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
      <button class="btn btn-sm" style="background:#7b1fa2;color:#fff" onclick="navigateTo('portal-gaji')">💰 Slip Gaji</button>
      <button class="btn btn-sm" style="background:#00796b;color:#fff" onclick="navigateTo('portal-kpi')">📈 KPI</button>
      <button class="btn btn-sm" style="background:#e65100;color:#fff" onclick="navigateTo('portal-jobdesk')">📋 Jobdesk</button>
      <button class="btn btn-sm" style="background:#4e342e;color:#fff" onclick="navigateTo('portal-disc')">🧠 DISC Test</button>
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

// ══════════════════════════════════════════════════════════════
// ── KELOLA JOBDESK — Admin assign jobdesk ke karyawan ─────────
// ══════════════════════════════════════════════════════════════

async function renderJobdeskMgmt() {
  if(!hasAccess(3))return document.getElementById('mainContent').innerHTML='<div class="card"><p>Akses ditolak.</p></div>';
  const main=document.getElementById('mainContent');
  main.innerHTML=`<div class="page-title"><span>📋 Kelola Jobdesk Karyawan</span><button class="btn btn-primary btn-sm" onclick="modalJobdeskPilih()">+ Atur Jobdesk</button></div><div class="card"><p class="text-sm mb-16" style="color:#666">Atur deskripsi pekerjaan, tanggung jawab, dan KPI untuk setiap karyawan. Data diambil dari Data Karyawan.</p><div class="flex gap-8 mb-16"><input class="form-control" placeholder="🔍 Cari nama..." id="srcJobdesk" oninput="filterJobdeskList()"><select class="form-control" style="max-width:180px" id="filterJobdeskDept" onchange="filterJobdeskList()"><option value="">Semua Dept</option></select></div><div class="table-wrap"><table><thead><tr><th>NIP</th><th>Nama</th><th>Departemen</th><th>Posisi</th><th>Jobdesk</th><th>Aksi</th></tr></thead><tbody id="tblJobdesk"></tbody></table></div></div>`;
  // Get ALL karyawan (no status filter to avoid index issues)
  const[karySnap,jobdeskSnap]=await Promise.all([db.collection('hrd_karyawan').get(),db.collection('hrd_jobdesk').get()]);
  const jobdeskMap={};jobdeskSnap.forEach(d=>{const data=d.data();jobdeskMap[data.karyawanId||data.userId||'']=d.id;});
  window._jobdeskKaryawan=[];
  const depts=new Set();
  karySnap.forEach(d=>{const p={id:d.id,...d.data()};const st=(p.status||'').toLowerCase();if(st==='nonaktif')return;p.hasJobdesk=!!jobdeskMap[d.id];p.jobdeskDocId=jobdeskMap[d.id]||null;window._jobdeskKaryawan.push(p);depts.add(p.departemen||'');});
  // Sort by nama
  window._jobdeskKaryawan.sort((a,b)=>(a.nama||'').localeCompare(b.nama||''));
  const sel=document.getElementById('filterJobdeskDept');
  depts.forEach(d=>{if(d)sel.innerHTML+=`<option>${escHtml(d)}</option>`;});
  filterJobdeskList();
}

async function modalJobdeskPilih(){
  // Show dropdown to pick karyawan
  const karySnap=await db.collection('hrd_karyawan').get();
  let opts='<option value="">-- Pilih Karyawan --</option>';
  const list=[];karySnap.forEach(d=>{const p=d.data();if((p.status||'').toLowerCase()!=='nonaktif')list.push({id:d.id,...p});});
  list.sort((a,b)=>(a.nama||'').localeCompare(b.nama||''));
  list.forEach(k=>{opts+=`<option value="${k.id}" data-nama="${escHtml(k.nama)}" data-posisi="${escHtml(k.posisi||'')}">${escHtml(k.nama)} — ${escHtml(k.departemen||'-')} (${escHtml(k.posisi||'-')})</option>`;});
  openModal(`<div class="modal-title">📋 Pilih Karyawan untuk Atur Jobdesk</div>
    <div class="form-group"><label>Karyawan</label><select class="form-control" id="jdPilihKary">${opts}</select></div>
    <button class="btn btn-primary" onclick="openJobdeskFromDropdown()">Lanjut →</button>`);
}

function openJobdeskFromDropdown(){
  const sel=document.getElementById('jdPilihKary');
  const id=sel.value;
  if(!id)return toast('Pilih karyawan dulu','warning');
  const nama=sel.options[sel.selectedIndex].dataset.nama||'';
  const posisi=sel.options[sel.selectedIndex].dataset.posisi||'';
  closeModalDirect();
  modalJobdesk(id,nama,posisi);
}

