'use strict';
// ── PORTAL KARYAWAN ───────────────────────────────────────────
async function renderPortal(){const main=document.getElementById('mainContent');const u=currentUser;
  // Refresh user data from Firestore to get latest profilePic/foto
  let avatarUrl='';
  try{
    const freshDoc=await db.collection('hrd_users').doc(u.id).get();
    if(freshDoc.exists){const freshData=freshDoc.data();if(freshData.profilePic)currentUser.profilePic=freshData.profilePic;if(freshData.departemen)currentUser.departemen=freshData.departemen;if(freshData.posisi)currentUser.posisi=freshData.posisi;localStorage.setItem('hrd_session',JSON.stringify(currentUser));}
    // Get foto from hrd_karyawan (priority over profilePic)
    const kSnap=await db.collection('hrd_karyawan').where('nama','==',u.nama).limit(1).get();
    if(!kSnap.empty){const kData=kSnap.docs[0].data();if(kData.foto)avatarUrl=kData.foto;}
    if(!avatarUrl)avatarUrl=currentUser.profilePic||'';
  }catch(e){}
  const avatarHtml=avatarUrl?`<img src="${avatarUrl}" style="width:60px;height:60px;border-radius:50%;object-fit:cover">`:`<div style="width:60px;height:60px;font-size:1.5rem;background:var(--primary);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center">${u.nama.charAt(0)}</div>`;
  main.innerHTML=`<div class="page-title"><span>🏠 Portal Saya</span></div><div class="card" style="border-left:4px solid var(--accent)"><div class="flex gap-16" style="align-items:center">${avatarHtml}<div><div class="fw-700" style="font-size:1.1rem">${escHtml(u.nama)}</div><div class="text-sm" style="color:#999">${escHtml(u.departemen||'-')} • ${escHtml(u.posisi||u.role)}</div><div class="text-xs" style="color:#999">NIP: ${escHtml(u.nip||'-')}</div></div></div></div><div class="stats-grid"><div class="stat-card" style="cursor:pointer;-webkit-tap-highlight-color:rgba(198,40,40,.2);touch-action:manipulation" onclick="navigateTo('portal-absensi')"><div class="stat-icon">📍</div><div class="stat-value" id="pAbsen">-</div><div class="stat-label">Kehadiran Bulan Ini</div></div><div class="stat-card" style="cursor:pointer;-webkit-tap-highlight-color:rgba(198,40,40,.2);touch-action:manipulation" onclick="navigateTo('portal-cuti')"><div class="stat-icon">🏖️</div><div class="stat-value" id="pCuti">-</div><div class="stat-label">Sisa Cuti</div></div><div class="stat-card" style="cursor:pointer;-webkit-tap-highlight-color:rgba(198,40,40,.2);touch-action:manipulation" onclick="navigateTo('inbox')"><div class="stat-icon">📥</div><div class="stat-value" id="pInbox">-</div><div class="stat-label">Inbox Meeting</div></div></div>
  <!-- KOLOM PENGUMUMAN, BROADCAST, MEETING & INVITE -->
  <!-- AKSI CEPAT + KOMUNIKASI -->
  <div class="card">
    <div class="card-title mb-12">⚡ Aksi Cepat</div>
    <div class="flex flex-wrap gap-8" style="touch-action:manipulation;-webkit-tap-highlight-color:rgba(198,40,40,.2)">
      <button class="btn btn-primary btn-sm" onclick="navigateTo('portal-absensi')">📍 Absensi</button>
      <button class="btn btn-info btn-sm" onclick="navigateTo('portal-cuti')">🏖️ Ajukan Cuti</button>
      <button class="btn btn-sm" style="background:#ff6f00;color:#fff" onclick="navigateTo('portal-overtime')">⏰ Overtime</button>
      <button class="btn btn-success btn-sm" onclick="navigateTo('portal-reimburse')">🧾 Reimburse</button>
      <button class="btn btn-warning btn-sm" onclick="navigateTo('portal-kasbon')">💳 Kasbon</button>
      <button class="btn btn-sm" style="background:#1565c0;color:#fff" onclick="navigateTo('daily-task')">📋 Daily Task</button>
      <button class="btn btn-sm" style="background:#7b1fa2;color:#fff" onclick="navigateTo('portal-gaji')">💰 Slip Gaji</button>
      <button class="btn btn-sm" style="background:#00796b;color:#fff" onclick="navigateTo('portal-kpi')">📈 KPI</button>
      <button class="btn btn-sm" style="background:#e65100;color:#fff" onclick="navigateTo('portal-jobdesk')">📋 Jobdesk</button>
      <button class="btn btn-sm" style="background:#4e342e;color:#fff" onclick="navigateTo('portal-disc')">🧠 DISC Test</button>
      <button class="btn btn-sm" style="background:#1b5e20;color:#fff" onclick="navigateTo('portal-test-kesehatan')">🏥 Test Kesehatan</button>
      <button class="btn btn-sm" style="background:#37474f;color:#fff" onclick="navigateTo('portal-setting')">⚙️ Setting</button>
    </div>
    <div class="card-title mb-12 mt-16">📋 Informasi & Komunikasi</div>
    <div class="flex flex-wrap gap-8">
      <button class="btn btn-sm" style="background:#1565c0;color:#fff" onclick="navigateTo('portal-pengumuman')">📢 Pengumuman</button>
      <button class="btn btn-sm" style="background:#7b1fa2;color:#fff" onclick="navigateTo('portal-broadcast')">📡 Broadcast</button>
      <button class="btn btn-sm" style="background:#2e7d32;color:#fff" onclick="navigateTo('portal-meeting')">📅 Meeting</button>
      <button class="btn btn-sm" style="background:#e65100;color:#fff" onclick="navigateTo('portal-invite')">✉️ Undangan</button>
      <button class="btn btn-sm" style="background:#1565c0;color:#fff" onclick="navigateTo('chat')">💬 Obrolan</button>
      <button class="btn btn-sm" style="background:#c62828;color:#fff" onclick="navigateTo('notifikasi')">🔔 Notifikasi</button>
    </div>
  </div>
  <div class="card"><div class="card-title">📲 Download / Install Aplikasi</div><p class="text-sm mb-8" style="color:#666">Install aplikasi ini di perangkat Anda untuk akses lebih cepat.</p>${renderDownloadAppSection()}</div>`;
  // Load data
  const[absenSnap,cutiSnap,inboxSnap]=await Promise.all([db.collection('hrd_absensi').where('userId','==',u.id).where('tanggal','>=',monthStr()+'-01').get(),db.collection('hrd_cuti').where('userId','==',u.id).where('status','==','approved').get(),db.collection('hrd_meeting_invites').where('targetUser','==',u.id).where('read','==',false).get()]);
  document.getElementById('pAbsen').textContent=absenSnap.size+' hari';
  document.getElementById('pCuti').textContent=Math.max(0,12-cutiSnap.size)+' hari';
  document.getElementById('pInbox').textContent=inboxSnap.size;
}

async function loadPortalPengumuman(){try{const snap=await db.collection('hrd_pengumuman').get();const el=document.getElementById('portalPengumumanBody');const ct=document.getElementById('portalPengumumanCount');if(ct)ct.textContent=snap.size;if(!el)return;if(snap.empty){el.innerHTML='<p class="text-sm" style="color:#999">Belum ada</p>';return;}let h='';const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));items.slice(0,5).forEach(p=>{h+=`<div style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="viewPengumuman('${p.id}')"><div class="fw-700 text-sm">${escHtml(p.judul||'')}</div><div class="text-xs" style="color:#999">${formatDate(p.createdAt)}</div></div>`;});el.innerHTML=h;}catch(e){console.error('loadPortalPengumuman:',e);}}

async function loadPortalBroadcastInfo(){try{const snap=await db.collection('hrd_broadcast').get();const el=document.getElementById('portalBroadcastBody');const ct=document.getElementById('portalBroadcastCount');if(ct)ct.textContent=snap.size;if(!el)return;if(snap.empty){
  // Fallback: show notifications with "broadcast" in title
  const notifSnap=await db.collection('hrd_notifikasi').where('targetUser','==',currentUser.id).get();
  let h='';notifSnap.forEach(d=>{const n=d.data();if((n.title||'').toLowerCase().includes('broadcast'))h+=`<div style="padding:8px 0;border-bottom:1px solid var(--border)"><div class="fw-700 text-sm">${escHtml(n.title)}</div><div class="text-xs">${escHtml(n.message||'')}</div><div class="text-xs" style="color:#999">${formatDateTime(n.createdAt)}</div></div>`;});
  el.innerHTML=h||'<p class="text-sm" style="color:#999">Belum ada broadcast</p>';if(h&&ct)ct.textContent=notifSnap.size;return;}
  let h='';const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));items.slice(0,5).forEach(p=>{h+=`<div style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="viewBroadcast('${p.id}')"><div class="fw-700 text-sm">${escHtml((p.pesan||'').substring(0,80))}</div><div class="text-xs" style="color:#999">${formatDate(p.createdAt)} — ${escHtml(p.pengirim||'')}</div></div>`;});el.innerHTML=h;}catch(e){console.error('loadPortalBroadcastInfo:',e);}}

