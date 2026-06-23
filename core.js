'use strict';
// ============================================================
// CORE.JS — HRD & Legal IJEF Corp v5.0
// Firebase Config, Auth, Router, Helpers
// ============================================================

const firebaseConfig = {
  apiKey: 'AIzaSyAWlNi_iBOWxZBD6E20aHOSrRpPsirDdOM',
  authDomain: 'test-kesehatan-ijef-corp-7c278.firebaseapp.com',
  projectId: 'test-kesehatan-ijef-corp-7c278',
  storageBucket: 'test-kesehatan-ijef-corp-7c278.appspot.com',
  messagingSenderId: '48180557823',
  appId: '1:48180557823:web:47ea8db8126737dbc0d9ca',
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// ── FILE UPLOAD HELPER — Firebase Storage (max 100MB) ─────────
async function uploadFileToStorage(file, path) {
  if (!file) throw new Error('No file provided');
  if (file.size > 100 * 1024 * 1024) throw new Error('File terlalu besar (max 100MB)');
  const storageRef = storage.ref(path);
  const snapshot = await storageRef.put(file);
  const downloadURL = await snapshot.ref.getDownloadURL();
  return downloadURL;
}

async function deleteFileFromStorage(url) {
  if (!url || !url.includes('firebasestorage')) return;
  try {
    const fileRef = storage.refFromURL(url);
    await fileRef.delete();
  } catch (e) {
    console.warn('[Storage] Delete failed:', e.message);
  }
}

// ── FCM (Firebase Cloud Messaging) Push Notifications ──────────────────
// IMPORTANT: Replace this placeholder with your actual VAPID public key.
// Generate it in Firebase Console > Project Settings > Cloud Messaging >
// Web Push certificates > "Generate key pair". Without a valid key,
// getToken() will fail and push notifications will not work.
const VAPID_KEY =
  'BKGJy5_3Z0dSIifKhousIb_mp06c0-bLVcUcOq0HyOTnpHY65DuUJ4hpyz0xyO48bJgwBId_LPfM1Twcn_QGwUc';
let messagingInstance = null;

/**
 * Generate a simple hash string from an FCM token to use as a document ID.
 * This allows storing multiple device tokens per user.
 */
function hashToken(token) {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const chr = token.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

async function initFCM() {
  try {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
    if (!currentUser) return;

    // Request permission - retry if user dismisses
    var permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission not granted:', permission);
      return;
    }

    // Register the FCM service worker
    var swRegistration;
    try {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
    } catch (swErr) {
      console.warn('[FCM] Service Worker registration failed:', swErr.message);
      return;
    }

    messagingInstance = firebase.messaging();

    var token;
    try {
      token = await messagingInstance.getToken({
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swRegistration,
      });
    } catch (tokenErr) {
      console.warn('[FCM] getToken failed, retrying...', tokenErr.message);
      // Retry once after 2 seconds
      await new Promise(function (r) {
        setTimeout(r, 2000);
      });
      try {
        token = await messagingInstance.getToken({
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swRegistration,
        });
      } catch (e) {
        console.error('[FCM] getToken retry failed:', e.message);
        return;
      }
    }

    if (token) {
      console.log('[FCM] Token registered successfully');
      // Store FCM token in subcollection to support multiple devices per user.
      const tokenId = hashToken(token);
      await db
        .collection('hrd_fcm_tokens')
        .doc(currentUser.id)
        .collection('devices')
        .doc(tokenId)
        .set({
          token: token,
          userId: currentUser.id,
          userName: currentUser.nama,
          role: currentUser.role,
          departemen: currentUser.departemen || '',
          device: navigator.userAgent,
          updatedAt: new Date().toISOString(),
        });
    } else {
      console.warn('[FCM] No token received');
    }

    // Handle foreground messages
    messagingInstance.onMessage((payload) => {
      const notification = payload.notification || payload.data || {};
      var title = notification.title || payload.data?.title || 'IMS Notifikasi';
      var body = notification.body || payload.data?.body || '';
      playNotificationSound();
      showSystemNotification(title, body);
      showInAppNotification(title, body, '');
    });
  } catch (e) {
    console.warn('FCM init failed:', e);
  }
}

async function cleanupFCMToken(userId) {
  try {
    if (!userId) return;
    // Only delete the current device's token, not all devices.
    // Get the current token before deleting it, then remove its Firestore doc.
    if (messagingInstance) {
      const currentToken = await messagingInstance.getToken();
      if (currentToken) {
        const tokenId = hashToken(currentToken);
        await db
          .collection('hrd_fcm_tokens')
          .doc(userId)
          .collection('devices')
          .doc(tokenId)
          .delete();
      }
      await messagingInstance.deleteToken();
      messagingInstance = null;
    }
  } catch (e) {
    console.warn('FCM cleanup failed:', e);
  }
}

const ROLES = { admin: 6, bod: 5, head: 4, manager: 3, leader: 2, staff: 1 };

const DEFAULT_ACCOUNTS = [
  {
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    nama: 'Administrator',
    departemen: 'Management',
  },
];

let currentUser = null;
let currentPage = 'dashboard';
let unsubscribers = [];

async function initApp() {
  // Check if public portal (calon karyawan) via hash
  if (window.location.hash === '#calon' || window.location.hash.startsWith('#calon-')) {
    renderPublicPortalCalon();
    return;
  }
  // Shared portal link → arahkan ke login (tidak tampilkan data langsung)
  // Setelah login, user otomatis masuk ke portal mereka
  if (window.location.hash.startsWith('#portal-karyawan-')) {
    // Simpan info bahwa user datang dari shared link, lalu tampilkan login
    window._sharedPortalUser = window.location.hash.replace('#portal-karyawan-', '');
    window.location.hash = '';
  }
  await seedDefaultAccounts();
  const saved = localStorage.getItem('hrd_session');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      const adminRoles = ['admin', 'bod', 'head', 'manager'];
      currentPage = adminRoles.includes(currentUser.role) ? 'dashboard' : 'portal';
      renderApp();
    } catch (e) {
      renderLogin();
    }
  } else renderLogin();
}