function filterJobdeskList(){
  const q=(document.getElementById('srcJobdesk')?.value||'').toLowerCase();
  const dept=document.getElementById('filterJobdeskDept')?.value||'';
  const filtered=(window._jobdeskKaryawan||[]).filter(k=>{
    if(q&&!k.nama?.toLowerCase().includes(q))return false;
    if(dept&&k.departemen!==dept)return false;
    return true;
  });
  let h='';
  if(!filtered.length)h='<tr><td colspan="6" class="text-center">Tidak ada data karyawan</td></tr>';
  else filtered.forEach(k=>{
    h+=`<tr><td class="text-xs">${escHtml(k.nip||'-')}</td><td class="fw-700">${escHtml(k.nama)}</td><td>${escHtml(k.departemen||'-')}</td><td>${escHtml(k.posisi||'-')}</td><td><span class="badge badge-${k.hasJobdesk?'success':'warning'}">${k.hasJobdesk?'✅ Sudah':'⚠️ Belum'}</span></td><td><button class="btn btn-xs btn-info" onclick="modalJobdesk('${k.id}','${escHtml(k.nama)}','${escHtml(k.posisi||'')}')">${k.hasJobdesk?'✏️ Edit':'+ Atur'}</button></td></tr>`;
  });
  document.getElementById('tblJobdesk').innerHTML=h;
}

async function modalJobdesk(karyawanId, nama, posisi) {
  // Load existing jobdesk by karyawanId
  const snap=await db.collection('hrd_jobdesk').where('karyawanId','==',karyawanId).get();
  let p={},docId=null;
  if(!snap.empty){p=snap.docs[0].data();docId=snap.docs[0].id;}
  else{
    // Fallback: check by userId (old format)
    const snap2=await db.collection('hrd_jobdesk').where('userId','==',karyawanId).get();
    if(!snap2.empty){p=snap2.docs[0].data();docId=snap2.docs[0].id;}
  }

  openModal(`<div class="modal-title">📋 Jobdesk: ${escHtml(nama)}</div>
    <div style="background:#f0f4ff;padding:10px 14px;border-radius:8px;margin-bottom:16px"><div class="text-xs"><b>Posisi:</b> ${escHtml(posisi||'-')}</div></div>
    <div class="form-group"><label>Deskripsi Pekerjaan</label><textarea class="form-control" id="jdDesc" style="min-height:100px" placeholder="Deskripsi umum posisi dan pekerjaan...">${escHtml(p.deskripsi||'')}</textarea></div>
    <div class="form-group"><label>Tanggung Jawab (per baris)</label><textarea class="form-control" id="jdTanggung" style="min-height:120px" placeholder="Mengelola data karyawan\nMembuat laporan bulanan\nKoordinasi dengan tim">${escHtml(p.tanggungJawab||'')}</textarea></div>
    <div class="form-group"><label>Kualifikasi (per baris)</label><textarea class="form-control" id="jdKualifikasi" style="min-height:80px" placeholder="Min. S1 Manajemen\nPengalaman 2 tahun\nMenguasai MS Office">${escHtml(p.kualifikasi||'')}</textarea></div>
    <div class="form-group"><label>Target KPI</label><textarea class="form-control" id="jdKPI" placeholder="Target yang harus dicapai...">${escHtml(p.kpi||'')}</textarea></div>
    <div class="flex gap-8"><button class="btn btn-primary" onclick="simpanJobdesk('${karyawanId}','${docId||''}')">💾 Simpan Jobdesk</button>${docId?`<button class="btn btn-danger" onclick="hapusDoc('hrd_jobdesk','${docId}','jobdesk-mgmt')">🗑️ Hapus</button>`:''}</div>`,true);
}

async function simpanJobdesk(karyawanId, docId) {
  const data={karyawanId,userId:karyawanId,deskripsi:document.getElementById('jdDesc').value,tanggungJawab:document.getElementById('jdTanggung').value,kualifikasi:document.getElementById('jdKualifikasi').value,kpi:document.getElementById('jdKPI').value,updatedAt:new Date().toISOString()};
  if(docId)await db.collection('hrd_jobdesk').doc(docId).update(data);
  else await db.collection('hrd_jobdesk').add({...data,createdAt:new Date().toISOString()});
  closeModalDirect();toast('Jobdesk disimpan','success');renderJobdeskMgmt();
}

// ══════════════════════════════════════════════════════════════
// ── EDIT FUNCTIONS — untuk semua modul ────────────────────────
// ══════════════════════════════════════════════════════════════