async function loadPortalMeetingInfo(){try{const snap=await db.collection('hrd_meeting').get();const el=document.getElementById('portalMeetingBody');const ct=document.getElementById('portalMeetingCount');if(ct)ct.textContent=snap.size;if(!el)return;if(snap.empty){el.innerHTML='<p class="text-sm" style="color:#999">Belum ada meeting</p>';return;}let h='';const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));items.sort((a,b)=>(b.tanggal||'').localeCompare(a.tanggal||''));items.slice(0,5).forEach(p=>{h+=`<div style="padding:8px 0;border-bottom:1px solid var(--border)"><div class="fw-700 text-sm">${escHtml(p.judul||'Meeting')}</div><div class="text-xs" style="color:#999">📅 ${formatDate(p.tanggal)} ${p.waktu||''}</div></div>`;});el.innerHTML=h;}catch(e){console.error('loadPortalMeetingInfo:',e);}}

async function loadPortalInviteInfo(){try{const snap=await db.collection('hrd_meeting_invites').where('targetUser','==',currentUser.id).get();const el=document.getElementById('portalInviteBody');const ct=document.getElementById('portalInviteCount');if(ct)ct.textContent=snap.size;if(!el)return;if(snap.empty){el.innerHTML='<p class="text-sm" style="color:#999">Belum ada undangan</p>';return;}let h='';snap.forEach(d=>{const p=d.data();h+=`<div style="padding:8px 0;border-bottom:1px solid var(--border)"><div class="fw-700 text-sm">${escHtml(p.meetingTitle||p.judul||'Undangan')}</div><div class="text-xs" style="color:#999">${formatDate(p.createdAt)} — ${escHtml(p.fromName||'')}</div>${p.onlineRoomId?`<button class="btn btn-xs btn-success mt-4" onclick="joinOnlineMeeting('${p.onlineRoomId}')">🎥 Join</button>`:''}</div>`;});el.innerHTML=h;}catch(e){console.error('loadPortalInviteInfo:',e);}}

// ── PORTAL INFO SECTIONS — Accordion Data Loader ──────────────
async function loadPortalInfoSections(){
  try{
    // Use simple queries (no composite index needed)
    const pgSnap=await db.collection('hrd_pengumuman').get();
    const bcSnap=await db.collection('hrd_broadcast').get();
    const mtSnap=await db.collection('hrd_meeting').get();
    const invSnap=await db.collection('hrd_meeting_invites').get();
    const notifSnap=await db.collection('hrd_notifikasi').get();
    
    // Filter invites for current user
    const myInvites=[];invSnap.forEach(d=>{const p=d.data();if(p.targetUser===currentUser.id)myInvites.push({id:d.id,...p});});
    // Filter notifs for current user (unread)
    const myNotifs=[];notifSnap.forEach(d=>{const p=d.data();if((p.targetUser===currentUser.id||p.targetUser===currentUser.role)&&!p.read)myNotifs.push({id:d.id,...p});});

    // Pengumuman
    const pgCount=document.getElementById('portalPengumumanCount');
    if(pgCount)pgCount.textContent=pgSnap.size;
    let pgH='';
    if(pgSnap.empty)pgH='<p class="text-sm" style="color:#999">Belum ada pengumuman</p>';
    else{const items=[];pgSnap.forEach(d=>items.push({id:d.id,...d.data()}));items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));items.slice(0,5).forEach(p=>{pgH+=`<div style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="viewPengumuman('${p.id}')"><div class="fw-700 text-sm">${escHtml(p.judul||'')}</div><div class="text-xs" style="color:#999">${formatDate(p.createdAt)}</div></div>`;});}
    const pgBody=document.getElementById('portalPengumumanBody');if(pgBody)pgBody.innerHTML=pgH;
    
    // Broadcast + Notifikasi broadcast
    const bcCount=document.getElementById('portalBroadcastCount');
    let bcItems=[];bcSnap.forEach(d=>bcItems.push({id:d.id,...d.data()}));
    // Add broadcast notifications
    myNotifs.forEach(n=>{if((n.title||'').toLowerCase().includes('broadcast'))bcItems.push({id:n.id,pesan:n.message,pengirim:n.title?.replace('📡 ',''),createdAt:n.createdAt,fromNotif:true});});
    bcItems.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    if(bcCount)bcCount.textContent=bcItems.length;
    let bcH='';
    if(!bcItems.length)bcH='<p class="text-sm" style="color:#999">Belum ada broadcast</p>';
    else bcItems.slice(0,5).forEach(p=>{bcH+=`<div style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="${p.fromNotif?'':`viewBroadcast('${p.id}')`}"><div class="fw-700 text-sm">${escHtml((p.pesan||p.message||'').substring(0,80))}</div><div class="text-xs" style="color:#999">${formatDate(p.createdAt)} — ${escHtml(p.pengirim||'')}</div></div>`;});
    const bcBody=document.getElementById('portalBroadcastBody');if(bcBody)bcBody.innerHTML=bcH;
    
    // Meeting
    const mtCount=document.getElementById('portalMeetingCount');
    if(mtCount)mtCount.textContent=mtSnap.size;
    let mtH='';
    if(mtSnap.empty)mtH='<p class="text-sm" style="color:#999">Belum ada meeting</p>';
    else{const items=[];mtSnap.forEach(d=>items.push({id:d.id,...d.data()}));items.sort((a,b)=>(b.tanggal||'').localeCompare(a.tanggal||''));items.slice(0,5).forEach(p=>{mtH+=`<div style="padding:8px 0;border-bottom:1px solid var(--border)"><div class="fw-700 text-sm">${escHtml(p.judul||'Meeting')}</div><div class="text-xs" style="color:#999">📅 ${formatDate(p.tanggal)} ${p.waktu||''}</div></div>`;});}
    const mtBody=document.getElementById('portalMeetingBody');if(mtBody)mtBody.innerHTML=mtH;
    
    // Invite
    const invCount=document.getElementById('portalInviteCount');
    if(invCount)invCount.textContent=myInvites.length;
    let invH='';
    if(!myInvites.length)invH='<p class="text-sm" style="color:#999">Belum ada undangan</p>';
    else myInvites.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,5).forEach(p=>{invH+=`<div style="padding:8px 0;border-bottom:1px solid var(--border)"><div class="fw-700 text-sm">${escHtml(p.meetingTitle||p.judul||'Undangan')}</div><div class="text-xs" style="color:#999">${formatDate(p.createdAt)} — ${escHtml(p.fromName||'')}</div></div>`;});
    const invBody=document.getElementById('portalInviteBody');if(invBody)invBody.innerHTML=invH;
  }catch(e){
    console.error('loadPortalInfoSections error:',e);
    // Fallback: show error message in first section
    const pgBody=document.getElementById('portalPengumumanBody');
    if(pgBody)pgBody.innerHTML=`<p class="text-sm" style="color:var(--accent)">⚠️ Gagal memuat data: ${e.message||'Unknown error'}</p>`;
  }
}

function togglePortalSection(section){
  const body=document.getElementById('portal'+section.charAt(0).toUpperCase()+section.slice(1)+'Body');
  if(!body)return;
  const isHidden=body.style.display==='none';
  body.style.display=isHidden?'block':'none';
}

async function respondInvite(id,status){
  try{
    await db.collection('hrd_meeting_invites').doc(id).update({status,read:true,respondedAt:new Date().toISOString()});
    toast(status==='accepted'?'✅ Undangan diterima':'❌ Undangan ditolak',status==='accepted'?'success':'info');
    loadPortalInviteInfo();
    // Refresh if on invite page
    if(currentPage==='portal-invite') renderPortalInvite();
  }catch(e){toast('Gagal: '+e.message,'error');}
}

