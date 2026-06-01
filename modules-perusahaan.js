'use strict';
// ── PENGUMUMAN ────────────────────────────────────────────────
async function renderPengumuman(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>📢 Pengumuman</span>${hasAccess(3)?'<button class="btn btn-primary btn-sm" onclick="modalPengumuman()">+ Tambah</button>':''}</div><div id="pengumumanList">Loading...</div>`;try{const snap=await db.collection('hrd_pengumuman').get();const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));let h='';if(!items.length)h='<div class="empty-state"><div class="icon">📢</div><p>Belum ada</p></div>';else items.forEach(p=>{h+=`<div class="card" style="cursor:pointer" onclick="viewPengumuman('${p.id}')"><div class="card-header"><div class="card-title">${escHtml(p.judul)}</div><div style="display:flex;gap:8px;align-items:center"><div class="text-xs" style="color:#999">${formatDateTime(p.createdAt)}</div>${hasAccess(3)?`<button class="btn btn-xs btn-danger" onclick="event.stopPropagation();hapusDoc('hrd_pengumuman','${p.id}','pengumuman')">🗑️</button>`:''}</div></div><div class="text-sm" style="color:var(--text-light)">${escHtml((p.isi||'').substring(0,100))}${(p.isi||'').length>100?'...':''}</div></div>`;});document.getElementById('pengumumanList').innerHTML=h;}catch(e){document.getElementById('pengumumanList').innerHTML='<div class="empty-state"><div class="icon">📢</div><p>Belum ada pengumuman</p></div>';}}
function viewPengumuman(id){db.collection('hrd_pengumuman').doc(id).get().then(d=>{const p=d.data();openModal(`<div class="modal-title">📢 ${escHtml(p.judul||'')}</div><div style="font-size:.78rem;color:#999;margin-bottom:16px">${formatDateTime(p.createdAt)} — Oleh: ${escHtml(p.dibuatOleh||'-')}</div><div style="font-size:.9rem;line-height:1.8;white-space:pre-wrap">${escHtml(p.isi||'')}</div>`);});}
function modalPengumuman(){openModal(`<div class="modal-title">Tambah Pengumuman</div><div class="form-group"><label>Judul</label><input class="form-control" id="pgJudul"></div><div class="form-group"><label>Isi</label><textarea class="form-control" id="pgIsi" style="min-height:150px"></textarea></div><button class="btn btn-primary" onclick="simpanPengumuman()">Publikasikan</button>`);}
async function simpanPengumuman(){const data={judul:document.getElementById('pgJudul').value,isi:document.getElementById('pgIsi').value,dibuatOleh:currentUser.nama,createdAt:new Date().toISOString()};if(!data.judul)return toast('Judul wajib','warning');await db.collection('hrd_pengumuman').add(data);const users=await getAllUsers();await sendNotificationBulk(users.map(u=>u.id),'📢 Pengumuman',data.judul);closeModalDirect();toast('Dipublikasikan','success');renderPengumuman();}

// ── MANAJEMEN AKUN ────────────────────────────────────────────
async function renderAkun(){if(!hasAccess(6))return document.getElementById('mainContent').innerHTML='<div class="card"><p>Akses ditolak.</p></div>';const main=document.getElementById('mainContent');const baseUrl = window.location.origin + window.location.pathname;main.innerHTML=`<div class="page-title"><span>👤 Manajemen Akun</span><button class="btn btn-primary btn-sm" onclick="modalAkun()">+ Tambah</button></div>
  <!-- DATA PERUSAHAAN -->
  <div class="card mb-16" id="companyDataCard">
    <div class="card-title mb-16">🏢 Data Perusahaan</div>
    <div class="fw-700 text-sm mb-8 color-primary">Informasi Perusahaan</div>
    <div class="grid-2">
      <div class="form-group"><label>Nama Perusahaan</label><input class="form-control" id="cpNama" placeholder="PT. IJEF Corp"></div>
      <div class="form-group"><label>NPWP</label><input class="form-control" id="cpNpwp" placeholder="00.000.000.0-000.000"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Alamat</label><input class="form-control" id="cpAlamat" placeholder="Jl. ..."></div>
      <div class="form-group"><label>Kota</label><input class="form-control" id="cpKota"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Telepon</label><input class="form-control" id="cpTelp"></div>
      <div class="form-group"><label>Email</label><input class="form-control" id="cpEmail" type="email"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Jumlah Karyawan</label><input class="form-control" id="cpJmlKaryawan" type="number" placeholder="50"></div>
      <div class="form-group"><label>Tahun Berdiri</label><input class="form-control" id="cpTahunBerdiri" type="number" placeholder="2020"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>No. Izin Usaha (NIB)</label><input class="form-control" id="cpNIB" placeholder="No. NIB"></div>
      <div class="form-group"><label>No. Izin Kemenkumham</label><input class="form-control" id="cpKemenkumham" placeholder="No. SK Kemenkumham"></div>
    </div>
    <div class="form-group"><label>Logo Perusahaan</label>
      <div style="display:flex;align-items:center;gap:16px;margin-top:8px">
        <div id="cpLogoPreview" style="width:64px;height:64px;border-radius:50%;border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f8f9ff"><span style="font-size:1.5rem">🏛️</span></div>
        <div>
          <input type="file" id="cpLogoFile" accept="image/png,image/jpeg,image/webp" style="display:none" onchange="previewCompanyLogo(this)">
          <button class="btn btn-primary btn-sm" onclick="document.getElementById('cpLogoFile').click()">📁 Upload Logo (JPG/PNG)</button>
          <div class="text-xs mt-4" style="color:#999">Format: JPG/PNG/WebP. Akan digunakan sebagai ikon aplikasi IMS.</div>
        </div>
      </div>
    </div>
    <button class="btn btn-primary mt-16" onclick="simpanDataPerusahaan()">💾 Simpan Data Perusahaan</button>
  </div>
  <div class="card mb-16"><div class="card-title">📲 Bagikan Aplikasi</div><p class="text-sm mb-16" style="color:#666">Bagikan link download aplikasi ke karyawan agar mereka dapat mengakses portal lewat browser atau PWA di Android, iOS, Windows, dan Mac.</p><div class="form-group"><label>Link Aplikasi</label><input class="form-control" readonly id="adminAppLink" value="${baseUrl}"></div><div class="flex gap-8"><button class="btn btn-primary btn-sm" onclick="copyDownloadLink()">📋 Salin Link</button><button class="btn btn-success btn-sm" onclick="shareDownloadWhatsApp()">💬 Share WA</button><button class="btn btn-info btn-sm" onclick="shareDownloadEmail()">✉️ Email</button></div></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Username</th><th>Nama</th><th>Role</th><th>Dept</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblAkun"></tbody></table></div></div>`;loadCompanyData();const snap=await db.collection('hrd_users').get();let h='';snap.forEach(d=>{const p=d.data();h+=`<tr><td class="fw-700">${escHtml(d.id)}</td><td>${escHtml(p.nama)}</td><td><span class="badge badge-primary">${p.role}</span></td><td>${escHtml(p.departemen||'-')}</td><td><span class="badge badge-${p.status==='aktif'?'success':'danger'}">${p.status||'aktif'}</span></td><td><button class="btn btn-xs btn-info" onclick="modalAkun('${d.id}')">✏️</button></td></tr>`;});document.getElementById('tblAkun').innerHTML=h;}

// ── DATA PERUSAHAAN ───────────────────────────────────────────
async function loadCompanyData(){
  const doc=await db.collection('hrd_settings').doc('perusahaan').get();
  if(!doc.exists)return;
  const d=doc.data();
  if(d.nama)document.getElementById('cpNama').value=d.nama;
  if(d.npwp)document.getElementById('cpNpwp').value=d.npwp;
  if(d.alamat)document.getElementById('cpAlamat').value=d.alamat;
  if(d.kota)document.getElementById('cpKota').value=d.kota;
  if(d.telepon)document.getElementById('cpTelp').value=d.telepon;
  if(d.email)document.getElementById('cpEmail').value=d.email;
  if(d.jumlahKaryawan)document.getElementById('cpJmlKaryawan').value=d.jumlahKaryawan;
  if(d.tahunBerdiri)document.getElementById('cpTahunBerdiri').value=d.tahunBerdiri;
  if(d.nib)document.getElementById('cpNIB').value=d.nib;
  if(d.kemenkumham)document.getElementById('cpKemenkumham').value=d.kemenkumham;
  if(d.logo){
    document.getElementById('cpLogoPreview').innerHTML=`<img src="${d.logo}" style="width:100%;height:100%;object-fit:contain">`;
    window._companyLogo=d.logo;
  }
}

function previewCompanyLogo(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    // Show crop modal
    openModal(`<div class="modal-title">✂️ Crop Logo (Bulat)</div>
      <p class="text-sm mb-16" style="color:#666">Geser dan zoom gambar untuk menyesuaikan area crop bulat.</p>
      <div style="position:relative;width:280px;height:280px;margin:0 auto;border-radius:50%;overflow:hidden;border:3px solid var(--accent);background:#000">
        <canvas id="cropCanvas" width="280" height="280" style="width:100%;height:100%;cursor:move"></canvas>
      </div>
      <div class="flex gap-8 mt-16" style="justify-content:center;align-items:center">
        <span class="text-xs">Zoom:</span>
        <input type="range" id="cropZoom" min="50" max="300" value="100" oninput="updateCropPreview()" style="flex:1;max-width:200px">
      </div>
      <div class="flex gap-8 mt-16" style="justify-content:center">
        <button class="btn btn-primary" onclick="applyCrop()">✅ Gunakan Logo Ini</button>
        <button class="btn btn-outline" onclick="closeModalDirect()">Batal</button>
      </div>`,true);
    // Setup crop
    const img=new Image();
    img.onload=()=>{
      window._cropImg=img;
      window._cropOffsetX=0;
      window._cropOffsetY=0;
      window._cropZoom=100;
      updateCropPreview();
      // Drag to move
      const canvas=document.getElementById('cropCanvas');
      let dragging=false,startX=0,startY=0;
      canvas.onmousedown=canvas.ontouchstart=(ev)=>{dragging=true;const e=ev.touches?ev.touches[0]:ev;startX=e.clientX-window._cropOffsetX;startY=e.clientY-window._cropOffsetY;ev.preventDefault();};
      document.onmousemove=document.ontouchmove=(ev)=>{if(!dragging)return;const e=ev.touches?ev.touches[0]:ev;window._cropOffsetX=e.clientX-startX;window._cropOffsetY=e.clientY-startY;updateCropPreview();};
      document.onmouseup=document.ontouchend=()=>{dragging=false;};
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

function updateCropPreview(){
  const canvas=document.getElementById('cropCanvas');if(!canvas||!window._cropImg)return;
  const ctx=canvas.getContext('2d');
  const img=window._cropImg;
  const zoom=(document.getElementById('cropZoom')?.value||100)/100;
  window._cropZoom=zoom;
  ctx.clearRect(0,0,280,280);
  // Draw image centered with offset and zoom
  const scale=Math.max(280/img.width,280/img.height)*zoom;
  const w=img.width*scale,h=img.height*scale;
  const x=(280-w)/2+window._cropOffsetX;
  const y=(280-h)/2+window._cropOffsetY;
  // Clip to circle
  ctx.save();
  ctx.beginPath();ctx.arc(140,140,140,0,Math.PI*2);ctx.clip();
  ctx.drawImage(img,x,y,w,h);
  ctx.restore();
  // Draw circle border
  ctx.beginPath();ctx.arc(140,140,139,0,Math.PI*2);ctx.strokeStyle='rgba(198,40,40,0.5)';ctx.lineWidth=2;ctx.stroke();
}

function applyCrop(){
  const canvas=document.getElementById('cropCanvas');if(!canvas)return;
  // Export as circular PNG
  const exportCanvas=document.createElement('canvas');
  exportCanvas.width=128;exportCanvas.height=128;
  const ctx=exportCanvas.getContext('2d');
  ctx.beginPath();ctx.arc(64,64,64,0,Math.PI*2);ctx.clip();
  ctx.drawImage(canvas,0,0,280,280,0,0,128,128);
  window._companyLogo=exportCanvas.toDataURL('image/png',0.9);
  document.getElementById('cpLogoPreview').innerHTML=`<img src="${window._companyLogo}" style="width:100%;height:100%;object-fit:contain;border-radius:50%">`;
  closeModalDirect();
  toast('Logo di-crop berhasil!','success');
}

async function simpanDataPerusahaan(){
  const data={
    nama:document.getElementById('cpNama').value,
    npwp:document.getElementById('cpNpwp').value,
    alamat:document.getElementById('cpAlamat').value,
    kota:document.getElementById('cpKota').value,
    telepon:document.getElementById('cpTelp').value,
    email:document.getElementById('cpEmail').value,
    jumlahKaryawan:Number(document.getElementById('cpJmlKaryawan').value)||0,
    tahunBerdiri:Number(document.getElementById('cpTahunBerdiri').value)||0,
    nib:document.getElementById('cpNIB').value,
    kemenkumham:document.getElementById('cpKemenkumham').value,
    logo:window._companyLogo||'',
    updatedAt:new Date().toISOString()
  };
  await db.collection('hrd_settings').doc('perusahaan').set(data,{merge:true});
  // Update PWA manifest icon if logo exists
  if(data.logo) updateAppIcon(data.logo);
  toast('Data perusahaan disimpan','success');
}

function updateAppIcon(logoDataUrl){
  // Update favicon
  let link=document.querySelector("link[rel*='icon']");
  if(!link){link=document.createElement('link');link.rel='icon';document.head.appendChild(link);}
  link.href=logoDataUrl;
  // Store for PWA usage
  localStorage.setItem('ims_company_logo',logoDataUrl);
}

// Load company logo on app start for branding
function loadCompanyBranding(){
  // First try localStorage (fast)
  const logo=localStorage.getItem('ims_company_logo');
  if(logo){
    updateAppIcon(logo);
    const logoEl=document.querySelector('.logo');
    if(logoEl)logoEl.innerHTML=`<img src="${logo}" style="width:28px;height:28px;border-radius:50%;object-fit:contain;margin-right:8px"><span>IMS</span>`;
  }
  // Then sync from Firestore (for all users including karyawan)
  db.collection('hrd_settings').doc('perusahaan').get().then(doc=>{
    if(!doc.exists)return;
    const d=doc.data();
    if(d.logo){
      localStorage.setItem('ims_company_logo',d.logo);
      updateAppIcon(d.logo);
      const logoEl=document.querySelector('.logo');
      if(logoEl)logoEl.innerHTML=`<img src="${d.logo}" style="width:28px;height:28px;border-radius:50%;object-fit:contain;margin-right:8px"><span>IMS</span>`;
    }
  }).catch(()=>{});
}
function modalAkun(id){if(id)db.collection('hrd_users').doc(id).get().then(d=>showAkunForm(id,d.data()||{}));else showAkunForm(null,{});}
async function showAkunForm(id,p){
  // Load karyawan list for linking (only active)
  const karySnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  let karyData=[];
  karySnap.forEach(d=>{const k=d.data();karyData.push({id:d.id,nama:k.nama,nip:k.nip||'',departemen:k.departemen||'',posisi:k.posisi||''});});
  karyData.sort((a,b)=>(a.nama||'').localeCompare(b.nama||''));
  let karyOpts='<option value="">-- Tidak disambungkan --</option>';
  karyData.forEach(k=>{karyOpts+=`<option value="${k.id}" ${p.linkedKaryawan===k.id?'selected':''}>${escHtml(k.nama)} (${escHtml(k.nip)} — ${escHtml(k.departemen)})</option>`;});
  openModal(`<div class="modal-title">${id?'Edit':'Tambah'} Akun</div>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
      <div id="akAvatarPreview" style="width:64px;height:64px;border-radius:50%;border:2px solid var(--accent);overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f5f5f5;font-size:1.5rem;cursor:pointer" onclick="document.getElementById('akAvatarFile').click()">${p.profilePic?`<img src="${p.profilePic}" style="width:100%;height:100%;object-fit:cover">`:(p.nama||'?').charAt(0)}</div>
      <div><input type="file" id="akAvatarFile" accept="image/png,image/jpeg" style="display:none" onchange="previewAkunAvatar(this)"><button class="btn btn-sm btn-primary" onclick="document.getElementById('akAvatarFile').click()">📷 Foto Profil</button><div class="text-xs mt-4" style="color:#999">Upload foto untuk identifikasi user</div></div>
    </div>
    <div class="grid-2"><div class="form-group"><label>Username</label><input class="form-control" id="akUser" value="${escHtml(id||'')}" data-old-id="${escHtml(id||'')}"></div><div class="form-group"><label>Password</label><input class="form-control" id="akPass" value="${escHtml(p.password||'')}"></div></div>
    <div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="akNama" value="${escHtml(p.nama||'')}"></div><div class="form-group"><label>Role</label><select class="form-control" id="akRole"><option value="staff" ${p.role==='staff'||p.role==='karyawan'?'selected':''}>Staff</option><option value="leader" ${p.role==='leader'?'selected':''}>Leader</option><option value="manager" ${p.role==='manager'?'selected':''}>Manager</option><option value="head" ${p.role==='head'?'selected':''}>Head</option><option value="bod" ${p.role==='bod'?'selected':''}>BOD / Founder</option><option value="admin" ${p.role==='admin'||p.role==='superadmin'?'selected':''}>Admin (Full Access)</option></select></div></div>
    <div class="grid-2"><div class="form-group"><label>Departemen</label><input class="form-control" id="akDept" value="${escHtml(p.departemen||'')}"></div><div class="form-group"><label>Status</label><select class="form-control" id="akStatus"><option value="aktif" ${p.status==='aktif'?'selected':''}>Aktif</option><option value="nonaktif" ${p.status==='nonaktif'?'selected':''}>Nonaktif</option></select></div></div>
    <div class="form-group" style="background:#f0f4ff;padding:12px;border-radius:8px;border-left:4px solid var(--primary)"><label style="color:var(--primary)">🔗 Sambungkan ke Data Karyawan</label><input class="form-control mb-8" id="akLinkedSearch" placeholder="🔍 Ketik nama untuk mencari..." oninput="filterLinkedKary()"><select class="form-control" id="akLinkedKary" size="10" style="height:auto;max-height:250px">${karyOpts}</select><div class="text-xs mt-8" style="color:#666">Hanya karyawan aktif. Ketik nama untuk filter, lalu pilih dari daftar.</div></div>
    <div class="flex gap-8 mt-16"><button class="btn btn-primary" onclick="simpanAkun('${id||''}')">💾 Simpan</button>${id?`<button class="btn btn-danger" onclick="hapusDoc('hrd_users','${id}','akun')">🗑️ Hapus</button>`:''}</div>`,true);
}

function previewAkunAvatar(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    const img=new Image();img.onload=()=>{
      const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
      const ctx=canvas.getContext('2d');const size=Math.min(img.width,img.height);
      const sx=(img.width-size)/2,sy=(img.height-size)/2;
      ctx.beginPath();ctx.arc(64,64,64,0,Math.PI*2);ctx.clip();
      ctx.drawImage(img,sx,sy,size,size,0,0,128,128);
      window._akunProfilePic=canvas.toDataURL('image/jpeg',0.8);
      document.getElementById('akAvatarPreview').innerHTML=`<img src="${window._akunProfilePic}" style="width:100%;height:100%;object-fit:cover">`;
    };img.src=e.target.result;
  };reader.readAsDataURL(file);
}
function filterLinkedKary(){
  const q=(document.getElementById('akLinkedSearch')?.value||'').toLowerCase();
  const sel=document.getElementById('akLinkedKary');
  if(!sel)return;
  Array.from(sel.options).forEach(opt=>{
    if(!opt.value){opt.style.display='';return;}// Always show "tidak disambungkan"
    const text=opt.textContent.toLowerCase();
    opt.style.display=text.includes(q)?'':'none';
  });
}
async function simpanAkun(id){
  const oldId = id;
  const newUsername = document.getElementById('akUser').value.trim();
  if (!newUsername) return toast('Username wajib','warning');
  const linkedKary = document.getElementById('akLinkedKary')?.value || '';
  const data = {
    password: document.getElementById('akPass').value,
    nama: document.getElementById('akNama').value,
    role: document.getElementById('akRole').value,
    departemen: document.getElementById('akDept').value,
    status: document.getElementById('akStatus').value,
    linkedKaryawan: linkedKary,
    username: newUsername,
    updatedAt: new Date().toISOString()
  };
  if(window._akunProfilePic) data.profilePic=window._akunProfilePic;
  if (!data.nama || !data.password) return toast('Nama & password wajib','warning');
  try {
    if (linkedKary) {
      const kDoc = await db.collection('hrd_karyawan').doc(linkedKary).get();
      if (kDoc.exists) {
        const kData = kDoc.data();
        data.nama = kData.nama || data.nama;
        data.departemen = kData.departemen || data.departemen;
        data.nip = kData.nip || newUsername;
        data.posisi = kData.posisi || '';
      }
    }
    if (oldId && oldId !== newUsername) {
      // Username changed — create new doc, delete old
      const oldDoc = await db.collection('hrd_users').doc(oldId).get();
      const oldData = oldDoc.exists ? oldDoc.data() : {};
      await db.collection('hrd_users').doc(newUsername).set({ ...oldData, ...data, username: newUsername });
      await db.collection('hrd_users').doc(oldId).delete();
      // Update session if editing own account
      if (currentUser.id === oldId) { currentUser.id = newUsername; localStorage.setItem('hrd_session', JSON.stringify(currentUser)); }
    } else if (oldId) {
      await db.collection('hrd_users').doc(oldId).update(data);
    } else {
      await db.collection('hrd_users').doc(newUsername).set({ ...data, nip: data.nip || newUsername, createdAt: new Date().toISOString() });
    }
    closeModalDirect();
    toast('Akun disimpan & disinkronkan', 'success');
    renderAkun();
  } catch (e) {
    console.error(e);
    toast('Gagal: '+(e.message||e), 'error');
  }
}

// ── APPROVAL CENTER — Multi-step flow with department filtering ──
async function renderApprovalCenter(){
  const main=document.getElementById('mainContent');
  main.innerHTML=`<div class="page-title"><span>✅ Approval Center</span></div><div class="card" id="approvalList">Loading...</div>`;
  const myName=currentUser.nama?.toLowerCase()||'';
  const myDept=(currentUser.departemen||'').toLowerCase();
  const isAdmin=hasAccess(5);
  const isGM=(currentUser.posisi||'').toLowerCase().includes('general manager');
  // Load approval flows
  const flowSnap=await db.collection('hrd_approval_flow').get();
  const flows=[];flowSnap.forEach(d=>flows.push({id:d.id,...d.data()}));
  // Load karyawan for dept mapping
  const karySnap=await db.collection('hrd_karyawan').get();
  const deptMap={};karySnap.forEach(d=>{const k=d.data();deptMap[(k.nama||'').toLowerCase()]=k.departemen||'';});
  const collections=['hrd_cuti','hrd_overtime','hrd_reimbursement','hrd_kasbon','hrd_dinas_luar'];
  let items=[];
  for(const col of collections){
    try{const snap=await db.collection(col).where('status','in',['pending','step1','step2']).get();snap.forEach(d=>{const data={id:d.id,collection:col,...d.data()};data._dept=(data.departemen||deptMap[(data.nama||'').toLowerCase()]||'').toLowerCase();items.push(data);});}catch(e){const snap=await db.collection(col).where('status','==','pending').get();snap.forEach(d=>{const data={id:d.id,collection:col,...d.data()};data._dept=(data.departemen||deptMap[(data.nama||'').toLowerCase()]||'').toLowerCase();items.push(data);});}
  }
  items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  let h='';let visibleCount=0;
  items.forEach(item=>{
    const flow=flows.find(f=>f.pengaju?.toLowerCase()===item.nama?.toLowerCase());
    const steps=flow?.steps||[];
    const currentStep=item.approvalStep||0;
    const currentApprover=steps[currentStep]?.nama?.toLowerCase()||'';
    const canSee=isAdmin||isGM||(item._dept===myDept);
    if(!canSee)return;
    const isMyTurn=isAdmin||currentApprover===myName;
    const typeLabel=item.collection.replace('hrd_','').toUpperCase();
    const detail=item.jenis||item.kategori||'';
    const jumlah=item.jumlah?` — ${formatCurrency(item.jumlah)}`:'';
    const durasi=item.durasi?` (${item.durasi} hari)`:'';
    let progressHtml='';
    if(steps.length){progressHtml='<div class="flex gap-4 mt-8" style="flex-wrap:wrap">';steps.forEach((s,i)=>{const done=i<currentStep;const active=i===currentStep;const color=done?'#2e7d32':active?'var(--accent)':'#ccc';progressHtml+=`<span style="font-size:.6rem;padding:2px 6px;border-radius:4px;background:${done?'#e8f5e9':active?'#fce4ec':'#f5f5f5'};color:${color};border:1px solid ${color}">${done?'✓ ':''}${escHtml(s.nama||'')}</span>`;if(i<steps.length-1)progressHtml+=`<span style="color:#ccc;font-size:.6rem">→</span>`;});progressHtml+='</div>';}
    visibleCount++;
    h+=`<div style="padding:14px;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px"><div style="flex:1"><div><span class="badge badge-info">${typeLabel}</span> <span class="fw-700">${escHtml(item.nama)}</span> <span class="badge" style="background:#eee;color:#555;font-size:.6rem">${escHtml(item._dept?.toUpperCase()||'')}</span></div><div class="text-sm" style="color:#555;margin-top:4px">${escHtml(detail)}${durasi}${jumlah}</div><div class="text-xs" style="color:#999;margin-top:2px">${formatDateTime(item.createdAt)}</div></div><div class="flex gap-8"><button class="btn btn-xs btn-primary" onclick="viewApprovalDetail('${item.collection}','${item.id}')">👁️</button>${isMyTurn?`<button class="btn btn-xs btn-success" onclick="approveItem('${item.collection}','${item.id}','approved')">✅</button><button class="btn btn-xs btn-danger" onclick="approveItem('${item.collection}','${item.id}','rejected')">❌</button>`:`<span class="badge badge-warning" style="font-size:.6rem">Menunggu ${escHtml(steps[currentStep]?.nama||'')}</span>`}</div></div>${progressHtml}</div>`;
  });
  if(!visibleCount)h='<div class="empty-state"><div class="icon">✅</div><p>Tidak ada pengajuan pending</p></div>';
  document.getElementById('approvalList').innerHTML=h;
}

function viewApprovalDetail(col,id){
  db.collection(col).doc(id).get().then(d=>{
    const p=d.data();const type=col.replace('hrd_','').replace('_',' ').toUpperCase();
    let html=`<div class="modal-title">📋 Detail Pengajuan — ${type}</div>`;
    html+=`<div style="background:#f8f9ff;padding:16px;border-radius:8px;margin-bottom:16px">`;
    html+=`<div class="grid-2" style="gap:12px">`;
    html+=`<div><b>Nama:</b> ${escHtml(p.nama||'-')}</div>`;
    html+=`<div><b>Status:</b> <span class="badge badge-${p.status==='approved'?'success':p.status==='rejected'?'danger':'warning'}">${p.status||'pending'}</span></div>`;
    html+=`<div><b>Tanggal Ajuan:</b> ${formatDateTime(p.createdAt)}</div>`;
    if(p.departemen)html+=`<div><b>Departemen:</b> ${escHtml(p.departemen)}</div>`;
    if(p.userId)html+=`<div><b>User ID:</b> ${escHtml(p.userId)}</div>`;
    if(p.jenis)html+=`<div><b>Jenis:</b> ${escHtml(p.jenis)}</div>`;
    if(p.kategori)html+=`<div><b>Kategori:</b> ${escHtml(p.kategori)}</div>`;
    if(p.tanggal)html+=`<div><b>Tanggal Pelaksanaan:</b> ${formatDate(p.tanggal)}</div>`;
    if(p.mulai)html+=`<div><b>Mulai:</b> ${formatDate(p.mulai)}</div>`;
    if(p.selesai)html+=`<div><b>Selesai:</b> ${formatDate(p.selesai)}</div>`;
    if(p.durasi)html+=`<div><b>Durasi:</b> ${p.durasi} hari</div>`;
    if(p.jamMulai)html+=`<div><b>Jam Mulai:</b> ${p.jamMulai}</div>`;
    if(p.jamSelesai)html+=`<div><b>Jam Selesai:</b> ${p.jamSelesai}</div>`;
    if(p.jumlah)html+=`<div><b>Jumlah:</b> ${formatCurrency(p.jumlah)}</div>`;
    if(p.cicilan)html+=`<div><b>Cicilan:</b> ${p.cicilan}x</div>`;
    if(p.tujuan)html+=`<div><b>Tujuan / Lokasi:</b> ${escHtml(p.tujuan)}</div>`;
    if(p.jamBerangkat)html+=`<div><b>Jam Berangkat:</b> ${p.jamBerangkat}</div>`;
    if(p.jamKembali)html+=`<div><b>Estimasi Kembali:</b> ${p.jamKembali}</div>`;
    if(p.approvalStep!==undefined)html+=`<div><b>Step Approval:</b> Step ${p.approvalStep+1}</div>`;
    if(p.lastApprovedBy)html+=`<div><b>Terakhir disetujui:</b> ${escHtml(p.lastApprovedBy)}</div>`;
    if(p.approvedBy)html+=`<div><b>Disetujui oleh:</b> ${escHtml(p.approvedBy)}</div>`;
    html+=`</div></div>`;
    if(p.keperluan)html+=`<div class="mb-16"><div class="fw-700 mb-4">📝 Keperluan:</div><div style="background:#fff;padding:12px;border-radius:6px;border:1px solid var(--border);white-space:pre-wrap;font-size:.85rem">${escHtml(p.keperluan)}</div></div>`;
    if(p.keterangan)html+=`<div class="mb-16"><div class="fw-700 mb-4">📝 Keterangan:</div><div style="background:#fff;padding:12px;border-radius:6px;border:1px solid var(--border);white-space:pre-wrap;font-size:.85rem">${escHtml(p.keterangan)}</div></div>`;
    if(p.alasan)html+=`<div class="mb-16"><div class="fw-700 mb-4">📝 Alasan:</div><div style="background:#fff;padding:12px;border-radius:6px;border:1px solid var(--border);font-size:.85rem">${escHtml(p.alasan)}</div></div>`;
    if(p.approvalHistory&&p.approvalHistory.length){html+=`<div class="mb-16"><div class="fw-700 mb-8">📋 Riwayat Approval:</div>`;p.approvalHistory.forEach(h2=>{html+=`<div style="padding:6px 10px;margin-bottom:4px;border-radius:6px;font-size:.82rem;background:${h2.action==='approved'?'#e8f5e9':'#ffebee'}"><span class="fw-700">${h2.action==='approved'?'✅':'❌'} ${escHtml(h2.nama)}</span> <span style="color:#666">(${escHtml(h2.role||'')})</span> — <span style="color:#999">${formatDateTime(h2.at)}</span></div>`;});html+=`</div>`;}
    html+=`<div class="flex gap-8 mt-16"><button class="btn btn-success" onclick="approveItem('${col}','${id}','approved')">✅ Approve</button><button class="btn btn-danger" onclick="approveItem('${col}','${id}','rejected')">❌ Reject</button></div>`;
    openModal(html,true);
  });
}

async function approveItem(col,id,status){
  const doc=await db.collection(col).doc(id).get();
  const data=doc.data();
  const currentStep=data.approvalStep||0;
  const history=data.approvalHistory||[];
  history.push({nama:currentUser.nama,role:currentUser.role,action:status,at:new Date().toISOString()});
  if(status==='rejected'){
    await db.collection(col).doc(id).update({status:'rejected',approvedBy:currentUser.nama,approvedAt:new Date().toISOString(),approvalHistory:history});
    if(data.userId)await sendNotification(data.userId,'❌ Ditolak',`Pengajuan ${data.jenis||col.replace('hrd_','')} ditolak oleh ${currentUser.nama}`);
  }else{
    const flowSnap=await db.collection('hrd_approval_flow').where('pengaju','==',data.nama).get();
    let steps=[];flowSnap.forEach(d=>{const f=d.data();if(!steps.length)steps=f.steps||[];});
    const nextStep=currentStep+1;
    if(nextStep<steps.length){
      await db.collection(col).doc(id).update({status:`step${nextStep}`,approvalStep:nextStep,approvalHistory:history,lastApprovedBy:currentUser.nama});
      const nextApprover=steps[nextStep];
      if(nextApprover?.nama){const uSnap=await db.collection('hrd_users').where('nama','==',nextApprover.nama).limit(1).get();if(!uSnap.empty)await sendNotification(uSnap.docs[0].id,'📋 Perlu Approval',`${data.nama}: ${data.jenis||col.replace('hrd_','')} — disetujui ${currentUser.nama}, menunggu Anda`);}
      if(data.userId)await sendNotification(data.userId,'⏳ Proses',`Disetujui ${currentUser.nama}, menunggu ${nextApprover?.nama||'selanjutnya'}`);
    }else{
      await db.collection(col).doc(id).update({status:'approved',approvedBy:currentUser.nama,approvedAt:new Date().toISOString(),approvalStep:nextStep,approvalHistory:history});
      if(data.userId)await sendNotification(data.userId,'✅ Disetujui (Final)',`Pengajuan ${data.jenis||col.replace('hrd_','')} DISETUJUI oleh ${currentUser.nama}`);
    }
  }
  closeModalDirect();toast(status==='approved'?'Disetujui':'Ditolak','success');renderApprovalCenter();
}

// ── APPROVAL MANAGEMENT ───────────────────────────────────────
async function renderApprovalMgmt(){if(!hasAccess(6))return document.getElementById('mainContent').innerHTML='<div class="card"><p>Akses ditolak.</p></div>';const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>⚙️ Approval Management</span><div class="flex gap-8"><button class="btn btn-success btn-sm" onclick="generateAllApprovalFlows()">⚡ Generate Semua</button><button class="btn btn-primary btn-sm" onclick="modalApprovalFlow()">+ Tambah Flow</button></div></div><div class="card"><p class="text-sm mb-16" style="color:#666">Konfigurasi alur approval multi-step berdasarkan struktur organisasi. Klik "Generate Semua" untuk otomatis membuat flow berdasarkan data karyawan.</p><div class="table-wrap"><table><thead><tr><th>Jenis</th><th>Pengaju</th><th>Dept</th><th>Approver Steps</th><th>Aksi</th></tr></thead><tbody id="tblApprFlow"></tbody></table></div></div>`;const snap=await db.collection('hrd_approval_flow').get();let h='';if(snap.empty)h='<tr><td colspan="5" class="text-center">Belum ada flow. Klik "Generate Semua" untuk membuat otomatis.</td></tr>';else{const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));items.sort((a,b)=>(a.jenis||'').localeCompare(b.jenis||'')||(a.pengaju||'').localeCompare(b.pengaju||''));items.forEach(p=>{h+=`<tr><td class="fw-700">${escHtml(p.jenis)}</td><td>${escHtml(p.pengaju||'Semua')}</td><td>${escHtml(p.departemen||'Semua')}</td><td>${(p.steps||[]).map(s=>`<span class="badge badge-primary">${escHtml(s.nama||s.role)}</span>`).join(' → ')}</td><td><button class="btn btn-xs btn-info" onclick="viewApprovalFlow('${p.id}')">👁️</button> <button class="btn btn-xs btn-primary" onclick="editApprovalFlow('${p.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_approval_flow','${p.id}','approval-mgmt')">🗑️</button></td></tr>`;});}document.getElementById('tblApprFlow').innerHTML=h;}

async function generateAllApprovalFlows(){
  if(!confirm('Generate approval flow untuk SEMUA karyawan berdasarkan struktur organisasi?\n\nFlow yang sudah ada akan dihapus dan dibuat ulang.'))return;
  // Delete existing flows
  const existSnap=await db.collection('hrd_approval_flow').get();
  if(!existSnap.empty){const batch=db.batch();existSnap.forEach(d=>batch.delete(d.ref));await batch.commit();}
  // Load karyawan
  const kSnap=await db.collection('hrd_karyawan').where('status','!=','nonaktif').get();
  const karyawan=[];kSnap.forEach(d=>karyawan.push({id:d.id,...d.data()}));
  // Jenis pengajuan
  const jenisArr=['Cuti/Izin','WFH','Dinas Luar','Overtime','Reimbursement','Kasbon','Insentif','Penggajian','Onboarding','Offboarding','Perpanjangan Kontrak','Pelatihan'];
  // For each staff/leader, create approval flow based on atasan hierarchy
  const staffAndLeaders=karyawan.filter(k=>{const pos=(k.posisi||'').toLowerCase();return!pos.includes('founder');});
  let count=0;
  for(const k of staffAndLeaders){
    // Build approval chain: atasan → atasan's atasan → admin
    const steps=[];
    // Step 1: Direct atasan
    if(k.atasan&&k.atasan.toLowerCase()!=='founder'){
      const atasan=karyawan.find(a=>a.nama?.toLowerCase()===k.atasan?.toLowerCase());
      if(atasan)steps.push({nama:atasan.nama,role:atasan.posisi||'',userId:atasan.id});
    }
    // Step 2: Head (if atasan is not head)
    if(steps.length&&steps[0].role){
      const step1Pos=(steps[0].role||'').toLowerCase();
      if(!step1Pos.includes('head')&&!step1Pos.includes('general')){
        // Find head of department
        const head=karyawan.find(a=>(a.posisi||'').toLowerCase().includes('head')&&(a.departemen||'').toLowerCase()===(k.departemen||'').toLowerCase());
        if(head&&head.nama!==steps[0].nama)steps.push({nama:head.nama,role:head.posisi||'',userId:head.id});
      }
    }
    // Step 3: GM (for important items) — skip if the person IS the GM
    const gm=karyawan.find(a=>(a.posisi||'').toLowerCase().includes('general manager'));
    if(gm&&gm.nama!==k.nama&&!steps.find(s=>s.nama===gm.nama))steps.push({nama:gm.nama,role:'General Manager',userId:gm.id});
    // For GM: approver is Founder/BOD
    if((k.posisi||'').toLowerCase().includes('general manager')){
      const founder=karyawan.find(a=>(a.posisi||'').toLowerCase().includes('founder'));
      if(founder)steps.push({nama:founder.nama,role:'Founder/BOD',userId:founder.id});
    }
    // If no steps found, default to admin
    if(!steps.length)steps.push({nama:'Admin',role:'admin'});
    // Create flow for each jenis
    for(const jenis of jenisArr){
      await db.collection('hrd_approval_flow').add({
        jenis,pengaju:k.nama,departemen:k.departemen||'',
        steps,createdAt:new Date().toISOString()
      });
      count++;
    }
  }
  toast(`${count} approval flow di-generate untuk ${staffAndLeaders.length} karyawan`,'success');
  renderApprovalMgmt();
}

function viewApprovalFlow(id){
  db.collection('hrd_approval_flow').doc(id).get().then(d=>{
    const p=d.data();
    let stepsHtml='';
    (p.steps||[]).forEach((s,i)=>{stepsHtml+=`<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)"><span class="badge badge-primary" style="font-size:.8rem">Step ${i+1}</span><span class="fw-700">${escHtml(s.nama||s.role)}</span><span class="text-xs" style="color:#999">${escHtml(s.role||'')}</span></div>`;});
    openModal(`<div class="modal-title">📋 Detail Approval Flow</div>
      <div class="grid-2 mb-16"><div><b>Jenis:</b> ${escHtml(p.jenis)}</div><div><b>Pengaju:</b> ${escHtml(p.pengaju||'Semua')}</div><div><b>Departemen:</b> ${escHtml(p.departemen||'Semua')}</div></div>
      <div class="fw-700 text-sm mb-8 color-primary">Alur Approval:</div>
      <div style="background:#f8f9ff;padding:12px;border-radius:8px">${stepsHtml||'<p class="text-sm" style="color:#999">Tidak ada step</p>'}</div>`);
  });
}