function editCutiDoc(id){db.collection('hrd_cuti').doc(id).get().then(d=>{const p=d.data();openModal(`<div class="modal-title">✏️ Edit Cuti/Izin</div><div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="ecNama" value="${escHtml(p.nama||'')}"></div><div class="form-group"><label>Jenis</label><select class="form-control" id="ecJenis"><option ${p.jenis==='Cuti Tahunan'?'selected':''}>Cuti Tahunan</option><option ${p.jenis==='Cuti Sakit'?'selected':''}>Cuti Sakit</option><option ${p.jenis==='Izin Pribadi'?'selected':''}>Izin Pribadi</option><option ${p.jenis==='WFH'?'selected':''}>WFH</option><option ${p.jenis==='Cuti Melahirkan'?'selected':''}>Cuti Melahirkan</option></select></div></div><div class="grid-2"><div class="form-group"><label>Mulai</label><input class="form-control" type="date" id="ecMulai" value="${p.mulai||''}"></div><div class="form-group"><label>Selesai</label><input class="form-control" type="date" id="ecSelesai" value="${p.selesai||''}"></div></div><div class="form-group"><label>Status</label><select class="form-control" id="ecStatus"><option value="pending" ${p.status==='pending'?'selected':''}>Pending</option><option value="approved" ${p.status==='approved'?'selected':''}>Approved</option><option value="rejected" ${p.status==='rejected'?'selected':''}>Rejected</option></select></div><div class="form-group"><label>Keterangan</label><textarea class="form-control" id="ecKet">${escHtml(p.keterangan||'')}</textarea></div><button class="btn btn-primary" onclick="updateCutiDoc('${id}')">💾 Simpan</button><button class="btn btn-danger" style="margin-left:8px" onclick="hapusDoc('hrd_cuti','${id}','cuti')">🗑️ Hapus</button>`);});}
async function updateCutiDoc(id){const mulai=document.getElementById('ecMulai').value,selesai=document.getElementById('ecSelesai').value;const durasi=Math.max(1,Math.ceil((new Date(selesai)-new Date(mulai))/86400000)+1);await db.collection('hrd_cuti').doc(id).update({nama:document.getElementById('ecNama').value,jenis:document.getElementById('ecJenis').value,mulai,selesai,durasi,status:document.getElementById('ecStatus').value,keterangan:document.getElementById('ecKet').value,updatedAt:new Date().toISOString()});closeModalDirect();toast('Cuti diupdate','success');renderCuti();}

function editOTDoc(id){db.collection('hrd_overtime').doc(id).get().then(d=>{const p=d.data();openModal(`<div class="modal-title">✏️ Edit Overtime</div><div class="form-group"><label>Nama</label><input class="form-control" id="eoNama" value="${escHtml(p.nama||'')}"></div><div class="grid-3"><div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="eoTgl" value="${p.tanggal||''}"></div><div class="form-group"><label>Mulai</label><input class="form-control" type="time" id="eoStart" value="${p.jamMulai||''}"></div><div class="form-group"><label>Selesai</label><input class="form-control" type="time" id="eoEnd" value="${p.jamSelesai||''}"></div></div><div class="form-group"><label>Status</label><select class="form-control" id="eoStatus"><option value="pending" ${p.status==='pending'?'selected':''}>Pending</option><option value="approved" ${p.status==='approved'?'selected':''}>Approved</option><option value="rejected" ${p.status==='rejected'?'selected':''}>Rejected</option></select></div><div class="form-group"><label>Alasan</label><textarea class="form-control" id="eoAlasan">${escHtml(p.alasan||'')}</textarea></div><button class="btn btn-primary" onclick="updateOTDoc('${id}')">💾 Simpan</button><button class="btn btn-danger" style="margin-left:8px" onclick="hapusDoc('hrd_overtime','${id}','overtime')">🗑️ Hapus</button>`);});}
async function updateOTDoc(id){const s=document.getElementById('eoStart').value,e=document.getElementById('eoEnd').value;const durasi=s&&e?Math.max(0,((new Date('2000-01-01T'+e)-new Date('2000-01-01T'+s))/3600000)).toFixed(1):0;await db.collection('hrd_overtime').doc(id).update({nama:document.getElementById('eoNama').value,tanggal:document.getElementById('eoTgl').value,jamMulai:s,jamSelesai:e,durasi:parseFloat(durasi),status:document.getElementById('eoStatus').value,alasan:document.getElementById('eoAlasan').value,updatedAt:new Date().toISOString()});closeModalDirect();toast('Overtime diupdate','success');renderOvertime();}

