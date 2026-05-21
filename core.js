'use strict';
// ============================================================
// CORE.JS — HRD & Legal IJEF Corp v5.0
// Firebase Config, Auth, Router, Helpers
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyAWlNi_iBOWxZBD6E20aHOSrRpPsirDdOM",
  authDomain: "test-kesehatan-ijef-corp-7c278.firebaseapp.com",
  projectId: "test-kesehatan-ijef-corp-7c278",
  storageBucket: "test-kesehatan-ijef-corp-7c278.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const ROLES = { superadmin:5, admin:4, hr:3, legal:3, manager:2, karyawan:1 };

const DEFAULT_ACCOUNTS = [
  { username:'superadmin', password:'super2026', role:'superadmin', nama:'Super Admin', departemen:'Management' },
  { username:'admin', password:'admin123', role:'admin', nama:'Administrator', departemen:'IT' },
  { username:'hr', password:'hr123', role:'hr', nama:'HR Manager', departemen:'HRD' },
  { username:'legal', password:'legal123', role:'legal', nama:'Legal Officer', departemen:'Legal' },
  { username:'benoegila', password:'ryanbenoe21', role:'karyawan', nama:'Ryan Benoe', departemen:'Operasional' },
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
    window._sharedPortalUser = window.location.hash.replace('#portal-karyawan-','');
    window.location.hash = '';
  }
  await seedDefaultAccounts();
  const saved = localStorage.getItem('hrd_session');
  if (saved) { try { currentUser = JSON.parse(saved); renderApp(); } catch(e) { renderLogin(); } }
  else renderLogin();
}