// ── PORTAL PENGUMUMAN PAGE ────────────────────────────────────
async function renderPortalPengumuman(){
  const main=document.getElementById('mainContent');
  main.innerHTML=`<div class="page-title"><span>📢 Pengumuman</span></div><div class="card" id="portalPgList">Loading...</div>`;
  const snap=await db.collection('hrd_pengumuman').get();
  const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));
  items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  // Group by category
  const categories={};
  items.forEach(p=>{const cat=p.kategori||'Umum';if(!categories[cat])categories[cat]=[];categories[cat].push(p);});
  let h='';
  Object.keys(categories).forEach(cat=>{
    h+=`<div class="portal-accordion mb-8">
      <div onclick="toggleAccordion(this)" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#e3f2fd;border-radius:8px;cursor:pointer;font-weight:700;font-size:.9rem">
        <span>📂 ${escHtml(cat)}</span><span class="badge badge-info" style="font-size:.7rem">${categories[cat].length}</span>
      </div>
      <div style="display:none;padding:8px 16px;border:1px solid #e3f2fd;border-top:none;border-radius:0 0 8px 8px">`;
    categories[cat].forEach(p=>{
      h+=`<div style="padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="viewPengumuman('${p.id}')"><div class="fw-700 text-sm">${escHtml(p.judul||'')}</div><div class="text-xs" style="color:#999">${formatDate(p.createdAt)} — ${escHtml(p.dibuatOleh||'')}</div></div>`;
    });
    h+=`</div></div>`;
  });
  if(!items.length) h='<p class="text-sm" style="color:#999;padding:16px">Belum ada pengumuman</p>';
  document.getElementById('portalPgList').innerHTML=h;
}

// ── PORTAL BROADCAST PAGE ─────────────────────────────────────
async function renderPortalBroadcast(){
  const main=document.getElementById('mainContent');
  main.innerHTML=`<div class="page-title"><span>📡 Broadcast</span></div><div class="card" id="portalBcList">Loading...</div>`;
  const snap=await db.collection('hrd_broadcast').get();
  const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));
  items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  // Group by target
  const categories={};
  items.forEach(p=>{const cat=p.targetLabel||p.target||'Semua';if(!categories[cat])categories[cat]=[];categories[cat].push(p);});
  let h='';
  Object.keys(categories).forEach(cat=>{
    h+=`<div class="portal-accordion mb-8">
      <div onclick="toggleAccordion(this)" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#f3e5f5;border-radius:8px;cursor:pointer;font-weight:700;font-size:.9rem">
        <span>📡 ${escHtml(cat)}</span><span class="badge" style="background:#ce93d8;color:#fff;font-size:.7rem">${categories[cat].length}</span>
      </div>
      <div style="display:none;padding:8px 16px;border:1px solid #f3e5f5;border-top:none;border-radius:0 0 8px 8px">`;
    categories[cat].forEach(p=>{
      h+=`<div style="padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="viewBroadcast('${p.id}')"><div class="fw-700 text-sm">${escHtml((p.pesan||'').substring(0,100))}${(p.pesan||'').length>100?'...':''}</div><div class="text-xs" style="color:#999">${formatDate(p.createdAt)} — Dari: ${escHtml(p.pengirim||'')}</div></div>`;
    });
    h+=`</div></div>`;
  });
  if(!items.length) h='<p class="text-sm" style="color:#999;padding:16px">Belum ada broadcast</p>';
  document.getElementById('portalBcList').innerHTML=h;
}

// ── PORTAL MEETING PAGE ───────────────────────────────────────
async function renderPortalMeeting(){
  const main=document.getElementById('mainContent');
  main.innerHTML=`<div class="page-title"><span>📅 Meeting</span><div class="flex gap-8"><button class="btn btn-success btn-sm" onclick="startInstantMeeting()">🎥 Meeting Online</button><button class="btn btn-primary btn-sm" onclick="modalMeetingCreate()">+ Buat Meeting</button></div></div>
    <div class="card mb-16"><div class="card-title mb-8">🎥 Meeting Online Aktif</div><div id="portalOnlineMeetings">Loading...</div></div>
    <div class="card" id="portalMtList">Loading...</div>`;
  // Load online meetings
  const onlineSnap=await db.collection('hrd_online_meeting').where('status','==','active').get();
  let onlineH='';
  if(onlineSnap.empty)onlineH='<p class="text-sm" style="color:#999">Tidak ada meeting online aktif saat ini</p>';
  else onlineSnap.forEach(d=>{const m=d.data();onlineH+=`<div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between"><div><div class="fw-700 text-sm">${escHtml(m.judul||'Meeting Online')}</div><div class="text-xs" style="color:#999">${escHtml(m.createdByName||'')} — ${formatDateTime(m.createdAt)}</div></div><button class="btn btn-xs btn-success" onclick="joinOnlineMeeting('${m.roomId}')">🎥 Join</button></div>`;});
  document.getElementById('portalOnlineMeetings').innerHTML=onlineH;
  // Load regular meetings
  const snap=await db.collection('hrd_meeting').get();
  const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));
  items.sort((a,b)=>(b.tanggal||'').localeCompare(a.tanggal||''));
  // Group: Upcoming vs Selesai
  const today=todayStr();
  const upcoming=items.filter(p=>p.tanggal>=today);
  const past=items.filter(p=>p.tanggal<today);
  let h='';
  // Upcoming
  h+=`<div class="portal-accordion mb-8">
    <div onclick="toggleAccordion(this)" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#e8f5e9;border-radius:8px;cursor:pointer;font-weight:700;font-size:.9rem">
      <span>🟢 Upcoming</span><span class="badge badge-success" style="font-size:.7rem">${upcoming.length}</span>
    </div>
    <div style="display:none;padding:8px 16px;border:1px solid #e8f5e9;border-top:none;border-radius:0 0 8px 8px">`;
  if(!upcoming.length) h+='<p class="text-sm" style="color:#999">Tidak ada meeting mendatang</p>';
  else upcoming.forEach(p=>{h+=`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div class="fw-700 text-sm">${escHtml(p.judul||p.agenda||'Meeting')}</div><div class="text-xs" style="color:#999">📅 ${formatDate(p.tanggal)} ${p.jam||''} — 📍 ${escHtml(p.lokasi||'-')}</div>${p.agenda?`<div class="text-xs mt-4" style="color:#555">${escHtml(p.agenda)}</div>`:''}</div>`;});
  h+=`</div></div>`;
  // Past
  h+=`<div class="portal-accordion mb-8">
    <div onclick="toggleAccordion(this)" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#eceff1;border-radius:8px;cursor:pointer;font-weight:700;font-size:.9rem">
      <span>⚪ Selesai</span><span class="badge" style="background:#9e9e9e;color:#fff;font-size:.7rem">${past.length}</span>
    </div>
    <div style="display:none;padding:8px 16px;border:1px solid #eceff1;border-top:none;border-radius:0 0 8px 8px">`;
  if(!past.length) h+='<p class="text-sm" style="color:#999">Belum ada meeting selesai</p>';
  else past.slice(0,20).forEach(p=>{h+=`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div class="fw-700 text-sm" style="color:#999">${escHtml(p.judul||p.agenda||'Meeting')}</div><div class="text-xs" style="color:#bbb">📅 ${formatDate(p.tanggal)} ${p.jam||''} — 📍 ${escHtml(p.lokasi||'-')}</div></div>`;});
  h+=`</div></div>`;
  document.getElementById('portalMtList').innerHTML=h;
}