async function seedDefaultAccounts() {
  const snap = await db.collection('hrd_users').limit(1).get();
  if (snap.empty) {
    const batch = db.batch();
    DEFAULT_ACCOUNTS.forEach((acc) => {
      batch.set(db.collection('hrd_users').doc(acc.username), {
        ...acc,
        status: 'aktif',
        createdAt: new Date().toISOString(),
        nip: generateNIP(),
      });
    });
    await batch.commit();
  }
}

async function doLogin(username, password) {
  const doc = await db.collection('hrd_users').doc(username).get();
  if (!doc.exists) throw new Error('Akun tidak ditemukan');
  const data = doc.data();
  if (data.password !== password) throw new Error('Password salah');
  if (data.status === 'nonaktif') throw new Error('Akun dinonaktifkan');
  currentUser = { id: doc.id, ...data };
  localStorage.setItem('hrd_session', JSON.stringify(currentUser));
  // Langsung ke beranda - admin/bod/head/manager get dashboard, leader/staff get portal
  const adminRoles = ['admin', 'bod', 'head', 'manager'];
  currentPage = adminRoles.includes(currentUser.role) ? 'dashboard' : 'portal';
  renderApp();
}

function doLogout() {
  // Capture userId before nulling currentUser to avoid race condition
  const userId = currentUser?.id;
  cleanupFCMToken(userId);
  currentUser = null;
  currentPage = 'dashboard';
  localStorage.removeItem('hrd_session');
  unsubscribers.forEach((fn) => fn());
  unsubscribers = [];
  renderLogin();
}

function hasAccess(minLevel) {
  return (ROLES[currentUser?.role] || 0) >= minLevel;
}

function renderLogin() {
  const logo = localStorage.getItem('ims_company_logo');
  const logoHtml = logo
    ? `<img src="${logo}" style="width:72px;height:72px;border-radius:50%;margin:0 auto 12px;display:block;object-fit:contain">`
    : '';
  document.getElementById('app').innerHTML = `
  <div class="login-page"><div class="login-box">
    ${logoHtml}
    <h2 style="color:#c62828">IMS</h2><p class="subtitle">IJEF Management System</p>
    <div class="form-group"><label>Username</label><input type="text" class="form-control" id="loginUser" placeholder="Username" onkeydown="if(event.key==='Enter')document.getElementById('loginPass').focus()"></div>
    <div class="form-group"><label>Password</label><input type="password" class="form-control" id="loginPass" placeholder="Password" onkeydown="if(event.key==='Enter')handleLogin()"></div>
    <button class="btn btn-primary" style="width:100%;padding:12px;font-size:.9rem;margin-top:8px;background:#1a1a1a;border:none" onclick="handleLogin()">Masuk</button>
    <p style="text-align:center;margin-top:16px;font-size:.75rem;color:#999">© 2026 LPK IJEF Corp — International Japan Eco-Future</p>
  </div></div>`;
  setTimeout(() => document.getElementById('loginUser')?.focus(), 100);
}