async function seedDefaultAccounts() {
  const snap = await db.collection('hrd_users').limit(1).get();
  if (snap.empty) {
    const batch = db.batch();
    DEFAULT_ACCOUNTS.forEach(acc => {
      batch.set(db.collection('hrd_users').doc(acc.username), { ...acc, status:'aktif', createdAt:new Date().toISOString(), nip:generateNIP() });
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
  currentPage = currentUser.role === 'karyawan' ? 'portal' : 'dashboard';
  renderApp();
}

function doLogout() {
  currentUser = null; currentPage = 'dashboard';
  localStorage.removeItem('hrd_session');
  unsubscribers.forEach(fn => fn()); unsubscribers = [];
  renderLogin();
}

function hasAccess(minLevel) { return (ROLES[currentUser?.role]||0) >= minLevel; }

function renderLogin() {
  document.getElementById('app').innerHTML = `
  <div class="login-page"><div class="login-box">
    <h2>[OFFICE] IJEF Corp</h2><p class="subtitle">HRD & Legal System v5.0</p>
    <div class="form-group"><label>Username</label><input type="text" class="form-control" id="loginUser" placeholder="Username" onkeydown="if(event.key==='Enter')document.getElementById('loginPass').focus()"></div>
    <div class="form-group"><label>Password</label><input type="password" class="form-control" id="loginPass" placeholder="Password" onkeydown="if(event.key==='Enter')handleLogin()"></div>
    <button class="btn btn-primary" style="width:100%;padding:12px;font-size:.9rem;margin-top:8px" onclick="handleLogin()">Masuk</button>
    <p style="text-align:center;margin-top:16px;font-size:.75rem;color:#999">© 2026 LPK IJEF Corp</p>
  </div></div>`;
  setTimeout(()=>document.getElementById('loginUser')?.focus(),100);
}

async function handleLogin() {
  const u=document.getElementById('loginUser').value.trim(), p=document.getElementById('loginPass').value;
  if(!u||!p) return toast('Isi username dan password','warning');
  try { await doLogin(u,p); toast(`Selamat datang, ${currentUser.nama}!`,'success'); }
  catch(e) { toast(e.message,'error'); }
}

function renderApp() {
  const isKaryawan = currentUser.role === 'karyawan';
  document.getElementById('app').innerHTML = `
  <div class="sidebar" id="sidebar">
    <div class="logo">[OFFICE] <span>IJEF Corp HRD</span></div>
    <nav>${buildNavItems(isKaryawan)}</nav>
    <div style="padding:16px 20px;border-top:1px solid rgba(255,255,255,.1)"><div style="font-size:.75rem;color:rgba(255,255,255,.5)">v5.0 — ${currentUser.nama}</div></div>
  </div>
  <div class="header">
    <button class="menu-btn" onclick="toggleSidebar()">=</button>
    <div class="title">HRD & Legal IJEF Corp</div>
    <div class="notif-badge" onclick="navigateTo('notifikasi')" title="Notifikasi">[BELL]<span class="count" id="notifCount" style="display:none">0</span></div>
    <div class="user-info">
      <div class="avatar">${currentUser.nama.charAt(0)}</div>
      <span>${currentUser.nama}</span>
      <button class="btn btn-xs" style="background:rgba(255,255,255,.15);color:#fff" onclick="doLogout()">Keluar</button>
    </div>
  </div>
  <div class="main" id="mainContent"></div>`;
  navigateTo(currentPage);
  listenNotifications();
}

function buildNavItems(isKaryawan) {
  if (isKaryawan) {
    return navGroup('Portal Saya',[['portal','[HOME]','Beranda'],['portal-absensi','[PIN]','Absensi'],['portal-cuti','[LEAVE]','Cuti & Izin'],['portal-gaji','[MONEY]','Slip Gaji'],['portal-jobdesk','[LIST]','Jobdesk'],['portal-peraturan','[SCROLL]','Peraturan'],['inbox','[INBOX]','Inbox Meeting'],['chat','[CHAT]','Obrolan']]);
  }
  let nav='';
  nav+=navGroup('Utama',[['dashboard','[CHART]','Dashboard'],['approval-center','[OK]','Approval Center'],['notifikasi','[BELL]','Notifikasi'],['pengumuman','[ANNOUNCE]','Pengumuman']]);
  nav+=navGroup('Perusahaan',[['departemen','[DEPT]','Departemen'],['posisi','[JOB]','Posisi'],['cabang','[OFFICE]','Cabang']]);
  nav+=navGroup('Karyawan',[['karyawan','[USERS]','Data Karyawan'],['struktur-org','[TREE]','Struktur Org'],['jobdesk-mgmt','[LIST]','Kelola Jobdesk'],['onboarding','[START]','Onboarding'],['offboarding','[BOX]','Offboarding']]);
  nav+=navGroup('Rekrutmen',[['lowongan','[NOTE]','Lowongan'],['pipeline','[SYNC]','Pipeline Kanban'],['kandidat','🧑‍[JOB]','Kandidat']]);
  nav+=navGroup('Kehadiran',[['absensi','[PIN]','Absensi IJEF'],['cuti','[LEAVE]','Cuti/Izin/WFH'],['overtime','[CLOCK]','Overtime'],['hari-libur','[CAL]','Hari Libur'],['penalty','[WARN]','Penalty Point']]);
  nav+=navGroup('Keuangan',[['penggajian','[MONEY]','Penggajian'],['reimbursement','[RECEIPT]','Reimbursement'],['kasbon','[CARD]','Kasbon & Loan'],['tunjangan','[GIFT]','Tunjangan']]);
  nav+=navGroup('Kinerja',[['kpi','[UP]','KPI & Penilaian'],['pelatihan','[GRAD]','Pelatihan']]);
  nav+=navGroup('Legal & Aset',[['kontrak','[DOC]','Kontrak'],['asset','[PC]','Asset'],['peraturan','[SCROLL]','Peraturan'],['surat','[MAIL]','Generator Surat']]);
  nav+=navGroup('Komunikasi',[['meeting','[CAL]','Meeting & Invite'],['chat','[CHAT]','Obrolan Divisi'],['broadcast','[BROADCAST]','Broadcast'],['inbox','[INBOX]','Inbox Saya']]);
  nav+=navGroup('Portal',[['portal-share','[LINK]','Download Aplikasi']]);
  nav+=navGroup('Pengaturan',[['akun','[USER]','Manajemen Akun'],['approval-mgmt','[SETTING]','Approval Mgmt'],['qr-share','[PHONE]','QR & PWA']]);
  return nav;
}

function navGroup(title, items) {
  let html=`<div class="nav-group"><div class="nav-group-title">${title}</div>`;
  items.forEach(([page,icon,label])=>{html+=`<div class="nav-item${currentPage===page?' active':''}" onclick="navigateTo('${page}')"><span class="icon">${icon}</span><span>${label}</span></div>`;});
  return html+'</div>';
}

function navigateTo(page) {
  currentPage = page;
  unsubscribers.forEach(fn=>fn()); unsubscribers=[];
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el=>{if(el.getAttribute('onclick')?.includes(`'${page}'`))el.classList.add('active');});
  const main=document.getElementById('mainContent'); if(!main)return;
  closeSidebar();
  const routes={
    'dashboard':renderDashboard,'departemen':renderDepartemen,'posisi':renderPosisi,'cabang':renderCabang,
    'karyawan':renderKaryawan,'struktur-org':renderStrukturOrg,'onboarding':renderOnboarding,'offboarding':renderOffboarding,'jobdesk-mgmt':renderJobdeskMgmt,
    'lowongan':renderLowongan,'pipeline':renderPipeline,'kandidat':renderKandidat,
    'absensi':renderAbsensiAdmin,'cuti':renderCuti,'overtime':renderOvertime,'hari-libur':renderHariLibur,'penalty':renderPenalty,
    'penggajian':renderPenggajian,'reimbursement':renderReimbursement,'kasbon':renderKasbon,'tunjangan':renderTunjangan,
    'kpi':renderKPI,'pelatihan':renderPelatihan,
    'kontrak':renderKontrak,'asset':renderAsset,'peraturan':renderPeraturan,'surat':renderSurat,
    'meeting':renderMeeting,'chat':renderChat,'broadcast':renderBroadcast,'inbox':renderInbox,
    'notifikasi':renderNotifikasi,'pengumuman':renderPengumuman,
    'akun':renderAkun,'approval-center':renderApprovalCenter,'approval-mgmt':renderApprovalMgmt,'qr-share':renderQRShare,
    'portal':renderPortal,'portal-absensi':renderPortalAbsensi,'portal-cuti':renderPortalCuti,
    'portal-gaji':renderPortalGaji,'portal-jobdesk':renderPortalJobdesk,'portal-peraturan':renderPortalPeraturan,
    'portal-share':renderPortalShare,
  };
  const fn=routes[page];
  if(fn)fn(); else main.innerHTML=`<div class="empty-state"><div class="icon">🚧</div><p>Halaman "${page}" dalam pengembangan</p></div>`;
}

function toggleSidebar(){document.getElementById('sidebar')?.classList.toggle('open');document.getElementById('overlaySidebar')?.classList.toggle('active');}
function closeSidebar(){document.getElementById('sidebar')?.classList.remove('open');document.getElementById('overlaySidebar')?.classList.remove('active');}

function openModal(html,large){const o=document.getElementById('modalOverlay'),c=document.getElementById('modalContent');c.className='modal'+(large?' modal-lg':'');c.innerHTML=html;o.classList.add('active');}
function closeModal(e){if(e&&e.target!==document.getElementById('modalOverlay'))return;document.getElementById('modalOverlay').classList.remove('active');}
function closeModalDirect(){document.getElementById('modalOverlay').classList.remove('active');}

function toast(msg,type='info'){const c=document.getElementById('toastContainer'),el=document.createElement('div');el.className=`toast toast-${type}`;el.textContent=msg;c.appendChild(el);setTimeout(()=>el.remove(),3500);}

function escHtml(str){const d=document.createElement('div');d.textContent=str||'';return d.innerHTML;}
function formatDate(d){if(!d)return'-';const dt=typeof d==='string'?new Date(d):d.toDate?d.toDate():new Date(d);return dt.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});}
function formatDateTime(d){if(!d)return'-';const dt=typeof d==='string'?new Date(d):d.toDate?d.toDate():new Date(d);return dt.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function formatCurrency(n){return'Rp '+(Number(n)||0).toLocaleString('id-ID');}
function generateId(){return Date.now().toString(36)+Math.random().toString(36).substr(2,6);}
function generateNIP(){return'NIP'+Date.now().toString().slice(-8)+Math.floor(Math.random()*100);}
function todayStr(){return new Date().toISOString().split('T')[0];}
function monthStr(){return new Date().toISOString().slice(0,7);}
function getMonthDays(ym){const[y,m]=ym.split('-').map(Number);return new Date(y,m,0).getDate();}

function listenNotifications(){
  // Listen for notifications targeted to this user's ID
  const unsub1=db.collection('hrd_notifikasi').where('targetUser','==',currentUser.id).where('read','==',false).onSnapshot(snap=>{
    updateNotifBadge();
  });
  unsubscribers.push(unsub1);
  // Also listen for notifications targeted to this user's role (e.g. 'hr', 'admin')
  const unsub2=db.collection('hrd_notifikasi').where('targetUser','==',currentUser.role).where('read','==',false).onSnapshot(snap=>{
    updateNotifBadge();
  });
  unsubscribers.push(unsub2);
}

async function updateNotifBadge(){
  const[s1,s2]=await Promise.all([
    db.collection('hrd_notifikasi').where('targetUser','==',currentUser.id).where('read','==',false).get(),
    db.collection('hrd_notifikasi').where('targetUser','==',currentUser.role).where('read','==',false).get()
  ]);
  const count=s1.size+s2.size;
  const badge=document.getElementById('notifCount');
  if(badge){badge.textContent=count;badge.style.display=count>0?'block':'none';}
}

async function sendNotification(targetUser, title, message, link) {
  await db.collection('hrd_notifikasi').add({ targetUser, title, message, link:link||'', read:false, createdAt:new Date().toISOString() });
}
async function sendNotificationBulk(userIds, title, message, link) {
  const batch=db.batch();
  userIds.forEach(uid=>{const ref=db.collection('hrd_notifikasi').doc();batch.set(ref,{targetUser:uid,title,message,link:link||'',read:false,createdAt:new Date().toISOString()});});
  await batch.commit();
}

// Get all active user accounts
async function getAllUsers() {
  const snap=await db.collection('hrd_users').where('status','==','aktif').get();
  const users=[];snap.forEach(d=>users.push({id:d.id,...d.data()}));return users;
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
  toast('[OK] Aplikasi berhasil diinstall!', 'success');
  const btn = document.getElementById('btnInstallPWA');
  if (btn) btn.style.display = 'none';
});

function triggerInstallPWA() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(result => {
      if (result.outcome === 'accepted') toast('[OK] Aplikasi diinstall!', 'success');
      deferredInstallPrompt = null;
    });
  } else {
    // Fallback instructions
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    if (isIOS) {
      toast('iOS: Tap Share ([UP]) → "Add to Home Screen"', 'info');
    } else if (isAndroid) {
      toast('Android: Tap Menu (⋮) → "Add to Home Screen"', 'info');
    } else {
      toast('Klik ikon install ([+]) di address bar browser Anda', 'info');
    }
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
document.addEventListener('DOMContentLoaded', initApp);