function editReimb(id){db.collection('hrd_reimbursement').doc(id).get().then(d=>{const p=d.data();openModal(`<div class="modal-title">✏️ Edit Reimbursement</div><div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="erNama" value="${escHtml(p.nama||'')}"></div><div class="form-group"><label>Kategori</label><select class="form-control" id="erKat"><option ${p.kategori==='Transport'?'selected':''}>Transport</option><option ${p.kategori==='Makan'?'selected':''}>Makan</option><option ${p.kategori==='Kesehatan'?'selected':''}>Kesehatan</option><option ${p.kategori==='Operasional'?'selected':''}>Operasional</option></select></div></div><div class="form-group"><label>Jumlah (Rp)</label><input class="form-control" type="number" id="erJumlah" value="${p.jumlah||0}"></div><div class="form-group"><label>Status</label><select class="form-control" id="erStatus"><option value="pending" ${p.status==='pending'?'selected':''}>Pending</option><option value="approved" ${p.status==='approved'?'selected':''}>Approved</option><option value="rejected" ${p.status==='rejected'?'selected':''}>Rejected</option></select></div><div class="form-group"><label>Keterangan</label><textarea class="form-control" id="erKet">${escHtml(p.keterangan||'')}</textarea></div><button class="btn btn-primary" onclick="updateReimb('${id}')">💾 Simpan</button><button class="btn btn-danger" style="margin-left:8px" onclick="hapusDoc('hrd_reimbursement','${id}','reimbursement')">🗑️ Hapus</button>`);});}
async function updateReimb(id){await db.collection('hrd_reimbursement').doc(id).update({nama:document.getElementById('erNama').value,kategori:document.getElementById('erKat').value,jumlah:Number(document.getElementById('erJumlah').value)||0,status:document.getElementById('erStatus').value,keterangan:document.getElementById('erKet').value,updatedAt:new Date().toISOString()});closeModalDirect();toast('Reimbursement diupdate','success');renderReimbursement();}

function editKasbonDoc(id){db.collection('hrd_kasbon').doc(id).get().then(d=>{const p=d.data();openModal(`<div class="modal-title">✏️ Edit Kasbon/Loan</div><div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="ekNama" value="${escHtml(p.nama||'')}"></div><div class="form-group"><label>Jenis</label><select class="form-control" id="ekJenis"><option ${p.jenis==='Kasbon'?'selected':''}>Kasbon</option><option ${p.jenis==='Pinjaman Karyawan'?'selected':''}>Pinjaman Karyawan</option></select></div></div><div class="grid-2"><div class="form-group"><label>Jumlah</label><input class="form-control" type="number" id="ekJumlah" value="${p.jumlah||0}"></div><div class="form-group"><label>Cicilan (bln)</label><input class="form-control" type="number" id="ekCicilan" value="${p.cicilan||1}"></div></div><div class="form-group"><label>Status</label><select class="form-control" id="ekStatus"><option value="pending" ${p.status==='pending'?'selected':''}>Pending</option><option value="approved" ${p.status==='approved'?'selected':''}>Approved</option><option value="rejected" ${p.status==='rejected'?'selected':''}>Rejected</option><option value="lunas" ${p.status==='lunas'?'selected':''}>Lunas</option></select></div><button class="btn btn-primary" onclick="updateKasbonDoc('${id}')">💾 Simpan</button><button class="btn btn-danger" style="margin-left:8px" onclick="hapusDoc('hrd_kasbon','${id}','kasbon')">🗑️ Hapus</button>`);});}
async function updateKasbonDoc(id){await db.collection('hrd_kasbon').doc(id).update({nama:document.getElementById('ekNama').value,jenis:document.getElementById('ekJenis').value,jumlah:Number(document.getElementById('ekJumlah').value)||0,cicilan:Number(document.getElementById('ekCicilan').value)||1,status:document.getElementById('ekStatus').value,updatedAt:new Date().toISOString()});closeModalDirect();toast('Kasbon diupdate','success');renderKasbon();}

// ── HELPER HAPUS ──────────────────────────────────────────────
async function hapusDoc(col,id,page){if(!confirm('Yakin hapus?'))return;await db.collection(col).doc(id).delete();toast('Dihapus','success');navigateTo(page);}

// ── ABSENSI ADMIN (delegate to absensi-ijef.js) ───────────────
function renderAbsensiAdmin(){if(typeof renderAbsensiIJEF==='function')renderAbsensiIJEF();else document.getElementById('mainContent').innerHTML='<div class="card">Loading absensi...</div>';}

// ══════════════════════════════════════════════════════════════