async function editApprovalFlow(id){
  const d=await db.collection('hrd_approval_flow').doc(id).get();
  const p=d.data();
  const kSnap=await db.collection('hrd_karyawan').where('status','!=','nonaktif').get();
  let approverOpts='<option value="">-- Tidak ada --</option>';
  kSnap.forEach(doc=>{const k=doc.data();approverOpts+=`<option value="${escHtml(k.nama)}">${escHtml(k.nama)} — ${escHtml(k.posisi||'')} (${escHtml(k.departemen||'')})</option>`;});
  const steps=p.steps||[];
  openModal(`<div class="modal-title">✏️ Edit Approval Flow</div>
    <div class="grid-2 mb-16"><div><b>Jenis:</b> ${escHtml(p.jenis)}</div><div><b>Pengaju:</b> ${escHtml(p.pengaju)}</div></div>
    <div class="form-group"><label>Approver Step 1</label><select class="form-control" id="eafStep1">${approverOpts.replace(`value="${escHtml(steps[0]?.nama||'')}"`,`value="${escHtml(steps[0]?.nama||'')}" selected`)}</select></div>
    <div class="form-group"><label>Approver Step 2</label><select class="form-control" id="eafStep2">${approverOpts.replace(`value="${escHtml(steps[1]?.nama||'')}"`,`value="${escHtml(steps[1]?.nama||'')}" selected`)}</select></div>
    <div class="form-group"><label>Approver Step 3</label><select class="form-control" id="eafStep3">${approverOpts.replace(`value="${escHtml(steps[2]?.nama||'')}"`,`value="${escHtml(steps[2]?.nama||'')}" selected`)}</select></div>
    <button class="btn btn-primary" onclick="simpanEditApprovalFlow('${id}')">💾 Simpan</button>`,true);
  // Set selected values properly
  setTimeout(()=>{
    if(steps[0])document.getElementById('eafStep1').value=steps[0].nama||'';
    if(steps[1])document.getElementById('eafStep2').value=steps[1].nama||'';
    if(steps[2])document.getElementById('eafStep3').value=steps[2].nama||'';
  },100);
}