async function handleLogin() {
  const u = document.getElementById('loginUser').value.trim(),
    p = document.getElementById('loginPass').value;
  if (!u || !p) return toast('Isi username dan password', 'warning');
  try {
    await doLogin(u, p);
    toast(`Selamat datang, ${currentUser.nama}!`, 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

function renderApp() {
  const adminRoles = ['admin', 'bod', 'head', 'manager'];
  const isPortalUser = !adminRoles.includes(currentUser.role);
  document.getElementById('app').innerHTML = `
  <div class="sidebar" id="sidebar">
    <div class="logo">🏛️ <span>IMS</span></div>
    <nav>${buildNavItems(isPortalUser)}</nav>
    <div style="padding:16px 20px;border-top:1px solid rgba(255,255,255,.1)"><div style="font-size:.75rem;color:rgba(255,255,255,.5)">v5.0 — ${currentUser.nama}</div></div>
  </div>
  <div class="header">
    <button class="menu-btn" onclick="toggleSidebar()">☰</button>
    <div class="home-btn" onclick="navigateTo('${isPortalUser ? 'portal' : 'dashboard'}')" title="Beranda" style="cursor:pointer;font-size:1.3rem;margin-right:8px">🏠</div>
    <div class="title">${isPortalUser ? 'IMS Karyawan' : 'IMS (IJEF Management System)'}</div>
    <div class="notif-badge" onclick="navigateTo('notifikasi')" title="Notifikasi">🔔<span class="count" id="notifCount" style="display:none">0</span></div>
    <div class="user-info">
      <div class="avatar" style="cursor:pointer" onclick="viewUserProfile('${escHtml(currentUser.nama)}')">${currentUser.profilePic ? `<img src="${currentUser.profilePic}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : currentUser.nama.charAt(0)}</div>
      <span style="cursor:pointer" onclick="viewUserProfile('${escHtml(currentUser.nama)}')">${currentUser.nama}</span>
      <button class="btn btn-xs" style="background:rgba(255,255,255,.15);color:#fff" onclick="doLogout()">Keluar</button>
    </div>
  </div>
  <div class="main" id="mainContent"></div>`;
  navigateTo(currentPage);
  listenNotifications();
  initFCM();
  setupRealtimeSync();
  // Load company branding (logo)
  if (typeof loadCompanyBranding === 'function') loadCompanyBranding();
  // Refresh user data from Firestore (get latest profilePic etc)
  db.collection('hrd_users')
    .doc(currentUser.id)
    .get()
    .then((doc) => {
      if (!doc.exists) return;
      const d = doc.data();
      let changed = false;
      if (d.profilePic && d.profilePic !== currentUser.profilePic) {
        currentUser.profilePic = d.profilePic;
        changed = true;
      }
      if (d.departemen && d.departemen !== currentUser.departemen) {
        currentUser.departemen = d.departemen;
        changed = true;
      }
      if (d.posisi && d.posisi !== currentUser.posisi) {
        currentUser.posisi = d.posisi;
        changed = true;
      }
      if (changed) {
        localStorage.setItem('hrd_session', JSON.stringify(currentUser));
        const av = document.querySelector('.header .avatar');
        if (av && currentUser.profilePic)
          av.innerHTML = `<img src="${currentUser.profilePic}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
      }
    })
    .catch(() => {});
  // Auto-load national holidays if not yet populated
  autoLoadHariLiburNasional().catch(() => {});
  // Start task reminder checker
  if (typeof startTaskReminderCheck === 'function') startTaskReminderCheck();
}