// ── PORTAL INVITE PAGE ────────────────────────────────────────
async function renderPortalInvite(){
  const main=document.getElementById('mainContent');
  main.innerHTML=`<div class="page-title"><span>✉️ Undangan / Invite</span></div><div class="card" id="portalInvList">Loading...</div>`;
  const snap=await db.collection('hrd_meeting_invites').where('targetUser','==',currentUser.id).get();
  const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));
  items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  // Group: Pending, Accepted, Declined
  const pending=items.filter(p=>!p.status||p.status==='pending');
  const accepted=items.filter(p=>p.status==='accepted');
  const declined=items.filter(p=>p.status==='declined');
  let h='';
  // Pending
  h+=`<div class="portal-accordion mb-8">
    <div onclick="toggleAccordion(this)" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#fff3e0;border-radius:8px;cursor:pointer;font-weight:700;font-size:.9rem">
      <span>⏳ Menunggu Respon</span><span class="badge badge-warning" style="font-size:.7rem">${pending.length}</span>
    </div>
    <div style="${pending.length?'display:block':'display:none'};padding:8px 16px;border:1px solid #fff3e0;border-top:none;border-radius:0 0 8px 8px">`;
  if(!pending.length) h+='<p class="text-sm" style="color:#999">Tidak ada undangan pending</p>';
  else pending.forEach(p=>{h+=`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div class="fw-700 text-sm">${escHtml(p.meetingTitle||p.judul||'Undangan Meeting')}</div><div class="text-xs" style="color:#999">📅 ${formatDate(p.tanggal||p.createdAt)} — Dari: ${escHtml(p.invitedBy||'')}</div><div class="mt-8"><button class="btn btn-xs btn-success" onclick="respondInvite('${p.id}','accepted')">✅ Terima</button> <button class="btn btn-xs btn-danger" onclick="respondInvite('${p.id}','declined')">❌ Tolak</button></div></div>`;});
  h+=`</div></div>`;
  // Accepted
  h+=`<div class="portal-accordion mb-8">
    <div onclick="toggleAccordion(this)" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#e8f5e9;border-radius:8px;cursor:pointer;font-weight:700;font-size:.9rem">
      <span>✅ Diterima</span><span class="badge badge-success" style="font-size:.7rem">${accepted.length}</span>
    </div>
    <div style="display:none;padding:8px 16px;border:1px solid #e8f5e9;border-top:none;border-radius:0 0 8px 8px">`;
  if(!accepted.length) h+='<p class="text-sm" style="color:#999">Belum ada</p>';
  else accepted.forEach(p=>{h+=`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div class="fw-700 text-sm">${escHtml(p.meetingTitle||p.judul||'Meeting')}</div><div class="text-xs" style="color:#999">📅 ${formatDate(p.tanggal||p.createdAt)} — Dari: ${escHtml(p.invitedBy||'')}</div></div>`;});
  h+=`</div></div>`;
  // Declined
  h+=`<div class="portal-accordion mb-8">
    <div onclick="toggleAccordion(this)" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#ffebee;border-radius:8px;cursor:pointer;font-weight:700;font-size:.9rem">
      <span>❌ Ditolak</span><span class="badge badge-danger" style="font-size:.7rem">${declined.length}</span>
    </div>
    <div style="display:none;padding:8px 16px;border:1px solid #ffebee;border-top:none;border-radius:0 0 8px 8px">`;
  if(!declined.length) h+='<p class="text-sm" style="color:#999">Belum ada</p>';
  else declined.forEach(p=>{h+=`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div class="fw-700 text-sm" style="color:#999">${escHtml(p.meetingTitle||p.judul||'Meeting')}</div><div class="text-xs" style="color:#bbb">📅 ${formatDate(p.tanggal||p.createdAt)}</div></div>`;});
  h+=`</div></div>`;
  document.getElementById('portalInvList').innerHTML=h;
}

// ── TOGGLE ACCORDION HELPER ───────────────────────────────────
function toggleAccordion(el){
  const body=el.nextElementSibling;
  if(!body)return;
  const isHidden=body.style.display==='none';
  body.style.display=isHidden?'block':'none';
}

// ── PORTAL OVERTIME ───────────────────────────────────────────
async function renderPortalOvertime(){
  const main=document.getElementById('mainContent');
  main.innerHTML=`<div class="page-title"><span>⏰ Overtime Saya</span><button class="btn btn-primary btn-sm" onclick="modalOvertime()">+ Ajukan Overtime</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Jam</th><th>Durasi</th><th>Alasan</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblPortalOT"></tbody></table></div></div>`;
  const snap=await db.collection('hrd_overtime').where('userId','==',currentUser.id).get();
  const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));
  items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  let h='';
  if(!items.length)h='<tr><td colspan="5" class="text-center">Belum ada pengajuan overtime</td></tr>';
  else items.forEach(p=>{
    const badge=p.status==='approved'?'badge-success':p.status==='rejected'?'badge-danger':'badge-warning';
    h+=`<tr><td>${formatDate(p.tanggal)}</td><td>${p.jamMulai||'-'} - ${p.jamSelesai||'-'}</td><td class="fw-700">${p.durasi||0} jam</td><td class="text-sm">${escHtml((p.alasan||'').substring(0,50))}</td><td><span class="badge ${badge}">${p.status}</span></td><td><button class="btn btn-xs btn-info" onclick="viewOvertimeDetail('${p.id}')">👁️</button> <button class="btn btn-xs btn-primary" onclick="editOvertimePortal('${p.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_overtime','${p.id}','portal-overtime')">🗑️</button></td></tr>`;
  });
  document.getElementById('tblPortalOT').innerHTML=h;
}

function viewOvertimeDetail(id){
  db.collection('hrd_overtime').doc(id).get().then(d=>{const p=d.data();
    openModal(`<div class="modal-title">⏰ Detail Overtime</div>
      <div class="grid-2 mb-16"><div><b>Nama:</b> ${escHtml(p.nama)}</div><div><b>Status:</b> <span class="badge badge-${p.status==='approved'?'success':p.status==='rejected'?'danger':'warning'}">${p.status}</span></div><div><b>Tanggal:</b> ${formatDate(p.tanggal)}</div><div><b>Jam:</b> ${p.jamMulai||'-'} - ${p.jamSelesai||'-'}</div><div><b>Durasi:</b> ${p.durasi||0} jam</div>${p.approvedBy?`<div><b>Diproses:</b> ${escHtml(p.approvedBy)}</div>`:''}</div>
      ${p.alasan?`<div class="mb-16"><b>Alasan:</b><div class="text-sm mt-8" style="background:#f8f9ff;padding:10px;border-radius:6px">${escHtml(p.alasan)}</div></div>`:''}`);
  });
}
async function editOvertimePortal(id){
  const d=await db.collection('hrd_overtime').doc(id).get();const p=d.data();
  openModal(`<div class="modal-title">✏️ Edit Overtime</div>
    <div class="grid-2"><div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="eotTgl" value="${p.tanggal||''}"></div><div class="form-group"><label>Alasan</label><input class="form-control" id="eotAlasan" value="${escHtml(p.alasan||'')}"></div></div>
    <div class="grid-2"><div class="form-group"><label>Jam Mulai</label><input class="form-control" type="time" id="eotStart" value="${p.jamMulai||''}"></div><div class="form-group"><label>Jam Selesai</label><input class="form-control" type="time" id="eotEnd" value="${p.jamSelesai||''}"></div></div>
    <button class="btn btn-primary" onclick="simpanEditOvertime('${id}')">💾 Simpan</button>`);
}
async function simpanEditOvertime(id){
  const s=document.getElementById('eotStart').value,e=document.getElementById('eotEnd').value;
  const durasi=s&&e?Math.max(0,((new Date('2000-01-01T'+e)-new Date('2000-01-01T'+s))/3600000)).toFixed(1):0;
  await db.collection('hrd_overtime').doc(id).update({tanggal:document.getElementById('eotTgl').value,alasan:document.getElementById('eotAlasan').value,jamMulai:s,jamSelesai:e,durasi:parseFloat(durasi),updatedAt:new Date().toISOString()});
  closeModalDirect();toast('Overtime diupdate','success');renderPortalOvertime();
}