async function simpanEditApprovalFlow(id){
  const steps=[];
  const s1=document.getElementById('eafStep1').value;
  const s2=document.getElementById('eafStep2').value;
  const s3=document.getElementById('eafStep3').value;
  if(s1)steps.push({nama:s1,role:s1});
  if(s2)steps.push({nama:s2,role:s2});
  if(s3)steps.push({nama:s3,role:s3});
  if(!steps.length)return toast('Minimal 1 approver','warning');
  await db.collection('hrd_approval_flow').doc(id).update({steps,updatedAt:new Date().toISOString()});
  closeModalDirect();toast('Flow diupdate','success');renderApprovalMgmt();
}
async function modalApprovalFlow(){
  const kSnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  let karyOpts='<option value="Semua">Semua Karyawan</option>';
  let approverOpts='';
  const depts=new Set();
  kSnap.forEach(d=>{const k=d.data();karyOpts+=`<option value="${escHtml(k.nama)}">${escHtml(k.nama)} — ${escHtml(k.departemen||'')} (${escHtml(k.posisi||'')})</option>`;depts.add(k.departemen||'');
    const pos=(k.posisi||'').toUpperCase();if(pos.includes('HEAD')||pos.includes('MANAGER')||pos.includes('GENERAL')||pos.includes('FOUNDER'))approverOpts+=`<option value="${escHtml(k.nama)}">${escHtml(k.nama)} — ${escHtml(k.posisi||'')} (${escHtml(k.departemen||'')})</option>`;});
  let deptOpts='';depts.forEach(d=>{if(d)deptOpts+=`<option>${escHtml(d)}</option>`;});
  openModal(`<div class="modal-title">Tambah Approval Flow</div>
    <div class="form-group"><label>Jenis Pengajuan</label><select class="form-control" id="afJenis"><option value="Cuti/Izin">Cuti / Izin</option><option value="WFH">WFH (Work From Home)</option><option value="Dinas Luar">Dinas Luar</option><option value="Overtime">Overtime / Lembur</option><option value="Reimbursement">Reimbursement</option><option value="Kasbon">Kasbon & Loan</option><option value="Insentif">Insentif</option><option value="Penggajian">Penggajian</option><option value="Onboarding">Onboarding</option><option value="Offboarding">Offboarding</option><option value="Perpanjangan Kontrak">Perpanjangan Kontrak</option><option value="Pelatihan">Pelatihan</option></select></div>
    <div class="form-group"><label>Departemen</label><select class="form-control" id="afDept" onchange="filterApprovalByDept()"><option value="">Semua Departemen</option>${deptOpts}</select></div>
    <div class="form-group"><label>Siapa yang Mengajukan</label><select class="form-control" id="afPengaju">${karyOpts}</select></div>
    <div class="form-group"><label>Approver Step 1</label><select class="form-control" id="afStep1"><option value="">-- Pilih --</option>${approverOpts}<option value="hr">HR (Role)</option><option value="admin">Admin (Role)</option><option value="superadmin">Super Admin (Role)</option></select></div>
    <div class="form-group"><label>Approver Step 2 (opsional)</label><select class="form-control" id="afStep2"><option value="">-- Tidak ada --</option>${approverOpts}<option value="hr">HR (Role)</option><option value="admin">Admin (Role)</option><option value="superadmin">Super Admin (Role)</option></select></div>
    <div class="form-group"><label>Approver Step 3 (opsional)</label><select class="form-control" id="afStep3"><option value="">-- Tidak ada --</option>${approverOpts}<option value="hr">HR (Role)</option><option value="admin">Admin (Role)</option><option value="superadmin">Super Admin (Role)</option></select></div>
    <button class="btn btn-primary" onclick="simpanApprovalFlow()">Simpan</button>`,true);
  window._afAllKary=[];kSnap.forEach(d=>window._afAllKary.push(d.data()));}