function buildNavItems(isPortalUser) {
  if (isPortalUser) {
    // STAFF & LEADER portal
    let nav = '';
    nav += navGroup('🏠 Utama', [
      ['portal', '🏠', 'Beranda'],
      ['portal-absensi', '📍', 'Absensi'],
      ['portal-cuti', '🏖️', 'Cuti & Izin'],
      ['portal-overtime', '⏰', 'Overtime'],
      ['portal-perjalanan-dinas', '✈️', 'Perjalanan Dinas'],
      ['daily-task', '📋', 'Daily Task'],
    ]);
    nav += navGroup('💰 Keuangan', [
      ['portal-gaji', '💰', 'Slip Gaji'],
      ['portal-reimburse', '🧾', 'Reimburse'],
      ['portal-kasbon', '💳', 'Kasbon & Loan'],
    ]);
    nav += navGroup('💼 Pekerjaan', [
      ['portal-jobdesk', '📋', 'Jobdesk'],
      ['portal-disc', '🧠', 'DISC Test'],
      ['portal-kpi', '📈', 'KPI Saya'],
      ['portal-test-kesehatan', '🏥', 'Test Kesehatan'],
    ]);
    nav += navGroup('🏢 Organisasi', [
      ['portal-struktur', '🌳', 'Struktur Org'],
      ['portal-libur', '📅', 'Hari Libur'],
      ['portal-peraturan', '📜', 'Peraturan'],
    ]);
    nav += navGroup('💬 Komunikasi', [
      ['portal-pengumuman', '📢', 'Pengumuman'],
      ['portal-broadcast', '📡', 'Broadcast'],
      ['portal-meeting', '📅', 'Meeting'],
      ['portal-invite', '✉️', 'Undangan'],
      ['inbox', '📥', 'Inbox'],
      ['chat', '💬', 'Obrolan'],
    ]);
    // Leader gets approval access
    if (currentUser.role === 'leader')
      nav += navGroup('✅ Approval', [['approval-center', '✅', 'Approval Center']]);
    nav += navGroup('⚙️ Pengaturan', [
      ['portal-setting', '⚙️', 'Setting Akun'],
      ['panduan', '📖', 'Panduan Sistem'],
    ]);
    return nav;
  }
  // ADMIN / BOD / HEAD / MANAGER dashboard
  let nav = '';
  nav += navGroup('🏠 Utama', [
    ['dashboard', '🏠', 'Beranda'],
    ['approval-center', '✅', 'Approval Center'],
    ['notifikasi', '🔔', 'Notifikasi'],
    ['pengumuman', '📢', 'Pengumuman'],
  ]);
  nav += navGroup('🏢 Perusahaan', [
    ['departemen', '🏢', 'Departemen'],
    ['posisi', '💼', 'Posisi'],
    ['cabang', '🏛️', 'Cabang'],
  ]);
  nav += navGroup('👥 Karyawan', [
    ['karyawan', '👥', 'Data Karyawan'],
    ['struktur-org', '🌳', 'Struktur Org'],
    ['jobdesk-mgmt', '📋', 'Kelola Jobdesk'],
    ['onboarding', '🚀', 'Onboarding'],
    ['offboarding', '📦', 'Offboarding'],
    ['test-kesehatan', '🏥', 'Test Kesehatan'],
  ]);
  // Manager+ gets Rekrutmen
  if (hasAccess(3))
    nav += navGroup('🔍 Rekrutmen', [
      ['lowongan', '📝', 'Lowongan'],
      ['pipeline', '🔄', 'Pipeline Kanban'],
      ['kandidat', '🧑‍💼', 'Kandidat'],
    ]);
  nav += navGroup('📍 Kehadiran', [
    ['absensi', '📍', 'Absensi IJEF'],
    ['cuti', '🏖️', 'Cuti/Izin/WFH'],
    ['overtime', '⏰', 'Overtime'],
    ['perjalanan-dinas', '✈️', 'Perjalanan Dinas'],
    ['hari-libur', '📅', 'Hari Libur'],
    ['penalty', '⚠️', 'Penalty Point'],
    ['daily-task', '📋', 'Daily Task'],
  ]);
  nav += navGroup('💰 Keuangan', [
    ['penggajian', '💰', 'Penggajian'],
    ['tax-calc', '🧮', 'Tax & BPJS'],
    ['insentif', '🏆', 'Insentif'],
    ['reimbursement', '🧾', 'Reimbursement'],
    ['kasbon', '💳', 'Kasbon & Loan'],
    ['tunjangan', '🎁', 'Tunjangan'],
  ]);
  nav += navGroup('📈 Kinerja', [
    ['kpi', '📈', 'KPI & Penilaian'],
    ['pelatihan', '🎓', 'Pelatihan'],
    ['disc-test', '🧠', 'DISC Test'],
  ]);
  // Manager+ gets Legal & Aset
  if (hasAccess(3))
    nav += navGroup('📄 Legal & Aset', [
      ['kontrak', '📄', 'Kontrak'],
      ['asset', '💻', 'Asset'],
      ['peraturan', '📜', 'Peraturan'],
      ['surat', '✉️', 'Generator Surat'],
    ]);
  nav += navGroup('💬 Komunikasi', [
    ['meeting', '📅', 'Meeting & Invite'],
    ['chat', '💬', 'Obrolan Divisi'],
    ['broadcast', '📡', 'Broadcast'],
    ['inbox', '📥', 'Inbox Saya'],
  ]);
  // Manager+ gets QR & PWA, Admin gets full settings
  if (hasAccess(3)) nav += navGroup('🔗 Portal', [['portal-share', '🔗', 'Download Aplikasi']]);
  if (hasAccess(6)) {
    nav += navGroup('⚙️ Pengaturan', [
      ['akun', '👤', 'Manajemen Akun'],
      ['approval-mgmt', '⚙️', 'Approval Mgmt'],
      ['system-admin', '🔧', 'Reset & Backup'],
      ['qr-share', '📱', 'QR & PWA'],
      ['panduan', '📖', 'Panduan Sistem'],
    ]);
  } else if (hasAccess(3)) {
    nav += navGroup('⚙️ Pengaturan', [
      ['qr-share', '📱', 'QR & PWA'],
      ['panduan', '📖', 'Panduan Sistem'],
    ]);
  }
  return nav;
}