function renderPortalAbsensi(){
  // For karyawan: render absensi content directly without changing currentPage away from portal-absensi
  window._portalAbsensiMode=true;
  renderAbsensiIJEF();
}
async function renderPortalCuti(){
  const main=document.getElementById('mainContent');
  // Get karyawan data for quota calculation
  const kSnap=await db.collection('hrd_karyawan').where('nama','==',currentUser.nama).limit(1).get();
  const kData=kSnap.empty?{tanggalMasuk:'',status:'aktif'}:kSnap.docs[0].data();
  const jatah=hitungJatahCuti(kData);
  const snap=await db.collection('hrd_cuti').where('userId','==',currentUser.id).get();
  let used=0;
  snap.forEach(d=>{const p=d.data();if(p.status==='approved'&&p.jenis==='Cuti Tahunan')used+=(p.durasi||1);});
  const sisa=Math.max(0,jatah-used);
  const masaKerja=hitungMasaKerja(kData.tanggalMasuk);

  main.innerHTML=`<div class="page-title"><span>🏖️ Cuti Saya</span><button class="btn btn-primary btn-sm" onclick="modalCuti()">+ Ajukan</button></div>
    <div class="stats-grid mb-16">
      <div class="stat-card" style="border-left-color:var(--primary)"><div class="stat-value" style="color:var(--primary)">${jatah}</div><div class="stat-label">Jatah Cuti/Tahun</div></div>
      <div class="stat-card" style="border-left-color:var(--warning)"><div class="stat-value" style="color:var(--warning)">${used}</div><div class="stat-label">Terpakai</div></div>
      <div class="stat-card" style="border-left-color:${sisa<=2?'var(--danger)':'var(--success)'}"><div class="stat-value" style="color:${sisa<=2?'var(--danger)':'var(--success)'}">${sisa}</div><div class="stat-label">Sisa Cuti</div></div>
      <div class="stat-card" style="border-left-color:#795548"><div class="stat-value" style="color:#795548;font-size:.9rem">${masaKerja}</div><div class="stat-label">Masa Kerja</div></div>
    </div>
    <div class="card mb-8" style="background:#f0f4ff;border-left:4px solid var(--info);padding:12px">
      <div class="text-xs" style="line-height:1.6"><b>Ketentuan Cuti:</b><br>• Cuti tahunan: ${jatah} hari (berdasarkan masa kerja ${masaKerja})<br>• Minimal 1 tahun kerja untuk jatah penuh 12 hari<br>• Bonus +1 hari per 2 tahun kerja (max 18 hari)<br>• Cuti sakit & melahirkan tidak mengurangi jatah cuti tahunan</div>
    </div>
    <div class="card"><div class="table-wrap"><table><thead><tr><th>Jenis</th><th>Tanggal</th><th>Durasi</th><th>Status</th></tr></thead><tbody id="tblPortalCuti"></tbody></table></div></div>`;
  let h='';if(snap.empty)h='<tr><td colspan="4" class="text-center">Belum ada</td></tr>';
  else{const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));items.forEach(p=>{h+=`<tr><td>${escHtml(p.jenis)}</td><td>${formatDate(p.mulai)}-${formatDate(p.selesai)}</td><td>${p.durasi||1} hari</td><td><span class="badge badge-${p.status==='approved'?'success':p.status==='rejected'?'danger':'warning'}">${p.status}</span></td></tr>`;});}
  document.getElementById('tblPortalCuti').innerHTML=h;
}
async function renderPortalGaji(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>💰 Slip Gaji Saya</span></div><div class="card"><div class="flex gap-8 mb-16"><input class="form-control" type="month" id="portalGajiBulan" value="${monthStr()}" onchange="loadPortalGaji()" style="max-width:160px"><button class="btn btn-sm btn-info" onclick="loadPortalGaji()">🔍 Cari</button></div><div class="table-wrap"><table><thead><tr><th>Periode</th><th>Gaji Pokok</th><th>Lembur</th><th>Potongan</th><th>THP</th><th>Aksi</th></tr></thead><tbody id="tblPortalGaji"></tbody></table></div></div>`;loadPortalGaji();}
async function loadPortalGaji(){
  const snap=await db.collection('hrd_penggajian').where('nama','==',currentUser.nama).get();
  const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));
  items.sort((a,b)=>(b.periode||'').localeCompare(a.periode||''));
  let h='';if(!items.length)h='<tr><td colspan="6" class="text-center">Belum ada slip gaji</td></tr>';
  else items.forEach(p=>{const totPot=(p.bpjsKesehatan||0)+(p.bpjsTK||0)+(p.potongan||0)+(p.kasbon||0)+(p.pph21||0);h+=`<tr><td class="fw-700">${p.periode}</td><td>${formatCurrency(p.gajiPokok)}</td><td>${formatCurrency(p.lembur||0)}</td><td style="color:var(--danger)">${formatCurrency(totPot)}</td><td class="fw-700" style="color:var(--success)">${formatCurrency(p.totalBersih)}</td><td><button class="btn btn-xs btn-info" onclick="lihatSlip('${p.id}')">📄 View</button></td></tr>`;});
  document.getElementById('tblPortalGaji').innerHTML=h;
}
function renderPortalJobdesk(){
  const main=document.getElementById('mainContent');
  main.innerHTML=`<div class="page-title"><span>📋 Jobdesk Saya</span></div><div class="card" id="jobdeskContent">Loading...</div>`;
  loadJobdesk();
}
async function loadJobdesk(){
  // Try to load jobdesk - first by linkedKaryawan, then by userId, then by nama match
  let snap=await db.collection('hrd_jobdesk').where('karyawanId','==',currentUser.linkedKaryawan||'__none__').get();
  if(snap.empty) snap=await db.collection('hrd_jobdesk').where('userId','==',currentUser.id).get();
  if(snap.empty) snap=await db.collection('hrd_jobdesk').where('karyawanId','==',currentUser.id).get();
  // Also try matching by finding karyawan record first
  if(snap.empty){
    const kSnap=await db.collection('hrd_karyawan').where('nama','==',currentUser.nama).limit(1).get();
    if(!kSnap.empty){snap=await db.collection('hrd_jobdesk').where('karyawanId','==',kSnap.docs[0].id).get();}
  }
  let html=`<div class="grid-2 mb-16"><div><b>Nama:</b> ${escHtml(currentUser.nama)}</div><div><b>NIP:</b> ${escHtml(currentUser.nip||'-')}</div><div><b>Departemen:</b> ${escHtml(currentUser.departemen||'-')}</div><div><b>Posisi:</b> ${escHtml(currentUser.posisi||currentUser.role)}</div></div>`;
  if(!snap.empty){
    const p=snap.docs[0].data();
    html+=`<div style="border-top:2px solid var(--border);padding-top:16px">`;
    if(p.deskripsi)html+=`<div class="mb-16"><div class="fw-700 mb-8">📝 Deskripsi Pekerjaan</div><div class="text-sm" style="white-space:pre-wrap;line-height:1.8">${escHtml(p.deskripsi)}</div></div>`;
    if(p.tanggungJawab)html+=`<div class="mb-16"><div class="fw-700 mb-8">✅ Tanggung Jawab</div><ul style="padding-left:20px;font-size:.85rem;line-height:2">${p.tanggungJawab.split('\n').filter(x=>x.trim()).map(x=>'<li>'+escHtml(x.trim())+'</li>').join('')}</ul></div>`;
    if(p.kualifikasi)html+=`<div class="mb-16"><div class="fw-700 mb-8">🎯 Kualifikasi</div><ul style="padding-left:20px;font-size:.85rem;line-height:2">${p.kualifikasi.split('\n').filter(x=>x.trim()).map(x=>'<li>'+escHtml(x.trim())+'</li>').join('')}</ul></div>`;
    if(p.kpi)html+=`<div class="mb-16"><div class="fw-700 mb-8">📈 Target KPI</div><div class="text-sm" style="white-space:pre-wrap">${escHtml(p.kpi)}</div></div>`;
    html+=`</div>`;
  } else {
    html+=`<div style="border-top:2px solid var(--border);padding-top:16px;color:#999" class="text-sm"><p>Jobdesk belum diatur oleh admin. Hubungi HRD untuk informasi lebih lanjut.</p></div>`;
  }
  html+=renderDownloadAppSection();
  document.getElementById('jobdeskContent').innerHTML=html;
}
async function renderPortalPeraturan(){
  const grade = await getUserGrade();
  const cfg = await getGradeConfig(grade);
  const peraturan = await getGradePeraturan(grade);
  let gradeSection = `<div class="card mb-16" style="border-left:4px solid #ff9800">
    <div class="card-header"><div class="card-title">✈️ Ketentuan Perjalanan Dinas - Grade ${escHtml(grade || 'STAFF')}</div></div>
    <div style="padding:12px">
      <div class="table-wrap"><table><thead><tr><th>Komponen</th><th>Ketentuan Anda</th></tr></thead><tbody>
        <tr><td class="fw-700">Transportasi Diizinkan</td><td>${escHtml(peraturan.transportasiDiizinkan.join(', '))}</td></tr>
        <tr><td class="fw-700">Kelas Hotel</td><td>${escHtml(peraturan.kelasHotelDiizinkan)}</td></tr>
        <tr><td class="fw-700">Uang Harian</td><td>${formatCurrency(cfg.uangHarian)}</td></tr>
        <tr><td class="fw-700">Max Makan/Hari</td><td>${formatCurrency(cfg.maxMakan)}</td></tr>
        <tr><td class="fw-700">Uang Saku/Hari</td><td>${formatCurrency(cfg.uangSaku)}</td></tr>
        <tr><td class="fw-700">Alur Approval</td><td>${escHtml(peraturan.alurApproval)}</td></tr>
        <tr><td class="fw-700">Uang Muka</td><td>${peraturan.persenUangMuka}% dari estimasi</td></tr>
        <tr><td class="fw-700">Batas Waktu Laporan</td><td>${peraturan.batasWaktuLaporan} hari setelah kembali</td></tr>
      </tbody></table></div>
      ${peraturan.ketentuanKhusus.length ? '<div class="mt-8"><div class="fw-700 text-sm mb-4">Ketentuan Khusus:</div><ul class="text-sm" style="padding-left:16px;line-height:1.6;color:#555;margin:0">'+peraturan.ketentuanKhusus.map(k=>'<li>'+escHtml(k)+'</li>').join('')+'</ul></div>' : ''}
    </div>
  </div>`;
  document.getElementById('mainContent').innerHTML=`<div class="page-title"><span>📜 Peraturan Perusahaan</span></div>${gradeSection}<div class="card">${renderPeraturanHTML(true)}</div>`;
}

// ── PORTAL SHARE — Admin share link/QR ke karyawan ────────────
// Setiap karyawan punya link unik yang bisa didownload/share
// ══════════════════════════════════════════════════════════════

async function renderPortalShare() {
  if (!hasAccess(3)) return document.getElementById('mainContent').innerHTML = '<div class="card"><p>Akses ditolak.</p></div>';
  const main = document.getElementById('mainContent');
  const downloadLink = getAppDownloadLink();
  main.innerHTML = `<div class="page-title"><span>📲 Download Aplikasi</span></div>
    <div class="card mb-16"><div class="card-title">📥 Link Aplikasi</div><p class="text-sm mb-16" style="color:#666">Bagikan link ini ke semua karyawan agar mereka bisa mengakses portal lewat browser atau menginstal sebagai aplikasi PWA di Android, iOS, Windows, dan Mac.</p>
      <div class="form-group"><label>Link Download</label><input class="form-control" readonly value="${downloadLink}" id="portalAppLink"></div>
      <div class="flex gap-8"><button class="btn btn-primary btn-sm" onclick="copyDownloadLink()">📋 Salin Link</button><button class="btn btn-success btn-sm" onclick="shareDownloadWhatsApp()">💬 Share WA</button><button class="btn btn-info btn-sm" onclick="shareDownloadEmail()">✉️ Email</button></div>
    </div>
    <div class="grid-2"><div class="card"><div class="card-title mb-16">📱 Android</div><p class="text-sm" style="color:#666">Buka link di browser Chrome, lalu pilih menu dan "Add to Home screen". Aplikasi akan terpasang seperti biasa.</p></div><div class="card"><div class="card-title mb-16">🍎 iOS</div><p class="text-sm" style="color:#666">Buka link di Safari, tap tombol Share lalu pilih "Add to Home Screen". Jika diminta, pilih "Add".</p></div></div>
    <div class="grid-2"><div class="card"><div class="card-title mb-16">💻 Windows</div><p class="text-sm" style="color:#666">Buka link di browser Edge/Chrome, lalu pilih install PWA dari menu browser atau toolbar.</p></div><div class="card"><div class="card-title mb-16"> Mac</div><p class="text-sm" style="color:#666">Buka link di browser Safari/Chrome, lalu gunakan opsi "Add to Home Screen" / "Install App".</p></div></div>`;
}

function getAppDownloadLink() {
  return window.location.origin + window.location.pathname;
}

function copyDownloadLink() {
  const link = getAppDownloadLink();
  navigator.clipboard?.writeText(link).then(() => toast('Link disalin!','success')).catch(() => {
    const ta = document.createElement('textarea'); ta.value = link; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    toast('Link disalin!','success');
  });
}

function shareDownloadWhatsApp() {
  const link = getAppDownloadLink();
  const text = encodeURIComponent(`Halo,

Berikut link download aplikasi HRD IJEF Corp:
${link}

Buka link menggunakan browser dan pilih "Add to Home Screen" atau install PWA untuk akses cepat di Android, iOS, Windows, atau Mac.

— HRD IJEF Corp`);
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

function shareDownloadEmail() {
  const link = getAppDownloadLink();
  const subject = encodeURIComponent('Link Download Aplikasi HRD IJEF Corp');
  const body = encodeURIComponent(`Halo,

Silakan buka link berikut untuk mengakses aplikasi HRD IJEF Corp:
${link}

Aplikasi mendukung browser, PWA, dan dapat dipasang di Android, iOS, Windows, dan Mac.`);
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

async function loadLamaranMasuk() {
  const snap = await db.collection('hrd_lamaran').get();
  let html = '';
  if (snap.empty) html = '<p class="text-sm" style="color:#999">Belum ada lamaran masuk</p>';
  else {
    html = '<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Posisi</th><th>Email</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
    snap.forEach(d => {
      const p = d.data();
      const badge = p.status==='diterima'?'badge-success':p.status==='ditolak'?'badge-danger':'badge-warning';
      html += `<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.posisi||'-')}</td><td>${escHtml(p.email||'-')}</td><td>${formatDate(p.createdAt)}</td><td><span class="badge ${badge}">${p.status||'baru'}</span></td><td><button class="btn btn-xs btn-info" onclick="detailLamaran('${d.id}')">👁️</button> <button class="btn btn-xs btn-success" onclick="updateLamaran('${d.id}','diterima')">✅</button> <button class="btn btn-xs btn-danger" onclick="updateLamaran('${d.id}','ditolak')">❌</button></td></tr>`;
    });
    html += '</tbody></table></div>';
  }
  document.getElementById('lamaranList').innerHTML = html;
}

function detailLamaran(id) {
  db.collection('hrd_lamaran').doc(id).get().then(d => {
    const p = d.data();
    openModal(`<div class="modal-title">📄 Detail Lamaran</div>
      <div class="grid-2 mb-16">
        <div><b>Nama:</b> ${escHtml(p.nama)}</div>
        <div><b>Email:</b> ${escHtml(p.email||'-')}</div>
        <div><b>Telepon:</b> ${escHtml(p.telepon||'-')}</div>
        <div><b>Posisi:</b> ${escHtml(p.posisi||'-')}</div>
        <div><b>Pendidikan:</b> ${escHtml(p.pendidikan||'-')}</div>
        <div><b>Pengalaman:</b> ${escHtml(p.pengalaman||'-')}</div>
      </div>
      <div class="mb-16"><b>Tentang Diri:</b><div class="text-sm mt-8" style="white-space:pre-wrap;background:#f8f9ff;padding:12px;border-radius:6px">${escHtml(p.tentang||'-')}</div></div>
      <div><b>Tanggal Melamar:</b> ${formatDateTime(p.createdAt)}</div>`, true);
  });
}

async function updateLamaran(id, status) {
  await db.collection('hrd_lamaran').doc(id).update({status, updatedBy: currentUser.nama, updatedAt: new Date().toISOString()});
  toast(`Lamaran ${status}`, 'success');
  loadLamaranMasuk();
}

// ══════════════════════════════════════════════════════════════
// ── PUBLIC PORTAL CALON KARYAWAN — No Login Required ──────────
// Accessible via #calon hash
// ══════════════════════════════════════════════════════════════

async function renderPublicPortalCalon() {
  document.getElementById('app').innerHTML = `
    <div style="background:linear-gradient(135deg,var(--primary-dark),var(--primary));color:#fff;padding:24px 20px;text-align:center">
      <div style="font-size:1.4rem;font-weight:700">🏛️ LPK IJEF CORP</div>
      <div style="font-size:.9rem;opacity:.8;margin-top:4px">Portal Calon Karyawan</div>
    </div>
    <div style="max-width:900px;margin:0 auto;padding:20px">
      <div class="tabs" id="calonTabs">
        <div class="tab active" onclick="loadCalonTab('lowongan')">📝 Lowongan</div>
        <div class="tab" onclick="loadCalonTab('lamar')">📤 Kirim Lamaran</div>
        <div class="tab" onclick="loadCalonTab('tentang')">🏛️ Tentang Perusahaan</div>
        <div class="tab" onclick="loadCalonTab('peraturan')">📜 Peraturan</div>
      </div>
      <div id="calonContent"></div>
      <div class="text-center mt-16" style="padding:20px;border-top:1px solid var(--border)">
        <p class="text-xs" style="color:#999">© 2026 LPK IJEF Corp — HRD & Legal System</p>
        <button class="btn btn-outline btn-sm mt-8" onclick="window.location.hash='';window.location.reload()">🔐 Login Karyawan</button>
      </div>
    </div>`;
  loadCalonTab('lowongan');
}

async function loadCalonTab(tab) {
  document.querySelectorAll('#calonTabs .tab').forEach((t,i) => t.classList.toggle('active',
    (tab==='lowongan'&&i===0)||(tab==='lamar'&&i===1)||(tab==='tentang'&&i===2)||(tab==='peraturan'&&i===3)));
  const el = document.getElementById('calonContent');

  if (tab === 'lowongan') {
    const snap = await db.collection('hrd_lowongan').where('status','==','open').get();
    let html = '<div class="card"><div class="card-title mb-16">📝 Lowongan Tersedia</div>';
    if (snap.empty) html += '<div class="empty-state"><div class="icon">📝</div><p>Saat ini belum ada lowongan terbuka</p></div>';
    else {
      snap.forEach(d => {
        const p = d.data();
        html += `<div style="padding:16px;border:1px solid var(--border);border-radius:8px;margin-bottom:12px;border-left:4px solid var(--primary)">
          <div class="fw-700" style="font-size:1rem;color:var(--primary)">${escHtml(p.posisi)}</div>
          <div class="text-sm mt-8"><b>Departemen:</b> ${escHtml(p.departemen||'-')}</div>
          <div class="text-sm"><b>Deadline:</b> ${formatDate(p.deadline)}</div>
          ${p.deskripsi?`<div class="text-sm mt-8" style="color:#666">${escHtml(p.deskripsi)}</div>`:''}
          <button class="btn btn-primary btn-sm mt-8" onclick="loadCalonTab('lamar')">📤 Lamar Posisi Ini</button>
        </div>`;
      });
    }
    html += '</div>';
    el.innerHTML = html;

  } else if (tab === 'lamar') {
    // Load open positions for dropdown
    const snap = await db.collection('hrd_lowongan').where('status','==','open').get();
    let posOptions = '<option value="">-- Pilih Posisi --</option>';
    snap.forEach(d => { const p=d.data(); posOptions += `<option value="${escHtml(p.posisi)}">${escHtml(p.posisi)} (${escHtml(p.departemen||'-')})</option>`; });

    el.innerHTML = `<div class="card">
      <div class="card-title mb-16">📤 Form Lamaran Kerja</div>
      <p class="text-sm mb-16" style="color:#666">Isi form di bawah untuk mengajukan lamaran kerja di LPK IJEF Corp.</p>
      <div class="grid-2">
        <div class="form-group"><label>Nama Lengkap *</label><input class="form-control" id="lamNama"></div>
        <div class="form-group"><label>Email *</label><input class="form-control" type="email" id="lamEmail"></div>
        <div class="form-group"><label>No. Telepon *</label><input class="form-control" id="lamTelp"></div>
        <div class="form-group"><label>Posisi yang Dilamar *</label><select class="form-control" id="lamPosisi">${posOptions}</select></div>
        <div class="form-group"><label>Pendidikan Terakhir</label><select class="form-control" id="lamPendidikan"><option>SMA/SMK</option><option>D3</option><option>S1</option><option>S2</option><option>S3</option></select></div>
        <div class="form-group"><label>Pengalaman Kerja</label><select class="form-control" id="lamPengalaman"><option>Fresh Graduate</option><option>1-2 Tahun</option><option>3-5 Tahun</option><option>5+ Tahun</option></select></div>
      </div>
      <div class="form-group"><label>Tentang Diri / Motivasi</label><textarea class="form-control" id="lamTentang" placeholder="Ceritakan tentang diri Anda, keahlian, dan motivasi melamar..." style="min-height:120px"></textarea></div>
      <div class="form-group"><label>Alamat</label><textarea class="form-control" id="lamAlamat" placeholder="Alamat lengkap"></textarea></div>
      <button class="btn btn-primary" style="width:100%;padding:12px" onclick="kirimLamaran()">📤 Kirim Lamaran</button>
    </div>`;

  } else if (tab === 'tentang') {
    el.innerHTML = `<div class="card">
      <div class="card-title mb-16">🏛️ Tentang LPK IJEF CORP</div>
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:2rem">🏛️</div>
        <div class="fw-700" style="font-size:1.2rem;color:var(--primary);margin-top:8px">LPK IJEF CORP</div>
      </div>
      <div class="text-sm" style="line-height:1.8">
        <p>LPK IJEF Corp adalah lembaga pelatihan kerja yang berkomitmen untuk mengembangkan sumber daya manusia berkualitas. Kami menyediakan lingkungan kerja yang profesional, mendukung pertumbuhan karir, dan menghargai kontribusi setiap karyawan.</p>
        <div class="mt-16"><b>Mengapa Bergabung dengan Kami?</b></div>
        <ul style="padding-left:20px;margin-top:8px">
          <li>Lingkungan kerja profesional dan kondusif</li>
          <li>Kesempatan pengembangan karir</li>
          <li>Program pelatihan berkelanjutan</li>
          <li>Tunjangan dan benefit kompetitif</li>
          <li>Work-life balance</li>
        </ul>
        <div class="mt-16"><b>Nilai-Nilai Perusahaan:</b></div>
        <div class="grid-2 mt-8">
          <div class="stat-card"><div class="stat-icon">🎯</div><div class="fw-700">Integritas</div><div class="text-xs">Jujur dan bertanggung jawab</div></div>
          <div class="stat-card"><div class="stat-icon">🤝</div><div class="fw-700">Kerjasama</div><div class="text-xs">Kolaborasi tim yang solid</div></div>
          <div class="stat-card"><div class="stat-icon">🚀</div><div class="fw-700">Inovasi</div><div class="text-xs">Terus belajar dan berkembang</div></div>
          <div class="stat-card"><div class="stat-icon">💪</div><div class="fw-700">Profesional</div><div class="text-xs">Standar kerja tinggi</div></div>
        </div>
      </div>
    </div>`;

  } else if (tab === 'peraturan') {
    el.innerHTML = `<div class="card"><div class="card-title mb-16">📜 Peraturan Perusahaan — LPK IJEF CORP</div><p class="text-sm mb-16" style="color:#666">Berikut ringkasan peraturan perusahaan yang berlaku bagi seluruh karyawan.</p>${renderPeraturanHTML(true)}</div>`;
  }
}

async function kirimLamaran() {
  const nama = document.getElementById('lamNama').value.trim();
  const email = document.getElementById('lamEmail').value.trim();
  const telp = document.getElementById('lamTelp').value.trim();
  const posisi = document.getElementById('lamPosisi').value;

  if (!nama || !email || !telp) return toast('Nama, email, dan telepon wajib diisi', 'warning');
  if (!posisi) return toast('Pilih posisi yang dilamar', 'warning');

  const data = {
    nama,
    email,
    telepon: telp,
    posisi,
    pendidikan: document.getElementById('lamPendidikan').value,
    pengalaman: document.getElementById('lamPengalaman').value,
    tentang: document.getElementById('lamTentang').value,
    alamat: document.getElementById('lamAlamat').value,
    status: 'baru',
    createdAt: new Date().toISOString()
  };

  await db.collection('hrd_lamaran').add(data);

  // Also add to kandidat pipeline
  await db.collection('hrd_kandidat').add({
    nama: data.nama,
    email: data.email,
    posisi: data.posisi,
    stage: 'Applied',
    sumber: 'Portal Calon Karyawan',
    createdAt: new Date().toISOString()
  });

  document.getElementById('calonContent').innerHTML = `<div class="card text-center" style="padding:40px">
    <div style="font-size:3rem;margin-bottom:16px">✅</div>
    <div class="fw-700" style="font-size:1.2rem;color:var(--success)">Lamaran Berhasil Dikirim!</div>
    <p class="text-sm mt-8" style="color:#666">Terima kasih, ${escHtml(nama)}. Lamaran Anda untuk posisi <b>${escHtml(posisi)}</b> telah kami terima.</p>
    <p class="text-sm mt-8" style="color:#666">Tim HRD kami akan menghubungi Anda melalui email/telepon jika lolos seleksi administrasi.</p>
    <button class="btn btn-primary mt-16" onclick="loadCalonTab('lowongan')">📝 Lihat Lowongan Lain</button>
  </div>`;
  toast('Lamaran terkirim!', 'success');
}



// ── PORTAL DISC (Karyawan self-test, data auto-filled) ────────
function renderPortalDisc(){
  const main=document.getElementById('mainContent');
  const u=currentUser;
  main.innerHTML=`
  <div class="page-title"><span>🧠 DISC Test Saya</span></div>
  <div class="card">
    <div style="background:#e3f2fd;border-radius:8px;padding:14px;margin-bottom:16px;border-left:4px solid var(--info)">
      <p class="text-sm" style="line-height:1.6">Tes DISC membantu Anda memahami gaya komunikasi dan kepribadian Anda. Hasil tes akan tersimpan dan dapat dilihat oleh HR untuk evaluasi.</p>
    </div>
    <div style="text-align:center;margin-bottom:16px">
      <button class="btn btn-primary btn-lg" onclick="startPortalDiscTest()">🧠 Mulai Tes DISC</button>
    </div>
  </div>
  <div class="card"><div class="card-title">📋 Riwayat Tes DISC Saya</div>
    <div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Tipe</th><th>Profil</th><th>Periode</th><th>Aksi</th></tr></thead><tbody id="myDiscTbl"><tr><td colspan="5" class="text-center">Memuat...</td></tr></tbody></table></div>
  </div>`;
  loadMyDiscHistory();
}

function startPortalDiscTest(){
  const u=currentUser;
  const params=new URLSearchParams({nama:u.nama,nip:u.nip||'',dept:u.departemen||'',pos:u.posisi||u.role||'',mode:'evaluasi',periode:'Self-Assessment '+new Date().toLocaleDateString('id-ID',{month:'long',year:'numeric'})});
  window.open('disc-test.html#evaluasi?'+params.toString(),'_blank');
}

async function loadMyDiscHistory(){
  try{
    // Flexible name matching - case insensitive
    const snap=await db.collection('hrd_disc_results').get();
    const myName=currentUser.nama.toLowerCase().trim();
    const myNip=(currentUser.nip||'').toLowerCase().trim();
    let allResults=[];
    snap.forEach(d=>{const r=d.data();const rName=(r.nama||'').toLowerCase().trim();const rNip=(r.nip||'').toLowerCase().trim();if(rName===myName||(myNip&&rNip===myNip))allResults.push({id:d.id,...r});});
    allResults.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    let h='';
    if(!allResults.length)h='<tr><td colspan="5" class="text-center" style="color:var(--text-light)">Belum pernah tes</td></tr>';
    else allResults.slice(0,20).forEach(r=>{const dt=r.createdAt?new Date(r.createdAt).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'-';h+=`<tr><td>${dt}</td><td class="fw-700" style="color:var(--primary)">${escHtml(r.pattern||'-')}</td><td>${escHtml(r.profileName||'-')}</td><td>${escHtml(r.evaluasiPeriode||'-')}</td><td><button class="btn btn-xs btn-info" onclick="viewMyDiscDetail('${r.id}')">👁️ Detail</button></td></tr>`;});
    document.getElementById('myDiscTbl').innerHTML=h;
  }catch(e){document.getElementById('myDiscTbl').innerHTML='<tr><td colspan="5" class="text-center" style="color:var(--text-light)">Belum pernah tes</td></tr>';}
}

async function viewMyDiscDetail(id){
  // Reuse the admin detail view for consistency
  viewDiscResult(id);
}


// ── PORTAL: REIMBURSE ─────────────────────────────────────────
async function renderPortalReimburse(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>🧾 Reimbursement Saya</span><button class="btn btn-primary btn-sm" onclick="modalReimburse()">+ Ajukan</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Kategori</th><th>Jumlah</th><th>Status</th><th>Tanggal</th></tr></thead><tbody id="tblMyReimb"></tbody></table></div></div>`;const snap=await db.collection('hrd_reimbursement').get();const items=[];snap.forEach(d=>{const r=d.data();if((r.nama||'').toLowerCase()===currentUser.nama.toLowerCase())items.push(r);});let h='';if(!items.length)h='<tr><td colspan="4" class="text-center">Belum ada</td></tr>';else items.forEach(p=>{h+=`<tr><td>${escHtml(p.kategori||'-')}</td><td>${formatCurrency(p.jumlah)}</td><td><span class="badge badge-${p.status==='approved'?'success':p.status==='rejected'?'danger':'warning'}">${p.status}</span></td><td>${formatDate(p.createdAt)}</td></tr>`;});document.getElementById('tblMyReimb').innerHTML=h;}

