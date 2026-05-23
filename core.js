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
  // Langsung ke beranda
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
    <h2>🏛️ IJEF Corp</h2><p class="subtitle">HRD & Legal System v5.0</p>
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
    <div class="logo">🏛️ <span>IJEF Corp HRD</span></div>
    <nav>${buildNavItems(isKaryawan)}</nav>
    <div style="padding:16px 20px;border-top:1px solid rgba(255,255,255,.1)"><div style="font-size:.75rem;color:rgba(255,255,255,.5)">v5.0 — ${currentUser.nama}</div></div>
  </div>
  <div class="header">
    <button class="menu-btn" onclick="toggleSidebar()">☰</button>
    <div class="home-btn" onclick="navigateTo('${isKaryawan?'portal':'dashboard'}')" title="Beranda" style="cursor:pointer;font-size:1.3rem;margin-right:8px">🏠</div>
    <div class="title">HRD & Legal IJEF Corp</div>
    <div class="notif-badge" onclick="navigateTo('notifikasi')" title="Notifikasi">🔔<span class="count" id="notifCount" style="display:none">0</span></div>
    <div class="user-info">
      <div class="avatar">${currentUser.nama.charAt(0)}</div>
      <span>${currentUser.nama}</span>
      <button class="btn btn-xs" style="background:rgba(255,255,255,.15);color:#fff" onclick="doLogout()">Keluar</button>
    </div>
  </div>
  <div class="main" id="mainContent"></div>`;
  navigateTo(currentPage);
  listenNotifications();
  setupRealtimeSync();
  // Auto-load national holidays if not yet populated
  autoLoadHariLiburNasional().catch(()=>{});
}

function buildNavItems(isKaryawan) {
  if (isKaryawan) {
    let nav='';
    nav+=navGroup('Utama',[['portal','🏠','Beranda'],['portal-absensi','📍','Absensi'],['portal-cuti','🏖️','Cuti & Izin']]);
    nav+=navGroup('Keuangan',[['portal-gaji','💰','Slip Gaji'],['portal-reimburse','🧾','Reimburse'],['portal-kasbon','💳','Kasbon & Loan']]);
    nav+=navGroup('Pekerjaan',[['portal-jobdesk','📋','Jobdesk'],['portal-disc','🧠','DISC Test'],['portal-kpi','📈','KPI Saya']]);
    nav+=navGroup('Organisasi',[['portal-struktur','🌳','Struktur Org'],['portal-libur','📅','Hari Libur'],['portal-peraturan','📜','Peraturan']]);
    nav+=navGroup('Komunikasi',[['portal-pengumuman','📢','Pengumuman'],['portal-broadcast','📡','Broadcast'],['portal-meeting','📅','Meeting'],['portal-invite','✉️','Undangan'],['inbox','📥','Inbox'],['chat','💬','Obrolan']]);
    nav+=navGroup('Pengaturan',[['portal-setting','⚙️','Setting Akun']]);
    return nav;
  }
  let nav='';
  nav+=navGroup('Utama',[['dashboard','📊','Dashboard'],['approval-center','✅','Approval Center'],['notifikasi','🔔','Notifikasi'],['pengumuman','📢','Pengumuman']]);
  nav+=navGroup('Perusahaan',[['departemen','🏢','Departemen'],['posisi','💼','Posisi'],['cabang','🏛️','Cabang']]);
  nav+=navGroup('Karyawan',[['karyawan','👥','Data Karyawan'],['struktur-org','🌳','Struktur Org'],['jobdesk-mgmt','📋','Kelola Jobdesk'],['onboarding','🚀','Onboarding'],['offboarding','📦','Offboarding']]);
  nav+=navGroup('Rekrutmen',[['lowongan','📝','Lowongan'],['pipeline','🔄','Pipeline Kanban'],['kandidat','🧑‍💼','Kandidat']]);
  nav+=navGroup('Kehadiran',[['absensi','📍','Absensi IJEF'],['cuti','🏖️','Cuti/Izin/WFH'],['overtime','⏰','Overtime'],['hari-libur','📅','Hari Libur'],['penalty','⚠️','Penalty Point']]);
  nav+=navGroup('Keuangan',[['penggajian','💰','Penggajian'],['insentif','🏆','Insentif'],['reimbursement','🧾','Reimbursement'],['kasbon','💳','Kasbon & Loan'],['tunjangan','🎁','Tunjangan']]);
  nav+=navGroup('Kinerja',[['kpi','📈','KPI & Penilaian'],['pelatihan','🎓','Pelatihan'],['disc-test','🧠','DISC Test']]);
  nav+=navGroup('Legal & Aset',[['kontrak','📄','Kontrak'],['asset','💻','Asset'],['peraturan','📜','Peraturan'],['surat','✉️','Generator Surat']]);
  nav+=navGroup('Komunikasi',[['meeting','📅','Meeting & Invite'],['chat','💬','Obrolan Divisi'],['broadcast','📡','Broadcast'],['inbox','📥','Inbox Saya']]);
  nav+=navGroup('Portal',[['portal-share','🔗','Download Aplikasi']]);
  nav+=navGroup('Pengaturan',[['akun','👤','Manajemen Akun'],['approval-mgmt','⚙️','Approval Mgmt'],['qr-share','📱','QR & PWA']]);
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
    'penggajian':renderPenggajian,'insentif':renderInsentif,'reimbursement':renderReimbursement,'kasbon':renderKasbon,'tunjangan':renderTunjangan,
    'kpi':renderKPI,'pelatihan':renderPelatihan,'disc-test':renderDiscTestPage,
    'kontrak':renderKontrak,'asset':renderAsset,'peraturan':renderPeraturan,'surat':renderSurat,
    'meeting':renderMeeting,'chat':renderChat,'broadcast':renderBroadcast,'inbox':renderInbox,
    'notifikasi':renderNotifikasi,'pengumuman':renderPengumuman,
    'akun':renderAkun,'approval-center':renderApprovalCenter,'approval-mgmt':renderApprovalMgmt,'qr-share':renderQRShare,
    'portal':renderPortal,'portal-absensi':renderPortalAbsensi,'portal-cuti':renderPortalCuti,
    'portal-gaji':renderPortalGaji,'portal-jobdesk':renderPortalJobdesk,'portal-peraturan':renderPortalPeraturan,
    'portal-disc':renderPortalDisc,'portal-reimburse':renderPortalReimburse,'portal-kasbon':renderPortalKasbon,
    'portal-kpi':renderPortalKPI,'portal-struktur':renderStrukturOrg,'portal-libur':renderHariLibur,
    'portal-pengumuman':renderPortalPengumuman,'portal-broadcast':renderPortalBroadcast,
    'portal-meeting':renderPortalMeeting,'portal-invite':renderPortalInvite,
    'portal-setting':renderPortalSetting,'portal-share':renderPortalShare,
  };
  const fn=routes[page];
  if(fn)fn(); else main.innerHTML=`<div class="empty-state"><div class="icon">🚧</div><p>Halaman "${page}" dalam pengembangan</p></div>`;
}

function toggleSidebar(){
  const sb=document.getElementById('sidebar');
  const ov=document.getElementById('overlaySidebar');
  if(sb){sb.classList.toggle('open');}
  if(ov){ov.classList.toggle('active');}
}
function closeSidebar(){
  const sb=document.getElementById('sidebar');
  const ov=document.getElementById('overlaySidebar');
  if(sb){sb.classList.remove('open');}
  if(ov){ov.classList.remove('active');}
}

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
    // Play sound for new notifications
    snap.docChanges().forEach(change=>{
      if(change.type==='added') playNotificationSound();
    });
  });
  unsubscribers.push(unsub1);
  // Also listen for notifications targeted to this user's role (e.g. 'hr', 'admin')
  const unsub2=db.collection('hrd_notifikasi').where('targetUser','==',currentUser.role).where('read','==',false).onSnapshot(snap=>{
    updateNotifBadge();
    snap.docChanges().forEach(change=>{
      if(change.type==='added') playNotificationSound();
    });
  });
  unsubscribers.push(unsub2);
  // Listen for broadcast messages
  const unsub3=db.collection('hrd_broadcast').onSnapshot(snap=>{
    snap.docChanges().forEach(change=>{
      if(change.type==='added'&&change.doc.data().createdAt){
        const created=new Date(change.doc.data().createdAt);
        const now=new Date();
        if((now-created)<30000) playNotificationSound(); // Only play for recent (30s)
      }
    });
  });
  unsubscribers.push(unsub3);
  // Listen for meeting invites
  const unsub4=db.collection('hrd_meeting_invites').where('targetUser','==',currentUser.id).where('read','==',false).onSnapshot(snap=>{
    snap.docChanges().forEach(change=>{
      if(change.type==='added') playNotificationSound();
    });
  });
  unsubscribers.push(unsub4);
  // Listen for new pengumuman
  const unsub5=db.collection('hrd_pengumuman').onSnapshot(snap=>{
    snap.docChanges().forEach(change=>{
      if(change.type==='added'&&change.doc.data().createdAt){
        const created=new Date(change.doc.data().createdAt);
        const now=new Date();
        if((now-created)<30000) playNotificationSound();
      }
    });
  });
  unsubscribers.push(unsub5);
  // Listen for new meeting
  const unsub6=db.collection('hrd_meeting').onSnapshot(snap=>{
    snap.docChanges().forEach(change=>{
      if(change.type==='added'&&change.doc.data().createdAt){
        const created=new Date(change.doc.data().createdAt);
        const now=new Date();
        if((now-created)<30000) playNotificationSound();
      }
    });
  });
  unsubscribers.push(unsub6);
  // Listen for chat messages
  const unsub7=db.collection('hrd_chat').onSnapshot(snap=>{
    snap.docChanges().forEach(change=>{
      if(change.type==='added'&&change.doc.data().createdAt){
        const d=change.doc.data();
        if(d.userId!==currentUser.id){
          const created=new Date(d.createdAt);
          const now=new Date();
          if((now-created)<15000) playNotificationSound();
        }
      }
    });
  });
  unsubscribers.push(unsub7);
}

// ── NOTIFICATION SOUND — Loud & Clear ─────────────────────────
let _notifSoundCooldown=false;
let _notifAudioCtx=null;
function getAudioContext(){
  if(!_notifAudioCtx||_notifAudioCtx.state==='closed'){
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    _notifAudioCtx=new AudioCtx();
  }
  if(_notifAudioCtx.state==='suspended') _notifAudioCtx.resume();
  return _notifAudioCtx;
}
function playNotificationSound(){
  if(_notifSoundCooldown)return;
  _notifSoundCooldown=true;
  setTimeout(()=>{_notifSoundCooldown=false;},3000);
  try{
    const ctx=getAudioContext();
    const playTone=(freq,startTime,duration,vol)=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type='square'; // square wave = louder & more piercing
      osc.frequency.setValueAtTime(freq,ctx.currentTime+startTime);
      gain.gain.setValueAtTime(vol||1.0,ctx.currentTime+startTime);
      gain.gain.setValueAtTime(vol||1.0,ctx.currentTime+startTime+duration*0.7);
      gain.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+startTime+duration);
      osc.start(ctx.currentTime+startTime);
      osc.stop(ctx.currentTime+startTime+duration);
    };
    // Loud 3-tone chime x3 (very attention-grabbing)
    playTone(880,0,0.12,1.0);      // A5
    playTone(1109,0.12,0.12,1.0);  // C#6
    playTone(1319,0.24,0.25,1.0);  // E6
    // Repeat louder
    playTone(880,0.55,0.12,1.0);
    playTone(1109,0.67,0.12,1.0);
    playTone(1319,0.79,0.25,1.0);
    // Third time
    playTone(1319,1.1,0.12,1.0);
    playTone(1568,1.22,0.3,1.0);   // G6 - highest
  }catch(e){console.warn('Notification sound failed:',e);}
}
// Activate audio context on first user interaction (required by browsers)
document.addEventListener('click',function _initAudio(){getAudioContext();document.removeEventListener('click',_initAudio);},{once:true});
document.addEventListener('touchstart',function _initAudio2(){getAudioContext();document.removeEventListener('touchstart',_initAudio2);},{once:true});

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
  toast('✅ Aplikasi berhasil diinstall!', 'success');
  const btn = document.getElementById('btnInstallPWA');
  if (btn) btn.style.display = 'none';
});

function triggerInstallPWA() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(result => {
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
  // Unregister old SW and register new one to force update
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister());
  });
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
document.addEventListener('DOMContentLoaded', initApp);

// ── REAL-TIME SYNC: Auto-refresh current page when data changes ───
function setupRealtimeSync() {
  // Listen to key collections and refresh current page when changes detected
  const watchCollections = ['hrd_karyawan','hrd_absensi','hrd_disc_results','hrd_notifikasi','hrd_pengumuman','hrd_kandidat','hrd_cuti'];
  watchCollections.forEach(col => {
    const unsub = db.collection(col).onSnapshot(() => {
      // Update notification badge always
      if(currentUser) updateNotifBadge();
    }, () => {});
    unsubscribers.push(unsub);
  });
}