function navGroup(title, items) {
  const hasActive = items.some(([page]) => currentPage === page);
  let html = `<div class="nav-group"><div class="nav-group-title" onclick="toggleNavGroup(this)"><span>${title}</span><span class="nav-arrow${hasActive ? ' open' : ''}">⌵</span></div><div class="nav-group-items"${hasActive ? '' : ' style="display:none"'}>`;
  items.forEach(([page, icon, label]) => {
    html += `<div class="nav-item${currentPage === page ? ' active' : ''}" onclick="navigateTo('${page}')"><span class="icon">${icon}</span><span>${label}</span></div>`;
  });
  return html + '</div></div>';
}

function toggleNavGroup(el) {
  const items = el.nextElementSibling;
  const arrow = el.querySelector('.nav-arrow');
  if (!items) return;
  const isHidden = items.style.display === 'none';
  items.style.display = isHidden ? 'block' : 'none';
  if (arrow) arrow.classList.toggle('open', isHidden);
}

function navigateTo(page) {
  currentPage = page;
  unsubscribers.forEach((fn) => fn());
  unsubscribers = [];
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((el) => {
    if (el.getAttribute('onclick')?.includes(`'${page}'`)) el.classList.add('active');
  });
  // Auto-expand nav-group containing active page
  document.querySelectorAll('.nav-item.active').forEach((el) => {
    const groupItems = el.closest('.nav-group-items');
    if (groupItems) {
      groupItems.style.display = 'block';
      const arrow = groupItems.previousElementSibling?.querySelector('.nav-arrow');
      if (arrow) arrow.classList.add('open');
    }
  });
  const main = document.getElementById('mainContent');
  if (!main) return;
  closeSidebar();
  const routes = {
    dashboard: renderDashboard,
    departemen: renderDepartemen,
    posisi: renderPosisi,
    cabang: renderCabang,
    karyawan: renderKaryawan,
    'struktur-org': renderStrukturOrg,
    onboarding: renderOnboarding,
    offboarding: renderOffboarding,
    'jobdesk-mgmt': renderJobdeskMgmt,
    lowongan: renderLowongan,
    pipeline: renderPipeline,
    kandidat: renderKandidat,
    absensi: renderAbsensiAdmin,
    cuti: renderCuti,
    overtime: renderOvertime,
    'hari-libur': renderHariLibur,
    penalty: renderPenalty,
    penggajian: renderPenggajian,
    'tax-calc': renderTaxCalc,
    insentif: renderInsentif,
    'system-admin': renderSystemAdmin,
    reimbursement: renderReimbursement,
    kasbon: renderKasbon,
    tunjangan: renderTunjangan,
    kpi: renderKPI,
    pelatihan: renderPelatihan,
    'disc-test': renderDiscTestPage,
    kontrak: renderKontrak,
    asset: renderAsset,
    peraturan: renderPeraturan,
    surat: renderSurat,
    meeting: renderMeeting,
    chat: renderChat,
    broadcast: renderBroadcast,
    inbox: renderInbox,
    notifikasi: renderNotifikasi,
    pengumuman: renderPengumuman,
    akun: renderAkun,
    'approval-center': renderApprovalCenter,
    'approval-mgmt': renderApprovalMgmt,
    'qr-share': renderQRShare,
    portal: renderPortal,
    'portal-absensi': renderPortalAbsensi,
    'portal-cuti': renderPortalCuti,
    'portal-gaji': renderPortalGaji,
    'portal-jobdesk': renderPortalJobdesk,
    'portal-peraturan': renderPortalPeraturan,
    'portal-disc': renderPortalDisc,
    'portal-reimburse': renderPortalReimburse,
    'portal-kasbon': renderPortalKasbon,
    'portal-kpi': renderPortalKPI,
    'portal-struktur': renderStrukturOrg,
    'portal-libur': renderHariLibur,
    'portal-pengumuman': renderPortalPengumuman,
    'portal-broadcast': renderPortalBroadcast,
    'portal-meeting': renderPortalMeeting,
    'portal-invite': renderPortalInvite,
    'portal-overtime': renderPortalOvertime,
    'portal-setting': renderPortalSetting,
    'portal-share': renderPortalShare,
    'perjalanan-dinas': renderPerjalananDinas,
    'portal-perjalanan-dinas': renderPortalPerjalananDinas,
    'test-kesehatan': renderTestKesehatan,
    'portal-test-kesehatan': renderPortalTestKesehatan,
    'daily-task': renderDailyTask,
    panduan: renderPanduan,
  };
  const fn = routes[page];
  if (fn) fn();
  else
    main.innerHTML = `<div class="empty-state"><div class="icon">🚧</div><p>Halaman "${page}" dalam pengembangan</p></div>`;
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('overlaySidebar');
  if (sb) {
    sb.classList.toggle('open');
  }
  if (ov) {
    ov.classList.toggle('active');
  }
}
function closeSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('overlaySidebar');
  if (sb) {
    sb.classList.remove('open');
  }
  if (ov) {
    ov.classList.remove('active');
  }
}