function filterApprovalByDept(){const dept=document.getElementById('afDept').value;const sel=document.getElementById('afPengaju');let opts='<option value="Semua">Semua Karyawan</option>';(window._afAllKary||[]).forEach(k=>{if(!dept||(k.departemen||'')===dept)opts+=`<option value="${escHtml(k.nama)}">${escHtml(k.nama)} — ${escHtml(k.posisi||'')}</option>`;});sel.innerHTML=opts;}
async function simpanApprovalFlow(){const steps=[];const s1=document.getElementById('afStep1').value;const s2=document.getElementById('afStep2').value;const s3=document.getElementById('afStep3').value;if(s1)steps.push({role:s1,nama:s1});if(s2)steps.push({role:s2,nama:s2});if(s3)steps.push({role:s3,nama:s3});if(!steps.length)return toast('Minimal 1 approver','warning');await db.collection('hrd_approval_flow').add({jenis:document.getElementById('afJenis').value,departemen:document.getElementById('afDept').value,pengaju:document.getElementById('afPengaju').value,steps,createdAt:new Date().toISOString()});closeModalDirect();toast('Flow disimpan','success');renderApprovalMgmt();}

// ── INSENTIF MODULE ───────────────────────────────────────────
async function renderInsentif(){
  const main=document.getElementById('mainContent');
  main.innerHTML=`<div class="page-title"><span>🏆 Insentif Kinerja</span><button class="btn btn-primary btn-sm" onclick="modalInsentif()">+ Tambah Insentif</button></div>
  <div class="card"><div style="background:#fff3e0;border-radius:8px;padding:12px;margin-bottom:16px;border-left:4px solid var(--warning)"><p class="text-sm" style="line-height:1.6"><b>Dua Jenis Insentif:</b><br><br><b>1. Insentif KPI (Kinerja)</b><br>• KPI ≥ 90 (Grade A) = <b>15%</b> dari Gaji Pokok<br>• KPI ≥ 80 (Grade B) = <b>10%</b> dari Gaji Pokok<br>• KPI ≥ 70 (Grade C) = <b>5%</b> dari Gaji Pokok<br>• KPI < 70 = <b>0%</b><br><br><b>2. Insentif Target Siswa (Manual)</b><br>• Berdasarkan jumlah siswa yang diterima/masuk<br>• Nominal per siswa ditentukan manual<br>• Contoh: 10 siswa × Rp 200.000 = Rp 2.000.000</p></div>
  <div class="flex gap-8 mb-16 flex-wrap"><button class="btn btn-success btn-sm" onclick="generateInsentifFromKPI()">⚡ Generate dari KPI</button><button class="btn btn-info btn-sm" onclick="modalInsentifSiswa()">🎓 Insentif Target Siswa</button><button class="btn btn-danger btn-sm" onclick="hapusSemuaInsentif()">🗑️ Hapus Semua</button></div>
  <div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Dept</th><th>Jenis</th><th>Basis</th><th>Nominal</th><th>Periode</th><th>Aksi</th></tr></thead><tbody id="tblInsentif"></tbody></table></div></div>`;
  const snap=await db.collection('hrd_insentif').get();const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  let h='';if(!items.length)h='<tr><td colspan="7" class="text-center">Belum ada data insentif</td></tr>';
  else items.forEach(p=>{const jenis=p.jenis||'KPI';const basis=jenis==='KPI'?`KPI ${p.kpiScore||0} (${p.persen||0}% gaji)`:`${p.jumlahSiswa||0} siswa × ${formatCurrency(p.nominalPerSiswa||0)}`;h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.departemen||'-')}</td><td><span class="badge badge-${jenis==='KPI'?'info':'success'}">${jenis}</span></td><td style="font-size:.78rem">${basis}</td><td class="fw-700">${formatCurrency(p.nominal||0)}</td><td>${escHtml(p.periode||'-')}</td><td><button class="btn btn-xs btn-info" onclick="viewInsentifDetail('${p.id}')">👁️</button> <button class="btn btn-xs btn-primary" onclick="editInsentif('${p.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_insentif','${p.id}','insentif')">🗑️</button></td></tr>`;});
  document.getElementById('tblInsentif').innerHTML=h;
}

async function modalInsentif(){
  const kSnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  let opts='<option value="">-- Pilih --</option>';kSnap.forEach(d=>{const k=d.data();opts+=`<option value="${escHtml(k.nama)}" data-gaji="${k.gajiPokok||0}" data-dept="${escHtml(k.departemen||'')}">${escHtml(k.nama)} — ${escHtml(k.departemen||'')} (${formatCurrency(k.gajiPokok||0)})</option>`;});
  openModal(`<div class="modal-title">Tambah Insentif KPI</div>
    <div class="form-group"><label>Karyawan</label><select class="form-control" id="insKary" onchange="onInsKaryChange()">${opts}</select></div>
    <div class="grid-2"><div class="form-group"><label>KPI Score</label><input class="form-control" type="number" id="insKPI" value="0" oninput="calcInsentif()"></div><div class="form-group"><label>Periode</label><input class="form-control" id="insPeriode" value="${monthStr()}"></div></div>
    <div class="grid-2"><div class="form-group"><label>% Insentif (auto)</label><input class="form-control" id="insPersen" readonly></div><div class="form-group"><label>Nominal (auto)</label><input class="form-control" id="insNominal" readonly style="font-weight:700"></div></div>
    <button class="btn btn-primary" onclick="simpanInsentif()">Simpan</button>`);
}

async function modalInsentifSiswa(){
  const kSnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  let opts='<option value="">-- Pilih --</option>';kSnap.forEach(d=>{const k=d.data();opts+=`<option value="${escHtml(k.nama)}" data-dept="${escHtml(k.departemen||'')}">${escHtml(k.nama)} — ${escHtml(k.departemen||'')}</option>`;});
  openModal(`<div class="modal-title">🎓 Insentif Target Siswa</div>
    <div style="background:#e3f2fd;border-radius:8px;padding:10px;margin-bottom:14px;font-size:.82rem;border-left:4px solid var(--info)">Hitung insentif berdasarkan jumlah siswa yang diterima/masuk. Nominal dihitung: Jumlah Siswa × Nominal per Siswa.</div>
    <div class="form-group"><label>Karyawan (PIC Rekrutmen)</label><select class="form-control" id="insSiswaKary" onchange="window._insSiswaDept=this.options[this.selectedIndex]?.dataset?.dept||''">${opts}</select></div>
    <div class="grid-2"><div class="form-group"><label>Jumlah Siswa Diterima</label><input class="form-control" type="number" id="insSiswaJml" value="0" oninput="calcInsentifSiswa()"></div><div class="form-group"><label>Nominal per Siswa (Rp)</label><input class="form-control" type="number" id="insSiswaRate" value="200000" oninput="calcInsentifSiswa()"></div></div>
    <div class="grid-2"><div class="form-group"><label>Periode</label><input class="form-control" id="insSiswaPeriode" value="${monthStr()}"></div><div class="form-group"><label>Total Insentif (auto)</label><input class="form-control" id="insSiswaTotal" readonly style="font-weight:700;font-size:1rem;color:var(--success)"></div></div>
    <div class="form-group"><label>Keterangan</label><input class="form-control" id="insSiswaKet" placeholder="Contoh: Batch April 2026, Program Reguler"></div>
    <button class="btn btn-primary" onclick="simpanInsentifSiswa()">Simpan</button>`);
}
function calcInsentifSiswa(){const jml=Number(document.getElementById('insSiswaJml').value)||0;const rate=Number(document.getElementById('insSiswaRate').value)||0;document.getElementById('insSiswaTotal').value=formatCurrency(jml*rate);}
async function simpanInsentifSiswa(){const nama=document.getElementById('insSiswaKary').value;if(!nama)return toast('Pilih karyawan','warning');const jml=Number(document.getElementById('insSiswaJml').value)||0;const rate=Number(document.getElementById('insSiswaRate').value)||0;if(!jml)return toast('Isi jumlah siswa','warning');await db.collection('hrd_insentif').add({nama,departemen:window._insSiswaDept||'',jenis:'Target Siswa',jumlahSiswa:jml,nominalPerSiswa:rate,nominal:jml*rate,periode:document.getElementById('insSiswaPeriode').value,keterangan:document.getElementById('insSiswaKet').value,createdAt:new Date().toISOString()});closeModalDirect();toast('Insentif target siswa disimpan','success');renderInsentif();}

function onInsKaryChange(){const sel=document.getElementById('insKary');const opt=sel.options[sel.selectedIndex];window._insGaji=Number(opt?.dataset?.gaji)||0;window._insDept=opt?.dataset?.dept||'';calcInsentif();}
function calcInsentif(){const kpi=Number(document.getElementById('insKPI').value)||0;let pct=0;if(kpi>=90)pct=15;else if(kpi>=80)pct=10;else if(kpi>=70)pct=5;const nominal=Math.round((window._insGaji||0)*pct/100);document.getElementById('insPersen').value=pct+'%';document.getElementById('insNominal').value=formatCurrency(nominal);window._insCalc={pct,nominal};}
async function simpanInsentif(){const nama=document.getElementById('insKary').value;if(!nama)return toast('Pilih karyawan','warning');await db.collection('hrd_insentif').add({nama,departemen:window._insDept||'',gajiPokok:window._insGaji||0,jenis:'KPI',kpiScore:Number(document.getElementById('insKPI').value)||0,persen:window._insCalc?.pct||0,nominal:window._insCalc?.nominal||0,periode:document.getElementById('insPeriode').value,createdAt:new Date().toISOString()});closeModalDirect();toast('Insentif disimpan','success');renderInsentif();}

async function generateInsentifFromKPI(){
  if(!confirm('Generate insentif untuk semua karyawan berdasarkan data KPI terbaru?'))return;
  const kSnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  const kpiSnap=await db.collection('hrd_kpi').get();
  const kpiMap={};kpiSnap.forEach(d=>{const r=d.data();const n=(r.nama||'').toLowerCase();if(!kpiMap[n]||r.skor>kpiMap[n])kpiMap[n]=r.skor||0;});
  let count=0;
  for(const doc of kSnap.docs){
    const k=doc.data();const kpi=kpiMap[(k.nama||'').toLowerCase()]||0;
    let pct=0;if(kpi>=90)pct=15;else if(kpi>=80)pct=10;else if(kpi>=70)pct=5;
    if(pct===0)continue;
    const nominal=Math.round((k.gajiPokok||0)*pct/100);
    await db.collection('hrd_insentif').add({nama:k.nama,departemen:k.departemen||'',gajiPokok:k.gajiPokok||0,kpiScore:kpi,persen:pct,nominal,periode:monthStr(),createdAt:new Date().toISOString()});
    count++;
  }
  toast(`${count} insentif di-generate dari KPI`,'success');renderInsentif();
}
async function hapusSemuaInsentif(){if(!confirm('Hapus semua data insentif?'))return;const snap=await db.collection('hrd_insentif').get();const batch=db.batch();snap.forEach(d=>batch.delete(d.ref));await batch.commit();toast('Semua insentif dihapus','success');renderInsentif();}

function viewInsentifDetail(id){
  db.collection('hrd_insentif').doc(id).get().then(d=>{const p=d.data();
    openModal(`<div class="modal-title">🏆 Detail Insentif</div>
      <div class="grid-2 mb-16"><div><b>Nama:</b> ${escHtml(p.nama)}</div><div><b>Departemen:</b> ${escHtml(p.departemen||'-')}</div><div><b>Jenis:</b> ${escHtml(p.jenis||'KPI')}</div><div><b>Periode:</b> ${escHtml(p.periode||'-')}</div><div><b>Nominal:</b> <span class="fw-700">${formatCurrency(p.nominal||0)}</span></div>${p.jenis==='KPI'?`<div><b>KPI Score:</b> ${p.kpiScore||0} (${p.persen||0}%)</div>`:`<div><b>Siswa:</b> ${p.jumlahSiswa||0} × ${formatCurrency(p.nominalPerSiswa||0)}</div>`}</div>`);
  });
}
async function editInsentif(id){
  const d=await db.collection('hrd_insentif').doc(id).get();const p=d.data();
  openModal(`<div class="modal-title">✏️ Edit Insentif</div>
    <div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="eiNama" value="${escHtml(p.nama||'')}"></div><div class="form-group"><label>Nominal</label><input class="form-control" type="number" id="eiNominal" value="${p.nominal||0}"></div></div>
    <div class="form-group"><label>Periode</label><input class="form-control" id="eiPeriode" value="${escHtml(p.periode||'')}"></div>
    <button class="btn btn-primary" onclick="simpanEditInsentif('${id}')">💾 Simpan</button>`);
}
async function simpanEditInsentif(id){
  await db.collection('hrd_insentif').doc(id).update({nominal:Number(document.getElementById('eiNominal').value)||0,periode:document.getElementById('eiPeriode').value,updatedAt:new Date().toISOString()});
  closeModalDirect();toast('Insentif diupdate','success');renderInsentif();
}

// ── TAX & BPJS CALCULATOR ─────────────────────────────────────
async function renderTaxCalc(){
  const main=document.getElementById('mainContent');
  const kSnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  let karyOpts='<option value="">-- Input Manual --</option>';
  kSnap.forEach(d=>{const k=d.data();karyOpts+=`<option value="${k.gajiPokok||0}" data-nama="${escHtml(k.nama)}">${escHtml(k.nama)} — ${formatCurrency(k.gajiPokok||0)}</option>`;});
  main.innerHTML=`<div class="page-title"><span>🧮 Tax & BPJS Calculator</span></div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title mb-16">🧮 Kalkulator Gaji</div>
        <div class="form-group"><label>Pilih Karyawan (atau input manual)</label><select class="form-control" id="tcKarySelect" onchange="onTcKarySelect()">${karyOpts}</select></div>
        <div class="form-group"><label>Gaji Pokok (Rp)</label><input class="form-control" type="number" id="tcGaji" value="5000000" oninput="calcTax()"></div>
        <div class="form-group"><label>Tunjangan (Rp)</label><input class="form-control" type="number" id="tcTunj" value="0" oninput="calcTax()"></div>
        <div class="form-group"><label>Lembur (Rp)</label><input class="form-control" type="number" id="tcLembur" value="0" oninput="calcTax()"></div>
        <div class="form-group"><label>Status PTKP</label><select class="form-control" id="tcPTKP" onchange="calcTax()"><option value="54000000">TK/0 (Rp 54.000.000)</option><option value="58500000">K/0 (Rp 58.500.000)</option><option value="63000000">K/1 (Rp 63.000.000)</option><option value="67500000">K/2 (Rp 67.500.000)</option><option value="72000000">K/3 (Rp 72.000.000)</option></select></div>
        <div style="background:#f8f9ff;padding:16px;border-radius:8px;margin-top:16px;border:1px solid var(--border)">
          <div class="fw-700 mb-12" style="color:var(--accent)">Hasil Perhitungan:</div>
          <div id="tcResultRows"></div>
          <div id="tcResultFooter" class="mt-12"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title mb-16">📊 Potongan per Karyawan</div>
        <div id="tcKaryList">Loading...</div>
      </div>
    </div>`;
  calcTax();loadTaxKaryList();
}
function onTcKarySelect(){const sel=document.getElementById('tcKarySelect');if(sel.value){document.getElementById('tcGaji').value=sel.value;calcTax();}}
function calcTax(){
  const gaji=Number(document.getElementById('tcGaji')?.value)||0;
  const tunj=Number(document.getElementById('tcTunj')?.value)||0;
  const lembur=Number(document.getElementById('tcLembur')?.value)||0;
  const ptkp=Number(document.getElementById('tcPTKP')?.value)||54000000;
  const bruto=gaji+tunj+lembur;
  // Allow manual override of potongan
  const bpjsKesAuto=Math.round(gaji*0.01);
  const bpjsTKAuto=Math.round(gaji*0.02);
  const bpjsKesPerusahaan=Math.round(gaji*0.04);
  const bpjsTKPerusahaan=Math.round(gaji*0.037);
  const nettoTahunan=Math.max(0,(bruto-bpjsKesAuto-bpjsTKAuto)*12-ptkp);
  let pphAuto=0;
  if(nettoTahunan<=60000000)pphAuto=nettoTahunan*0.05;
  else if(nettoTahunan<=250000000)pphAuto=3000000+(nettoTahunan-60000000)*0.15;
  else if(nettoTahunan<=500000000)pphAuto=3000000+28500000+(nettoTahunan-250000000)*0.25;
  else pphAuto=3000000+28500000+62500000+(nettoTahunan-500000000)*0.30;
  const pphBulananAuto=Math.round(pphAuto/12);
  // Use manual values if user edited them, otherwise auto
  const bpjsKes=Number(document.getElementById('tcBpjsKes')?.value)||bpjsKesAuto;
  const bpjsTK=Number(document.getElementById('tcBpjsTK')?.value)||bpjsTKAuto;
  const pphBulanan=Number(document.getElementById('tcPPH')?.value)||pphBulananAuto;
  const thp=bruto-bpjsKes-bpjsTK-pphBulanan;
  
  document.getElementById('tcResultRows').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee"><span style="font-size:.85rem">Bruto</span><span class="fw-700">${formatCurrency(bruto)}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee"><span style="font-size:.82rem">BPJS Kes (1%)</span><input class="form-control" type="number" id="tcBpjsKes" value="${bpjsKes}" oninput="calcTaxResult()" style="width:130px;text-align:right;padding:4px 8px;font-size:.82rem;color:var(--accent)"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee"><span style="font-size:.82rem">BPJS TK/JHT (2%)</span><input class="form-control" type="number" id="tcBpjsTK" value="${bpjsTK}" oninput="calcTaxResult()" style="width:130px;text-align:right;padding:4px 8px;font-size:.82rem;color:var(--accent)"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee"><span style="font-size:.82rem">PPH 21/bulan</span><input class="form-control" type="number" id="tcPPH" value="${pphBulanan}" oninput="calcTaxResult()" style="width:130px;text-align:right;padding:4px 8px;font-size:.82rem;color:var(--accent)"></div>
    <div style="display:flex;justify-content:space-between;padding:12px 0;font-weight:700;font-size:1.05rem;border-top:2px solid var(--accent);margin-top:4px"><span>Take Home Pay</span><span id="tcTHP">${formatCurrency(thp)}</span></div>`;
  document.getElementById('tcResultFooter').innerHTML=`<div style="font-size:.75rem;color:#666;padding-top:8px;border-top:1px dashed #ddd"><b>Kontribusi Perusahaan:</b><br>BPJS Kes (4%): ${formatCurrency(bpjsKesPerusahaan)}<br>BPJS TK (3.7%): ${formatCurrency(bpjsTKPerusahaan)}</div>
    <div class="text-xs mt-8" style="color:#999">💡 Nilai potongan bisa diedit manual. Klik angka untuk mengubah.</div>`;
}
function calcTaxResult(){
  const gaji=Number(document.getElementById('tcGaji')?.value)||0;
  const tunj=Number(document.getElementById('tcTunj')?.value)||0;
  const lembur=Number(document.getElementById('tcLembur')?.value)||0;
  const bruto=gaji+tunj+lembur;
  const bpjsKes=Number(document.getElementById('tcBpjsKes')?.value)||0;
  const bpjsTK=Number(document.getElementById('tcBpjsTK')?.value)||0;
  const pph=Number(document.getElementById('tcPPH')?.value)||0;
  const thp=bruto-bpjsKes-bpjsTK-pph;
  const el=document.getElementById('tcTHP');if(el)el.textContent=formatCurrency(thp);
}
async function loadTaxKaryList(){
  const snap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  let h='<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Gaji</th><th>BPJS Kes</th><th>BPJS TK</th><th>PPH21</th><th>THP</th></tr></thead><tbody>';
  snap.forEach(d=>{const k=d.data();const gaji=k.gajiPokok||0;
    const bpjsKes=Math.round(gaji*0.01);const bpjsTK=Math.round(gaji*0.02);
    const netto=Math.max(0,(gaji-bpjsKes-bpjsTK)*12-54000000);
    let pph=0;if(netto<=60000000)pph=netto*0.05;else if(netto<=250000000)pph=3000000+(netto-60000000)*0.15;else pph=3000000+28500000+(netto-250000000)*0.25;
    const pphBln=Math.round(pph/12);const thp=gaji-bpjsKes-bpjsTK-pphBln;
    h+=`<tr><td class="fw-700">${escHtml(k.nama)}</td><td>${formatCurrency(gaji)}</td><td style="color:var(--accent)">${formatCurrency(bpjsKes)}</td><td style="color:var(--accent)">${formatCurrency(bpjsTK)}</td><td style="color:var(--accent)">${formatCurrency(pphBln)}</td><td class="fw-700">${formatCurrency(thp)}</td></tr>`;
  });
  h+='</tbody></table></div>';
  document.getElementById('tcKaryList').innerHTML=h;
}