// ── PORTAL: KASBON ────────────────────────────────────────────
async function renderPortalKasbon(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>💳 Kasbon & Loan Saya</span><button class="btn btn-primary btn-sm" onclick="modalKasbon()">+ Ajukan</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Jenis</th><th>Total</th><th>Angsuran/Bln</th><th>Sudah Bayar</th><th>Sisa</th><th>Status</th></tr></thead><tbody id="tblMyKasbon"></tbody></table></div></div>`;const snap=await db.collection('hrd_kasbon').get();const items=[];snap.forEach(d=>{const r=d.data();if((r.nama||'').toLowerCase()===currentUser.nama.toLowerCase())items.push(r);});let h='';if(!items.length)h='<tr><td colspan="6" class="text-center">Belum ada</td></tr>';else items.forEach(p=>{const angsuran=Math.ceil((p.jumlah||0)/(p.cicilan||1));const sisa=Math.max(0,(p.jumlah||0)-(p.sudahBayar||0));h+=`<tr><td>${escHtml(p.jenis||'-')}</td><td>${formatCurrency(p.jumlah)}</td><td>${formatCurrency(angsuran)}</td><td>${formatCurrency(p.sudahBayar||0)}</td><td class="fw-700" style="color:${sisa>0?'var(--danger)':'var(--success)'}">${formatCurrency(sisa)}</td><td><span class="badge badge-${p.status==='aktif'?'success':p.status==='lunas'?'primary':'warning'}">${p.status}</span></td></tr>`;});document.getElementById('tblMyKasbon').innerHTML=h;}

// ── PORTAL: KPI ───────────────────────────────────────────────
async function renderPortalKPI(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>📈 KPI Saya</span></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Periode</th><th>Skor</th><th>Grade</th><th>Penilai</th><th>Catatan</th></tr></thead><tbody id="tblMyKPI"></tbody></table></div></div>`;const snap=await db.collection('hrd_kpi').get();const items=[];snap.forEach(d=>{const r=d.data();if((r.nama||'').toLowerCase()===currentUser.nama.toLowerCase())items.push(r);});items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));let h='';if(!items.length)h='<tr><td colspan="5" class="text-center">Belum ada penilaian</td></tr>';else items.forEach(p=>{const grade=p.skor>=90?'A':p.skor>=80?'B':p.skor>=70?'C':p.skor>=60?'D':'E';h+=`<tr><td>${escHtml(p.periode||'-')}</td><td><span class="badge badge-${p.skor>=80?'success':p.skor>=60?'warning':'danger'}">${p.skor}/100</span></td><td class="fw-700">${grade}</td><td>${escHtml(p.penilai||'-')}</td><td style="font-size:.78rem">${escHtml(p.catatan||'-')}</td></tr>`;});document.getElementById('tblMyKPI').innerHTML=h;}