function openModal(html, large) {
  const o = document.getElementById('modalOverlay'),
    c = document.getElementById('modalContent');
  c.className = 'modal' + (large ? ' modal-lg' : '');
  c.innerHTML = html;
  o.classList.add('active');
}
function closeModal(e) {
  if (e && e.target !== document.getElementById('modalOverlay')) return;
  document.getElementById('modalOverlay').classList.remove('active');
}
function closeModalDirect() {
  document.getElementById('modalOverlay').classList.remove('active');
}

function toast(msg, type = 'info') {
  const c = document.getElementById('toastContainer'),
    el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
function formatDate(d) {
  if (!d) return '-';
  const dt = typeof d === 'string' ? new Date(d) : d.toDate ? d.toDate() : new Date(d);
  return dt.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
function formatDateTime(d) {
  if (!d) return '-';
  const dt = typeof d === 'string' ? new Date(d) : d.toDate ? d.toDate() : new Date(d);
  return dt.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function formatCurrency(n) {
  return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}
function generateNIP() {
  return 'NIP' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100);
}
function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function monthStr() {
  return new Date().toISOString().slice(0, 7);
}
function getMonthDays(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function listenNotifications() {
  // Request notification permission on mobile
  requestNotifPermission();
  // Listen for notifications targeted to this user's ID (single-field query to avoid composite index)
  const unsub1 = db
    .collection('hrd_notifikasi')
    .where('targetUser', '==', currentUser.id)
    .onSnapshot((snap) => {
      updateNotifBadge();
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const d = change.doc.data();
          if (d.read === false) {
            // Only show popup for truly new notifications (created within last 30s)
            var created = d.createdAt ? new Date(d.createdAt) : null;
            var isRecent = created && new Date() - created < 60000;
            if (isRecent) {
              playNotificationSound();
              showSystemNotification(d.title || 'Notifikasi', d.message || '');
              showInAppNotification(d.title || 'Notifikasi', d.message || '', d.link || '');
            }
          }
        }
      });
    });
  unsubscribers.push(unsub1);
  // Also listen for notifications targeted to this user's role (e.g. 'hr', 'admin')
  const unsub2 = db
    .collection('hrd_notifikasi')
    .where('targetUser', '==', currentUser.role)
    .onSnapshot((snap) => {
      updateNotifBadge();
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const d = change.doc.data();
          if (d.read === false) {
            var created = d.createdAt ? new Date(d.createdAt) : null;
            var isRecent = created && new Date() - created < 60000;
            if (isRecent) {
              playNotificationSound();
              showInAppNotification(d.title || 'Notifikasi', d.message || '', d.link || '');
            }
          }
        }
      });
    });
  unsubscribers.push(unsub2);
  // Listen for broadcast messages
  const unsub3 = db.collection('hrd_broadcast').onSnapshot((snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === 'added' && change.doc.data().createdAt) {
        const created = new Date(change.doc.data().createdAt);
        const now = new Date();
        if (now - created < 30000) playNotificationSound(); // Only play for recent (30s)
      }
    });
  });
  unsubscribers.push(unsub3);
  // Listen for meeting invites (single-field query to avoid composite index)
  const unsub4 = db
    .collection('hrd_meeting_invites')
    .where('targetUser', '==', currentUser.id)
    .onSnapshot((snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const d = change.doc.data();
          if (d.read === false) playNotificationSound();
        }
      });
    });
  unsubscribers.push(unsub4);
  // Listen for new pengumuman
  const unsub5 = db.collection('hrd_pengumuman').onSnapshot((snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === 'added' && change.doc.data().createdAt) {
        const created = new Date(change.doc.data().createdAt);
        const now = new Date();
        if (now - created < 30000) playNotificationSound();
      }
    });
  });
  unsubscribers.push(unsub5);
  // Listen for new meeting
  const unsub6 = db.collection('hrd_meeting').onSnapshot((snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === 'added' && change.doc.data().createdAt) {
        const created = new Date(change.doc.data().createdAt);
        const now = new Date();
        if (now - created < 30000) playNotificationSound();
      }
    });
  });
  unsubscribers.push(unsub6);
  // Listen for chat messages
  const unsub7 = db.collection('hrd_chat').onSnapshot((snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === 'added' && change.doc.data().createdAt) {
        const d = change.doc.data();
        if (d.userId !== currentUser.id) {
          const created = new Date(d.createdAt);
          const now = new Date();
          if (now - created < 15000) playNotificationSound();
        }
      }
    });
  });
  unsubscribers.push(unsub7);
}

// ── NOTIFICATION SOUND — Loud & Clear ─────────────────────────
let _notifSoundCooldown = false;
let _notifAudioCtx = null;
let _audioUnlocked = false;
let _notifAudioEl = null;