// ── QR & PWA & DOWNLOAD APP ───────────────────────────────────
function renderQRShare(){
  const url='https://hrlegal.netlify.app';
  document.getElementById('mainContent').innerHTML=`<div class="page-title"><span>📱 QR, PWA & Download Aplikasi</span></div>
    <div class="grid-2">
      <div class="card text-center">
        <div class="card-title mb-16">📱 QR Code Aplikasi</div>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}" style="width:200px;height:200px;border-radius:12px;border:2px solid var(--border)">
        <p class="text-sm mt-16">${url}</p>
        <div class="flex gap-8 mt-8" style="justify-content:center">
          <button class="btn btn-primary btn-sm" onclick="navigator.clipboard?.writeText('${url}').then(()=>toast('Disalin!','success'))">📋 Copy</button>
          <button class="btn btn-success btn-sm" onclick="shareAppWA()">💬 Share WA</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title mb-16">📲 Install / Download Aplikasi</div>
        <p class="text-sm mb-16" style="color:#666">Aplikasi ini berbasis PWA (Progressive Web App) dan bisa diinstall di semua perangkat tanpa perlu app store.</p>
        ${renderDownloadAppSection()}
      </div>
    </div>
    <div class="card">
      <div class="card-title mb-16">🔗 Share Link Download ke Karyawan</div>
      <p class="text-sm mb-16">Bagikan link install aplikasi ke semua karyawan agar bisa akses dari perangkat masing-masing.</p>
      <div class="flex gap-8 flex-wrap">
        <button class="btn btn-primary btn-sm" onclick="navigator.clipboard?.writeText('${url}').then(()=>toast('Link disalin!','success'))">📋 Copy Link</button>
        <button class="btn btn-success btn-sm" onclick="shareAppWA()">💬 Share via WhatsApp</button>
        <button class="btn btn-info btn-sm" onclick="shareAppBroadcast()">📡 Broadcast ke Semua Karyawan</button>
        <button class="btn btn-warning btn-sm" onclick="downloadQR('https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}','qr_hrd_ijef')">⬇️ Download QR HD</button>
      </div>
    </div>`;
}