// ── PORTAL: SETTING AKUN ──────────────────────────────────────
function renderPortalSetting(){const u=currentUser;const main=document.getElementById('mainContent');const avatar=u.profilePic||'';main.innerHTML=`<div class="page-title"><span>⚙️ Setting Akun</span></div><div class="card"><h4 class="color-primary mb-16">👤 Data Pribadi</h4>
  <div style="display:flex;align-items:center;gap:20px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--border)">
    <div id="psAvatarPreview" style="width:80px;height:80px;border-radius:50%;border:3px solid var(--accent);overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f5f5f5;font-size:2rem;font-weight:700;color:var(--primary);cursor:pointer" onclick="document.getElementById('psAvatarFile').click()">${avatar?`<img src="${avatar}" style="width:100%;height:100%;object-fit:cover">`:`${u.nama?.charAt(0)||'?'}`}</div>
    <div>
      <input type="file" id="psAvatarFile" accept="image/png,image/jpeg,image/webp" style="display:none" onchange="previewProfilePic(this)">
      <button class="btn btn-sm btn-primary" onclick="document.getElementById('psAvatarFile').click()">📷 Upload Foto Profil</button>
      <div class="text-xs mt-4" style="color:#999">Klik foto atau tombol untuk upload. Format: JPG/PNG.</div>
    </div>
  </div>
  <div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="psNama" value="${escHtml(u.nama||'')}"></div><div class="form-group"><label>Username</label><input class="form-control" id="psUser" value="${escHtml(u.id||'')}"></div><div class="form-group"><label>Email</label><input class="form-control" id="psEmail" value="${escHtml(u.email||'')}"></div><div class="form-group"><label>Telepon</label><input class="form-control" id="psTelp" value="${escHtml(u.telepon||'')}"></div><div class="form-group"><label>Password Baru</label><input class="form-control" type="password" id="psPass" placeholder="Kosongkan jika tidak diubah"></div><div class="form-group"><label>Departemen</label><input class="form-control" value="${escHtml(u.departemen||'-')}" readonly></div></div><button class="btn btn-primary" onclick="simpanPortalSetting()">💾 Simpan Perubahan</button></div>`;}