// Create a reusable audio element with generated WAV (works better on mobile than Web Audio API)
function createNotifAudio() {
  if (_notifAudioEl) return _notifAudioEl;
  // Generate a short WAV notification sound programmatically
  const sampleRate = 22050;
  const duration = 1.2;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  // WAV header
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  // Generate tones: 3 ascending beeps
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let val = 0;
    // Beep 1: 0-0.15s (880Hz)
    if (t < 0.15) val = Math.sin(2 * Math.PI * 880 * t) * 0.9 * (1 - (t / 0.15) * 0.3);
    // Beep 2: 0.18-0.33s (1109Hz)
    else if (t >= 0.18 && t < 0.33)
      val = Math.sin(2 * Math.PI * 1109 * t) * 0.9 * (1 - ((t - 0.18) / 0.15) * 0.3);
    // Beep 3: 0.36-0.55s (1319Hz)
    else if (t >= 0.36 && t < 0.55)
      val = Math.sin(2 * Math.PI * 1319 * t) * 0.95 * (1 - ((t - 0.36) / 0.19) * 0.5);
    // Repeat: Beep 4-6
    else if (t >= 0.6 && t < 0.75) val = Math.sin(2 * Math.PI * 880 * t) * 0.9;
    else if (t >= 0.78 && t < 0.93) val = Math.sin(2 * Math.PI * 1109 * t) * 0.9;
    else if (t >= 0.96 && t < 1.2)
      val = Math.sin(2 * Math.PI * 1568 * t) * 1.0 * (1 - ((t - 0.96) / 0.24) * 0.6);
    view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.floor(val * 32767))), true);
  }
  const blob = new Blob([buffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  _notifAudioEl = new Audio(url);
  _notifAudioEl.volume = 1.0;
  return _notifAudioEl;
}

function getAudioContext() {
  if (!_notifAudioCtx || _notifAudioCtx.state === 'closed') {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    _notifAudioCtx = new AudioCtx();
  }
  if (_notifAudioCtx.state === 'suspended') _notifAudioCtx.resume();
  return _notifAudioCtx;
}

function unlockAudio() {
  if (_audioUnlocked) return;
  try {
    // Method 1: Unlock Web Audio API
    const ctx = getAudioContext();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    // Method 2: Unlock HTML5 Audio element (critical for iOS)
    const audio = createNotifAudio();
    audio.muted = true;
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.muted = false;
        audio.currentTime = 0;
      })
      .catch(() => {});
    _audioUnlocked = true;
  } catch (e) {}
}

function playNotificationSound() {
  if (_notifSoundCooldown) return;
  _notifSoundCooldown = true;
  setTimeout(() => {
    _notifSoundCooldown = false;
  }, 3000);
  // Vibrate on mobile
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300]);
  // Method 1: HTML5 Audio (most reliable on mobile)
  try {
    const audio = createNotifAudio();
    audio.currentTime = 0;
    audio.volume = 1.0;
    audio.play().catch(() => {
      // Fallback: Web Audio API
      playNotifWebAudio();
    });
  } catch (e) {
    playNotifWebAudio();
  }
}

function playNotifWebAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const playTone = (freq, startTime, duration, vol) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
      gain.gain.setValueAtTime(vol || 1.0, ctx.currentTime + startTime);
      gain.gain.setValueAtTime(vol || 1.0, ctx.currentTime + startTime + duration * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };
    playTone(880, 0, 0.12, 1.0);
    playTone(1109, 0.12, 0.12, 1.0);
    playTone(1319, 0.24, 0.25, 1.0);
    playTone(880, 0.55, 0.12, 1.0);
    playTone(1109, 0.67, 0.12, 1.0);
    playTone(1568, 0.79, 0.3, 1.0);
  } catch (e) {}
}

// Unlock audio on ANY user interaction (critical for mobile)
['click', 'touchstart', 'touchend', 'keydown'].forEach((evt) => {
  document.addEventListener(evt, unlockAudio, { once: false, passive: true });
});
// Request notification permission for mobile (enables audio + system notifications)
function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then((p) => {
      if (p === 'granted') console.log('Notification permission granted');
    });
  }
}
// Show system notification (works even when tab is in background on mobile)
function showSystemNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🏛️</text></svg>',
        vibrate: [200, 100, 200],
      });
    } catch (e) {}
  }
}