function renderDownloadAppSection(){
  const url='https://hrlegal.netlify.app';
  const showBtn = typeof deferredInstallPrompt !== 'undefined' && deferredInstallPrompt ? 'inline-flex' : 'none';
  return `
    <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:16px">
      <div style="text-align:center;margin-bottom:20px">
        <button class="btn btn-primary" id="btnInstallPWA" style="display:${showBtn};padding:14px 32px;font-size:1rem;border-radius:12px" onclick="triggerInstallPWA()">📲 Install Aplikasi Sekarang</button>
        <button class="btn btn-outline" style="padding:14px 32px;font-size:.9rem;border-radius:12px;margin-left:8px" onclick="triggerInstallPWA()">📲 Cara Install</button>
      </div>
      <div class="fw-700 mb-12" style="font-size:.9rem">📲 Install di Perangkat Anda:</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
        <div style="padding:12px;border:1px solid var(--border);border-radius:8px;text-align:center;cursor:pointer" onclick="triggerInstallPWA()">
          <div style="font-size:1.5rem">🤖</div>
          <div class="fw-700 text-sm mt-8">Android</div>
          <div class="text-xs" style="color:#666;margin-top:4px">Chrome → Menu (⋮) → "Install app"</div>
        </div>
        <div style="padding:12px;border:1px solid var(--border);border-radius:8px;text-align:center;cursor:pointer" onclick="triggerInstallPWA()">
          <div style="font-size:1.5rem">🍎</div>
          <div class="fw-700 text-sm mt-8">iOS</div>
          <div class="text-xs" style="color:#666;margin-top:4px">Safari → Share (📈) → "Add to Home Screen"</div>
        </div>
        <div style="padding:12px;border:1px solid var(--border);border-radius:8px;text-align:center;cursor:pointer" onclick="triggerInstallPWA()">
          <div style="font-size:1.5rem">🪟</div>
          <div class="fw-700 text-sm mt-8">Windows</div>
          <div class="text-xs" style="color:#666;margin-top:4px">Chrome/Edge → ikon [+] di address bar</div>
        </div>
        <div style="padding:12px;border:1px solid var(--border);border-radius:8px;text-align:center;cursor:pointer" onclick="triggerInstallPWA()">
          <div style="font-size:1.5rem">🖥️</div>
          <div class="fw-700 text-sm mt-8">macOS</div>
          <div class="text-xs" style="color:#666;margin-top:4px">Chrome → ⋮ → "Install HRD IJEF..."</div>
        </div>
      </div>
      <div style="margin-top:16px;padding:12px;background:#e8f5e9;border-radius:8px;border-left:4px solid var(--success)">
        <div class="text-sm fw-700 mb-4">✅ Setelah install:</div>
        <div class="text-xs" style="color:#555;line-height:1.8">Aplikasi muncul di home screen / desktop seperti app native. Bisa dibuka tanpa browser. Akses lebih cepat dan mendukung notifikasi.</div>
      </div>
    </div>`;
}