function previewProfilePic(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      // Crop to square center and resize to 128x128
      const canvas=document.createElement('canvas');
      canvas.width=128;canvas.height=128;
      const ctx=canvas.getContext('2d');
      const size=Math.min(img.width,img.height);
      const sx=(img.width-size)/2,sy=(img.height-size)/2;
      ctx.beginPath();ctx.arc(64,64,64,0,Math.PI*2);ctx.clip();
      ctx.drawImage(img,sx,sy,size,size,0,0,128,128);
      window._profilePic=canvas.toDataURL('image/jpeg',0.8);
      document.getElementById('psAvatarPreview').innerHTML=`<img src="${window._profilePic}" style="width:100%;height:100%;object-fit:cover">`;
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

async function simpanPortalSetting(){const data={nama:document.getElementById('psNama').value,email:document.getElementById('psEmail').value,telepon:document.getElementById('psTelp').value,updatedAt:new Date().toISOString()};if(window._profilePic)data.profilePic=window._profilePic;const newPass=document.getElementById('psPass').value;if(newPass)data.password=newPass;const newUser=document.getElementById('psUser').value.trim();if(newUser&&newUser!==currentUser.id){await db.collection('hrd_users').doc(newUser).set({...currentUser,...data,username:newUser});await db.collection('hrd_users').doc(currentUser.id).delete();currentUser={...currentUser,...data,id:newUser};localStorage.setItem('hrd_session',JSON.stringify(currentUser));}else{await db.collection('hrd_users').doc(currentUser.id).update(data);currentUser={...currentUser,...data};localStorage.setItem('hrd_session',JSON.stringify(currentUser));}window._profilePic=null;toast('Akun diperbarui','success');renderApp();}