function showInAppNotification(title, message, link) {
  var container = document.getElementById('inAppNotifContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'inAppNotifContainer';
    container.style.cssText =
      'position:fixed;top:16px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:10px;max-width:360px;width:calc(100% - 32px);pointer-events:none';
    document.body.appendChild(container);
  }
  var popup = document.createElement('div');
  popup.style.cssText =
    'background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.15);padding:14px 16px;display:flex;gap:12px;align-items:flex-start;pointer-events:auto;cursor:pointer;border-left:4px solid #1565c0;transition:transform .3s ease,opacity .3s ease';
  popup.innerHTML =
    '<div style="font-size:1.4rem;flex-shrink:0">\u{1F514}</div><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:.88rem;color:#1a1a1a;margin-bottom:2px">' +
    escHtml(title) +
    '</div><div style="font-size:.8rem;color:#555;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">' +
    escHtml(message) +
    '</div></div><button onclick="this.parentElement.remove()" style="background:none;border:none;font-size:1.1rem;cursor:pointer;color:#999;padding:0;line-height:1">\u00d7</button>';
  popup.onclick = function (e) {
    if (e.target.tagName === 'BUTTON') return;
    popup.remove();
    if (link) navigateTo(link);
    else navigateTo('notifikasi');
  };
  container.appendChild(popup);
  setTimeout(function () {
    if (popup.parentElement) {
      popup.style.transform = 'translateX(120%)';
      popup.style.opacity = '0';
      setTimeout(function () {
        popup.remove();
      }, 300);
    }
  }, 6000);
}

async function updateNotifBadge() {
  const [s1, s2] = await Promise.all([
    db.collection('hrd_notifikasi').where('targetUser', '==', currentUser.id).get(),
    db.collection('hrd_notifikasi').where('targetUser', '==', currentUser.role).get(),
  ]);
  let count = 0;
  s1.forEach((d) => {
    if (d.data().read === false) count++;
  });
  s2.forEach((d) => {
    if (d.data().read === false) count++;
  });
  const badge = document.getElementById('notifCount');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'block' : 'none';
  }
}

async function sendNotification(targetUser, title, message, link) {
  await db.collection('hrd_notifikasi').add({
    targetUser,
    title,
    message,
    link: link || '',
    read: false,
    createdAt: new Date().toISOString(),
  });
}
async function sendNotificationBulk(userIds, title, message, link) {
  const batch = db.batch();
  userIds.forEach((uid) => {
    const ref = db.collection('hrd_notifikasi').doc();
    batch.set(ref, {
      targetUser: uid,
      title,
      message,
      link: link || '',
      read: false,
      createdAt: new Date().toISOString(),
    });
  });
  await batch.commit();
}

// Get all active user accounts
async function getAllUsers() {
  const snap = await db.collection('hrd_users').where('status', '==', 'aktif').get();
  const users = [];
  snap.forEach((d) => users.push({ id: d.id, ...d.data() }));
  return users;
}

// ── PWA INSTALL PROMPT ─────────────────────────────────────────
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  // Show install button if visible
  const btn = document.getElementById('btnInstallPWA');
  if (btn) btn.style.display = 'inline-flex';
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  toast('✅ Aplikasi berhasil diinstall!', 'success');
  const btn = document.getElementById('btnInstallPWA');
  if (btn) btn.style.display = 'none';
});

function triggerInstallPWA() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((result) => {
      if (result.outcome === 'accepted') toast('✅ Aplikasi diinstall!', 'success');
      deferredInstallPrompt = null;
    });
  } else {
    // Fallback instructions
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    if (isIOS) {
      toast('iOS: Tap Share (📈) → "Add to Home Screen"', 'info');
    } else if (isAndroid) {
      toast('Android: Tap Menu (⋮) → "Add to Home Screen"', 'info');
    } else {
      toast('Klik ikon install ([+]) di address bar browser Anda', 'info');
    }
  }
}

if ('serviceWorker' in navigator) {
  // Only unregister service workers that are NOT firebase-messaging-sw.js
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => {
      if (r.active && r.active.scriptURL.includes('firebase-messaging-sw.js')) return;
      r.unregister();
    });
  });
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
document.addEventListener('DOMContentLoaded', initApp);

// ── REAL-TIME SYNC: Auto-refresh current page when data changes ───
function setupRealtimeSync() {
  // Listen to key collections and refresh current page when changes detected
  const watchCollections = [
    'hrd_karyawan',
    'hrd_absensi',
    'hrd_disc_results',
    'hrd_notifikasi',
    'hrd_pengumuman',
    'hrd_kandidat',
    'hrd_cuti',
  ];
  watchCollections.forEach((col) => {
    const unsub = db.collection(col).onSnapshot(
      () => {
        // Update notification badge always
        if (currentUser) updateNotifBadge();
      },
      () => {}
    );
    unsubscribers.push(unsub);
  });

  // Listen for benefit config changes (invalidate cache so portals auto-update)
  const unsubBenefit = db
    .collection('hrd_config_benefit')
    .doc('current')
    .onSnapshot(
      () => {
        if (typeof invalidateBenefitCache === 'function') invalidateBenefitCache();
      },
      () => {}
    );
  unsubscribers.push(unsubBenefit);
}