function shareAppWA(){
  const url='https://hrlegal.netlify.app';
  const text=encodeURIComponent(`📱 *HRD & Legal IJEF Corp*\n\nInstall aplikasi HRD di perangkat Anda:\n${url}\n\n📲 Cara Install:\n• Android: Chrome → Menu → "Add to Home Screen"\n• iPhone: Safari → Share → "Add to Home Screen"\n• PC/Laptop: Chrome → Klik ikon install di address bar\n\nLogin dengan akun karyawan Anda.\n\n— HRD IJEF Corp`);
  window.open(`https://wa.me/?text=${text}`,'_blank');
}

async function shareAppBroadcast(){
  const url='https://hrlegal.netlify.app';
  const users=await getAllUsers();
  const pesan=`📱 Install Aplikasi HRD IJEF Corp di perangkat Anda: ${url}\n\nCara: Buka link di browser → Install/Add to Home Screen. Login dengan akun karyawan.`;
  await db.collection('hrd_broadcast').add({pesan,targetLabel:'Semua',pengirim:currentUser.nama,createdAt:new Date().toISOString()});
  await sendNotificationBulk(users.map(u=>u.id),'📱 Install Aplikasi',`Buka ${url} dan install di perangkat Anda`);
  toast(`Broadcast terkirim ke ${users.length} karyawan`,'success');
}

