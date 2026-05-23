'use strict';
// ============================================================
// MODULES.JS — HRD & Legal IJEF Corp v5.0
// ============================================================

// ── DASHBOARD ─────────────────────────────────────────────────
async function renderDashboard() {
  const main=document.getElementById('mainContent');
  main.innerHTML='<div class="page-title"><span>📊 Dashboard</span></div><div class="stats-grid" id="dashStats">Loading...</div><div class="grid-2" id="dashWidgets"></div>';
  const[karyawan,cuti,absen,pengumuman]=await Promise.all([db.collection('hrd_karyawan').get(),db.collection('hrd_cuti').where('status','==','pending').get(),db.collection('hrd_absensi').where('tanggal','==',todayStr()).get(),db.collection('hrd_pengumuman').get()]);
  document.getElementById('dashStats').innerHTML=`
    <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-value">${karyawan.size}</div><div class="stat-label">Total Karyawan</div></div>
    <div class="stat-card"><div class="stat-icon">📍</div><div class="stat-value">${absen.size}</div><div class="stat-label">Hadir Hari Ini</div></div>
    <div class="stat-card"><div class="stat-icon">🏖️</div><div class="stat-value">${cuti.size}</div><div class="stat-label">Cuti Pending</div></div>
    <div class="stat-card"><div class="stat-icon">📢</div><div class="stat-value">${pengumuman.size}</div><div class="stat-label">Pengumuman</div></div>`;
  let aHtml='<div class="card"><div class="card-title">📢 Pengumuman Terbaru</div>';
  if(pengumuman.empty)aHtml+='<p class="text-sm" style="color:#999;margin-top:8px">Belum ada</p>';
  else pengumuman.forEach(d=>{const p=d.data();aHtml+=`<div style="padding:8px 0;border-bottom:1px solid var(--border)"><div class="fw-700 text-sm">${escHtml(p.judul)}</div><div class="text-xs" style="color:#999">${formatDate(p.createdAt)}</div></div>`;});
  aHtml+='</div>';
  document.getElementById('dashWidgets').innerHTML=aHtml+'<div class="card"><div class="card-title">⚡ Aksi Cepat</div><div class="flex flex-wrap gap-8 mt-8"><button class="btn btn-primary btn-sm" onclick="navigateTo(\'absensi\')">📍 Absensi</button><button class="btn btn-info btn-sm" onclick="navigateTo(\'cuti\')">🏖️ Cuti</button><button class="btn btn-success btn-sm" onclick="navigateTo(\'karyawan\')">👥 Karyawan</button><button class="btn btn-warning btn-sm" onclick="navigateTo(\'approval-center\')">✅ Approval</button></div></div>';
}

// ── DEPARTEMEN ────────────────────────────────────────────────
async function renderDepartemen(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>🏢 Departemen</span><div class="flex gap-8"><button class="btn btn-primary btn-sm" onclick="modalDepartemen()">+ Tambah</button><button class="btn btn-info btn-sm" onclick="syncDeptFromKaryawan()">🔄 Sinkron dari Karyawan</button></div></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Kode</th><th>Kepala</th><th>Jumlah</th><th>Aksi</th></tr></thead><tbody id="tblDept"></tbody></table></div></div>`;const snap=await db.collection('hrd_departemen').get();const karySnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();const countMap={};karySnap.forEach(d=>{const dept=d.data().departemen||'';if(dept)countMap[dept]=(countMap[dept]||0)+1;});let h='';if(snap.empty)h='<tr><td colspan="5" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.kode||'-')}</td><td>${escHtml(p.kepala||'-')}</td><td>${countMap[p.nama]||0}</td><td><button class="btn btn-xs btn-info" onclick="modalDepartemen('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_departemen','${d.id}','departemen')">🗑️</button></td></tr>`;});document.getElementById('tblDept').innerHTML=h;}
function modalDepartemen(id){if(id)db.collection('hrd_departemen').doc(id).get().then(d=>showDeptForm(id,d.data()||{}));else showDeptForm(null,{});}
function showDeptForm(id,p){openModal(`<div class="modal-title">${id?'Edit':'Tambah'} Departemen</div><div class="form-group"><label>Nama</label><input class="form-control" id="dNama" value="${escHtml(p.nama||'')}"></div><div class="form-group"><label>Kode</label><input class="form-control" id="dKode" value="${escHtml(p.kode||'')}"></div><div class="form-group"><label>Kepala</label><input class="form-control" id="dKepala" value="${escHtml(p.kepala||'')}"></div><button class="btn btn-primary" onclick="simpanDepartemen('${id||''}')">Simpan</button>`);}
async function simpanDepartemen(id){const data={nama:document.getElementById('dNama').value,kode:document.getElementById('dKode').value,kepala:document.getElementById('dKepala').value,updatedAt:new Date().toISOString()};if(!data.nama)return toast('Nama wajib','warning');if(id)await db.collection('hrd_departemen').doc(id).update(data);else await db.collection('hrd_departemen').add({...data,createdAt:new Date().toISOString()});closeModalDirect();toast('Disimpan','success');renderDepartemen();}

async function syncDeptFromKaryawan(){
  const kSnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  const depts=new Map();
  kSnap.forEach(d=>{const p=d.data();const dept=p.departemen;if(dept){if(!depts.has(dept))depts.set(dept,{count:0,head:''});depts.get(dept).count++;const pos=(p.posisi||'').toUpperCase();if(pos.includes('HEAD')||pos.includes('MANAGER')||pos.includes('GENERAL'))depts.get(dept).head=p.nama;}});
  const existSnap=await db.collection('hrd_departemen').get();
  const existing=new Set();existSnap.forEach(d=>existing.add(d.data().nama));
  let added=0;
  for(const[nama,info] of depts){
    if(!existing.has(nama)){
      await db.collection('hrd_departemen').add({nama,kode:nama.substring(0,3).toUpperCase(),kepala:info.head,createdAt:new Date().toISOString()});
      added++;
    }
  }
  toast(`Sinkronisasi selesai: ${added} departemen baru ditambahkan`,'success');
  renderDepartemen();
}

// ── POSISI ────────────────────────────────────────────────────
async function renderPosisi(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>💼 Posisi</span><div class="flex gap-8"><button class="btn btn-primary btn-sm" onclick="modalPosisi()">+ Tambah</button><button class="btn btn-info btn-sm" onclick="syncPosFromKaryawan()">🔄 Sinkron dari Karyawan</button></div></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Departemen</th><th>Level</th><th>Aksi</th></tr></thead><tbody id="tblPos"></tbody></table></div></div>`;const snap=await db.collection('hrd_posisi').get();let h='';if(snap.empty)h='<tr><td colspan="4" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.departemen||'-')}</td><td>${escHtml(p.level||'-')}</td><td><button class="btn btn-xs btn-info" onclick="modalPosisi('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_posisi','${d.id}','posisi')">🗑️</button></td></tr>`;});document.getElementById('tblPos').innerHTML=h;}
function modalPosisi(id){if(id)db.collection('hrd_posisi').doc(id).get().then(d=>showPosForm(id,d.data()||{}));else showPosForm(null,{});}
function showPosForm(id,p){openModal(`<div class="modal-title">${id?'Edit':'Tambah'} Posisi</div><div class="form-group"><label>Nama</label><input class="form-control" id="pNama" value="${escHtml(p.nama||'')}"></div><div class="form-group"><label>Departemen</label><input class="form-control" id="pDept" value="${escHtml(p.departemen||'')}"></div><div class="form-group"><label>Level</label><input class="form-control" id="pLevel" value="${escHtml(p.level||'')}"></div><button class="btn btn-primary" onclick="simpanPosisi('${id||''}')">Simpan</button>`);}
async function simpanPosisi(id){const data={nama:document.getElementById('pNama').value,departemen:document.getElementById('pDept').value,level:document.getElementById('pLevel').value,updatedAt:new Date().toISOString()};if(!data.nama)return toast('Nama wajib','warning');if(id)await db.collection('hrd_posisi').doc(id).update(data);else await db.collection('hrd_posisi').add({...data,createdAt:new Date().toISOString()});closeModalDirect();toast('Disimpan','success');renderPosisi();}

async function syncPosFromKaryawan(){
  const kSnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  const positions=new Map();
  kSnap.forEach(d=>{const p=d.data();const pos=p.posisi;const dept=p.departemen||'';if(pos&&!positions.has(pos))positions.set(pos,dept);});
  const existSnap=await db.collection('hrd_posisi').get();
  const existing=new Set();existSnap.forEach(d=>existing.add(d.data().nama));
  let added=0;
  for(const[nama,dept] of positions){
    if(!existing.has(nama)){
      await db.collection('hrd_posisi').add({nama,departemen:dept,level:'',createdAt:new Date().toISOString()});
      added++;
    }
  }
  toast(`Sinkronisasi selesai: ${added} posisi baru ditambahkan`,'success');
  renderPosisi();
}

// ── CABANG ────────────────────────────────────────────────────
async function renderCabang(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>🏛️ Cabang</span><button class="btn btn-primary btn-sm" onclick="modalCabang()">+ Tambah</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Kota</th><th>Lat/Lng</th><th>Radius</th><th>Aksi</th></tr></thead><tbody id="tblCab"></tbody></table></div></div>`;const snap=await db.collection('hrd_cabang').get();let h='';if(snap.empty)h='<tr><td colspan="5" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.kota||'-')}</td><td>${p.lat||0},${p.lng||0}</td><td>${p.radius||10}m</td><td><button class="btn btn-xs btn-info" onclick="modalCabang('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_cabang','${d.id}','cabang')">🗑️</button></td></tr>`;});document.getElementById('tblCab').innerHTML=h;}
function modalCabang(id){if(id)db.collection('hrd_cabang').doc(id).get().then(d=>showCabForm(id,d.data()||{}));else showCabForm(null,{});}
function showCabForm(id,p){openModal(`<div class="modal-title">${id?'Edit':'Tambah'} Cabang</div><div class="form-group"><label>Nama</label><input class="form-control" id="cNama" value="${escHtml(p.nama||'')}"></div><div class="grid-2"><div class="form-group"><label>Kota</label><input class="form-control" id="cKota" value="${escHtml(p.kota||'')}"></div><div class="form-group"><label>Radius (m)</label><input class="form-control" type="number" id="cRadius" value="${p.radius||10}"></div></div><div class="grid-2"><div class="form-group"><label>Latitude</label><input class="form-control" id="cLat" value="${p.lat||''}"></div><div class="form-group"><label>Longitude</label><input class="form-control" id="cLng" value="${p.lng||''}"></div></div><button class="btn btn-primary" onclick="simpanCabang('${id||''}')">Simpan</button>`);}
async function simpanCabang(id){const data={nama:document.getElementById('cNama').value,kota:document.getElementById('cKota').value,lat:parseFloat(document.getElementById('cLat').value)||0,lng:parseFloat(document.getElementById('cLng').value)||0,radius:parseInt(document.getElementById('cRadius').value)||10,updatedAt:new Date().toISOString()};if(!data.nama)return toast('Nama wajib','warning');if(id)await db.collection('hrd_cabang').doc(id).update(data);else await db.collection('hrd_cabang').add({...data,createdAt:new Date().toISOString()});closeModalDirect();toast('Disimpan','success');renderCabang();}

// ── KARYAWAN ──────────────────────────────────────────────────
async function renderKaryawan(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>👥 Data Karyawan</span><div><button class="btn btn-primary btn-sm" onclick="modalKaryawan()">+ Tambah</button> <button class="btn btn-secondary btn-sm" onclick="modalImportKaryawan()">⬇️ Import</button></div></div><div class="card"><div class="flex gap-8 mb-16"><input class="form-control" placeholder="🔍 Cari nama/NIP..." id="srcKary" oninput="filterKaryawan()"><select class="form-control" style="max-width:180px" id="filterDept" onchange="filterKaryawan()"><option value="">Semua Dept</option></select></div><div class="table-wrap"><table><thead><tr><th>NIP</th><th>Nama</th><th>Departemen</th><th>Posisi</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblKary"></tbody></table></div></div>`;const snap=await db.collection('hrd_karyawan').get();window._karyawanData=[];const depts=new Set();snap.forEach(d=>{const p={id:d.id,...d.data()};window._karyawanData.push(p);depts.add(p.departemen||'');});const sel=document.getElementById('filterDept');depts.forEach(d=>{if(d)sel.innerHTML+=`<option>${escHtml(d)}</option>`;});filterKaryawan();}
function filterKaryawan(){const q=(document.getElementById('srcKary')?.value||'').toLowerCase(),dept=document.getElementById('filterDept')?.value||'';const filtered=(window._karyawanData||[]).filter(k=>{if(q&&!k.nama?.toLowerCase().includes(q)&&!k.nip?.toLowerCase().includes(q))return false;if(dept&&k.departemen!==dept)return false;return true;});let h='';if(!filtered.length)h='<tr><td colspan="6" class="text-center">Tidak ada data</td></tr>';else filtered.forEach(k=>{h+=`<tr><td>${escHtml(k.nip||'-')}</td><td class="fw-700">${escHtml(k.nama)}</td><td>${escHtml(k.departemen||'-')}</td><td>${escHtml(k.posisi||'-')}</td><td><span class="badge badge-${k.status==='aktif'?'success':'danger'}">${k.status||'aktif'}</span></td><td><button class="btn btn-xs btn-info" onclick="modalKaryawan('${k.id}')">✏️</button> <button class="btn btn-xs btn-primary" onclick="detailKaryawan('${k.id}')">👁️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_karyawan','${k.id}','karyawan')">🗑️</button></td></tr>`;});document.getElementById('tblKary').innerHTML=h;}
function modalKaryawan(id){if(id)db.collection('hrd_karyawan').doc(id).get().then(d=>showKaryForm(id,d.data()||{}));else showKaryForm(null,{});}
function showKaryForm(id,p){openModal(`<div class="modal-title">${id?'Edit':'Tambah'} Karyawan</div>
    <div style="border-bottom:2px solid var(--border);padding-bottom:14px;margin-bottom:14px"><div class="fw-700 color-primary mb-8">👤 Data Personal</div><div class="grid-2"><div class="form-group"><label>Nama Lengkap</label><input class="form-control" id="kNama" value="${escHtml(p.nama||'')}"></div><div class="form-group"><label>NIP</label><input class="form-control" id="kNip" value="${escHtml(p.nip||generateNIP())}"></div><div class="form-group"><label>NIK (KTP)</label><input class="form-control" id="kNIK" value="${escHtml(p.nik||'')}" placeholder="16 digit"></div><div class="form-group"><label>No. Kartu Keluarga</label><input class="form-control" id="kNoKK" value="${escHtml(p.noKK||'')}"></div><div class="form-group"><label>No. Passport</label><input class="form-control" id="kPassport" value="${escHtml(p.noPassport||'')}"></div><div class="form-group"><label>Jenis Kelamin</label><select class="form-control" id="kGender"><option value="">-- Pilih --</option><option value="Laki-laki" ${p.jenisKelamin==='Laki-laki'?'selected':''}>Laki-laki</option><option value="Perempuan" ${p.jenisKelamin==='Perempuan'?'selected':''}>Perempuan</option></select></div><div class="form-group"><label>Tanggal Lahir</label><input class="form-control" type="date" id="kTglLahir" value="${p.tanggalLahir||''}"></div><div class="form-group"><label>Tempat Lahir</label><input class="form-control" id="kTmptLahir" value="${escHtml(p.tempatLahir||'')}"></div><div class="form-group"><label>Email</label><input class="form-control" id="kEmail" value="${escHtml(p.email||'')}"></div><div class="form-group"><label>Telepon</label><input class="form-control" id="kTelp" value="${escHtml(p.telepon||'')}"></div></div><div class="form-group"><label>Alamat</label><textarea class="form-control" id="kAlamat" style="min-height:50px">${escHtml(p.alamat||'')}</textarea></div></div>
    <div style="border-bottom:2px solid var(--border);padding-bottom:14px;margin-bottom:14px"><div class="fw-700 color-primary mb-8">🏢 Office Detail</div><div class="grid-2"><div class="form-group"><label>Departemen</label><input class="form-control" id="kDept" value="${escHtml(p.departemen||'')}"></div><div class="form-group"><label>Posisi</label><input class="form-control" id="kPos" value="${escHtml(p.posisi||'')}"></div><div class="form-group"><label>Cabang</label><input class="form-control" id="kCabang" value="${escHtml(p.cabang||'')}"></div><div class="form-group"><label>Jadwal Kantor</label><input class="form-control" id="kJadwal" value="${escHtml(p.jadwalKantor||'')}" placeholder="Senin-Jumat 08:00-17:00"></div><div class="form-group"><label>Tipe Karyawan</label><select class="form-control" id="kTipeKary"><option value="tetap" ${p.tipeKaryawan==='tetap'?'selected':''}>Tetap</option><option value="kontrak" ${p.tipeKaryawan==='kontrak'?'selected':''}>Kontrak</option><option value="magang" ${p.tipeKaryawan==='magang'?'selected':''}>Magang</option><option value="freelance" ${p.tipeKaryawan==='freelance'?'selected':''}>Freelance</option></select></div><div class="form-group"><label>Tipe User</label><select class="form-control" id="kTipeUser"><option value="office" ${p.tipeUser==='office'?'selected':''}>Office</option><option value="field" ${p.tipeUser==='field'?'selected':''}>Field</option><option value="remote" ${p.tipeUser==='remote'?'selected':''}>Remote</option><option value="hybrid" ${p.tipeUser==='hybrid'?'selected':''}>Hybrid</option></select></div><div class="form-group"><label>Ruang Kerja</label><input class="form-control" id="kRuangKerja" value="${escHtml(p.ruangKerja||'')}" placeholder="Office, Lantai 2, dll"></div><div class="form-group"><label>Tgl Bergabung</label><input class="form-control" type="date" id="kJoin" value="${p.tanggalMasuk||''}"></div><div class="form-group"><label>Status</label><select class="form-control" id="kStatus"><option value="aktif" ${p.status==='aktif'?'selected':''}>Aktif</option><option value="nonaktif" ${p.status==='nonaktif'?'selected':''}>Nonaktif</option><option value="probation" ${p.status==='probation'?'selected':''}>Probation</option><option value="kontrak" ${p.status==='kontrak'?'selected':''}>Kontrak</option></select></div><div class="form-group"><label>Atasan</label><input class="form-control" id="kAtasan" value="${escHtml(p.atasan||'')}"></div></div></div>
    <div style="border-bottom:2px solid var(--border);padding-bottom:14px;margin-bottom:14px"><div class="fw-700 color-primary mb-8">💳 Detail Rekening & BPJS</div><div class="grid-2"><div class="form-group"><label>Nama Bank / E-Wallet</label><input class="form-control" id="kBank" value="${escHtml(p.namaBank||'')}" placeholder="BCA, Mandiri, GoPay, dll"></div><div class="form-group"><label>No. Rekening / E-Wallet</label><input class="form-control" id="kNoRek" value="${escHtml(p.noRekening||'')}"></div><div class="form-group"><label>Tipe Rekening</label><select class="form-control" id="kTipeRek"><option value="salary" ${p.tipeRekening==='salary'?'selected':''}>Salary</option><option value="savings" ${p.tipeRekening==='savings'?'selected':''}>Savings</option><option value="ewallet" ${p.tipeRekening==='ewallet'?'selected':''}>E-Wallet</option></select></div><div class="form-group"><label>No. BPJS Kesehatan</label><input class="form-control" id="kBPJSKes" value="${escHtml(p.bpjsKesehatan||'')}"></div><div class="form-group"><label>No. BPJS Ketenagakerjaan</label><input class="form-control" id="kBPJSTK" value="${escHtml(p.bpjsKetenagakerjaan||'')}"></div><div class="form-group"><label>Gaji Pokok</label><input class="form-control" type="number" id="kGaji" value="${p.gajiPokok||0}"></div></div></div>
    <div style="border-bottom:2px solid var(--border);padding-bottom:14px;margin-bottom:14px"><div class="fw-700 color-primary mb-8">📄 Data Kontrak</div><div class="grid-2"><div class="form-group"><label>Jenis Kontrak</label><select class="form-control" id="kKontrakJenis"><option value="tetap" ${p.kontrakJenis==='tetap'?'selected':''}>Karyawan Tetap (PKWTT)</option><option value="kontrak" ${p.kontrakJenis==='kontrak'?'selected':''}>Kontrak (PKWT)</option><option value="magang" ${p.kontrakJenis==='magang'?'selected':''}>Magang</option></select></div><div class="form-group"><label>Durasi Kontrak</label><input class="form-control" id="kKontrakDurasi" value="${escHtml(p.kontrakDurasi||'')}" placeholder="12 bulan"></div><div class="form-group"><label>Kontrak Mulai</label><input class="form-control" type="date" id="kKontrakMulai" value="${p.kontrakMulai||''}"></div><div class="form-group"><label>Kontrak Berakhir</label><input class="form-control" type="date" id="kKontrakAkhir" value="${p.kontrakAkhir||''}"></div></div><div class="form-group"><label>Kontrak Ke-</label><input class="form-control" type="number" id="kKontrakKe" value="${p.kontrakKe||1}" min="1"></div></div>
    <div class="flex gap-8 mt-16"><button class="btn btn-primary" onclick="simpanKaryawan('${id||''}')">💾 Simpan</button>${id?`<button class="btn btn-danger" onclick="hapusDoc('hrd_karyawan','${id}','karyawan')">🗑️ Hapus</button><button class="btn btn-info" onclick="lihatHistoryKontrak('${id}')">📋 History Kontrak</button>`:''}</div>`,true);}
async function simpanKaryawan(id){const data={nama:document.getElementById('kNama').value,nip:document.getElementById('kNip').value,nik:document.getElementById('kNIK').value,noKK:document.getElementById('kNoKK').value,noPassport:document.getElementById('kPassport').value,jenisKelamin:document.getElementById('kGender').value,tanggalLahir:document.getElementById('kTglLahir').value,tempatLahir:document.getElementById('kTmptLahir').value,email:document.getElementById('kEmail').value,telepon:document.getElementById('kTelp').value,alamat:document.getElementById('kAlamat').value,departemen:document.getElementById('kDept').value,posisi:document.getElementById('kPos').value,cabang:document.getElementById('kCabang').value,jadwalKantor:document.getElementById('kJadwal').value,tipeKaryawan:document.getElementById('kTipeKary').value,tipeUser:document.getElementById('kTipeUser').value,ruangKerja:document.getElementById('kRuangKerja').value,tanggalMasuk:document.getElementById('kJoin').value,status:document.getElementById('kStatus').value,atasan:document.getElementById('kAtasan').value,namaBank:document.getElementById('kBank').value,noRekening:document.getElementById('kNoRek').value,tipeRekening:document.getElementById('kTipeRek').value,bpjsKesehatan:document.getElementById('kBPJSKes').value,bpjsKetenagakerjaan:document.getElementById('kBPJSTK').value,gajiPokok:Number(document.getElementById('kGaji').value)||0,kontrakJenis:document.getElementById('kKontrakJenis').value,kontrakDurasi:document.getElementById('kKontrakDurasi').value,kontrakMulai:document.getElementById('kKontrakMulai').value,kontrakAkhir:document.getElementById('kKontrakAkhir').value,kontrakKe:Number(document.getElementById('kKontrakKe').value)||1,updatedAt:new Date().toISOString()};if(!data.nama)return toast('Nama wajib','warning');
  if(id){
    // Save contract history if contract dates changed
    const oldDoc=await db.collection('hrd_karyawan').doc(id).get();
    const old=oldDoc.data()||{};
    if(data.kontrakMulai&&data.kontrakAkhir&&(data.kontrakMulai!==old.kontrakMulai||data.kontrakAkhir!==old.kontrakAkhir)){
      await db.collection('hrd_kontrak_history').add({karyawanId:id,nama:data.nama,kontrakKe:data.kontrakKe,jenis:data.kontrakJenis,mulai:data.kontrakMulai,akhir:data.kontrakAkhir,durasi:data.kontrakDurasi,createdAt:new Date().toISOString()});
    }
    await db.collection('hrd_karyawan').doc(id).update(data);
  } else await db.collection('hrd_karyawan').add({...data,createdAt:new Date().toISOString()});
  closeModalDirect();toast('Disimpan','success');renderKaryawan();}

async function lihatHistoryKontrak(karyawanId){
  const snap=await db.collection('hrd_kontrak_history').where('karyawanId','==',karyawanId).get();
  let h=`<div class="modal-title">📋 History Kontrak Kerja</div>`;
  if(snap.empty)h+='<p class="text-sm" style="color:#999">Belum ada riwayat kontrak</p>';
  else{h+='<div class="table-wrap"><table><thead><tr><th>Kontrak Ke-</th><th>Jenis</th><th>Mulai</th><th>Berakhir</th><th>Durasi</th></tr></thead><tbody>';
    snap.forEach(d=>{const p=d.data();h+=`<tr><td class="fw-700">${p.kontrakKe||'-'}</td><td>${escHtml(p.jenis||'-')}</td><td>${formatDate(p.mulai)}</td><td>${formatDate(p.akhir)}</td><td>${escHtml(p.durasi||'-')}</td></tr>`;});
    h+='</tbody></table></div>';}
  openModal(h,true);
}
function detailKaryawan(id){db.collection('hrd_karyawan').doc(id).get().then(d=>{const p=d.data();openModal(`<div class="modal-title">Detail Karyawan</div><div class="grid-2"><div><b>Nama:</b> ${escHtml(p.nama)}</div><div><b>NIP:</b> ${escHtml(p.nip)}</div><div><b>Dept:</b> ${escHtml(p.departemen)}</div><div><b>Posisi:</b> ${escHtml(p.posisi)}</div><div><b>Email:</b> ${escHtml(p.email||'-')}</div><div><b>Telp:</b> ${escHtml(p.telepon||'-')}</div><div><b>Masuk:</b> ${formatDate(p.tanggalMasuk)}</div><div><b>Gaji:</b> ${formatCurrency(p.gajiPokok)}</div></div>`,true);});}

function modalImportKaryawan(){openModal(`<div class="modal-title">📥 Import Data Karyawan</div>
    <div class="tabs mb-16"><div class="tab active" onclick="switchImportTab('kary','file')">📄 Upload CSV</div><div class="tab" onclick="switchImportTab('kary','api')">🔗 API Google Sheets</div></div>
    <div id="importKaryTab">
      <p class="text-sm mb-8" style="color:#666">Upload file CSV. Header: Nama, NIP, Email, Telepon, Departemen, Posisi, Tanggal Masuk, Status, Gaji Pokok, Atasan.</p>
      <div class="form-group"><label>File CSV</label><input class="form-control" type="file" accept=".csv" id="importKaryawanFile"></div>
      <div class="flex gap-8 mb-16"><button class="btn btn-primary" onclick="processImportKaryawan()">📥 Proses Import</button><button class="btn btn-outline btn-sm" onclick="downloadKaryawanTemplate()">📄 Download Template</button></div>
      <div class="text-xs" style="color:#666">Template CSV akan membantu memastikan header sesuai dengan format sheet.</div>
    </div>`,true);}

function switchImportTab(type, mode){
  document.querySelectorAll('.tabs .tab').forEach((t,i)=>t.classList.toggle('active',i===(mode==='file'?0:1)));
  const el=document.getElementById(type==='kary'?'importKaryTab':'importGajiTab');
  if(!el)return;
  if(mode==='api'){
    el.innerHTML=`<div style="padding:12px;background:#e8f5e9;border-radius:8px;margin-bottom:16px;border-left:4px solid var(--success)">
        <div class="fw-700 text-sm mb-8">✅ Cukup paste link Google Sheets biasa!</div>
        <ol class="text-xs" style="padding-left:16px;line-height:2;color:#555">
          <li>Buka Google Sheets Anda</li>
          <li>Pastikan sheet di-<b>Share</b> → "Anyone with the link" → <b>Viewer</b></li>
          <li>Copy URL dari address bar (misal: https://docs.google.com/spreadsheets/d/xxx/edit?usp=sharing)</li>
          <li>Paste di bawah → klik Preview → Import</li>
        </ol>
        <div class="text-xs mt-8" style="color:#888">[TIP] Jika sheet punya beberapa tab, pastikan Anda berada di tab yang benar sebelum copy URL (gid akan otomatis terdeteksi)</div>
      </div>
      <div class="form-group"><label>URL Google Sheets</label><input class="form-control" id="importApiUrl" placeholder="https://docs.google.com/spreadsheets/d/xxx/edit?usp=sharing"></div>
      <div id="importApiStatus" class="mb-8"></div>
      <div class="flex gap-8">
        <button class="btn btn-info" onclick="previewApiImport('${type}')">👁️ Preview Data</button>
        <button class="btn btn-primary" onclick="processApiImport('${type}')">📥 Import ke Sistem</button>
      </div>
      <div id="importApiPreview" class="mt-16"></div>`;
  } else {
    if(type==='kary'){
      el.innerHTML=`<p class="text-sm mb-8" style="color:#666">Upload file CSV. Header: Nama, NIP, Email, Telepon, Departemen, Posisi, Tanggal Masuk, Status, Gaji Pokok, Atasan.</p><div class="form-group"><label>File CSV</label><input class="form-control" type="file" accept=".csv" id="importKaryawanFile"></div><button class="btn btn-primary" onclick="processImportKaryawan()">📥 Proses Import</button>`;
    } else {
      el.innerHTML=`<p class="text-sm mb-8" style="color:#666">Upload file CSV. Header: Nama, Periode, Gaji Pokok, Tunjangan, Potongan, PPH21, Total Bersih.</p><div class="form-group"><label>File CSV</label><input class="form-control" type="file" accept=".csv" id="importGajiFile"></div><button class="btn btn-primary" onclick="processImportPenggajian()">📥 Proses Import</button>`;
    }
  }
}

// Convert any Google Sheets URL to CSV export URL
function convertToGSheetCSV(inputUrl) {
  let url = inputUrl.trim();
  // Already a published CSV URL (pub?output=csv)
  if (url.includes('/pub') && url.includes('output=csv')) return url;
  // Already an export URL
  if (url.includes('/export?') && url.includes('format=csv')) return url;
  // Extract spreadsheet ID from various URL formats
  let match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return url; // Can't parse, return as-is
  const sheetId = match[1];
  // Try to extract gid (sheet tab id)
  let gid = '0';
  const gidMatch = url.match(/gid=(\d+)/);
  if (gidMatch) gid = gidMatch[1];
  // Also check #gid=
  const hashGid = url.match(/#gid=(\d+)/);
  if (hashGid) gid = hashGid[1];
  // Build export URL
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

async function previewApiImport(type){
  const rawUrl=document.getElementById('importApiUrl').value.trim();
  if(!rawUrl)return toast('Paste URL Google Sheets dulu','warning');
  const url = convertToGSheetCSV(rawUrl);
  document.getElementById('importApiStatus').innerHTML='<span class="badge badge-warning">⏳ Mengambil data dari Google Sheets...</span>';
  try{
    const resp=await fetch(url);
    if(!resp.ok)throw new Error('HTTP '+resp.status+' — Pastikan sheet bersifat publik (Anyone with the link can view)');
    const text=await resp.text();
    // Check if we got HTML instead of CSV (common error)
    if(text.trim().startsWith('<!') || text.trim().startsWith('<html')){
      throw new Error('Response bukan CSV. Pastikan Google Sheets di-share sebagai "Anyone with the link can view"');
    }
    const rows=parseCsvRows(text);
    if(rows.length<2){document.getElementById('importApiStatus').innerHTML='<span class="badge badge-danger">❌ Data kosong atau format tidak valid</span>';return;}
    document.getElementById('importApiStatus').innerHTML=`<span class="badge badge-success">✅ ${rows.length-1} baris data ditemukan (${rows[0].length} kolom)</span>`;
    // Show preview table (max 5 rows)
    let h='<div class="table-wrap" style="max-height:250px;overflow:auto"><table><thead><tr>';
    rows[0].forEach(col=>{h+=`<th style="font-size:.7rem">${escHtml(col)}</th>`;});
    h+='</tr></thead><tbody>';
    rows.slice(1,6).forEach(row=>{h+='<tr>';row.forEach(col=>{h+=`<td style="font-size:.75rem">${escHtml(col)}</td>`;});h+='</tr>';});
    if(rows.length>6)h+=`<tr><td colspan="${rows[0].length}" class="text-center text-xs" style="color:#999">... dan ${rows.length-6} baris lainnya</td></tr>`;
    h+='</tbody></table></div>';
    document.getElementById('importApiPreview').innerHTML=h;
    window._apiImportData=text;
  }catch(e){
    document.getElementById('importApiStatus').innerHTML=`<span class="badge badge-danger">❌ Gagal: ${e.message}</span>
      <div class="text-xs mt-8" style="color:#666;line-height:1.8">
        <b>Solusi:</b><br>
        1. Buka Google Sheets → klik "Share" → ubah ke "Anyone with the link" → Viewer<br>
        2. Paste URL biasa (misal: https://docs.google.com/spreadsheets/d/xxx/edit?usp=sharing)<br>
        3. Sistem akan otomatis convert ke format CSV
      </div>`;
  }
}

async function processApiImport(type){
  if(!window._apiImportData){
    const rawUrl=document.getElementById('importApiUrl').value.trim();
    if(!rawUrl)return toast('Paste URL dan preview dulu','warning');
    const url=convertToGSheetCSV(rawUrl);
    try{const resp=await fetch(url);const text=await resp.text();if(text.trim().startsWith('<!'))return toast('Response bukan CSV. Share sheet sebagai "Anyone with link"','error');window._apiImportData=text;}catch(e){return toast('Gagal fetch: '+e.message,'error');}
  }
  const text=window._apiImportData;
  if(type==='kary'){
    await processImportKaryawanFromText(text);
  } else {
    await processImportPenggajianFromText(text);
  }
  window._apiImportData=null;
}

async function processImportKaryawanFromText(text){
  const rows=parseCsvRows(text);if(rows.length<2)return toast('Data kosong','warning');
  const headers=rows[0].map(h=>normalizeHeader(h));const map={};
  headers.forEach((h,i)=>{if(['nama','name','nama lengkap','nama karyawan'].includes(h))map.nama=i;else if(['nip','employee id','employee no','id karyawan','nik'].includes(h))map.nip=i;else if(['email','email address','e-mail'].includes(h))map.email=i;else if(['telepon','telephone','phone','hp','no hp','no. hp','handphone'].includes(h))map.telepon=i;else if(['departemen','department','divisi','dept'].includes(h))map.departemen=i;else if(['posisi','position','jabatan','job title'].includes(h))map.posisi=i;else if(['tanggal masuk','tgl masuk','join date','date joined','mulai kerja','tanggal bergabung'].includes(h))map.tanggalMasuk=i;else if(['status','status karyawan'].includes(h))map.status=i;else if(['gaji pokok','salary','basic salary','gaji','upah'].includes(h))map.gajiPokok=i;else if(['atasan','manager','supervisor','kepala'].includes(h))map.atasan=i;else if(['alamat','address'].includes(h))map.alamat=i;else if(['jenis kelamin','gender','kelamin'].includes(h))map.jenisKelamin=i;else if(['tempat lahir','kota lahir'].includes(h))map.tempatLahir=i;else if(['tanggal lahir','tgl lahir','birth date'].includes(h))map.tanggalLahir=i;});
  if(map.nama===undefined)return toast('Header harus berisi kolom "Nama"','warning');
  let added=0,updated=0;
  for(let i=1;i<rows.length;i++){const row=rows[i];const nama=(row[map.nama]||'').trim();if(!nama)continue;
    const nip=map.nip!==undefined?(row[map.nip]||'').trim():generateNIP();
    const payload={nama,nip,email:(map.email!==undefined?row[map.email]||'':'').trim(),telepon:(map.telepon!==undefined?row[map.telepon]||'':'').trim(),departemen:(map.departemen!==undefined?row[map.departemen]||'':'').trim(),posisi:(map.posisi!==undefined?row[map.posisi]||'':'').trim(),tanggalMasuk:(map.tanggalMasuk!==undefined?row[map.tanggalMasuk]||'':'').trim(),status:(map.status!==undefined?row[map.status]||'':'').trim()||'aktif',gajiPokok:Number(String(map.gajiPokok!==undefined?row[map.gajiPokok]:'').replace(/[^0-9.-]/g,''))||0,atasan:(map.atasan!==undefined?row[map.atasan]||'':'').trim(),alamat:(map.alamat!==undefined?row[map.alamat]||'':'').trim(),jenisKelamin:(map.jenisKelamin!==undefined?row[map.jenisKelamin]||'':'').trim(),tempatLahir:(map.tempatLahir!==undefined?row[map.tempatLahir]||'':'').trim(),tanggalLahir:(map.tanggalLahir!==undefined?row[map.tanggalLahir]||'':'').trim(),updatedAt:new Date().toISOString()};
    if(nip){const snap=await db.collection('hrd_karyawan').where('nip','==',nip).limit(1).get();if(!snap.empty){await db.collection('hrd_karyawan').doc(snap.docs[0].id).update(payload);updated++;}else{await db.collection('hrd_karyawan').add({...payload,createdAt:new Date().toISOString()});added++;}}
    else{await db.collection('hrd_karyawan').add({...payload,createdAt:new Date().toISOString()});added++;}
  }
  closeModalDirect();toast(`✅ Import selesai: ${added} baru, ${updated} terupdate`,'success');renderKaryawan();
}

async function processImportKaryawan(){const file=document.getElementById('importKaryawanFile')?.files?.[0];if(!file)return toast('Pilih file CSV','warning');const text=await file.text();await processImportKaryawanFromText(text);}

function downloadKaryawanTemplate(){const csv='Nama,NIP,Email,Telepon,Departemen,Posisi,Tanggal Masuk,Status,Gaji Pokok,Atasan\nBudi Santoso,EMP001,budi@ijef.co,08123456789,HRD,Manager,2024-01-10,aktif,5000000,Andi Pratama';const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='template_data_karyawan.csv';a.click();toast('Template karyawan didownload','success');}

function downloadPenggajianTemplate(){const csv='Nama,Periode,Gaji Pokok,Tunjangan,Potongan,PPH21,Total Bersih\nBudi Santoso,2026-05,5000000,1000000,200000,150000,5650000';const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='template_penggajian.csv';a.click();toast('Template penggajian didownload','success');}

function normalizeHeader(value){return (value||'').toString().trim().toLowerCase();}

function parseCsvRows(text){const lines=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim());return lines.map(line=>{const cols=[];let cur='';let inQuotes=false;for(let i=0;i<line.length;i++){const ch=line[i];if(inQuotes){if(ch==='"'){if(line[i+1]==='"'){cur+='"';i++;} else {inQuotes=false;}} else {cur+=ch;}} else {if(ch==='"'){inQuotes=true;} else if(ch===','){cols.push(cur);cur='';} else {cur+=ch;}}}cols.push(cur);return cols.map(c=>c.trim());});}

// ── STRUKTUR ORG ──────────────────────────────────────────────
async function renderStrukturOrg(){
  const main=document.getElementById('mainContent');
  main.innerHTML=`<div class="page-title"><span>🌳 Struktur Organisasi</span></div><div class="card" id="orgChart" style="overflow-x:auto;padding:30px 20px"></div>`;
  document.getElementById('orgChart').innerHTML=`<style>
.org{text-align:center;min-width:1000px;position:relative}
.org h2{font-size:1.2rem;font-weight:700;color:#1a237e;margin:0}.org .sub{font-size:.8rem;color:#666;margin-bottom:20px}
.org .box{border:2px solid #3949ab;border-radius:8px;padding:8px 16px;display:inline-block;text-align:center;background:#e8eaf6;min-width:130px;position:relative}
.org .box .n{font-weight:700;font-size:.76rem;color:#1a237e}.org .box .p{font-size:.63rem;color:#555;margin-top:2px;text-transform:uppercase}
.org .box.f::before{content:"★";color:#ff6f00;font-size:.55rem;display:block;margin-bottom:2px}
.org .sbox{border:1.5px solid #90a4ae;border-radius:6px;padding:6px 10px;display:inline-block;text-align:center;background:#fff;min-width:100px;position:relative}
.org .sbox .n{font-weight:600;font-size:.68rem;color:#333}.org .sbox .p{font-size:.58rem;color:#888;margin-top:1px}
.org .sbox.purple{border-color:#7b1fa2}
.org .v{width:2px;background:#3949ab;margin:0 auto}
.org .row{display:flex;justify-content:center;align-items:flex-start;flex-wrap:nowrap}
.org .col{display:flex;flex-direction:column;align-items:center}
.org .lbl{font-size:.63rem;color:#3949ab;font-weight:700;margin:6px 0 4px;text-transform:uppercase;letter-spacing:1px}
.org .tree{display:flex;flex-direction:column;align-items:center}
.org .children{display:flex;justify-content:center;position:relative;padding-top:20px}
.org .children::before{content:'';position:absolute;top:0;left:calc(50% - 1px);width:2px;height:20px;background:#3949ab}
.org .children-h{position:absolute;top:20px;height:2px;background:#3949ab}
.org .child{display:flex;flex-direction:column;align-items:center;position:relative;padding:0 6px}
.org .child::before{content:'';position:absolute;top:-0px;left:50%;width:2px;height:14px;background:#3949ab;transform:translateX(-1px)}
.org .child>.sbox,.org .child>.box{margin-top:14px}
</style>
<div class="org">
<h2>STRUKTUR ORGANISASI</h2><div class="sub">LPK IJEF CORP</div>

<div class="row" style="gap:12px;justify-content:center"><div class="box f"><div class="n">MISRIANA</div><div class="p">Founder</div></div><div class="box f"><div class="n">MAHPUDIN</div><div class="p">Founder</div></div><div class="box f"><div class="n">BUDI CAHYO</div><div class="p">Founder</div></div></div>
<div class="v" style="height:30px"></div>
<div class="box"><div class="n">MUHAMMAD AGUS RYANDA</div><div class="p">General Manager</div></div>

<div class="children" style="padding-top:30px">
<div class="children-h" style="left:25%;right:25%;top:30px"></div>

<div class="child" style="padding:0 50px">
<div class="box" style="margin-top:24px"><div class="n">AGUS PURIYANTO</div><div class="p">Head of Academic</div></div>
<div class="lbl">ACADEMIC</div>
<div class="children" style="padding-top:20px">
<div class="children-h" style="left:10%;right:10%;top:20px"></div>
<div class="child"><div class="sbox" style="margin-top:14px"><div class="n">Salma Nurhaliza</div><div class="p">Admin Documents</div></div></div>
<div class="child"><div class="sbox" style="margin-top:14px"><div class="n">M. Ihsan Hilmi</div><div class="p">Curriculum Leader</div></div></div>
<div class="child"><div class="sbox" style="margin-top:14px"><div class="n">Winnie D. Welliam</div><div class="p">Student Leader</div></div><div class="v" style="height:14px"></div><div class="sbox purple"><div class="n">Galih Resmayandi</div><div class="p">Japan Instructor</div></div></div>
</div>
</div>

<div class="child" style="padding:0 50px">
<div class="box" style="margin-top:24px"><div class="n">IRSAN JANWAR WIBAWA</div><div class="p">Head of Office</div></div>
<div class="lbl">OFFICE</div>
<div class="children" style="padding-top:20px">
<div class="children-h" style="left:5%;right:5%;top:20px"></div>
<div class="child"><div class="sbox" style="margin-top:14px"><div class="n">Mira Tania</div><div class="p">Admin Documents</div></div></div>
<div class="child"><div class="sbox" style="margin-top:14px"><div class="n">Maharani Ali Putri</div><div class="p">HR & Legal</div></div><div class="v" style="height:14px"></div><div class="sbox purple"><div class="n">Rafa Dame Siregar</div><div class="p">Asisten HR & Legal</div></div></div>
<div class="child"><div class="sbox" style="margin-top:14px"><div class="n">Siti Sofuroh</div><div class="p">Finance</div></div></div>
<div class="child"><div class="sbox" style="margin-top:14px"><div class="n">Nanda Yoga Maulana</div><div class="p">General Affairs</div></div></div>
</div>
</div>

</div>
</div>`;
}

// ── ONBOARDING ────────────────────────────────────────────────
async function renderOnboarding(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>🚀 Onboarding</span><button class="btn btn-primary btn-sm" onclick="modalOnboarding()">+ Tambah</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Mulai</th><th>Checklist</th><th>Status</th></tr></thead><tbody id="tblOnboard"></tbody></table></div></div>`;const snap=await db.collection('hrd_onboarding').get();let h='';if(snap.empty)h='<tr><td colspan="4" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();const done=(p.checklist||[]).filter(c=>c.done).length,total=(p.checklist||[]).length;h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${formatDate(p.tanggalMulai)}</td><td>${done}/${total}</td><td><span class="badge badge-${done===total?'success':'warning'}">${done===total?'Selesai':'Proses'}</span></td></tr>`;});document.getElementById('tblOnboard').innerHTML=h;}
function modalOnboarding(){openModal(`<div class="modal-title">Tambah Onboarding</div><div class="form-group"><label>Nama</label><input class="form-control" id="obNama"></div><div class="form-group"><label>Tanggal Mulai</label><input class="form-control" type="date" id="obTgl" value="${todayStr()}"></div><div class="form-group"><label>Checklist (per baris)</label><textarea class="form-control" id="obCheck">Orientasi perusahaan\nSetup email & akun\nTraining SOP\nPerkenalan tim\nSerah terima perlengkapan</textarea></div><button class="btn btn-primary" onclick="simpanOnboarding()">Simpan</button>`);}
async function simpanOnboarding(){const nama=document.getElementById('obNama').value;if(!nama)return toast('Nama wajib','warning');const items=document.getElementById('obCheck').value.split('\n').filter(x=>x.trim()).map(x=>({task:x.trim(),done:false}));await db.collection('hrd_onboarding').add({nama,tanggalMulai:document.getElementById('obTgl').value,checklist:items,createdAt:new Date().toISOString()});closeModalDirect();toast('Ditambahkan','success');renderOnboarding();}

// ── OFFBOARDING ───────────────────────────────────────────────
async function renderOffboarding(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>📦 Offboarding</span><button class="btn btn-primary btn-sm" onclick="modalOffboarding()">+ Tambah</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Tgl Keluar</th><th>Alasan</th><th>Status</th></tr></thead><tbody id="tblOff"></tbody></table></div></div>`;const snap=await db.collection('hrd_offboarding').get();let h='';if(snap.empty)h='<tr><td colspan="4" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${formatDate(p.tanggalKeluar)}</td><td>${escHtml(p.alasan||'-')}</td><td><span class="badge badge-${p.status==='selesai'?'success':'warning'}">${p.status||'proses'}</span></td></tr>`;});document.getElementById('tblOff').innerHTML=h;}
function modalOffboarding(){openModal(`<div class="modal-title">Tambah Offboarding</div><div class="form-group"><label>Nama</label><input class="form-control" id="offNama"></div><div class="form-group"><label>Tgl Keluar</label><input class="form-control" type="date" id="offTgl" value="${todayStr()}"></div><div class="form-group"><label>Alasan</label><select class="form-control" id="offAlasan"><option>Resign</option><option>PHK</option><option>Kontrak Habis</option><option>Pensiun</option></select></div><button class="btn btn-primary" onclick="simpanOffboarding()">Simpan</button>`);}
async function simpanOffboarding(){const data={nama:document.getElementById('offNama').value,tanggalKeluar:document.getElementById('offTgl').value,alasan:document.getElementById('offAlasan').value,status:'proses',createdAt:new Date().toISOString()};if(!data.nama)return toast('Nama wajib','warning');await db.collection('hrd_offboarding').add(data);closeModalDirect();toast('Ditambahkan','success');renderOffboarding();}

// ── REKRUTMEN ─────────────────────────────────────────────────
async function renderLowongan(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>📝 Lowongan</span><button class="btn btn-primary btn-sm" onclick="modalLowongan()">+ Tambah</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Posisi</th><th>Dept</th><th>Status</th><th>Deadline</th><th>Aksi</th></tr></thead><tbody id="tblLow"></tbody></table></div></div>`;const snap=await db.collection('hrd_lowongan').get();let h='';if(snap.empty)h='<tr><td colspan="5" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();h+=`<tr><td class="fw-700">${escHtml(p.posisi)}</td><td>${escHtml(p.departemen||'-')}</td><td><span class="badge badge-${p.status==='open'?'success':'danger'}">${p.status}</span></td><td>${formatDate(p.deadline)}</td><td><button class="btn btn-xs btn-info" onclick="modalLowongan('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_lowongan','${d.id}','lowongan')">🗑️</button></td></tr>`;});document.getElementById('tblLow').innerHTML=h;}
function modalLowongan(id){if(id)db.collection('hrd_lowongan').doc(id).get().then(d=>showLowForm(id,d.data()||{}));else showLowForm(null,{});}
function showLowForm(id,p){openModal(`<div class="modal-title">${id?'Edit':'Tambah'} Lowongan</div><div class="grid-2"><div class="form-group"><label>Posisi</label><input class="form-control" id="lwPos" value="${escHtml(p.posisi||'')}"></div><div class="form-group"><label>Dept</label><input class="form-control" id="lwDept" value="${escHtml(p.departemen||'')}"></div></div><div class="grid-2"><div class="form-group"><label>Status</label><select class="form-control" id="lwStatus"><option value="open" ${p.status==='open'?'selected':''}>Open</option><option value="closed" ${p.status==='closed'?'selected':''}>Closed</option></select></div><div class="form-group"><label>Deadline</label><input class="form-control" type="date" id="lwDead" value="${p.deadline||''}"></div></div><div class="form-group"><label>Deskripsi</label><textarea class="form-control" id="lwDesc">${escHtml(p.deskripsi||'')}</textarea></div><button class="btn btn-primary" onclick="simpanLowongan('${id||''}')">Simpan</button>`);}
async function simpanLowongan(id){const data={posisi:document.getElementById('lwPos').value,departemen:document.getElementById('lwDept').value,status:document.getElementById('lwStatus').value,deadline:document.getElementById('lwDead').value,deskripsi:document.getElementById('lwDesc').value,updatedAt:new Date().toISOString()};if(!data.posisi)return toast('Posisi wajib','warning');if(id)await db.collection('hrd_lowongan').doc(id).update(data);else await db.collection('hrd_lowongan').add({...data,createdAt:new Date().toISOString()});closeModalDirect();toast('Disimpan','success');renderLowongan();}

async function renderPipeline(){const main=document.getElementById('mainContent');const stages=['Applied','DISC Test Done','Screening','Interview','Offering','Hired','Rejected'];const colors=['#1565c0','#7b1fa2','#f57f17','#6a1b9a','#e65100','#2e7d32','#c62828'];main.innerHTML=`<div class="page-title"><span>🔄 Pipeline Rekrutmen</span></div><div class="kanban-board" id="kanbanBoard"></div>`;const snap=await db.collection('hrd_kandidat').get();const byStage={};stages.forEach(s=>byStage[s]=[]);snap.forEach(d=>{const p={id:d.id,...d.data()};const st=p.stage||'Applied';if(byStage[st])byStage[st].push(p);});let h='';stages.forEach((s,i)=>{h+=`<div class="kanban-col"><div class="kanban-col-title" style="background:${colors[i]}">${s} (${byStage[s].length})</div>`;byStage[s].forEach(k=>{h+=`<div class="kanban-card" onclick="modalKandidat('${k.id}')"><div class="fw-700">${escHtml(k.nama)}</div><div class="text-xs" style="color:#999">${escHtml(k.posisi||'-')}</div></div>`;});h+=`</div>`;});document.getElementById('kanbanBoard').innerHTML=h;}

async function renderKandidat(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>🧑‍💼 Kandidat</span><div class="flex gap-8"><button class="btn btn-primary btn-sm" onclick="modalKandidat()">+ Tambah</button><button class="btn btn-success btn-sm" onclick="syncDiscCalonToKandidat()">🔄 Sinkron dari DISC</button></div></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Posisi</th><th>Stage</th><th>DISC</th><th>Aksi</th></tr></thead><tbody id="tblKand"></tbody></table></div></div>`;const snap=await db.collection('hrd_kandidat').get();let h='';if(snap.empty)h='<tr><td colspan="5" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.posisi||'-')}</td><td><span class="badge badge-info">${p.stage||'Applied'}</span></td><td>${p.discPattern?`<span class="badge badge-primary">${escHtml(p.discPattern)}</span>`:'-'}</td><td><button class="btn btn-xs btn-info" onclick="modalKandidat('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_kandidat','${d.id}','kandidat')">🗑️</button></td></tr>`;});document.getElementById('tblKand').innerHTML=h;}

async function syncDiscCalonToKandidat(){
  const discSnap=await db.collection('hrd_disc_results').where('mode','==','calon').get();
  if(discSnap.empty)return toast('Tidak ada data DISC calon karyawan','info');
  const kandSnap=await db.collection('hrd_kandidat').get();
  const existingNames=new Set();kandSnap.forEach(d=>existingNames.add(d.data().nama?.toLowerCase()));
  let count=0;
  for(const doc of discSnap.docs){
    const r=doc.data();
    if(!r.nama||existingNames.has(r.nama.toLowerCase()))continue;
    await db.collection('hrd_kandidat').add({nama:r.nama,email:r.kontak||'',posisi:r.posisi||'',stage:'DISC Test Done',sumber:'DISC Test Online',discPattern:r.pattern||'',discProfile:r.profileName||'',discScore:r.kpiScore||0,usia:r.usia||'',jenisKelamin:r.jenisKelamin||'',kontak:r.kontak||'',createdAt:r.createdAt||new Date().toISOString()});
    existingNames.add(r.nama.toLowerCase());count++;
  }
  toast(`${count} kandidat dari DISC disinkronkan ke rekrutmen`,'success');
  if(count>0)renderKandidat();
}
function modalKandidat(id){if(id)db.collection('hrd_kandidat').doc(id).get().then(d=>showKandForm(id,d.data()||{}));else showKandForm(null,{});}
function showKandForm(id,p){openModal(`<div class="modal-title">${id?'Edit':'Tambah'} Kandidat</div><div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="kdNama" value="${escHtml(p.nama||'')}"></div><div class="form-group"><label>Posisi</label><input class="form-control" id="kdPos" value="${escHtml(p.posisi||'')}"></div></div><div class="grid-2"><div class="form-group"><label>Email</label><input class="form-control" id="kdEmail" value="${escHtml(p.email||'')}"></div><div class="form-group"><label>Stage</label><select class="form-control" id="kdStage"><option value="Applied" ${p.stage==='Applied'?'selected':''}>Applied</option><option value="DISC Test Done" ${p.stage==='DISC Test Done'?'selected':''}>DISC Test Done</option><option value="Screening" ${p.stage==='Screening'?'selected':''}>Screening</option><option value="Interview" ${p.stage==='Interview'?'selected':''}>Interview</option><option value="Offering" ${p.stage==='Offering'?'selected':''}>Offering</option><option value="Hired" ${p.stage==='Hired'?'selected':''}>Hired</option><option value="Rejected" ${p.stage==='Rejected'?'selected':''}>Rejected</option></select></div></div><div class="grid-2"><div class="form-group"><label>DISC Pattern</label><input class="form-control" id="kdDisc" value="${escHtml(p.discPattern||'')}" placeholder="Otomatis dari DISC" readonly></div><div class="form-group"><label>Kontak</label><input class="form-control" id="kdKontak" value="${escHtml(p.kontak||p.email||'')}"></div></div><button class="btn btn-primary" onclick="simpanKandidat('${id||''}')">Simpan</button>`);}
async function simpanKandidat(id){const data={nama:document.getElementById('kdNama').value,posisi:document.getElementById('kdPos').value,email:document.getElementById('kdEmail').value,stage:document.getElementById('kdStage').value,updatedAt:new Date().toISOString()};if(!data.nama)return toast('Nama wajib','warning');if(id)await db.collection('hrd_kandidat').doc(id).update(data);else await db.collection('hrd_kandidat').add({...data,createdAt:new Date().toISOString()});closeModalDirect();toast('Disimpan','success');renderKandidat();}

// ── CUTI / IZIN / WFH ─────────────────────────────────────────
async function renderCuti(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>🏖️ Cuti / Izin / WFH</span><button class="btn btn-primary btn-sm" onclick="modalCuti()">+ Pengajuan</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Jenis</th><th>Tanggal</th><th>Durasi</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblCuti"></tbody></table></div></div>`;const snap=await db.collection('hrd_cuti').get();let h='';if(snap.empty)h='<tr><td colspan="6" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();const badge=p.status==='approved'?'badge-success':p.status==='rejected'?'badge-danger':'badge-warning';h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.jenis)}</td><td>${formatDate(p.mulai)}-${formatDate(p.selesai)}</td><td>${p.durasi||1}h</td><td><span class="badge ${badge}">${p.status}</span></td><td>${p.status==='pending'&&hasAccess(3)?`<button class="btn btn-xs btn-success" onclick="approveCuti('${d.id}','approved')">✅</button> <button class="btn btn-xs btn-danger" onclick="approveCuti('${d.id}','rejected')">❌</button>`:''} <button class="btn btn-xs btn-warning" onclick="editCutiDoc('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_cuti','${d.id}','cuti')">🗑️</button></td></tr>`;});document.getElementById('tblCuti').innerHTML=h;}
function modalCuti(){openModal(`<div class="modal-title">Pengajuan Cuti/Izin/WFH</div><div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="ctNama" value="${currentUser.nama}"></div><div class="form-group"><label>Jenis</label><select class="form-control" id="ctJenis"><option>Cuti Tahunan</option><option>Cuti Sakit</option><option>Izin Pribadi</option><option>WFH</option><option>Cuti Melahirkan</option></select></div></div><div class="grid-2"><div class="form-group"><label>Mulai</label><input class="form-control" type="date" id="ctMulai" value="${todayStr()}"></div><div class="form-group"><label>Selesai</label><input class="form-control" type="date" id="ctSelesai" value="${todayStr()}"></div></div><div class="form-group"><label>Keterangan</label><textarea class="form-control" id="ctKet"></textarea></div><button class="btn btn-primary" onclick="simpanCuti()">Ajukan</button>`);}
async function simpanCuti(){
  const mulai=document.getElementById('ctMulai').value,selesai=document.getElementById('ctSelesai').value;
  const durasi=Math.max(1,Math.ceil((new Date(selesai)-new Date(mulai))/86400000)+1);
  const data={nama:document.getElementById('ctNama').value,jenis:document.getElementById('ctJenis').value,mulai,selesai,durasi,keterangan:document.getElementById('ctKet').value,status:'pending',userId:currentUser.id,createdAt:new Date().toISOString()};
  if(!data.nama)return toast('Nama wajib','warning');
  // Find atasan (supervisor) from karyawan data for hierarchical approval
  const kSnap=await db.collection('hrd_karyawan').where('nama','==',currentUser.nama).limit(1).get();
  if(!kSnap.empty){const kData=kSnap.docs[0].data();data.atasan=kData.atasan||'';data.departemen=kData.departemen||'';}
  await db.collection('hrd_cuti').add(data);
  // Notify atasan first, then HR
  if(data.atasan){
    const atasanSnap=await db.collection('hrd_users').where('nama','==',data.atasan).limit(1).get();
    if(!atasanSnap.empty)await sendNotification(atasanSnap.docs[0].id,'📋 Pengajuan Cuti',`${data.nama} mengajukan ${data.jenis} (${durasi} hari)`,'approval-center');
  }
  await sendNotification('hr','📋 Pengajuan Cuti',`${data.nama} mengajukan ${data.jenis}`,'approval-center');
  closeModalDirect();toast('Diajukan ke atasan & HR','success');renderCuti();
}
async function approveCuti(id,status){await db.collection('hrd_cuti').doc(id).update({status,approvedBy:currentUser.nama,approvedAt:new Date().toISOString()});toast('Updated','success');renderCuti();}

// ── OVERTIME ──────────────────────────────────────────────────
async function renderOvertime(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>⏰ Overtime</span><button class="btn btn-primary btn-sm" onclick="modalOvertime()">+ Pengajuan</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Tanggal</th><th>Jam</th><th>Durasi</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblOT"></tbody></table></div></div>`;const snap=await db.collection('hrd_overtime').get();let h='';if(snap.empty)h='<tr><td colspan="6" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();const badge=p.status==='approved'?'badge-success':p.status==='rejected'?'badge-danger':'badge-warning';h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${formatDate(p.tanggal)}</td><td>${p.jamMulai||'-'}-${p.jamSelesai||'-'}</td><td>${p.durasi||0}j</td><td><span class="badge ${badge}">${p.status}</span></td><td>${p.status==='pending'&&hasAccess(3)?`<button class="btn btn-xs btn-success" onclick="approveOT('${d.id}','approved')">✅</button> <button class="btn btn-xs btn-danger" onclick="approveOT('${d.id}','rejected')">❌</button>`:''} <button class="btn btn-xs btn-warning" onclick="editOTDoc('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_overtime','${d.id}','overtime')">🗑️</button></td></tr>`;});document.getElementById('tblOT').innerHTML=h;}
function modalOvertime(){openModal(`<div class="modal-title">Pengajuan Overtime</div><div class="form-group"><label>Nama</label><input class="form-control" id="otNama" value="${currentUser.nama}"></div><div class="grid-3"><div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="otTgl" value="${todayStr()}"></div><div class="form-group"><label>Mulai</label><input class="form-control" type="time" id="otStart"></div><div class="form-group"><label>Selesai</label><input class="form-control" type="time" id="otEnd"></div></div><div class="form-group"><label>Alasan</label><textarea class="form-control" id="otAlasan"></textarea></div><button class="btn btn-primary" onclick="simpanOvertime()">Ajukan</button>`);}
async function simpanOvertime(){const s=document.getElementById('otStart').value,e=document.getElementById('otEnd').value;const durasi=s&&e?Math.max(0,((new Date('2000-01-01T'+e)-new Date('2000-01-01T'+s))/3600000)).toFixed(1):0;await db.collection('hrd_overtime').add({nama:document.getElementById('otNama').value,tanggal:document.getElementById('otTgl').value,jamMulai:s,jamSelesai:e,durasi:parseFloat(durasi),alasan:document.getElementById('otAlasan').value,status:'pending',userId:currentUser.id,createdAt:new Date().toISOString()});closeModalDirect();toast('Diajukan','success');renderOvertime();}
async function approveOT(id,status){await db.collection('hrd_overtime').doc(id).update({status,approvedBy:currentUser.nama});toast('Updated','success');renderOvertime();}

// ── HARI LIBUR ────────────────────────────────────────────────

// Indonesian National Holidays 2025
const HARI_LIBUR_NASIONAL_2025 = [
  { tanggal: '2025-01-01', nama: 'Tahun Baru Masehi', tipe: 'nasional' },
  { tanggal: '2025-01-27', nama: 'Isra Mi\'raj Nabi Muhammad SAW', tipe: 'nasional' },
  { tanggal: '2025-01-29', nama: 'Tahun Baru Imlek 2576 Kongzili', tipe: 'nasional' },
  { tanggal: '2025-03-29', nama: 'Hari Raya Nyepi Tahun Baru Saka 1947', tipe: 'nasional' },
  { tanggal: '2025-03-30', nama: 'Hari Raya Idul Fitri 1446 H (Hari 1)', tipe: 'nasional' },
  { tanggal: '2025-03-31', nama: 'Hari Raya Idul Fitri 1446 H (Hari 2)', tipe: 'nasional' },
  { tanggal: '2025-03-28', nama: 'Cuti Bersama Idul Fitri', tipe: 'cuti_bersama' },
  { tanggal: '2025-04-01', nama: 'Cuti Bersama Idul Fitri', tipe: 'cuti_bersama' },
  { tanggal: '2025-04-02', nama: 'Cuti Bersama Idul Fitri', tipe: 'cuti_bersama' },
  { tanggal: '2025-04-03', nama: 'Cuti Bersama Idul Fitri', tipe: 'cuti_bersama' },
  { tanggal: '2025-04-04', nama: 'Cuti Bersama Idul Fitri', tipe: 'cuti_bersama' },
  { tanggal: '2025-04-18', nama: 'Wafat Isa Al Masih', tipe: 'nasional' },
  { tanggal: '2025-05-01', nama: 'Hari Buruh Internasional', tipe: 'nasional' },
  { tanggal: '2025-05-12', nama: 'Hari Raya Waisak 2569 BE', tipe: 'nasional' },
  { tanggal: '2025-05-29', nama: 'Kenaikan Isa Al Masih', tipe: 'nasional' },
  { tanggal: '2025-06-01', nama: 'Hari Lahir Pancasila', tipe: 'nasional' },
  { tanggal: '2025-06-06', nama: 'Hari Raya Idul Adha 1446 H', tipe: 'nasional' },
  { tanggal: '2025-06-27', nama: 'Tahun Baru Islam 1447 H', tipe: 'nasional' },
  { tanggal: '2025-08-17', nama: 'Hari Kemerdekaan RI', tipe: 'nasional' },
  { tanggal: '2025-09-05', nama: 'Maulid Nabi Muhammad SAW', tipe: 'nasional' },
  { tanggal: '2025-12-25', nama: 'Hari Natal', tipe: 'nasional' },
  { tanggal: '2025-12-26', nama: 'Cuti Bersama Natal', tipe: 'cuti_bersama' }
];

const HARI_LIBUR_NASIONAL_2026 = [
  { tanggal: '2026-01-01', nama: 'Tahun Baru Masehi', tipe: 'nasional' },
  { tanggal: '2026-01-16', nama: 'Isra Mi\'raj Nabi Muhammad SAW', tipe: 'nasional' },
  { tanggal: '2026-02-17', nama: 'Tahun Baru Imlek 2577 Kongzili', tipe: 'nasional' },
  { tanggal: '2026-03-19', nama: 'Hari Raya Nyepi Tahun Baru Saka 1948', tipe: 'nasional' },
  { tanggal: '2026-03-20', nama: 'Hari Raya Idul Fitri 1447 H (Hari 1)', tipe: 'nasional' },
  { tanggal: '2026-03-21', nama: 'Hari Raya Idul Fitri 1447 H (Hari 2)', tipe: 'nasional' },
  { tanggal: '2026-03-18', nama: 'Cuti Bersama Idul Fitri', tipe: 'cuti_bersama' },
  { tanggal: '2026-03-22', nama: 'Cuti Bersama Idul Fitri', tipe: 'cuti_bersama' },
  { tanggal: '2026-03-23', nama: 'Cuti Bersama Idul Fitri', tipe: 'cuti_bersama' },
  { tanggal: '2026-04-03', nama: 'Wafat Isa Al Masih', tipe: 'nasional' },
  { tanggal: '2026-05-01', nama: 'Hari Buruh Internasional', tipe: 'nasional' },
  { tanggal: '2026-05-14', nama: 'Kenaikan Isa Al Masih', tipe: 'nasional' },
  { tanggal: '2026-05-26', nama: 'Hari Raya Idul Adha 1447 H', tipe: 'nasional' },
  { tanggal: '2026-05-31', nama: 'Hari Raya Waisak 2570 BE', tipe: 'nasional' },
  { tanggal: '2026-06-01', nama: 'Hari Lahir Pancasila', tipe: 'nasional' },
  { tanggal: '2026-06-17', nama: 'Tahun Baru Islam 1448 H', tipe: 'nasional' },
  { tanggal: '2026-08-17', nama: 'Hari Kemerdekaan RI', tipe: 'nasional' },
  { tanggal: '2026-08-26', nama: 'Maulid Nabi Muhammad SAW', tipe: 'nasional' },
  { tanggal: '2026-12-25', nama: 'Hari Natal', tipe: 'nasional' },
  { tanggal: '2026-12-26', nama: 'Cuti Bersama Natal', tipe: 'cuti_bersama' }
];

let hariLiburCalendarMonth = null;
let hariLiburViewMode = 'kalender'; // 'kalender' or 'daftar'

async function renderHariLibur() {
  const main = document.getElementById('mainContent');
  if (!hariLiburCalendarMonth) {
    const now = new Date();
    hariLiburCalendarMonth = { year: now.getFullYear(), month: now.getMonth() };
  }
  main.innerHTML = `
    <div class="page-title"><span>📅 Hari Libur</span></div>
    <div class="card">
      <div class="tabs mb-16" id="hariLiburTabs">
        <div class="tab ${hariLiburViewMode==='kalender'?'active':''}" onclick="switchHariLiburView('kalender')">📅 Kalender</div>
        <div class="tab ${hariLiburViewMode==='daftar'?'active':''}" onclick="switchHariLiburView('daftar')">📋 Daftar</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px">
          <button class="btn btn-sm btn-outline" onclick="hariLiburPrevMonth()">&lt;</button>
          <span class="fw-700 color-primary" id="hariLiburMonthLabel" style="min-width:140px;text-align:center"></span>
          <button class="btn btn-sm btn-outline" onclick="hariLiburNextMonth()">&gt;</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-info btn-sm" onclick="syncHariLiburNasional()">🔄 Sinkron Nasional</button>
          <button class="btn btn-primary btn-sm" onclick="modalHariLibur()">+ Tambah Custom</button>
        </div>
      </div>
      <div id="hariLiburContent"></div>
    </div>`;
  await loadHariLiburView();
}

function switchHariLiburView(mode) {
  hariLiburViewMode = mode;
  renderHariLibur();
}

function hariLiburPrevMonth() {
  hariLiburCalendarMonth.month--;
  if (hariLiburCalendarMonth.month < 0) { hariLiburCalendarMonth.month = 11; hariLiburCalendarMonth.year--; }
  loadHariLiburView();
}

function hariLiburNextMonth() {
  hariLiburCalendarMonth.month++;
  if (hariLiburCalendarMonth.month > 11) { hariLiburCalendarMonth.month = 0; hariLiburCalendarMonth.year++; }
  loadHariLiburView();
}

async function loadHariLiburView() {
  const y = hariLiburCalendarMonth.year;
  const m = hariLiburCalendarMonth.month;
  const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const label = document.getElementById('hariLiburMonthLabel');
  if (label) label.textContent = `${monthNames[m]} ${y}`;

  // Load holidays from Firestore
  const startDate = `${y}-${String(m+1).padStart(2,'0')}-01`;
  const endDate = `${y}-${String(m+1).padStart(2,'0')}-${String(new Date(y, m+1, 0).getDate()).padStart(2,'0')}`;
  const snap = await db.collection('hrd_hari_libur').where('tanggal','>=',startDate).where('tanggal','<=',endDate).orderBy('tanggal').get();
  const holidays = [];
  snap.forEach(d => holidays.push({ id: d.id, ...d.data() }));

  const container = document.getElementById('hariLiburContent');
  if (!container) return;

  if (hariLiburViewMode === 'kalender') {
    renderHariLiburCalendar(container, y, m, holidays);
  } else {
    renderHariLiburList(container, y, m, holidays);
  }
}

function renderHariLiburCalendar(container, year, month, holidays) {
  const today = new Date();
  const todayStr2 = today.toISOString().split('T')[0];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  // Monday = 0, Sunday = 6
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;

  const holidayMap = {};
  holidays.forEach(h => {
    const day = parseInt(h.tanggal.split('-')[2]);
    if (!holidayMap[day]) holidayMap[day] = [];
    holidayMap[day].push(h);
  });

  let html = `<style>
    .hl-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-top:8px}
    .hl-cal-header{padding:8px 4px;text-align:center;font-size:.75rem;font-weight:700;color:var(--primary);background:#f0f4ff;border-radius:4px}
    .hl-cal-cell{min-height:70px;padding:4px 6px;border-radius:6px;border:1.5px solid transparent;position:relative;cursor:default;transition:all .15s}
    .hl-cal-cell:hover{box-shadow:0 2px 8px rgba(0,0,0,.1)}
    .hl-cal-cell.hl-empty{background:transparent;border:none;min-height:auto}
    .hl-cal-cell.hl-weekend{background:#f5f5f5;color:#999}
    .hl-cal-cell.hl-holiday{background:#ffebee;border-color:#ef5350}
    .hl-cal-cell.hl-cuti-bersama{background:#fff3e0;border-color:#ff9800}
    .hl-cal-cell.hl-today{border-color:#1565c0;box-shadow:0 0 0 2px rgba(21,101,192,.3)}
    .hl-cal-day{font-size:.85rem;font-weight:700}
    .hl-cal-cell.hl-holiday .hl-cal-day{color:#c62828}
    .hl-cal-cell.hl-cuti-bersama .hl-cal-day{color:#e65100}
    .hl-cal-cell.hl-today .hl-cal-day{color:#1565c0}
    .hl-cal-name{font-size:.6rem;color:#c62828;margin-top:2px;line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .hl-cal-cell.hl-cuti-bersama .hl-cal-name{color:#e65100}
  </style>
  <div class="hl-calendar">
    <div class="hl-cal-header">Sen</div>
    <div class="hl-cal-header">Sel</div>
    <div class="hl-cal-header">Rab</div>
    <div class="hl-cal-header">Kam</div>
    <div class="hl-cal-header">Jum</div>
    <div class="hl-cal-header" style="color:var(--text-light)">Sab</div>
    <div class="hl-cal-header" style="color:var(--danger)">Min</div>`;

  // Empty cells for days before month start
  for (let i = 0; i < startDayOfWeek; i++) {
    html += '<div class="hl-cal-cell hl-empty"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayOfWeek = (startDayOfWeek + day - 1) % 7; // 0=Mon, 5=Sat, 6=Sun
    const isWeekend = dayOfWeek >= 5;
    const isToday = dateStr === todayStr2;
    const dayHolidays = holidayMap[day] || [];
    const hasHoliday = dayHolidays.some(h => h.tipe === 'nasional' || h.tipe === 'perusahaan');
    const hasCutiBersama = dayHolidays.some(h => h.tipe === 'cuti_bersama');

    let classes = 'hl-cal-cell';
    if (hasHoliday) classes += ' hl-holiday';
    else if (hasCutiBersama) classes += ' hl-cuti-bersama';
    else if (isWeekend) classes += ' hl-weekend';
    if (isToday) classes += ' hl-today';

    const title = dayHolidays.map(h => h.nama).join(', ');
    html += `<div class="${classes}" title="${escHtml(title)}">`;
    html += `<div class="hl-cal-day">${day}</div>`;
    if (dayHolidays.length > 0) {
      html += `<div class="hl-cal-name">${escHtml(dayHolidays[0].nama)}</div>`;
    }
    html += '</div>';
  }

  html += '</div>';

  // Legend
  html += `<div style="margin-top:16px;display:flex;gap:16px;flex-wrap:wrap;align-items:center">
    <span class="text-xs"><span style="display:inline-block;width:14px;height:14px;background:#ffebee;border:1.5px solid #ef5350;border-radius:3px;vertical-align:middle"></span> Hari Libur</span>
    <span class="text-xs"><span style="display:inline-block;width:14px;height:14px;background:#fff3e0;border:1.5px solid #ff9800;border-radius:3px;vertical-align:middle"></span> Cuti Bersama</span>
    <span class="text-xs"><span style="display:inline-block;width:14px;height:14px;background:#f5f5f5;border:1.5px solid #ddd;border-radius:3px;vertical-align:middle"></span> Weekend</span>
    <span class="text-xs"><span style="display:inline-block;width:14px;height:14px;background:#fff;border:2px solid #1565c0;border-radius:3px;vertical-align:middle"></span> Hari Ini</span>
  </div>`;

  container.innerHTML = html;
}

function renderHariLiburList(container, year, month, holidays) {
  let html = '<div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Nama</th><th>Tipe</th><th>Aksi</th></tr></thead><tbody>';
  if (!holidays.length) {
    html += '<tr><td colspan="4" class="text-center">Tidak ada hari libur bulan ini</td></tr>';
  } else {
    holidays.forEach(h => {
      const tipeBadge = h.tipe === 'nasional' ? 'badge-danger' : h.tipe === 'cuti_bersama' ? 'badge-warning' : 'badge-info';
      const tipeLabel = h.tipe === 'nasional' ? 'Nasional' : h.tipe === 'cuti_bersama' ? 'Cuti Bersama' : 'Perusahaan';
      html += `<tr>
        <td>${formatDate(h.tanggal)}</td>
        <td class="fw-700">${escHtml(h.nama)}</td>
        <td><span class="badge ${tipeBadge}">${tipeLabel}</span></td>
        <td><button class="btn btn-xs btn-danger" onclick="hapusHariLibur('${h.id}')">🗑️</button></td>
      </tr>`;
    });
  }
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

async function hapusHariLibur(id) {
  if (!confirm('Hapus hari libur ini?')) return;
  await db.collection('hrd_hari_libur').doc(id).delete();
  toast('Dihapus', 'success');
  loadHariLiburView();
}

function modalHariLibur() {
  openModal(`<div class="modal-title">+ Tambah Hari Libur Custom</div>
    <div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="hlTgl"></div>
    <div class="form-group"><label>Nama Hari Libur</label><input class="form-control" id="hlNama" placeholder="Contoh: HUT Perusahaan"></div>
    <div class="form-group"><label>Tipe</label><select class="form-control" id="hlTipe">
      <option value="perusahaan">Perusahaan</option>
      <option value="nasional">Nasional</option>
      <option value="cuti_bersama">Cuti Bersama</option>
    </select></div>
    <button class="btn btn-primary" onclick="simpanHariLibur()">Simpan</button>`);
}

async function simpanHariLibur() {
  const tanggal = document.getElementById('hlTgl').value;
  const nama = document.getElementById('hlNama').value;
  const tipe = document.getElementById('hlTipe').value;
  if (!tanggal || !nama) return toast('Lengkapi data', 'warning');
  const tahun = parseInt(tanggal.split('-')[0]);
  await db.collection('hrd_hari_libur').add({
    tanggal, nama, tipe, tahun, createdAt: new Date().toISOString()
  });
  closeModalDirect();
  toast('Hari libur ditambahkan', 'success');
  loadHariLiburView();
}

async function syncHariLiburNasional() {
  const year = hariLiburCalendarMonth.year;
  let dataToSync = [];
  if (year === 2025) dataToSync = HARI_LIBUR_NASIONAL_2025;
  else if (year === 2026) dataToSync = HARI_LIBUR_NASIONAL_2026;
  else { toast(`Data hari libur nasional tahun ${year} belum tersedia. Tersedia: 2025, 2026`, 'warning'); return; }

  if (!confirm(`Sinkronisasi ${dataToSync.length} hari libur nasional tahun ${year}? Data yang sudah ada (nasional/cuti_bersama) akan diperbarui.`)) return;

  toast('Memproses sinkronisasi...', 'info');

  // Delete existing national holidays for this year
  const existingSnap = await db.collection('hrd_hari_libur').where('tahun','==',year).where('tipe','in',['nasional','cuti_bersama']).get();
  const batch1 = [];
  existingSnap.forEach(d => batch1.push(d.ref.delete()));
  await Promise.all(batch1);

  // Add all national holidays
  const batch2 = [];
  dataToSync.forEach(h => {
    batch2.push(db.collection('hrd_hari_libur').add({
      tanggal: h.tanggal,
      nama: h.nama,
      tipe: h.tipe,
      tahun: year,
      createdAt: new Date().toISOString()
    }));
  });
  await Promise.all(batch2);

  toast(`${dataToSync.length} hari libur nasional ${year} berhasil disinkronkan`, 'success');
  loadHariLiburView();
}

// Auto-load national holidays on first render if collection is empty for current year
async function autoLoadHariLiburNasional() {
  const year = new Date().getFullYear();
  let dataToSync = [];
  if (year === 2025) dataToSync = HARI_LIBUR_NASIONAL_2025;
  else if (year === 2026) dataToSync = HARI_LIBUR_NASIONAL_2026;
  else return;

  const existingSnap = await db.collection('hrd_hari_libur').where('tahun','==',year).where('tipe','in',['nasional','cuti_bersama']).limit(1).get();
  if (!existingSnap.empty) return; // Already populated

  const batch = [];
  dataToSync.forEach(h => {
    batch.push(db.collection('hrd_hari_libur').add({
      tanggal: h.tanggal,
      nama: h.nama,
      tipe: h.tipe,
      tahun: year,
      createdAt: new Date().toISOString()
    }));
  });
  await Promise.all(batch);
}

// Check if a given date is a holiday - returns holiday info or null
async function checkHoliday(dateStr) {
  const snap = await db.collection('hrd_hari_libur').where('tanggal','==',dateStr).limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].data();
}

// ── PENALTY ───────────────────────────────────────────────────
async function renderPenalty(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>⚠️ Penalty Point</span><button class="btn btn-primary btn-sm" onclick="modalPenalty()">+ Tambah</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Tanggal</th><th>Jenis</th><th>Poin</th><th>Aksi</th></tr></thead><tbody id="tblPenalty"></tbody></table></div></div>`;const snap=await db.collection('hrd_penalty').get();let h='';if(snap.empty)h='<tr><td colspan="5" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${formatDate(p.tanggal)}</td><td>${escHtml(p.jenis)}</td><td><span class="badge badge-danger">${p.poin}</span></td><td><button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_penalty','${d.id}','penalty')">🗑️</button></td></tr>`;});document.getElementById('tblPenalty').innerHTML=h;}
function modalPenalty(){openModal(`<div class="modal-title">Tambah Penalty</div><div class="grid-2"><div class="form-group"><label>Karyawan</label><input class="form-control" id="penNama"></div><div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="penTgl" value="${todayStr()}"></div></div><div class="grid-2"><div class="form-group"><label>Jenis</label><select class="form-control" id="penJenis"><option>Terlambat</option><option>Mangkir</option><option>SP I</option><option>SP II</option><option>SP III</option></select></div><div class="form-group"><label>Poin</label><input class="form-control" type="number" id="penPoin" value="1"></div></div><button class="btn btn-primary" onclick="simpanPenalty()">Simpan</button>`);}
async function simpanPenalty(){const data={nama:document.getElementById('penNama').value,tanggal:document.getElementById('penTgl').value,jenis:document.getElementById('penJenis').value,poin:parseInt(document.getElementById('penPoin').value)||1,createdAt:new Date().toISOString()};if(!data.nama)return toast('Nama wajib','warning');await db.collection('hrd_penalty').add(data);closeModalDirect();toast('Ditambahkan','success');renderPenalty();}

// ── PENGGAJIAN ────────────────────────────────────────────────
async function renderPenggajian(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>💰 Penggajian</span><div class="flex gap-8"><button class="btn btn-primary btn-sm" onclick="modalGaji()">+ Generate Slip</button><button class="btn btn-success btn-sm" onclick="generateAllGaji()">⚡ Generate Semua</button><button class="btn btn-secondary btn-sm" onclick="modalImportPenggajian()">⬇️ Import</button></div></div><div class="card"><div class="flex gap-8 mb-16 flex-wrap"><input class="form-control" type="month" id="filterBulanGaji" value="${monthStr()}" onchange="loadGaji()" style="max-width:160px"><input class="form-control" placeholder="🔍 Cari nama..." id="filterNamaGaji" oninput="filterGajiTable()" style="max-width:180px"><select class="form-control" id="filterDeptGaji" onchange="filterGajiTable()" style="max-width:160px"><option value="">Semua Dept</option></select><select class="form-control" id="filterGajiRange" onchange="filterGajiTable()" style="max-width:160px"><option value="">Semua Gaji</option><option value="0-3000000">&lt; 3 Juta</option><option value="3000000-5000000">3-5 Juta</option><option value="5000000-10000000">5-10 Juta</option><option value="10000000-99999999">&gt; 10 Juta</option></select><button class="btn btn-sm btn-info" onclick="loadGaji()">🔍</button></div><div id="gajiSummary" class="stats-grid mb-16"></div><div class="flex gap-8 mb-8"><label style="font-size:.78rem;display:flex;align-items:center;gap:4px"><input type="checkbox" id="selectAllGaji" onchange="toggleSelectAllGaji()"> Pilih Semua</label><button class="btn btn-xs btn-danger" onclick="hapusSelectedGaji()">🗑️ Hapus Terpilih</button><button class="btn btn-xs btn-danger" onclick="hapusSemuaGaji()">🗑️ Hapus Semua</button></div><div class="table-wrap"><table><thead><tr><th style="width:30px"><input type="checkbox" id="selectAllGajiHead" onchange="toggleSelectAllGaji()"></th><th>Karyawan</th><th>Gaji Pokok</th><th>Tunjangan</th><th>Insentif</th><th>Reimburse</th><th>Potongan</th><th>Loan</th><th>PPH21</th><th>THP</th><th>Aksi</th></tr></thead><tbody id="tblGaji"></tbody></table></div></div>`;loadGaji();}
async function loadGaji(){const bulan=document.getElementById('filterBulanGaji')?.value||monthStr();const snap=await db.collection('hrd_penggajian').where('periode','==',bulan).get();window._gajiData=[];snap.forEach(d=>window._gajiData.push({id:d.id,...d.data()}));
  // Populate dept filter from karyawan data
  const kSnap=await db.collection('hrd_karyawan').get();const depts=new Set();const karyDeptMap={};kSnap.forEach(d=>{const k=d.data();depts.add(k.departemen||'');karyDeptMap[(k.nama||'').toLowerCase()]=k.departemen||'';});
  window._gajiData.forEach(g=>{g._dept=karyDeptMap[(g.nama||'').toLowerCase()]||'';});
  const sel=document.getElementById('filterDeptGaji');if(sel){let opts='<option value="">Semua Dept</option>';depts.forEach(d=>{if(d)opts+=`<option>${escHtml(d)}</option>`;});sel.innerHTML=opts;}
  filterGajiTable();}

function filterGajiTable(){
  const q=(document.getElementById('filterNamaGaji')?.value||'').toLowerCase();
  const dept=document.getElementById('filterDeptGaji')?.value||'';
  const range=document.getElementById('filterGajiRange')?.value||'';
  let filtered=(window._gajiData||[]).filter(p=>{
    if(q&&!(p.nama||'').toLowerCase().includes(q))return false;
    if(dept&&p._dept!==dept)return false;
    if(range){const[min,max]=range.split('-').map(Number);const gaji=p.gajiPokok||0;if(gaji<min||gaji>=max)return false;}
    return true;
  });
  let h='',totBruto=0,totNet=0,totPPH=0,count=0;
  if(!filtered.length)h='<tr><td colspan="11" class="text-center">Tidak ada data</td></tr>';
  else filtered.forEach(p=>{totBruto+=p.gajiPokok||0;totNet+=p.totalBersih||0;totPPH+=p.pph21||0;count++;h+=`<tr><td><input type="checkbox" class="gaji-cb" value="${p.id}"></td><td class="fw-700">${escHtml(p.nama)}</td><td>${formatCurrency(p.gajiPokok)}</td><td>${formatCurrency(p.tunjangan)}</td><td>${formatCurrency(p.insentif||0)}</td><td>${formatCurrency(p.reimbursement||0)}</td><td>${formatCurrency(p.potongan)}</td><td>${formatCurrency(p.kasbon||0)}</td><td>${formatCurrency(p.pph21)}</td><td class="fw-700">${formatCurrency(p.totalBersih)}</td><td><button class="btn btn-xs btn-info" onclick="lihatSlip('${p.id}')">📄</button> <button class="btn btn-xs btn-warning" onclick="editGaji('${p.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_penggajian','${p.id}','penggajian')">🗑️</button></td></tr>`;});
  document.getElementById('tblGaji').innerHTML=h;
  document.getElementById('gajiSummary').innerHTML=`<div class="stat-card"><div class="stat-value">${count}</div><div class="stat-label">Karyawan</div></div><div class="stat-card"><div class="stat-value">${formatCurrency(totBruto)}</div><div class="stat-label">Total Gaji Pokok</div></div><div class="stat-card"><div class="stat-value">${formatCurrency(totNet)}</div><div class="stat-label">Total THP</div></div><div class="stat-card"><div class="stat-value">${formatCurrency(totPPH)}</div><div class="stat-label">Total PPH21</div></div>`;
}

function toggleSelectAllGaji(){const checked=document.getElementById('selectAllGaji')?.checked||document.getElementById('selectAllGajiHead')?.checked;document.querySelectorAll('.gaji-cb').forEach(cb=>cb.checked=checked);document.getElementById('selectAllGaji').checked=checked;document.getElementById('selectAllGajiHead').checked=checked;}

async function hapusSelectedGaji(){const ids=[];document.querySelectorAll('.gaji-cb:checked').forEach(cb=>ids.push(cb.value));if(!ids.length)return toast('Pilih slip yang ingin dihapus','warning');if(!confirm(`Hapus ${ids.length} slip gaji terpilih?`))return;for(const id of ids){await db.collection('hrd_penggajian').doc(id).delete();}toast(`${ids.length} slip dihapus`,'success');loadGaji();}

async function hapusSemuaGaji(){if(!confirm('⚠️ HAPUS SEMUA slip gaji periode ini?'))return;if(!confirm('Konfirmasi: Yakin hapus SEMUA?'))return;const bulan=document.getElementById('filterBulanGaji')?.value||monthStr();const snap=await db.collection('hrd_penggajian').where('periode','==',bulan).get();const batch=db.batch();snap.forEach(d=>batch.delete(d.ref));await batch.commit();toast(`${snap.size} slip dihapus`,'success');loadGaji();}

async function generateAllGaji(){
  if(!confirm('Generate slip gaji untuk SEMUA karyawan aktif periode ini?\n\nAkan otomatis menghitung:\n• Gaji Pokok\n• Tunjangan (dari data tunjangan)\n• Insentif (dari KPI)\n• Reimbursement (yang approved)\n• BPJS Kes & TK\n• Kasbon/Loan\n• PPH21 Progresif'))return;
  const bulan=document.getElementById('filterBulanGaji')?.value||monthStr();
  const kSnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  const existSnap=await db.collection('hrd_penggajian').where('periode','==',bulan).get();
  const existing=new Set();existSnap.forEach(d=>existing.add(d.data().nama?.toLowerCase()));
  // Load all related data
  const reimbSnap=await db.collection('hrd_reimbursement').where('status','==','approved').get();
  const kasbonSnap=await db.collection('hrd_kasbon').get();
  const tunjSnap=await db.collection('hrd_tunjangan').get();
  const kpiSnap=await db.collection('hrd_kpi').get();
  // Build maps
  const reimbMap={},kasbonMap={},kpiMap={};
  reimbSnap.forEach(d=>{const r=d.data();const n=(r.nama||'').toLowerCase();reimbMap[n]=(reimbMap[n]||0)+(r.jumlah||0);});
  kasbonSnap.forEach(d=>{const r=d.data();if(r.status==='aktif'||r.status==='approved'){const n=(r.nama||'').toLowerCase();kasbonMap[n]=(kasbonMap[n]||0)+(r.angsuran||r.jumlah||0);}});
  kpiSnap.forEach(d=>{const r=d.data();const n=(r.nama||'').toLowerCase();if(!kpiMap[n]||r.skor>kpiMap[n])kpiMap[n]=r.skor||0;});
  // Tunjangan (apply to all or specific)
  const tunjList=[];tunjSnap.forEach(d=>tunjList.push(d.data()));
  let count=0;
  for(const doc of kSnap.docs){
    const k=doc.data();const namaLow=k.nama?.toLowerCase();if(existing.has(namaLow))continue;
    const gaji=k.gajiPokok||0;
    // Tunjangan
    let tunj=0;tunjList.forEach(t=>{const p=(t.penerima||'Semua').toLowerCase();if(p==='semua'||p.includes(namaLow))tunj+=t.nominal||0;});
    // Insentif from KPI
    const kpiScore=kpiMap[namaLow]||0;let insentifPct=0;
    if(kpiScore>=90)insentifPct=0.15;else if(kpiScore>=80)insentifPct=0.10;else if(kpiScore>=70)insentifPct=0.05;
    const insentif=Math.round(gaji*insentifPct);
    // Reimbursement & Loan
    const reimb=reimbMap[namaLow]||0;const loan=kasbonMap[namaLow]||0;
    // BPJS
    const bpjsKes=Math.round(gaji*0.01);const bpjsTK=Math.round(gaji*0.02);
    // PPH21 Progressive
    const bruto=gaji+tunj+insentif+reimb;const penghasilanNetto=(gaji+tunj-bpjsKes-bpjsTK)*12;
    let pphT=0;if(penghasilanNetto<=60000000)pphT=penghasilanNetto*0.05;else if(penghasilanNetto<=250000000)pphT=3000000+(penghasilanNetto-60000000)*0.15;else pphT=3000000+28500000+(penghasilanNetto-250000000)*0.25;
    const pph21=Math.max(0,Math.round(pphT/12));
    // THP = Bruto - Semua Potongan
    const totalPotongan=bpjsKes+bpjsTK+loan+pph21;
    const thp=bruto-totalPotongan;
    await db.collection('hrd_penggajian').add({nama:k.nama,periode:bulan,gajiPokok:gaji,tunjangan:tunj,insentif,bonus:0,reimbursement:reimb,lembur:0,bpjsKesehatan:bpjsKes,bpjsTK,potongan:0,kasbon:loan,pph21,totalBersih:thp,kpiScore,createdAt:new Date().toISOString()});
    count++;
  }
  toast(`${count} slip gaji di-generate (terintegrasi tunjangan, insentif, reimburse, loan, PPH)`,'success');loadGaji();
}
function modalGaji(){loadKaryawanDropdownGaji();}
async function loadKaryawanDropdownGaji(){
  const kSnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  let opts='<option value="">-- Pilih Karyawan --</option>';
  kSnap.forEach(d=>{const k=d.data();opts+=`<option value="${escHtml(k.nama)}">${escHtml(k.nama)} — ${escHtml(k.departemen||'')} (${escHtml(k.posisi||'')})</option>`;});
  openModal(`<div class="modal-title">Generate Slip Gaji</div><div class="grid-2"><div class="form-group"><label>Karyawan</label><select class="form-control" id="gjNama" onchange="autoFillGajiFromKaryawan()">${opts}</select></div><div class="form-group"><label>Periode</label><input class="form-control" type="month" id="gjPeriode" value="${monthStr()}"></div></div>
    <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:8px"><div class="fw-700 text-sm mb-8 color-primary">💰 Pendapatan</div><div class="grid-2"><div class="form-group"><label>Gaji Pokok</label><input class="form-control" type="number" id="gjPokok" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Tunj. Jabatan</label><input class="form-control" type="number" id="gjTunjJabatan" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Tunj. Transport</label><input class="form-control" type="number" id="gjTunjTransport" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Tunj. Makan</label><input class="form-control" type="number" id="gjTunjMakan" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Tunj. Komunikasi</label><input class="form-control" type="number" id="gjTunjKom" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Lembur</label><input class="form-control" type="number" id="gjLembur" value="0" oninput="hitungGaji()"></div></div></div>
    <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:8px"><div class="fw-700 text-sm mb-8" style="color:#ff6f00">🏆 Insentif & Bonus</div><div class="grid-2"><div class="form-group"><label>Insentif Kinerja (auto KPI)</label><input class="form-control" type="number" id="gjInsentif" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Bonus</label><input class="form-control" type="number" id="gjBonus" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Tunj. Lainnya (auto)</label><input class="form-control" type="number" id="gjTunjLain" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Reimbursement (auto)</label><input class="form-control" type="number" id="gjReimburse" value="0" oninput="hitungGaji()"></div></div></div>
    <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:8px"><div class="fw-700 text-sm mb-8 color-danger">📉 Potongan</div><div class="grid-2"><div class="form-group"><label>BPJS Kesehatan (1%)</label><input class="form-control" type="number" id="gjBPJSKes" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>BPJS TK (2%)</label><input class="form-control" type="number" id="gjBPJSTK" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Kasbon/Loan (auto)</label><input class="form-control" type="number" id="gjKasbon" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Potongan Lain</label><input class="form-control" type="number" id="gjPotongan" value="0" oninput="hitungGaji()"></div></div></div>
    <div style="border-top:2px solid var(--primary);padding-top:12px;margin-top:12px;background:#f8f9ff;padding:12px;border-radius:8px"><div class="grid-2"><div class="form-group"><label>Total Bruto</label><input class="form-control" id="gjBruto" readonly style="font-weight:700;background:#e8f5e9"></div><div class="form-group"><label>Total Potongan</label><input class="form-control" id="gjTotPot" readonly style="color:var(--danger);background:#ffebee"></div><div class="form-group"><label>PPH 21 (auto)</label><input class="form-control" id="gjPPH" readonly style="color:var(--danger);background:#ffebee"></div><div class="form-group"><label>Take Home Pay (THP)</label><input class="form-control" id="gjTotal" readonly style="font-weight:700;font-size:1rem;background:#e8f5e9"></div></div></div>
    <button class="btn btn-primary mt-16" onclick="simpanGaji()">💾 Simpan Slip</button>`,true);
}
function hitungGaji(){const pokok=Number(document.getElementById('gjPokok').value)||0;const tJabatan=Number(document.getElementById('gjTunjJabatan').value)||0;const tTransport=Number(document.getElementById('gjTunjTransport').value)||0;const tMakan=Number(document.getElementById('gjTunjMakan').value)||0;const tKom=Number(document.getElementById('gjTunjKom').value)||0;const lembur=Number(document.getElementById('gjLembur').value)||0;const insentif=Number(document.getElementById('gjInsentif').value)||0;const bonus=Number(document.getElementById('gjBonus').value)||0;const tLain=Number(document.getElementById('gjTunjLain').value)||0;const reimburse=Number(document.getElementById('gjReimburse').value)||0;const bpjsKes=Number(document.getElementById('gjBPJSKes').value)||0;const bpjsTK=Number(document.getElementById('gjBPJSTK').value)||0;const potLain=Number(document.getElementById('gjPotongan').value)||0;const kasbon=Number(document.getElementById('gjKasbon').value)||0;
  const totalTunjangan=tJabatan+tTransport+tMakan+tKom+lembur+tLain;const bruto=pokok+totalTunjangan+insentif+bonus+reimburse;const totalPotongan=bpjsKes+bpjsTK+potLain+kasbon;
  const tahunan=(pokok+totalTunjangan-bpjsKes-bpjsTK)*12;let pphTahunan=0;
  if(tahunan<=60000000)pphTahunan=tahunan*0.05;
  else if(tahunan<=250000000)pphTahunan=60000000*0.05+(tahunan-60000000)*0.15;
  else if(tahunan<=500000000)pphTahunan=60000000*0.05+190000000*0.15+(tahunan-250000000)*0.25;
  else pphTahunan=60000000*0.05+190000000*0.15+250000000*0.25+(tahunan-500000000)*0.30;
  const pph21=Math.max(0,Math.round(pphTahunan/12));const total=bruto-totalPotongan-pph21;
  document.getElementById('gjBruto').value=formatCurrency(bruto);document.getElementById('gjTotPot').value=formatCurrency(totalPotongan);document.getElementById('gjPPH').value=formatCurrency(pph21);document.getElementById('gjTotal').value=formatCurrency(total);
  window._gajiCalc={pph21,total,bruto,totalTunjangan,totalPotongan,insentif,reimburse};}
async function autoFillGajiFromKaryawan(){const nama=(document.getElementById('gjNama').value||'').trim();if(!nama)return;
  // Find karyawan
  let k=null;const snap=await db.collection('hrd_karyawan').where('nama','==',nama).limit(1).get();
  if(!snap.empty){k=snap.docs[0].data();}else{const all=await db.collection('hrd_karyawan').get();all.forEach(d=>{if(d.data().nama?.toLowerCase()===nama.toLowerCase())k=d.data();});if(!k)return toast('Karyawan tidak ditemukan','warning');}
  const gaji=k.gajiPokok||0;document.getElementById('gjPokok').value=gaji;
  document.getElementById('gjBPJSKes').value=Math.round(gaji*0.01);
  document.getElementById('gjBPJSTK').value=Math.round(gaji*0.02);
  // Auto-load tunjangan from hrd_tunjangan
  const tunjSnap=await db.collection('hrd_tunjangan').get();let tunjTotal=0;
  tunjSnap.forEach(d=>{const t=d.data();const penerima=(t.penerima||'Semua').toLowerCase();if(penerima==='semua'||penerima.includes(nama.toLowerCase()))tunjTotal+=t.nominal||0;});
  document.getElementById('gjTunjLain').value=tunjTotal;
  // Auto-load reimbursement (approved)
  const reimbSnap=await db.collection('hrd_reimbursement').where('status','==','approved').get();
  let totalReimb=0;reimbSnap.forEach(d=>{const r=d.data();if((r.nama||'').toLowerCase()===nama.toLowerCase())totalReimb+=r.jumlah||0;});
  document.getElementById('gjReimburse').value=totalReimb;
  // Auto-load kasbon/loan (aktif)
  const kasbonSnap=await db.collection('hrd_kasbon').get();let totalLoan=0;
  kasbonSnap.forEach(d=>{const r=d.data();if((r.nama||'').toLowerCase()===nama.toLowerCase()&&(r.status==='aktif'||r.status==='approved'))totalLoan+=r.angsuran||r.jumlah||0;});
  document.getElementById('gjKasbon').value=totalLoan;
  // Auto-calculate insentif based on KPI score
  const kpiSnap=await db.collection('hrd_kpi').get();let kpiScore=0,kpiFound=false;
  kpiSnap.forEach(d=>{const r=d.data();if((r.nama||'').toLowerCase()===nama.toLowerCase()){kpiScore=r.skor||0;kpiFound=true;}});
  if(kpiFound&&kpiScore>0){
    // Insentif formula: KPI >= 90 = 15% gaji, >= 80 = 10%, >= 70 = 5%, < 70 = 0
    let insentifPct=0;if(kpiScore>=90)insentifPct=0.15;else if(kpiScore>=80)insentifPct=0.10;else if(kpiScore>=70)insentifPct=0.05;
    document.getElementById('gjInsentif').value=Math.round(gaji*insentifPct);
  }
  hitungGaji();toast(`Data dimuat: Gaji ${formatCurrency(gaji)}, Tunj ${formatCurrency(tunjTotal)}, Reimb ${formatCurrency(totalReimb)}, Loan ${formatCurrency(totalLoan)}`,'success');}
async function simpanGaji(){const tJab=Number(document.getElementById('gjTunjJabatan').value)||0;const tTrans=Number(document.getElementById('gjTunjTransport').value)||0;const tMakan=Number(document.getElementById('gjTunjMakan').value)||0;const tKom=Number(document.getElementById('gjTunjKom').value)||0;const lembur=Number(document.getElementById('gjLembur').value)||0;const insentif=Number(document.getElementById('gjInsentif').value)||0;const bonus=Number(document.getElementById('gjBonus').value)||0;const tLain=Number(document.getElementById('gjTunjLain').value)||0;const reimburse=Number(document.getElementById('gjReimburse').value)||0;const nama=document.getElementById('gjNama').value;const data={nama,periode:document.getElementById('gjPeriode').value,gajiPokok:Number(document.getElementById('gjPokok').value)||0,tunjangan:tJab+tTrans+tMakan+tKom+lembur+tLain,tunjJabatan:tJab,tunjTransport:tTrans,tunjMakan:tMakan,tunjKomunikasi:tKom,lembur,insentif,bonus,tunjLain:tLain,reimbursement:reimburse,bpjsKesehatan:Number(document.getElementById('gjBPJSKes').value)||0,bpjsTK:Number(document.getElementById('gjBPJSTK').value)||0,potongan:Number(document.getElementById('gjPotongan').value)||0,kasbon:Number(document.getElementById('gjKasbon').value)||0,pph21:window._gajiCalc?.pph21||0,totalBersih:window._gajiCalc?.total||0,createdAt:new Date().toISOString()};if(!nama)return toast('Pilih karyawan dulu','warning');await db.collection('hrd_penggajian').add(data);closeModalDirect();toast('Slip disimpan','success');renderPenggajian();}
function modalImportPenggajian(){openModal(`<div class="modal-title">📥 Import Data Penggajian</div>
    <div class="tabs mb-16"><div class="tab active" onclick="switchImportTab('gaji','file')">📄 Upload CSV</div><div class="tab" onclick="switchImportTab('gaji','api')">🔗 API Google Sheets</div></div>
    <div id="importGajiTab">
      <p class="text-sm mb-8" style="color:#666">Upload file CSV. Header: Nama, Periode, Gaji Pokok, Tunjangan, Potongan, PPH21, Total Bersih.</p>
      <div class="form-group"><label>File CSV</label><input class="form-control" type="file" accept=".csv" id="importGajiFile"></div>
      <div class="flex gap-8 mb-16"><button class="btn btn-primary" onclick="processImportPenggajian()">📥 Proses Import</button><button class="btn btn-outline btn-sm" onclick="downloadPenggajianTemplate()">📄 Download Template</button></div>
      <div class="text-xs" style="color:#666">Template CSV akan membantu memastikan header sesuai dengan format sheet.</div>
    </div>`,true);}

async function processImportPenggajianFromText(text){
  const rows=parseCsvRows(text);if(rows.length<2)return toast('Data kosong','warning');
  const headers=rows[0].map(h=>normalizeHeader(h));const map={};
  headers.forEach((h,i)=>{if(['nama','name','nama karyawan','employee name'].includes(h))map.nama=i;else if(['periode','period','bulan','month','periode gaji'].includes(h))map.periode=i;else if(['gaji pokok','salary','basic salary','gaji','upah pokok'].includes(h))map.gajiPokok=i;else if(['tunjangan','allowance','tunjangan total','total tunjangan'].includes(h))map.tunjangan=i;else if(['potongan','deduction','deductions','total potongan'].includes(h))map.potongan=i;else if(['pph21','pph','pph 21','pajak'].includes(h))map.pph21=i;else if(['total bersih','total','net total','net salary','take home pay','thp','gaji bersih'].includes(h))map.totalBersih=i;else if(['lembur','overtime','uang lembur'].includes(h))map.lembur=i;else if(['bonus'].includes(h))map.bonus=i;});
  if(map.nama===undefined)return toast('Header harus berisi kolom "Nama"','warning');
  let added=0,updated=0;
  for(let i=1;i<rows.length;i++){const row=rows[i];const nama=(row[map.nama]||'').trim();if(!nama)continue;
    const periode=(map.periode!==undefined?(row[map.periode]||'').trim():monthStr());
    if(!periode)continue;
    const gajiPokok=Number(String(map.gajiPokok!==undefined?row[map.gajiPokok]:'').replace(/[^0-9.-]/g,''))||0;
    const tunjangan=Number(String(map.tunjangan!==undefined?row[map.tunjangan]:'').replace(/[^0-9.-]/g,''))||0;
    const lembur=Number(String(map.lembur!==undefined?row[map.lembur]:'').replace(/[^0-9.-]/g,''))||0;
    const bonus=Number(String(map.bonus!==undefined?row[map.bonus]:'').replace(/[^0-9.-]/g,''))||0;
    const potongan=Number(String(map.potongan!==undefined?row[map.potongan]:'').replace(/[^0-9.-]/g,''))||0;
    const pph21=Number(String(map.pph21!==undefined?row[map.pph21]:'').replace(/[^0-9.-]/g,''))||0;
    let totalBersih=Number(String(map.totalBersih!==undefined?row[map.totalBersih]:'').replace(/[^0-9.-]/g,''))||0;
    if(!totalBersih)totalBersih=gajiPokok+tunjangan+lembur+bonus-potongan-pph21;
    const payload={nama,periode,gajiPokok,tunjangan:tunjangan+lembur+bonus,potongan,pph21,totalBersih,updatedAt:new Date().toISOString()};
    const snap=await db.collection('hrd_penggajian').where('nama','==',nama).where('periode','==',periode).limit(1).get();
    if(!snap.empty){await db.collection('hrd_penggajian').doc(snap.docs[0].id).update(payload);updated++;}
    else{await db.collection('hrd_penggajian').add({...payload,createdAt:new Date().toISOString()});added++;}
  }
  closeModalDirect();toast(`✅ Import selesai: ${added} baru, ${updated} terupdate`,'success');renderPenggajian();
}

async function processImportPenggajian(){const file=document.getElementById('importGajiFile')?.files?.[0];if(!file)return toast('Pilih file CSV','warning');const text=await file.text();await processImportPenggajianFromText(text);}
function lihatSlip(id){db.collection('hrd_penggajian').doc(id).get().then(d=>{const p=d.data();const bruto=(p.gajiPokok||0)+(p.tunjangan||0)+(p.insentif||0)+(p.bonus||0)+(p.reimbursement||0);const totPot=(p.bpjsKesehatan||0)+(p.bpjsTK||0)+(p.potongan||0)+(p.kasbon||0);openModal(`<div class="modal-title">📄 Slip Gaji — ${escHtml(p.nama)}</div><div style="text-align:center;padding:12px;border:2px solid var(--primary);border-radius:8px;margin-bottom:16px"><div class="fw-700 color-primary" style="font-size:1.1rem">LPK IJEF CORP</div><div class="text-xs">Slip Gaji Periode: ${p.periode}</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    <div><div class="fw-700 text-sm color-primary mb-8">💰 Pendapatan</div><table style="width:100%;font-size:.82rem"><tr><td>Gaji Pokok</td><td style="text-align:right">${formatCurrency(p.gajiPokok)}</td></tr>${p.tunjJabatan?`<tr><td>Tunj. Jabatan</td><td style="text-align:right">${formatCurrency(p.tunjJabatan)}</td></tr>`:''}${p.tunjTransport?`<tr><td>Tunj. Transport</td><td style="text-align:right">${formatCurrency(p.tunjTransport)}</td></tr>`:''}${p.tunjMakan?`<tr><td>Tunj. Makan</td><td style="text-align:right">${formatCurrency(p.tunjMakan)}</td></tr>`:''}${p.tunjKomunikasi?`<tr><td>Tunj. Komunikasi</td><td style="text-align:right">${formatCurrency(p.tunjKomunikasi)}</td></tr>`:''}${p.lembur?`<tr><td>Lembur</td><td style="text-align:right">${formatCurrency(p.lembur)}</td></tr>`:''}${p.insentif?`<tr><td>Insentif Kinerja</td><td style="text-align:right">${formatCurrency(p.insentif)}</td></tr>`:''}${p.bonus?`<tr><td>Bonus</td><td style="text-align:right">${formatCurrency(p.bonus)}</td></tr>`:''}${p.reimbursement?`<tr><td>Reimbursement</td><td style="text-align:right">${formatCurrency(p.reimbursement)}</td></tr>`:''}${p.tunjLain?`<tr><td>Tunjangan Lain</td><td style="text-align:right">${formatCurrency(p.tunjLain)}</td></tr>`:''}<tr style="border-top:2px solid var(--primary);font-weight:700"><td>Total Bruto</td><td style="text-align:right">${formatCurrency(bruto)}</td></tr></table></div>
    <div><div class="fw-700 text-sm color-danger mb-8">📉 Potongan</div><table style="width:100%;font-size:.82rem">${p.bpjsKesehatan?`<tr><td>BPJS Kesehatan</td><td style="text-align:right;color:var(--danger)">-${formatCurrency(p.bpjsKesehatan)}</td></tr>`:''}${p.bpjsTK?`<tr><td>BPJS TK</td><td style="text-align:right;color:var(--danger)">-${formatCurrency(p.bpjsTK)}</td></tr>`:''}${p.kasbon?`<tr><td>Kasbon/Loan</td><td style="text-align:right;color:var(--danger)">-${formatCurrency(p.kasbon)}</td></tr>`:''}${p.potongan?`<tr><td>Potongan Lain</td><td style="text-align:right;color:var(--danger)">-${formatCurrency(p.potongan)}</td></tr>`:''}<tr><td>PPH 21</td><td style="text-align:right;color:var(--danger)">-${formatCurrency(p.pph21)}</td></tr><tr style="border-top:2px solid var(--danger);font-weight:700"><td>Total Potongan</td><td style="text-align:right;color:var(--danger)">-${formatCurrency(totPot+(p.pph21||0))}</td></tr></table></div></div>
    <div style="background:var(--primary);color:#fff;padding:16px;border-radius:8px;text-align:center"><div style="font-size:.8rem;opacity:.8">TAKE HOME PAY</div><div style="font-size:1.5rem;font-weight:700">${formatCurrency(p.totalBersih)}</div></div>
    <div class="mt-16 text-center"><button class="btn btn-outline btn-sm" onclick="window.print()">🖨️ Cetak</button></div>`);});}

function editGaji(id){db.collection('hrd_penggajian').doc(id).get().then(d=>{const p=d.data();openModal(`<div class="modal-title">✏️ Edit Slip Gaji — ${escHtml(p.nama)}</div><div class="grid-2"><div class="form-group"><label>Karyawan</label><input class="form-control" id="egNama" value="${escHtml(p.nama||'')}"></div><div class="form-group"><label>Periode</label><input class="form-control" type="month" id="egPeriode" value="${p.periode||''}"></div></div><div class="grid-2"><div class="form-group"><label>Gaji Pokok</label><input class="form-control" type="number" id="egPokok" value="${p.gajiPokok||0}"></div><div class="form-group"><label>Tunjangan</label><input class="form-control" type="number" id="egTunjangan" value="${p.tunjangan||0}"></div></div><div class="grid-2"><div class="form-group"><label>Potongan</label><input class="form-control" type="number" id="egPotongan" value="${p.potongan||0}"></div><div class="form-group"><label>PPH21</label><input class="form-control" type="number" id="egPPH" value="${p.pph21||0}"></div></div><div class="form-group"><label>Total Bersih</label><input class="form-control" type="number" id="egTotal" value="${p.totalBersih||0}"></div><div class="flex gap-8 mt-16"><button class="btn btn-primary" onclick="updateGaji('${id}')">💾 Simpan</button><button class="btn btn-danger" onclick="hapusDoc('hrd_penggajian','${id}','penggajian')">🗑️ Hapus</button></div>`,true);});}
async function updateGaji(id){const data={nama:document.getElementById('egNama').value,periode:document.getElementById('egPeriode').value,gajiPokok:Number(document.getElementById('egPokok').value)||0,tunjangan:Number(document.getElementById('egTunjangan').value)||0,potongan:Number(document.getElementById('egPotongan').value)||0,pph21:Number(document.getElementById('egPPH').value)||0,totalBersih:Number(document.getElementById('egTotal').value)||0,updatedAt:new Date().toISOString()};await db.collection('hrd_penggajian').doc(id).update(data);closeModalDirect();toast('Slip gaji diupdate','success');renderPenggajian();}

// ── REIMBURSEMENT ─────────────────────────────────────────────
async function renderReimbursement(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>🧾 Reimbursement</span><button class="btn btn-primary btn-sm" onclick="modalReimburse()">+ Pengajuan</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Kategori</th><th>Jumlah</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblReimb"></tbody></table></div></div>`;const snap=await db.collection('hrd_reimbursement').get();let h='';if(snap.empty)h='<tr><td colspan="5" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();const badge=p.status==='approved'?'badge-success':p.status==='rejected'?'badge-danger':'badge-warning';h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.kategori)}</td><td>${formatCurrency(p.jumlah)}</td><td><span class="badge ${badge}">${p.status}</span></td><td>${p.status==='pending'&&hasAccess(3)?`<button class="btn btn-xs btn-success" onclick="approveReimb('${d.id}','approved')">✅</button> <button class="btn btn-xs btn-danger" onclick="approveReimb('${d.id}','rejected')">❌</button>`:''} <button class="btn btn-xs btn-warning" onclick="editReimb('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_reimbursement','${d.id}','reimbursement')">🗑️</button></td></tr>`;});document.getElementById('tblReimb').innerHTML=h;}
function modalReimburse(){openModal(`<div class="modal-title">Pengajuan Reimbursement</div><div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="rbNama" value="${currentUser.nama}"></div><div class="form-group"><label>Kategori</label><select class="form-control" id="rbKat"><option>Transport</option><option>Makan</option><option>Kesehatan</option><option>Operasional</option></select></div></div><div class="form-group"><label>Jumlah (Rp)</label><input class="form-control" type="number" id="rbJumlah"></div><div class="form-group"><label>Keterangan</label><textarea class="form-control" id="rbKet"></textarea></div><button class="btn btn-primary" onclick="simpanReimburse()">Ajukan</button>`);}
async function simpanReimburse(){const data={nama:document.getElementById('rbNama').value,kategori:document.getElementById('rbKat').value,jumlah:Number(document.getElementById('rbJumlah').value)||0,keterangan:document.getElementById('rbKet').value,status:'pending',userId:currentUser.id,createdAt:new Date().toISOString()};if(!data.jumlah)return toast('Jumlah wajib','warning');await db.collection('hrd_reimbursement').add(data);closeModalDirect();toast('Diajukan','success');renderReimbursement();}
async function approveReimb(id,status){await db.collection('hrd_reimbursement').doc(id).update({status,approvedBy:currentUser.nama});toast('Updated','success');renderReimbursement();}

// ── KASBON & LOAN ─────────────────────────────────────────────
async function renderKasbon(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>💳 Kasbon & Loan</span><button class="btn btn-primary btn-sm" onclick="modalKasbon()">+ Pengajuan</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Jenis</th><th>Jumlah</th><th>Cicilan</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblKasbon"></tbody></table></div></div>`;const snap=await db.collection('hrd_kasbon').get();let h='';if(snap.empty)h='<tr><td colspan="6" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();const badge=p.status==='approved'?'badge-success':p.status==='rejected'?'badge-danger':'badge-warning';h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.jenis)}</td><td>${formatCurrency(p.jumlah)}</td><td>${p.cicilan||1}x</td><td><span class="badge ${badge}">${p.status}</span></td><td>${p.status==='pending'&&hasAccess(3)?`<button class="btn btn-xs btn-success" onclick="approveKasbon('${d.id}','approved')">✅</button> <button class="btn btn-xs btn-danger" onclick="approveKasbon('${d.id}','rejected')">❌</button>`:''} <button class="btn btn-xs btn-warning" onclick="editKasbonDoc('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_kasbon','${d.id}','kasbon')">🗑️</button></td></tr>`;});document.getElementById('tblKasbon').innerHTML=h;}
function modalKasbon(){openModal(`<div class="modal-title">Pengajuan Kasbon/Loan</div><div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="kbNama" value="${currentUser.nama}"></div><div class="form-group"><label>Jenis</label><select class="form-control" id="kbJenis"><option>Kasbon</option><option>Pinjaman Karyawan</option></select></div></div><div class="grid-2"><div class="form-group"><label>Jumlah</label><input class="form-control" type="number" id="kbJumlah"></div><div class="form-group"><label>Cicilan (bln)</label><input class="form-control" type="number" id="kbCicilan" value="1"></div></div><button class="btn btn-primary" onclick="simpanKasbon()">Ajukan</button>`);}
async function simpanKasbon(){const data={nama:document.getElementById('kbNama').value,jenis:document.getElementById('kbJenis').value,jumlah:Number(document.getElementById('kbJumlah').value)||0,cicilan:Number(document.getElementById('kbCicilan').value)||1,status:'pending',userId:currentUser.id,createdAt:new Date().toISOString()};if(!data.jumlah)return toast('Jumlah wajib','warning');await db.collection('hrd_kasbon').add(data);closeModalDirect();toast('Diajukan','success');renderKasbon();}
async function approveKasbon(id,status){await db.collection('hrd_kasbon').doc(id).update({status,approvedBy:currentUser.nama});toast('Updated','success');renderKasbon();}

// ── TUNJANGAN ─────────────────────────────────────────────────
async function renderTunjangan(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>🎁 Tunjangan & Benefit</span><button class="btn btn-primary btn-sm" onclick="modalTunjangan()">+ Tambah</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Jenis</th><th>Nominal</th><th>Penerima</th><th>Aksi</th></tr></thead><tbody id="tblTunj"></tbody></table></div></div>`;const snap=await db.collection('hrd_tunjangan').get();let h='';if(snap.empty)h='<tr><td colspan="5" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.jenis||'-')}</td><td>${formatCurrency(p.nominal)}</td><td>${escHtml(p.penerima||'Semua')}</td><td><button class="btn btn-xs btn-info" onclick="modalTunjangan('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_tunjangan','${d.id}','tunjangan')">🗑️</button></td></tr>`;});document.getElementById('tblTunj').innerHTML=h;}
function modalTunjangan(id){if(id)db.collection('hrd_tunjangan').doc(id).get().then(d=>showTunjForm(id,d.data()||{}));else showTunjForm(null,{});}
function showTunjForm(id,p){openModal(`<div class="modal-title">${id?'Edit':'Tambah'} Tunjangan</div><div class="form-group"><label>Nama</label><input class="form-control" id="tjNama" value="${escHtml(p.nama||'')}"></div><div class="grid-2"><div class="form-group"><label>Jenis</label><select class="form-control" id="tjJenis"><option value="tetap" ${p.jenis==='tetap'?'selected':''}>Tetap</option><option value="tidak_tetap" ${p.jenis==='tidak_tetap'?'selected':''}>Tidak Tetap</option></select></div><div class="form-group"><label>Nominal</label><input class="form-control" type="number" id="tjNominal" value="${p.nominal||0}"></div></div><div class="form-group"><label>Penerima</label><input class="form-control" id="tjPenerima" value="${escHtml(p.penerima||'Semua')}"></div><button class="btn btn-primary" onclick="simpanTunjangan('${id||''}')">Simpan</button>`);}
async function simpanTunjangan(id){const data={nama:document.getElementById('tjNama').value,jenis:document.getElementById('tjJenis').value,nominal:Number(document.getElementById('tjNominal').value)||0,penerima:document.getElementById('tjPenerima').value,updatedAt:new Date().toISOString()};if(!data.nama)return toast('Nama wajib','warning');if(id)await db.collection('hrd_tunjangan').doc(id).update(data);else await db.collection('hrd_tunjangan').add({...data,createdAt:new Date().toISOString()});closeModalDirect();toast('Disimpan','success');renderTunjangan();}

// ── KPI ───────────────────────────────────────────────────────
async function renderKPI(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>📈 KPI & Penilaian</span><button class="btn btn-primary btn-sm" onclick="modalKPI()">+ Tambah</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Periode</th><th>Skor</th><th>Grade</th><th>Penilai</th></tr></thead><tbody id="tblKPI"></tbody></table></div></div>`;const snap=await db.collection('hrd_kpi').get();let h='';if(snap.empty)h='<tr><td colspan="5" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();const grade=p.skor>=90?'A':p.skor>=80?'B':p.skor>=70?'C':p.skor>=60?'D':'E';h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.periode)}</td><td><span class="badge badge-${p.skor>=80?'success':p.skor>=60?'warning':'danger'}">${p.skor}/100</span></td><td class="fw-700">${grade}</td><td>${escHtml(p.penilai||'-')}</td></tr>`;});document.getElementById('tblKPI').innerHTML=h;}
function modalKPI(){openModal(`<div class="modal-title">Tambah Penilaian KPI</div><div class="grid-2"><div class="form-group"><label>Karyawan</label><input class="form-control" id="kpiNama"></div><div class="form-group"><label>Periode</label><input class="form-control" id="kpiPeriode" value="${monthStr()}"></div></div><div class="grid-2"><div class="form-group"><label>Produktivitas (0-100)</label><input class="form-control" type="number" id="kpiProd" value="80"></div><div class="form-group"><label>Kualitas (0-100)</label><input class="form-control" type="number" id="kpiQual" value="80"></div></div><div class="grid-2"><div class="form-group"><label>Kedisiplinan (0-100)</label><input class="form-control" type="number" id="kpiDisc" value="80"></div><div class="form-group"><label>Kerjasama (0-100)</label><input class="form-control" type="number" id="kpiTeam" value="80"></div></div><div class="form-group"><label>Catatan</label><textarea class="form-control" id="kpiNote"></textarea></div><button class="btn btn-primary" onclick="simpanKPI()">Simpan</button>`);}
async function simpanKPI(){const prod=Number(document.getElementById('kpiProd').value)||0,qual=Number(document.getElementById('kpiQual').value)||0,disc=Number(document.getElementById('kpiDisc').value)||0,team=Number(document.getElementById('kpiTeam').value)||0;const skor=Math.round((prod+qual+disc+team)/4);await db.collection('hrd_kpi').add({nama:document.getElementById('kpiNama').value,periode:document.getElementById('kpiPeriode').value,produktivitas:prod,kualitas:qual,kedisiplinan:disc,kerjasama:team,skor,catatan:document.getElementById('kpiNote').value,penilai:currentUser.nama,createdAt:new Date().toISOString()});closeModalDirect();toast('KPI disimpan','success');renderKPI();}

// ── PELATIHAN ─────────────────────────────────────────────────
async function renderPelatihan(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>🎓 Pelatihan & Sertifikasi</span><button class="btn btn-primary btn-sm" onclick="modalPelatihan()">+ Tambah</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Judul</th><th>Jenis</th><th>Tanggal</th><th>Peserta</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblPelatihan"></tbody></table></div></div>`;const snap=await db.collection('hrd_pelatihan').get();let h='';if(snap.empty)h='<tr><td colspan="6" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();h+=`<tr><td class="fw-700">${escHtml(p.judul)}</td><td>${escHtml(p.jenis)}</td><td>${formatDate(p.tanggal)}</td><td>${(p.peserta||[]).length}</td><td><span class="badge badge-${p.status==='selesai'?'success':'info'}">${p.status||'terjadwal'}</span></td><td><button class="btn btn-xs btn-info" onclick="modalPelatihan('${d.id}')">✏️</button></td></tr>`;});document.getElementById('tblPelatihan').innerHTML=h;}
function modalPelatihan(id){if(id)db.collection('hrd_pelatihan').doc(id).get().then(d=>showPelForm(id,d.data()||{}));else showPelForm(null,{});}
function showPelForm(id,p){openModal(`<div class="modal-title">${id?'Edit':'Tambah'} Pelatihan</div><div class="form-group"><label>Judul</label><input class="form-control" id="pelJudul" value="${escHtml(p.judul||'')}"></div><div class="grid-2"><div class="form-group"><label>Jenis</label><select class="form-control" id="pelJenis"><option value="internal" ${p.jenis==='internal'?'selected':''}>Internal</option><option value="eksternal" ${p.jenis==='eksternal'?'selected':''}>Eksternal</option><option value="sertifikasi" ${p.jenis==='sertifikasi'?'selected':''}>Sertifikasi</option></select></div><div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="pelTgl" value="${p.tanggal||''}"></div></div><div class="form-group"><label>Peserta (koma)</label><input class="form-control" id="pelPeserta" value="${(p.peserta||[]).join(', ')}"></div><div class="form-group"><label>Status</label><select class="form-control" id="pelStatus"><option value="terjadwal" ${p.status==='terjadwal'?'selected':''}>Terjadwal</option><option value="selesai" ${p.status==='selesai'?'selected':''}>Selesai</option></select></div><button class="btn btn-primary" onclick="simpanPelatihan('${id||''}')">Simpan</button>`);}
async function simpanPelatihan(id){const data={judul:document.getElementById('pelJudul').value,jenis:document.getElementById('pelJenis').value,tanggal:document.getElementById('pelTgl').value,peserta:document.getElementById('pelPeserta').value.split(',').map(s=>s.trim()).filter(Boolean),status:document.getElementById('pelStatus').value,updatedAt:new Date().toISOString()};if(!data.judul)return toast('Judul wajib','warning');if(id)await db.collection('hrd_pelatihan').doc(id).update(data);else await db.collection('hrd_pelatihan').add({...data,createdAt:new Date().toISOString()});closeModalDirect();toast('Disimpan','success');renderPelatihan();}

// ── KONTRAK ───────────────────────────────────────────────────
async function renderKontrak(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>📄 Kontrak & Perjanjian</span><button class="btn btn-primary btn-sm" onclick="modalKontrak()">+ Tambah</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Judul</th><th>Pihak</th><th>Mulai</th><th>Berakhir</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblKontrak"></tbody></table></div></div>`;const snap=await db.collection('hrd_kontrak').orderBy('berakhir').get();const today=todayStr();let h='';if(snap.empty)h='<tr><td colspan="6" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();const expired=p.berakhir<today;h+=`<tr><td class="fw-700">${escHtml(p.judul)}</td><td>${escHtml(p.pihak||'-')}</td><td>${formatDate(p.mulai)}</td><td>${formatDate(p.berakhir)}</td><td><span class="badge badge-${expired?'danger':'success'}">${expired?'Expired':'Aktif'}</span></td><td><button class="btn btn-xs btn-info" onclick="modalKontrak('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_kontrak','${d.id}','kontrak')">🗑️</button></td></tr>`;});document.getElementById('tblKontrak').innerHTML=h;}
function modalKontrak(id){if(id)db.collection('hrd_kontrak').doc(id).get().then(d=>showKontrakForm(id,d.data()||{}));else showKontrakForm(null,{});}
function showKontrakForm(id,p){openModal(`<div class="modal-title">${id?'Edit':'Tambah'} Kontrak</div><div class="form-group"><label>Judul</label><input class="form-control" id="ktJudul" value="${escHtml(p.judul||'')}"></div><div class="grid-2"><div class="form-group"><label>Pihak</label><input class="form-control" id="ktPihak" value="${escHtml(p.pihak||'')}"></div><div class="form-group"><label>Jenis</label><select class="form-control" id="ktJenis"><option value="kerja" ${p.jenis==='kerja'?'selected':''}>Kontrak Kerja</option><option value="vendor" ${p.jenis==='vendor'?'selected':''}>Vendor</option><option value="nda" ${p.jenis==='nda'?'selected':''}>NDA</option></select></div></div><div class="grid-2"><div class="form-group"><label>Mulai</label><input class="form-control" type="date" id="ktMulai" value="${p.mulai||''}"></div><div class="form-group"><label>Berakhir</label><input class="form-control" type="date" id="ktAkhir" value="${p.berakhir||''}"></div></div><button class="btn btn-primary" onclick="simpanKontrak('${id||''}')">Simpan</button>`);}
async function simpanKontrak(id){const data={judul:document.getElementById('ktJudul').value,pihak:document.getElementById('ktPihak').value,jenis:document.getElementById('ktJenis').value,mulai:document.getElementById('ktMulai').value,berakhir:document.getElementById('ktAkhir').value,updatedAt:new Date().toISOString()};if(!data.judul)return toast('Judul wajib','warning');if(id)await db.collection('hrd_kontrak').doc(id).update(data);else await db.collection('hrd_kontrak').add({...data,createdAt:new Date().toISOString()});closeModalDirect();toast('Disimpan','success');renderKontrak();}

// ── ASSET ─────────────────────────────────────────────────────
async function renderAsset(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>💻 Asset Management</span><button class="btn btn-primary btn-sm" onclick="modalAsset()">+ Tambah</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Kode</th><th>Nama</th><th>Kategori</th><th>Pengguna</th><th>Kondisi</th><th>Aksi</th></tr></thead><tbody id="tblAsset"></tbody></table></div></div>`;const snap=await db.collection('hrd_asset').get();let h='';if(snap.empty)h='<tr><td colspan="6" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();h+=`<tr><td>${escHtml(p.kode||'-')}</td><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.kategori||'-')}</td><td>${escHtml(p.pengguna||'-')}</td><td><span class="badge badge-${p.kondisi==='baik'?'success':p.kondisi==='rusak'?'danger':'warning'}">${p.kondisi||'baik'}</span></td><td><button class="btn btn-xs btn-info" onclick="modalAsset('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_asset','${d.id}','asset')">🗑️</button></td></tr>`;});document.getElementById('tblAsset').innerHTML=h;}
function modalAsset(id){if(id)db.collection('hrd_asset').doc(id).get().then(d=>showAssetForm(id,d.data()||{}));else showAssetForm(null,{});}
function showAssetForm(id,p){openModal(`<div class="modal-title">${id?'Edit':'Tambah'} Asset</div><div class="grid-2"><div class="form-group"><label>Kode</label><input class="form-control" id="asKode" value="${escHtml(p.kode||'AST-'+Date.now().toString().slice(-6))}"></div><div class="form-group"><label>Nama</label><input class="form-control" id="asNama" value="${escHtml(p.nama||'')}"></div></div><div class="grid-2"><div class="form-group"><label>Kategori</label><select class="form-control" id="asKat"><option value="elektronik" ${p.kategori==='elektronik'?'selected':''}>Elektronik</option><option value="furniture" ${p.kategori==='furniture'?'selected':''}>Furniture</option><option value="kendaraan" ${p.kategori==='kendaraan'?'selected':''}>Kendaraan</option></select></div><div class="form-group"><label>Kondisi</label><select class="form-control" id="asKondisi"><option value="baik" ${p.kondisi==='baik'?'selected':''}>Baik</option><option value="perlu_perbaikan" ${p.kondisi==='perlu_perbaikan'?'selected':''}>Perlu Perbaikan</option><option value="rusak" ${p.kondisi==='rusak'?'selected':''}>Rusak</option></select></div></div><div class="form-group"><label>Pengguna</label><input class="form-control" id="asPengguna" value="${escHtml(p.pengguna||'')}"></div><button class="btn btn-primary" onclick="simpanAsset('${id||''}')">Simpan</button>`);}
async function simpanAsset(id){const data={kode:document.getElementById('asKode').value,nama:document.getElementById('asNama').value,kategori:document.getElementById('asKat').value,kondisi:document.getElementById('asKondisi').value,pengguna:document.getElementById('asPengguna').value,updatedAt:new Date().toISOString()};if(!data.nama)return toast('Nama wajib','warning');if(id)await db.collection('hrd_asset').doc(id).update(data);else await db.collection('hrd_asset').add({...data,createdAt:new Date().toISOString()});closeModalDirect();toast('Disimpan','success');renderAsset();}

// ══════════════════════════════════════════════════════════════
// ── MEETING & INVITE — Per Akun Karyawan ──────────────────────
// Setiap meeting dikirim langsung ke inbox masing-masing user
// Dipisah berdasarkan user head (pembuat meeting)
// ══════════════════════════════════════════════════════════════

async function renderMeeting() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="page-title"><span>📅 Meeting & Invite</span><button class="btn btn-primary btn-sm" onclick="modalMeetingCreate()">+ Buat Meeting</button></div>
    <div class="tabs">
      <div class="tab active" onclick="loadMeetingTab('saya')">📤 Meeting Saya (Dibuat)</div>
      <div class="tab" onclick="loadMeetingTab('semua')">📋 Semua Meeting</div>
    </div>
    <div id="meetingContent">Loading...</div>`;
  loadMeetingTab('saya');
}

async function loadMeetingTab(tab) {
  document.querySelectorAll('.tabs .tab').forEach((t,i)=>{t.classList.toggle('active',(tab==='saya'&&i===0)||(tab==='semua'&&i===1));});
  let snap;
  if (tab === 'saya') {
    // Meeting yang dibuat oleh user ini (user head)
    snap = await db.collection('hrd_meeting').where('createdBy','==',currentUser.id).get();
  } else {
    snap = await db.collection('hrd_meeting').get();
  }
  let html = '<div class="card">';
  if (snap.empty) {
    html += '<div class="empty-state"><div class="icon">📅</div><p>Belum ada meeting</p></div>';
  } else {
    html += '<div class="table-wrap"><table><thead><tr><th>Judul</th><th>Tanggal</th><th>Waktu</th><th>Pembuat</th><th>Peserta</th><th>Aksi</th></tr></thead><tbody>';
    snap.forEach(d => {
      const p = d.data();
      html += `<tr>
        <td class="fw-700">${escHtml(p.judul)}</td>
        <td>${formatDate(p.tanggal)}</td>
        <td>${p.waktu||'-'}</td>
        <td><span class="badge badge-primary">${escHtml(p.createdByName||'-')}</span></td>
        <td>${(p.pesertaIds||[]).length} orang</td>
        <td><button class="btn btn-xs btn-info" onclick="detailMeeting('${d.id}')">👁️</button> <button class="btn btn-xs btn-warning" onclick="modalNotulensi('${d.id}')">📝</button></td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  }
  html += '</div>';
  document.getElementById('meetingContent').innerHTML = html;
}

async function modalMeetingCreate() {
  // Load semua user aktif untuk dipilih sebagai peserta
  const users = await getAllUsers();
  let checkboxes = '';
  users.forEach(u => {
    if (u.id !== currentUser.id) {
      checkboxes += `<label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:.82rem;cursor:pointer"><input type="checkbox" class="mtPeserta" value="${u.id}" data-nama="${escHtml(u.nama)}"> ${escHtml(u.nama)} <span class="text-xs" style="color:#999">(${escHtml(u.departemen||'-')})</span></label>`;
    }
  });

  openModal(`<div class="modal-title">📅 Buat Meeting & Undang Peserta</div>
    <div class="form-group"><label>Judul Meeting</label><input class="form-control" id="mtJudul"></div>
    <div class="grid-3">
      <div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="mtTgl" value="${todayStr()}"></div>
      <div class="form-group"><label>Waktu</label><input class="form-control" type="time" id="mtWaktu"></div>
      <div class="form-group"><label>Durasi (menit)</label><input class="form-control" type="number" id="mtDurasi" value="60"></div>
    </div>
    <div class="form-group"><label>Lokasi / Link</label><input class="form-control" id="mtLokasi"></div>
    <div class="form-group"><label>Agenda</label><textarea class="form-control" id="mtAgenda"></textarea></div>
    <div class="form-group"><label>📤 Undang Peserta (pilih per akun):</label>
      <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:8px 12px;margin-top:4px">
        ${checkboxes || '<p class="text-sm" style="color:#999">Tidak ada user lain</p>'}
      </div>
    </div>
    <button class="btn btn-primary" onclick="simpanMeeting()">📤 Simpan & Kirim Undangan</button>`, true);
}

async function simpanMeeting() {
  const judul = document.getElementById('mtJudul').value;
  if (!judul) return toast('Judul wajib', 'warning');

  // Collect selected peserta
  const checkboxes = document.querySelectorAll('.mtPeserta:checked');
  const pesertaIds = [];
  const pesertaNames = [];
  checkboxes.forEach(cb => { pesertaIds.push(cb.value); pesertaNames.push(cb.dataset.nama); });

  const data = {
    judul,
    tanggal: document.getElementById('mtTgl').value,
    waktu: document.getElementById('mtWaktu').value,
    durasi: Number(document.getElementById('mtDurasi').value) || 60,
    lokasi: document.getElementById('mtLokasi').value,
    agenda: document.getElementById('mtAgenda').value,
    pesertaIds,
    pesertaNames,
    rsvp: {},
    notulensi: '',
    status: 'terjadwal',
    createdBy: currentUser.id,
    createdByName: currentUser.nama,
    createdAt: new Date().toISOString()
  };

  const docRef = await db.collection('hrd_meeting').add(data);

  // Kirim undangan ke inbox masing-masing peserta
  if (pesertaIds.length > 0) {
    await sendNotificationBulk(
      pesertaIds,
      '📅 Undangan Meeting',
      `${currentUser.nama} mengundang Anda ke meeting "${judul}" pada ${formatDate(data.tanggal)} ${data.waktu}`,
      'inbox'
    );
    // Simpan invite per user di collection terpisah
    const batch = db.batch();
    pesertaIds.forEach(uid => {
      const ref = db.collection('hrd_meeting_invites').doc();
      batch.set(ref, {
        meetingId: docRef.id,
        targetUser: uid,
        fromUser: currentUser.id,
        fromName: currentUser.nama,
        judul: data.judul,
        tanggal: data.tanggal,
        waktu: data.waktu,
        lokasi: data.lokasi,
        rsvpStatus: 'pending',
        read: false,
        createdAt: new Date().toISOString()
      });
    });
    await batch.commit();
  }

  closeModalDirect();
  toast(`Meeting dibuat & undangan terkirim ke ${pesertaIds.length} orang`, 'success');
  renderMeeting();
}

function detailMeeting(id) {
  db.collection('hrd_meeting').doc(id).get().then(d => {
    const p = d.data();
    let rsvpHtml = '';
    (p.pesertaNames || []).forEach((name, i) => {
      const uid = (p.pesertaIds || [])[i];
      const status = (p.rsvp || {})[uid] || 'pending';
      rsvpHtml += `<div style="padding:4px 0;font-size:.82rem;display:flex;align-items:center;gap:8px">
        <span class="badge badge-${status==='hadir'?'success':status==='tidak'?'danger':'warning'}">${status}</span>
        <span>${escHtml(name)}</span>
      </div>`;
    });
    openModal(`<div class="modal-title">📅 ${escHtml(p.judul)}</div>
      <div class="grid-2 mb-16">
        <div><b>Tanggal:</b> ${formatDate(p.tanggal)}</div>
        <div><b>Waktu:</b> ${p.waktu} (${p.durasi} menit)</div>
        <div><b>Lokasi:</b> ${escHtml(p.lokasi||'-')}</div>
        <div><b>Pembuat:</b> ${escHtml(p.createdByName)}</div>
      </div>
      <div class="mb-16"><b>Agenda:</b><div class="text-sm mt-8">${escHtml(p.agenda||'-')}</div></div>
      <div class="mb-16"><b>RSVP Peserta:</b>${rsvpHtml||'<p class="text-sm" style="color:#999">Belum ada peserta</p>'}</div>
      ${p.notulensi?`<div><b>Notulensi:</b><div class="text-sm mt-8" style="white-space:pre-wrap">${escHtml(p.notulensi)}</div></div>`:''}`, true);
  });
}

function modalNotulensi(id) {
  db.collection('hrd_meeting').doc(id).get().then(d => {
    const p = d.data();
    openModal(`<div class="modal-title">📝 Notulensi: ${escHtml(p.judul)}</div>
      <div class="form-group"><label>Notulensi</label><textarea class="form-control" id="notulIsi" style="min-height:200px">${escHtml(p.notulensi||'')}</textarea></div>
      <button class="btn btn-primary" onclick="simpanNotulensi('${id}')">Simpan</button>`);
  });
}
async function simpanNotulensi(id) {
  await db.collection('hrd_meeting').doc(id).update({notulensi:document.getElementById('notulIsi').value,status:'selesai'});
  closeModalDirect(); toast('Notulensi disimpan','success'); renderMeeting();
}

// ══════════════════════════════════════════════════════════════
// ── INBOX — Undangan Meeting masuk per akun user ──────────────
// Setiap user punya inbox sendiri, terpisah per user head
// ══════════════════════════════════════════════════════════════

async function renderInbox() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>📥 Inbox Saya</span></div><div class="card" id="inboxList">Loading...</div>`;

  // Real-time listener untuk inbox user ini
  const unsub = db.collection('hrd_meeting_invites')
    .where('targetUser', '==', currentUser.id)
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      let html = '';
      if (snap.empty) {
        html = '<div class="empty-state"><div class="icon">📥</div><p>Inbox kosong — belum ada undangan meeting</p></div>';
      } else {
        snap.forEach(d => {
          const p = d.data();
          const isUnread = !p.read;
          const rsvpBadge = p.rsvpStatus === 'hadir' ? 'badge-success' : p.rsvpStatus === 'tidak' ? 'badge-danger' : 'badge-warning';
          html += `<div class="inbox-item ${isUnread?'unread':''}" onclick="openInviteDetail('${d.id}')">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <div class="inbox-from">📅 ${escHtml(p.judul)}</div>
                <div class="inbox-subject">Dari: <b>${escHtml(p.fromName)}</b> — ${formatDate(p.tanggal)} ${p.waktu||''}</div>
              </div>
              <div style="text-align:right">
                <span class="badge ${rsvpBadge}">${p.rsvpStatus}</span>
                <div class="inbox-time">${formatDateTime(p.createdAt)}</div>
              </div>
            </div>
          </div>`;
        });
      }
      const el = document.getElementById('inboxList');
      if (el) el.innerHTML = html;
    });
  unsubscribers.push(unsub);
}

async function openInviteDetail(inviteId) {
  const invDoc = await db.collection('hrd_meeting_invites').doc(inviteId).get();
  const inv = invDoc.data();

  // Mark as read
  if (!inv.read) await db.collection('hrd_meeting_invites').doc(inviteId).update({read: true});

  // Get full meeting data
  let meetingData = null;
  if (inv.meetingId) {
    const mDoc = await db.collection('hrd_meeting').doc(inv.meetingId).get();
    if (mDoc.exists) meetingData = mDoc.data();
  }

  openModal(`<div class="modal-title">📅 Undangan Meeting</div>
    <div class="thread-header" style="border-radius:8px;margin-bottom:16px">
      <div class="fw-700" style="font-size:1rem">${escHtml(inv.judul)}</div>
      <div class="text-sm mt-8">Dari: <b>${escHtml(inv.fromName)}</b></div>
      <div class="text-sm">Tanggal: <b>${formatDate(inv.tanggal)}</b> — Waktu: <b>${inv.waktu||'-'}</b></div>
      <div class="text-sm">Lokasi: ${escHtml(inv.lokasi||'-')}</div>
    </div>
    ${meetingData?`<div class="mb-16"><b>Agenda:</b><div class="text-sm mt-8" style="background:#f8f9ff;padding:12px;border-radius:6px">${escHtml(meetingData.agenda||'Tidak ada agenda')}</div></div>`:''}
    <div class="mb-16"><b>Status RSVP Anda:</b> <span class="badge badge-${inv.rsvpStatus==='hadir'?'success':inv.rsvpStatus==='tidak'?'danger':'warning'}">${inv.rsvpStatus}</span></div>
    <div class="flex gap-8">
      <button class="btn btn-success" onclick="rsvpInvite('${inviteId}','${inv.meetingId}','hadir')">✅ Hadir</button>
      <button class="btn btn-danger" onclick="rsvpInvite('${inviteId}','${inv.meetingId}','tidak')">❌ Tidak Hadir</button>
    </div>`, true);
}

async function rsvpInvite(inviteId, meetingId, status) {
  // Update invite
  await db.collection('hrd_meeting_invites').doc(inviteId).update({rsvpStatus: status});

  // Update meeting RSVP map
  if (meetingId) {
    const mRef = db.collection('hrd_meeting').doc(meetingId);
    const mDoc = await mRef.get();
    if (mDoc.exists) {
      const rsvp = mDoc.data().rsvp || {};
      rsvp[currentUser.id] = status;
      await mRef.update({rsvp});
    }
  }

  // Notify meeting creator
  const invDoc = await db.collection('hrd_meeting_invites').doc(inviteId).get();
  const inv = invDoc.data();
  await sendNotification(inv.fromUser, '📅 RSVP Meeting', `${currentUser.nama} ${status==='hadir'?'akan hadir':'tidak hadir'} di meeting "${inv.judul}"`, 'meeting');

  closeModalDirect();
  toast(`RSVP: ${status}`, 'success');
}

// ══════════════════════════════════════════════════════════════
// ── OBROLAN — Per User Head (Thread terpisah per pengirim) ────
// Chat diarahkan langsung ke akun masing-masing karyawan
// Setiap percakapan dipisah berdasarkan siapa yang memulai (head)
// ══════════════════════════════════════════════════════════════

async function renderChat() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="page-title"><span>💬 Obrolan</span><button class="btn btn-primary btn-sm" onclick="modalNewChat()">+ Mulai Obrolan</button></div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title mb-8">📤 Percakapan</div>
        <div id="chatThreadList" style="max-height:500px;overflow-y:auto">Loading...</div>
      </div>
      <div class="card" id="chatArea">
        <div class="empty-state"><div class="icon">💬</div><p>Pilih percakapan atau mulai obrolan baru</p></div>
      </div>
    </div>`;
  loadChatThreads();
}

async function loadChatThreads() {
  // Load semua thread dimana user ini terlibat (sebagai sender atau receiver)
  const [sentSnap, recvSnap] = await Promise.all([
    db.collection('hrd_chat_threads').where('fromUser','==',currentUser.id).orderBy('lastMessageAt','desc').get(),
    db.collection('hrd_chat_threads').where('toUser','==',currentUser.id).orderBy('lastMessageAt','desc').get()
  ]);

  const threads = new Map();
  sentSnap.forEach(d => threads.set(d.id, {id:d.id, ...d.data()}));
  recvSnap.forEach(d => threads.set(d.id, {id:d.id, ...d.data()}));

  // Sort by lastMessageAt
  const sorted = [...threads.values()].sort((a,b) => (b.lastMessageAt||'').localeCompare(a.lastMessageAt||''));

  let html = '';
  if (!sorted.length) {
    html = '<p class="text-sm" style="color:#999;padding:12px">Belum ada percakapan. Klik "+ Mulai Obrolan" untuk chat.</p>';
  } else {
    sorted.forEach(t => {
      const otherName = t.fromUser === currentUser.id ? t.toName : t.fromName;
      const unread = t.fromUser !== currentUser.id && t.unreadBy === currentUser.id;
      html += `<div class="inbox-item ${unread?'unread':''}" onclick="openChatThread('${t.id}')">
        <div class="inbox-from">💬 ${escHtml(otherName)}</div>
        <div class="inbox-subject text-xs">${escHtml((t.lastMessage||'').substring(0,50))}</div>
        <div class="inbox-time">${formatDateTime(t.lastMessageAt)}</div>
      </div>`;
    });
  }
  document.getElementById('chatThreadList').innerHTML = html;
}

async function modalNewChat() {
  const users = await getAllUsers();
  let options = '';
  users.forEach(u => {
    if (u.id !== currentUser.id) {
      options += `<option value="${u.id}" data-nama="${escHtml(u.nama)}">${escHtml(u.nama)} (${escHtml(u.departemen||'-')})</option>`;
    }
  });
  openModal(`<div class="modal-title">💬 Mulai Obrolan Baru</div>
    <div class="form-group"><label>Pilih Karyawan</label><select class="form-control" id="newChatUser">${options}</select></div>
    <div class="form-group"><label>Pesan Pertama</label><textarea class="form-control" id="newChatMsg" placeholder="Ketik pesan..."></textarea></div>
    <button class="btn btn-primary" onclick="startNewChat()">📤 Kirim</button>`);
}

async function startNewChat() {
  const sel = document.getElementById('newChatUser');
  const toUser = sel.value;
  const toName = sel.options[sel.selectedIndex]?.dataset?.nama || '';
  const msg = document.getElementById('newChatMsg').value.trim();
  if (!toUser || !msg) return toast('Pilih user dan tulis pesan', 'warning');

  // Check if thread already exists between these two users
  const existingSnap = await db.collection('hrd_chat_threads')
    .where('participants', 'array-contains', currentUser.id)
    .get();
  
  let threadId = null;
  existingSnap.forEach(d => {
    const data = d.data();
    if (data.participants && data.participants.includes(toUser)) {
      threadId = d.id;
    }
  });

  if (!threadId) {
    // Create new thread
    const threadRef = await db.collection('hrd_chat_threads').add({
      fromUser: currentUser.id,
      fromName: currentUser.nama,
      toUser: toUser,
      toName: toName,
      participants: [currentUser.id, toUser],
      lastMessage: msg,
      lastMessageAt: new Date().toISOString(),
      unreadBy: toUser,
      createdAt: new Date().toISOString()
    });
    threadId = threadRef.id;
  }

  // Add message
  await db.collection('hrd_chat_messages').add({
    threadId,
    senderId: currentUser.id,
    senderName: currentUser.nama,
    message: msg,
    createdAt: new Date().toISOString()
  });

  // Update thread
  await db.collection('hrd_chat_threads').doc(threadId).update({
    lastMessage: msg,
    lastMessageAt: new Date().toISOString(),
    unreadBy: toUser
  });

  // Notify target user
  await sendNotification(toUser, '💬 Pesan Baru', `${currentUser.nama}: ${msg.substring(0,80)}`, 'chat');

  closeModalDirect();
  toast('Pesan terkirim', 'success');
  loadChatThreads();
  openChatThread(threadId);
}

function openChatThread(threadId) {
  const area = document.getElementById('chatArea');
  area.innerHTML = `<div class="chat-container">
    <div class="chat-messages" id="chatMsgs"></div>
    <div class="chat-input">
      <input class="form-control" id="chatInput" placeholder="Ketik pesan..." onkeydown="if(event.key==='Enter')kirimChatMsg('${threadId}')">
      <button class="btn btn-primary btn-sm" onclick="kirimChatMsg('${threadId}')">Kirim</button>
    </div>
  </div>`;

  // Mark as read
  db.collection('hrd_chat_threads').doc(threadId).get().then(d => {
    const data = d.data();
    if (data && data.unreadBy === currentUser.id) {
      db.collection('hrd_chat_threads').doc(threadId).update({unreadBy: ''});
    }
  });

  // Real-time messages
  const unsub = db.collection('hrd_chat_messages')
    .where('threadId', '==', threadId)
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      let html = '';
      snap.forEach(d => {
        const p = d.data();
        const isMine = p.senderId === currentUser.id;
        html += `<div class="chat-msg${isMine?' mine':''}">
          <div class="msg-avatar">${(p.senderName||'?').charAt(0)}</div>
          <div>
            <div class="msg-body">${escHtml(p.message)}</div>
            <div class="msg-time">${escHtml(p.senderName)} • ${formatDateTime(p.createdAt)}</div>
          </div>
        </div>`;
      });
      const msgs = document.getElementById('chatMsgs');
      if (msgs) { msgs.innerHTML = html || '<div class="text-center text-sm" style="color:#999;padding:40px">Belum ada pesan</div>'; msgs.scrollTop = msgs.scrollHeight; }
    });
  unsubscribers.push(unsub);
}

async function kirimChatMsg(threadId) {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  await db.collection('hrd_chat_messages').add({
    threadId,
    senderId: currentUser.id,
    senderName: currentUser.nama,
    message: msg,
    createdAt: new Date().toISOString()
  });

  // Get thread to find the other user
  const tDoc = await db.collection('hrd_chat_threads').doc(threadId).get();
  const tData = tDoc.data();
  const otherUser = tData.fromUser === currentUser.id ? tData.toUser : tData.fromUser;

  await db.collection('hrd_chat_threads').doc(threadId).update({
    lastMessage: msg,
    lastMessageAt: new Date().toISOString(),
    unreadBy: otherUser
  });

  // Notify
  await sendNotification(otherUser, '💬 Pesan Baru', `${currentUser.nama}: ${msg.substring(0,80)}`, 'chat');
}

// ── BROADCAST ─────────────────────────────────────────────────
async function renderBroadcast(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>📡 Broadcast</span><button class="btn btn-primary btn-sm" onclick="modalBroadcast()">+ Kirim</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Pesan</th><th>Target</th><th>Pengirim</th><th>Tanggal</th></tr></thead><tbody id="tblBroadcast"></tbody></table></div></div>`;const snap=await db.collection('hrd_broadcast').get();let h='';if(snap.empty)h='<tr><td colspan="4" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();h+=`<tr><td>${escHtml(p.pesan).substring(0,80)}</td><td><span class="badge badge-info">${escHtml(p.targetLabel||'Semua')}</span></td><td>${escHtml(p.pengirim)}</td><td>${formatDateTime(p.createdAt)}</td></tr>`;});document.getElementById('tblBroadcast').innerHTML=h;}
async function modalBroadcast(){
  const users=await getAllUsers();
  let opts='<option value="all">📢 Semua Karyawan</option>';
  const depts=new Set();users.forEach(u=>depts.add(u.departemen||''));
  depts.forEach(d=>{if(d)opts+=`<option value="dept:${d}">🏢 Divisi ${d}</option>`;});
  users.forEach(u=>{opts+=`<option value="user:${u.id}">👤 ${escHtml(u.nama)}</option>`;});
  openModal(`<div class="modal-title">📡 Kirim Broadcast</div><div class="form-group"><label>Target</label><select class="form-control" id="bcTarget">${opts}</select></div><div class="form-group"><label>Pesan</label><textarea class="form-control" id="bcPesan" style="min-height:120px"></textarea></div><button class="btn btn-primary" onclick="kirimBroadcast()">📡 Kirim</button>`);
}
async function kirimBroadcast(){
  const target=document.getElementById('bcTarget').value;const pesan=document.getElementById('bcPesan').value;
  if(!pesan)return toast('Pesan wajib','warning');
  const users=await getAllUsers();let targetIds=[];let targetLabel='Semua';
  if(target==='all'){targetIds=users.map(u=>u.id);targetLabel='Semua';}
  else if(target.startsWith('dept:')){const dept=target.replace('dept:','');targetIds=users.filter(u=>u.departemen===dept).map(u=>u.id);targetLabel='Divisi '+dept;}
  else if(target.startsWith('user:')){targetIds=[target.replace('user:','')];targetLabel=users.find(u=>u.id===targetIds[0])?.nama||'User';}
  await db.collection('hrd_broadcast').add({pesan,targetLabel,pengirim:currentUser.nama,createdAt:new Date().toISOString()});
  await sendNotificationBulk(targetIds,'📡 Broadcast',`${currentUser.nama}: ${pesan.substring(0,100)}`,'notifikasi');
  closeModalDirect();toast(`Broadcast terkirim ke ${targetIds.length} orang`,'success');renderBroadcast();
}

// ── NOTIFIKASI ────────────────────────────────────────────────
async function renderNotifikasi(){
  const main=document.getElementById('mainContent');
  main.innerHTML=`<div class="page-title"><span>🔔 Notifikasi</span><button class="btn btn-sm btn-outline" onclick="markAllRead()">Tandai Semua Dibaca</button></div><div class="card" id="notifList">Loading...</div>`;
  try{
    const[snap1,snap2]=await Promise.all([
      db.collection('hrd_notifikasi').where('targetUser','==',currentUser.id).get(),
      db.collection('hrd_notifikasi').where('targetUser','==',currentUser.role).get()
    ]);
    const allNotifs=[];const seen=new Set();
    snap1.forEach(d=>{if(!seen.has(d.id)){seen.add(d.id);allNotifs.push({id:d.id,...d.data()});}});
    snap2.forEach(d=>{if(!seen.has(d.id)){seen.add(d.id);allNotifs.push({id:d.id,...d.data()});}});
    allNotifs.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    let h='';
    if(!allNotifs.length)h='<div class="empty-state"><div class="icon">🔔</div><p>Tidak ada notifikasi</p></div>';
    else allNotifs.slice(0,30).forEach(p=>{
      const linkPage=p.link||detectNotifLink(p.title);
      h+=`<div style="padding:12px;border-bottom:1px solid var(--border);cursor:pointer;${p.read?'opacity:.6':'background:#f0f4ff;border-left:3px solid var(--primary)'}" onclick="openNotif('${p.id}','${linkPage}')"><div class="flex" style="justify-content:space-between"><div class="fw-700 text-sm">${escHtml(p.title)}</div><div class="text-xs" style="color:#999">${formatDateTime(p.createdAt)}</div></div><div class="text-sm mt-8">${escHtml(p.message)}</div>${!p.read?`<button class="btn btn-xs btn-outline mt-8" onclick="event.stopPropagation();markRead('${p.id}')">Tandai Dibaca</button>`:''}</div>`;
    });
    document.getElementById('notifList').innerHTML=h;
  }catch(e){document.getElementById('notifList').innerHTML='<div class="empty-state"><div class="icon">🔔</div><p>Tidak ada notifikasi</p></div>';}
}
async function markRead(id){await db.collection('hrd_notifikasi').doc(id).update({read:true});renderNotifikasi();}

async function openNotif(id,link){
  await db.collection('hrd_notifikasi').doc(id).update({read:true});
  if(link&&link!=='')navigateTo(link);
  else renderNotifikasi();
}
function detectNotifLink(title){
  const t=(title||'').toLowerCase();
  if(t.includes('meeting')||t.includes('undangan'))return'meeting';
  if(t.includes('broadcast'))return'broadcast';
  if(t.includes('pengumuman'))return'pengumuman';
  if(t.includes('cuti')||t.includes('izin'))return'cuti';
  if(t.includes('approval'))return'approval-center';
  if(t.includes('gaji')||t.includes('slip'))return'penggajian';
  if(t.includes('reimbursement'))return'reimbursement';
  if(t.includes('kandidat')||t.includes('rekrutmen'))return'kandidat';
  if(t.includes('disc'))return'disc-test';
  return'';
}
async function markAllRead(){
  const[s1,s2]=await Promise.all([
    db.collection('hrd_notifikasi').where('targetUser','==',currentUser.id).where('read','==',false).get(),
    db.collection('hrd_notifikasi').where('targetUser','==',currentUser.role).where('read','==',false).get()
  ]);
  const batch=db.batch();
  s1.forEach(d=>batch.update(d.ref,{read:true}));
  s2.forEach(d=>batch.update(d.ref,{read:true}));
  await batch.commit();
  toast('Semua dibaca','success');renderNotifikasi();
}

// ── PENGUMUMAN ────────────────────────────────────────────────
async function renderPengumuman(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>📢 Pengumuman</span>${hasAccess(3)?'<button class="btn btn-primary btn-sm" onclick="modalPengumuman()">+ Tambah</button>':''}</div><div id="pengumumanList">Loading...</div>`;try{const snap=await db.collection('hrd_pengumuman').get();const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));let h='';if(!items.length)h='<div class="empty-state"><div class="icon">📢</div><p>Belum ada</p></div>';else items.forEach(p=>{h+=`<div class="card"><div class="card-header"><div class="card-title">${escHtml(p.judul)}</div><div class="text-xs" style="color:#999">${formatDateTime(p.createdAt)} — ${escHtml(p.dibuatOleh||'')}</div></div><div class="text-sm" style="white-space:pre-wrap">${escHtml(p.isi)}</div></div>`;});document.getElementById('pengumumanList').innerHTML=h;}catch(e){document.getElementById('pengumumanList').innerHTML='<div class="empty-state"><div class="icon">📢</div><p>Belum ada pengumuman</p></div>';}}
function modalPengumuman(){openModal(`<div class="modal-title">Tambah Pengumuman</div><div class="form-group"><label>Judul</label><input class="form-control" id="pgJudul"></div><div class="form-group"><label>Isi</label><textarea class="form-control" id="pgIsi" style="min-height:150px"></textarea></div><button class="btn btn-primary" onclick="simpanPengumuman()">Publikasikan</button>`);}
async function simpanPengumuman(){const data={judul:document.getElementById('pgJudul').value,isi:document.getElementById('pgIsi').value,dibuatOleh:currentUser.nama,createdAt:new Date().toISOString()};if(!data.judul)return toast('Judul wajib','warning');await db.collection('hrd_pengumuman').add(data);const users=await getAllUsers();await sendNotificationBulk(users.map(u=>u.id),'📢 Pengumuman',data.judul);closeModalDirect();toast('Dipublikasikan','success');renderPengumuman();}

// ── MANAJEMEN AKUN ────────────────────────────────────────────
async function renderAkun(){if(!hasAccess(4))return document.getElementById('mainContent').innerHTML='<div class="card"><p>Akses ditolak.</p></div>';const main=document.getElementById('mainContent');const baseUrl = window.location.origin + window.location.pathname;main.innerHTML=`<div class="page-title"><span>👤 Manajemen Akun</span><button class="btn btn-primary btn-sm" onclick="modalAkun()">+ Tambah</button></div><div class="card mb-16"><div class="card-title">📲 Bagikan Aplikasi</div><p class="text-sm mb-16" style="color:#666">Bagikan link download aplikasi ke karyawan agar mereka dapat mengakses portal lewat browser atau PWA di Android, iOS, Windows, dan Mac.</p><div class="form-group"><label>Link Aplikasi</label><input class="form-control" readonly id="adminAppLink" value="${baseUrl}"></div><div class="flex gap-8"><button class="btn btn-primary btn-sm" onclick="copyDownloadLink()">📋 Salin Link</button><button class="btn btn-success btn-sm" onclick="shareDownloadWhatsApp()">💬 Share WA</button><button class="btn btn-info btn-sm" onclick="shareDownloadEmail()">✉️ Email</button></div></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Username</th><th>Nama</th><th>Role</th><th>Dept</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblAkun"></tbody></table></div></div>`;const snap=await db.collection('hrd_users').get();let h='';snap.forEach(d=>{const p=d.data();h+=`<tr><td class="fw-700">${escHtml(d.id)}</td><td>${escHtml(p.nama)}</td><td><span class="badge badge-primary">${p.role}</span></td><td>${escHtml(p.departemen||'-')}</td><td><span class="badge badge-${p.status==='aktif'?'success':'danger'}">${p.status||'aktif'}</span></td><td><button class="btn btn-xs btn-info" onclick="modalAkun('${d.id}')">✏️</button></td></tr>`;});document.getElementById('tblAkun').innerHTML=h;}
function modalAkun(id){if(id)db.collection('hrd_users').doc(id).get().then(d=>showAkunForm(id,d.data()||{}));else showAkunForm(null,{});}
async function showAkunForm(id,p){
  // Load karyawan list for linking
  const karySnap=await db.collection('hrd_karyawan').get();
  let karyOpts='<option value="">-- Tidak disambungkan --</option>';
  karySnap.forEach(d=>{const k=d.data();karyOpts+=`<option value="${d.id}" ${p.linkedKaryawan===d.id?'selected':''}>${escHtml(k.nama)} (${escHtml(k.nip||'-')} — ${escHtml(k.departemen||'-')})</option>`;});
  openModal(`<div class="modal-title">${id?'Edit':'Tambah'} Akun</div>
    <div class="grid-2"><div class="form-group"><label>Username</label><input class="form-control" id="akUser" value="${escHtml(id||'')}" data-old-id="${escHtml(id||'')}"></div><div class="form-group"><label>Password</label><input class="form-control" id="akPass" value="${escHtml(p.password||'')}"></div></div>
    <div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="akNama" value="${escHtml(p.nama||'')}"></div><div class="form-group"><label>Role</label><select class="form-control" id="akRole"><option value="karyawan" ${p.role==='karyawan'?'selected':''}>Karyawan</option><option value="manager" ${p.role==='manager'?'selected':''}>Manager</option><option value="hr" ${p.role==='hr'?'selected':''}>HR</option><option value="legal" ${p.role==='legal'?'selected':''}>Legal</option><option value="admin" ${p.role==='admin'?'selected':''}>Admin</option><option value="superadmin" ${p.role==='superadmin'?'selected':''}>Super Admin</option></select></div></div>
    <div class="grid-2"><div class="form-group"><label>Departemen</label><input class="form-control" id="akDept" value="${escHtml(p.departemen||'')}"></div><div class="form-group"><label>Status</label><select class="form-control" id="akStatus"><option value="aktif" ${p.status==='aktif'?'selected':''}>Aktif</option><option value="nonaktif" ${p.status==='nonaktif'?'selected':''}>Nonaktif</option></select></div></div>
    <div class="form-group" style="background:#f0f4ff;padding:12px;border-radius:8px;border-left:4px solid var(--primary)"><label style="color:var(--primary)">🔗 Sambungkan ke Data Karyawan</label><select class="form-control" id="akLinkedKary">${karyOpts}</select><div class="text-xs mt-8" style="color:#666">Pilih karyawan yang terdaftar untuk menyinkronkan data (nama, departemen, posisi) secara otomatis.</div></div>
    <div class="flex gap-8 mt-16"><button class="btn btn-primary" onclick="simpanAkun('${id||''}')">💾 Simpan</button>${id?`<button class="btn btn-danger" onclick="hapusDoc('hrd_users','${id}','akun')">🗑️ Hapus</button>`:''}</div>`,true);
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

// ── APPROVAL CENTER — dengan View detail + routing ke atasan ──
async function renderApprovalCenter(){
  const main=document.getElementById('mainContent');
  main.innerHTML=`<div class="page-title"><span>✅ Approval Center</span></div><div class="card" id="approvalList">Loading...</div>`;
  const collections=['hrd_cuti','hrd_overtime','hrd_reimbursement','hrd_kasbon'];
  let items=[];
  for(const col of collections){
    const snap=await db.collection(col).where('status','==','pending').get();
    snap.forEach(d=>items.push({id:d.id,collection:col,...d.data()}));
  }
  items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  let h='';
  if(!items.length) h='<div class="empty-state"><div class="icon">✅</div><p>Tidak ada pengajuan pending</p></div>';
  else items.forEach(item=>{
    const typeLabel=item.collection.replace('hrd_','').toUpperCase();
    const detail=item.jenis||item.kategori||'';
    const jumlah=item.jumlah?` — ${formatCurrency(item.jumlah)}`:'';
    const durasi=item.durasi?` (${item.durasi} hari)`:'';
    h+=`<div style="padding:14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div style="flex:1">
        <div><span class="badge badge-info">${typeLabel}</span> <span class="fw-700">${escHtml(item.nama)}</span></div>
        <div class="text-sm" style="color:#555;margin-top:4px">${escHtml(detail)}${durasi}${jumlah}</div>
        <div class="text-xs" style="color:#999;margin-top:2px">${formatDateTime(item.createdAt)}${item.atasan?` • Atasan: ${escHtml(item.atasan)}`:''}</div>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-xs btn-primary" onclick="viewApprovalDetail('${item.collection}','${item.id}')">👁️ View</button>
        ${hasAccess(2)?`<button class="btn btn-xs btn-success" onclick="approveItem('${item.collection}','${item.id}','approved')">✅</button><button class="btn btn-xs btn-danger" onclick="approveItem('${item.collection}','${item.id}','rejected')">❌</button>`:''}
      </div>
    </div>`;
  });
  document.getElementById('approvalList').innerHTML=h;
}

function viewApprovalDetail(col,id){
  db.collection(col).doc(id).get().then(d=>{
    const p=d.data();const type=col.replace('hrd_','');
    let html=`<div class="modal-title">📋 Detail Pengajuan — ${type.toUpperCase()}</div>`;
    html+=`<div class="grid-2 mb-16">`;
    html+=`<div><b>Nama:</b> ${escHtml(p.nama||'-')}</div>`;
    html+=`<div><b>Status:</b> <span class="badge badge-warning">${p.status}</span></div>`;
    html+=`<div><b>Tanggal Ajuan:</b> ${formatDateTime(p.createdAt)}</div>`;
    if(p.jenis)html+=`<div><b>Jenis:</b> ${escHtml(p.jenis)}</div>`;
    if(p.kategori)html+=`<div><b>Kategori:</b> ${escHtml(p.kategori)}</div>`;
    if(p.mulai)html+=`<div><b>Mulai:</b> ${formatDate(p.mulai)}</div>`;
    if(p.selesai)html+=`<div><b>Selesai:</b> ${formatDate(p.selesai)}</div>`;
    if(p.durasi)html+=`<div><b>Durasi:</b> ${p.durasi} hari</div>`;
    if(p.tanggal)html+=`<div><b>Tanggal:</b> ${formatDate(p.tanggal)}</div>`;
    if(p.jamMulai)html+=`<div><b>Jam:</b> ${p.jamMulai} - ${p.jamSelesai||'-'}</div>`;
    if(p.jumlah)html+=`<div><b>Jumlah:</b> ${formatCurrency(p.jumlah)}</div>`;
    if(p.cicilan)html+=`<div><b>Cicilan:</b> ${p.cicilan}x</div>`;
    html+=`</div>`;
    if(p.keterangan)html+=`<div class="mb-16"><b>Keterangan:</b><div class="text-sm mt-8" style="background:#f8f9ff;padding:10px;border-radius:6px;white-space:pre-wrap">${escHtml(p.keterangan)}</div></div>`;
    if(p.alasan)html+=`<div class="mb-16"><b>Alasan:</b><div class="text-sm mt-8" style="background:#f8f9ff;padding:10px;border-radius:6px">${escHtml(p.alasan)}</div></div>`;
    html+=`<div class="flex gap-8 mt-16">${hasAccess(2)?`<button class="btn btn-success" onclick="approveItem('${col}','${id}','approved')">✅ Approve</button><button class="btn btn-danger" onclick="approveItem('${col}','${id}','rejected')">❌ Reject</button>`:''}</div>`;
    openModal(html,true);
  });
}

async function approveItem(col,id,status){
  await db.collection(col).doc(id).update({status,approvedBy:currentUser.nama,approvedAt:new Date().toISOString()});
  // Notify the requester
  const doc=await db.collection(col).doc(id).get();
  const data=doc.data();
  if(data.userId)await sendNotification(data.userId,`${status==='approved'?'✅ Disetujui':'❌ Ditolak'}`,`Pengajuan ${data.jenis||data.kategori||col.replace('hrd_','')} Anda telah ${status} oleh ${currentUser.nama}`);
  closeModalDirect();
  toast(status==='approved'?'Disetujui':'Ditolak','success');
  renderApprovalCenter();
}

// ── APPROVAL MANAGEMENT ───────────────────────────────────────
async function renderApprovalMgmt(){if(!hasAccess(4))return document.getElementById('mainContent').innerHTML='<div class="card"><p>Akses ditolak.</p></div>';const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>⚙️ Approval Management</span><button class="btn btn-primary btn-sm" onclick="modalApprovalFlow()">+ Tambah Flow</button></div><div class="card"><p class="text-sm mb-16">Konfigurasi alur approval multi-step. Tentukan jenis pengajuan, siapa yang mengajukan, dan siapa yang approve.</p><div class="table-wrap"><table><thead><tr><th>Jenis</th><th>Pengaju</th><th>Approver Steps</th><th>Aksi</th></tr></thead><tbody id="tblApprFlow"></tbody></table></div></div>`;const snap=await db.collection('hrd_approval_flow').get();let h='';if(snap.empty)h='<tr><td colspan="4" class="text-center">Belum ada flow</td></tr>';else snap.forEach(d=>{const p=d.data();h+=`<tr><td class="fw-700">${escHtml(p.jenis)}</td><td>${escHtml(p.pengaju||'Semua')}</td><td>${(p.steps||[]).map(s=>`<span class="badge badge-primary">${escHtml(s.nama||s.role)}</span>`).join(' → ')}</td><td><button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_approval_flow','${d.id}','approval-mgmt')">🗑️</button></td></tr>`;});document.getElementById('tblApprFlow').innerHTML=h;}
async function modalApprovalFlow(){
  const kSnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  let karyOpts='<option value="Semua">Semua Karyawan</option>';
  let approverOpts='';
  const depts=new Set();
  kSnap.forEach(d=>{const k=d.data();karyOpts+=`<option value="${escHtml(k.nama)}">${escHtml(k.nama)} — ${escHtml(k.departemen||'')} (${escHtml(k.posisi||'')})</option>`;depts.add(k.departemen||'');
    const pos=(k.posisi||'').toUpperCase();if(pos.includes('HEAD')||pos.includes('MANAGER')||pos.includes('GENERAL')||pos.includes('FOUNDER'))approverOpts+=`<option value="${escHtml(k.nama)}">${escHtml(k.nama)} — ${escHtml(k.posisi||'')} (${escHtml(k.departemen||'')})</option>`;});
  let deptOpts='';depts.forEach(d=>{if(d)deptOpts+=`<option>${escHtml(d)}</option>`;});
  openModal(`<div class="modal-title">Tambah Approval Flow</div>
    <div class="form-group"><label>Jenis Pengajuan</label><select class="form-control" id="afJenis"><option value="cuti">Cuti / Izin</option><option value="overtime">Overtime / Lembur</option><option value="reimbursement">Reimbursement</option><option value="kasbon">Kasbon & Loan</option><option value="insentif">Insentif</option><option value="penggajian">Penggajian</option><option value="onboarding">Onboarding</option><option value="offboarding">Offboarding</option><option value="kontrak">Perpanjangan Kontrak</option><option value="pelatihan">Pelatihan</option></select></div>
    <div class="form-group"><label>Departemen</label><select class="form-control" id="afDept"><option value="">Semua Departemen</option>${deptOpts}</select></div>
    <div class="form-group"><label>Siapa yang Mengajukan</label><select class="form-control" id="afPengaju">${karyOpts}</select></div>
    <div class="form-group"><label>Approver Step 1</label><select class="form-control" id="afStep1"><option value="">-- Pilih --</option>${approverOpts}<option value="hr">HR (Role)</option><option value="admin">Admin (Role)</option><option value="superadmin">Super Admin (Role)</option></select></div>
    <div class="form-group"><label>Approver Step 2 (opsional)</label><select class="form-control" id="afStep2"><option value="">-- Tidak ada --</option>${approverOpts}<option value="hr">HR (Role)</option><option value="admin">Admin (Role)</option><option value="superadmin">Super Admin (Role)</option></select></div>
    <div class="form-group"><label>Approver Step 3 (opsional)</label><select class="form-control" id="afStep3"><option value="">-- Tidak ada --</option>${approverOpts}<option value="hr">HR (Role)</option><option value="admin">Admin (Role)</option><option value="superadmin">Super Admin (Role)</option></select></div>
    <button class="btn btn-primary" onclick="simpanApprovalFlow()">Simpan</button>`,true);}
async function simpanApprovalFlow(){const steps=[];const s1=document.getElementById('afStep1').value;const s2=document.getElementById('afStep2').value;const s3=document.getElementById('afStep3').value;if(s1)steps.push({role:s1,nama:s1});if(s2)steps.push({role:s2,nama:s2});if(s3)steps.push({role:s3,nama:s3});if(!steps.length)return toast('Minimal 1 approver','warning');await db.collection('hrd_approval_flow').add({jenis:document.getElementById('afJenis').value,departemen:document.getElementById('afDept').value,pengaju:document.getElementById('afPengaju').value,steps,createdAt:new Date().toISOString()});closeModalDirect();toast('Flow disimpan','success');renderApprovalMgmt();}

// ── INSENTIF MODULE ───────────────────────────────────────────
async function renderInsentif(){
  const main=document.getElementById('mainContent');
  main.innerHTML=`<div class="page-title"><span>🏆 Insentif Kinerja</span><button class="btn btn-primary btn-sm" onclick="modalInsentif()">+ Tambah Insentif</button></div>
  <div class="card"><div style="background:#fff3e0;border-radius:8px;padding:12px;margin-bottom:16px;border-left:4px solid var(--warning)"><p class="text-sm" style="line-height:1.6"><b>Formula Insentif:</b><br>• KPI ≥ 90 (Grade A) = <b>15%</b> dari Gaji Pokok<br>• KPI ≥ 80 (Grade B) = <b>10%</b> dari Gaji Pokok<br>• KPI ≥ 70 (Grade C) = <b>5%</b> dari Gaji Pokok<br>• KPI < 70 = <b>0%</b> (Tidak dapat insentif)<br><br>Insentif otomatis terintegrasi ke slip gaji saat Generate.</p></div>
  <div class="flex gap-8 mb-16"><button class="btn btn-success btn-sm" onclick="generateInsentifFromKPI()">⚡ Generate dari KPI</button><button class="btn btn-danger btn-sm" onclick="hapusSemuaInsentif()">🗑️ Hapus Semua</button></div>
  <div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Dept</th><th>Gaji Pokok</th><th>KPI Score</th><th>Grade</th><th>% Insentif</th><th>Nominal</th><th>Periode</th><th>Aksi</th></tr></thead><tbody id="tblInsentif"></tbody></table></div></div>`;
  const snap=await db.collection('hrd_insentif').get();const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  let h='';if(!items.length)h='<tr><td colspan="9" class="text-center">Belum ada data insentif</td></tr>';
  else items.forEach(p=>{const grade=p.kpiScore>=90?'A':p.kpiScore>=80?'B':p.kpiScore>=70?'C':'D';h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.departemen||'-')}</td><td>${formatCurrency(p.gajiPokok||0)}</td><td>${p.kpiScore||0}</td><td><span class="badge badge-${grade==='A'?'success':grade==='B'?'info':grade==='C'?'warning':'danger'}">${grade}</span></td><td>${p.persen||0}%</td><td class="fw-700">${formatCurrency(p.nominal||0)}</td><td>${escHtml(p.periode||'-')}</td><td><button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_insentif','${p.id}','insentif')">🗑️</button></td></tr>`;});
  document.getElementById('tblInsentif').innerHTML=h;
}

async function modalInsentif(){
  const kSnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  let opts='<option value="">-- Pilih --</option>';kSnap.forEach(d=>{const k=d.data();opts+=`<option value="${escHtml(k.nama)}" data-gaji="${k.gajiPokok||0}" data-dept="${escHtml(k.departemen||'')}">${escHtml(k.nama)} — ${escHtml(k.departemen||'')} (${formatCurrency(k.gajiPokok||0)})</option>`;});
  openModal(`<div class="modal-title">Tambah Insentif Manual</div>
    <div class="form-group"><label>Karyawan</label><select class="form-control" id="insKary" onchange="onInsKaryChange()">${opts}</select></div>
    <div class="grid-2"><div class="form-group"><label>KPI Score</label><input class="form-control" type="number" id="insKPI" value="0" oninput="calcInsentif()"></div><div class="form-group"><label>Periode</label><input class="form-control" id="insPeriode" value="${monthStr()}"></div></div>
    <div class="grid-2"><div class="form-group"><label>% Insentif (auto)</label><input class="form-control" id="insPersen" readonly></div><div class="form-group"><label>Nominal (auto)</label><input class="form-control" id="insNominal" readonly style="font-weight:700"></div></div>
    <button class="btn btn-primary" onclick="simpanInsentif()">Simpan</button>`);
}
function onInsKaryChange(){const sel=document.getElementById('insKary');const opt=sel.options[sel.selectedIndex];window._insGaji=Number(opt?.dataset?.gaji)||0;window._insDept=opt?.dataset?.dept||'';calcInsentif();}
function calcInsentif(){const kpi=Number(document.getElementById('insKPI').value)||0;let pct=0;if(kpi>=90)pct=15;else if(kpi>=80)pct=10;else if(kpi>=70)pct=5;const nominal=Math.round((window._insGaji||0)*pct/100);document.getElementById('insPersen').value=pct+'%';document.getElementById('insNominal').value=formatCurrency(nominal);window._insCalc={pct,nominal};}
async function simpanInsentif(){const nama=document.getElementById('insKary').value;if(!nama)return toast('Pilih karyawan','warning');await db.collection('hrd_insentif').add({nama,departemen:window._insDept||'',gajiPokok:window._insGaji||0,kpiScore:Number(document.getElementById('insKPI').value)||0,persen:window._insCalc?.pct||0,nominal:window._insCalc?.nominal||0,periode:document.getElementById('insPeriode').value,createdAt:new Date().toISOString()});closeModalDirect();toast('Insentif disimpan','success');renderInsentif();}

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

// ── PERATURAN PERUSAHAAN ──────────────────────────────────────
const PERATURAN_PERUSAHAAN={nama:'LPK IJEF CORP',versi:'2026',bab:[{nomor:'VIII',judul:'PENINGKATAN KETERAMPILAN KARYAWAN',pasal:[{nomor:34,judul:'Pelatihan dan Pendidikan Karyawan',isi:['Untuk meningkatkan kemampuan karyawan serta memenuhi kebutuhan perusahaan akan tenaga terampil, perusahaan sewaktu-waktu dapat mengadakan pelatihan yang dibiayai perusahaan.','Penentuan sifat/jenis pelatihan, tempat serta jangka waktunya diatur berdasarkan kebijakan perusahaan.']}]},{nomor:'IX',judul:'TATA TERTIB KERJA',pasal:[{nomor:35,judul:'Pencatatan Kehadiran Kerja',isi:['Setiap karyawan wajib hadir pada waktu kerja dan mendata kehadiran dengan alat pencatat waktu pada saat masuk dan pulang kerja. Estimasi keterlambatan 10 menit.','Pengisian data kehadiran harus dilakukan sendiri oleh karyawan.','Pengisian oleh orang lain merupakan pelanggaran dan dikenakan sanksi kedua pihak.','Karyawan terlambat merupakan pelanggaran disiplin kerja.']},{nomor:36,judul:'Tanda Pengenal (ID Card)',isi:['Setiap karyawan diberikan tanda pengenal sebagai inventaris perusahaan.','Wajib dipakai selama di lingkungan perusahaan.']},{nomor:37,judul:'Kewajiban Karyawan',isi:['Memberikan keterangan sebenarnya mengenai pekerjaan.','Melaksanakan pekerjaan sebaik-baiknya dan penuh tanggung jawab.','Melaksanakan perintah/instruksi atasan.','Menjaga kultur kerja kondusif.','Menyimpan dokumen/informasi rahasia perusahaan.','Menjaga kesopanan dan norma pergaulan.','Memelihara kebersihan lingkungan kerja.','Menjaga keamanan barang milik perusahaan.','Menghormati sesama karyawan dan pimpinan.','Melaporkan perubahan data pribadi ke HRD.']},{nomor:38,judul:'Tindakan Disiplin',isi:['Pelanggaran dikenakan sanksi sesuai bobot.','Sanksi: Peringatan lisan; SP I, SP II, SP III (berlaku 6 bulan).','SP tidak selalu berurutan sesuai bobot pelanggaran.','Skorsing: karena hukuman atau menuju PHK, max 6 bulan.','Pekerja skorsing: tidak berhak kenaikan gaji, bonus 50%, tidak berhak promosi 1 tahun.']},{nomor:39,judul:'Pelanggaran Tata Tertib',sub:[{label:'A. SP I:',items:['Terlambat 3x sebulan','Mangkir 2 hari','Menyuruh orang lain absen','Meninggalkan kerja tanpa izin','Tidur saat jam kerja','Tidak memakai pakaian kerja','Perbuatan bertentangan norma sosial']},{label:'B. SP II:',items:['Pelanggaran saat masa SP I','Terlambat 5x berturut/10x sebulan','Mangkir 3 hari berturut/5 hari sebulan','Tidak melaksanakan petunjuk atasan','Bekerja tidak sesuai SOP','Mengambil keputusan di luar wewenang']},{label:'C. SP III:',items:['Pelanggaran saat masa SP II','Terlambat 10x berturut/15x sebulan','Mangkir 4 hari berturut/7 hari sebulan','Menyalahgunakan barang perusahaan','Menolak perintah atasan/mutasi','Tidak mencapai target','Mengganggu ketertiban']}],catatan:'Konsekuensi: penurunan kinerja, penundaan kenaikan upah, demosi, denda, pencabutan fasilitas.'}]},{nomor:'X',judul:'PEMUTUSAN HUBUNGAN KERJA (PHK)',pasal:[{nomor:40,judul:'Umum',isi:['Perusahaan berusaha agar PHK tidak terjadi.','Penyelesaian mengikuti peraturan ketenagakerjaan.','Sebab: pelanggaran, sakit berkepanjangan, tidak capai prestasi, alasan mendesak, pensiun, resign, meninggal, kontrak berakhir.','Hutang dilunasi saat PHK.','Wajib kembalikan inventaris.']},{nomor:42,judul:'PHK Pelanggaran Berat',isi:['Pelanggaran saat SP III.','Penipuan/pencurian/penggelapan.','Menyebarkan fitnah/hoax/konten negatif via medsos.','Mabuk/narkoba di lingkungan perusahaan.','Memalsukan dokumen.','Pelecehan seksual/intimidasi.','Merusak barang perusahaan.','Membocorkan rahasia perusahaan.','Menyalahgunakan jabatan/pungli.']},{nomor:46,judul:'PHK Pensiun',isi:['Pensiun usia 55 tahun.','Pensiun dipercepat usia 45 tahun (SK Direksi).','Dapat dipekerjakan kembali via kontrak khusus.']},{nomor:47,judul:'PHK Lainnya',isi:['Resign: surat 1 bulan sebelumnya + serah terima.','Meninggal: hubungan kerja berakhir otomatis.','Kontrak berakhir: putus saat masa habis.']},{nomor:48,judul:'Uang Pisah',isi:['Untuk karyawan tetap di-PHK karena pelanggaran berat, mangkir 5 hari, atau resign.'],tabel:{headers:['Masa Kerja','Resign','Mangkir','Pelanggaran Berat'],rows:[['< 3 tahun','0','0','0'],['≥ 3 tahun','1× upah','Rp 1.000.000','0']]}}]},{nomor:'XI',judul:'PENUTUP',pasal:[{nomor:49,judul:'Penutup',isi:['Hal belum tercantum diatur kemudian.','Berlaku 2 tahun.','Tetap berlaku sampai peraturan baru disahkan.','Diumumkan kepada seluruh karyawan.','Perubahan via SK tersendiri.']}]}]};

function renderPeraturanHTML(compact){let h='';PERATURAN_PERUSAHAAN.bab.forEach(bab=>{h+=`<div style="margin-bottom:${compact?'16px':'24px'}"><div style="background:#1a237e;color:white;padding:${compact?'8px 14px':'10px 18px'};border-radius:8px;font-weight:700;font-size:${compact?'0.88rem':'0.95rem'};margin-bottom:12px">BAB ${bab.nomor}: ${bab.judul}</div>`;bab.pasal.forEach(pasal=>{h+=`<div style="margin-bottom:12px;padding:12px 16px;background:#f8f9ff;border-radius:8px;border-left:3px solid #1a237e"><div style="font-weight:700;color:#1a237e;margin-bottom:8px;font-size:.9rem">Pasal ${pasal.nomor}: ${pasal.judul}</div>`;if(pasal.isi){h+=`<ol style="padding-left:18px;font-size:0.83rem;line-height:1.8">`;pasal.isi.forEach(i=>{h+=`<li>${escHtml(i)}</li>`;});h+=`</ol>`;}if(pasal.sub){pasal.sub.forEach(sub=>{h+=`<div style="margin-top:8px"><div style="font-weight:600;font-size:.83rem;margin-bottom:4px">${escHtml(sub.label)}</div><ul style="padding-left:18px;font-size:.82rem;line-height:1.8">`;sub.items.forEach(i=>{h+=`<li>${escHtml(i)}</li>`;});h+=`</ul></div>`;});}if(pasal.catatan)h+=`<div style="margin-top:8px;padding:6px 10px;background:#fff8e1;border-radius:6px;font-size:.8rem;color:#e65100"><b>Catatan:</b> ${escHtml(pasal.catatan)}</div>`;if(pasal.tabel){h+=`<div class="table-wrap" style="margin-top:10px"><table><thead><tr>${pasal.tabel.headers.map(x=>`<th style="font-size:.78rem">${escHtml(x)}</th>`).join('')}</tr></thead><tbody>${pasal.tabel.rows.map(r=>`<tr>${r.map(c=>`<td style="font-size:.8rem">${escHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}h+=`</div>`;});h+=`</div>`;});return h;}

function renderPeraturan(){document.getElementById('mainContent').innerHTML=`<div class="page-title"><span>📜 Peraturan Perusahaan</span><button class="btn btn-outline btn-sm" onclick="window.print()">🖨️ Cetak</button></div><div class="card"><div style="text-align:center;padding:16px 0;border-bottom:2px solid #e8eaf6;margin-bottom:20px"><div style="font-size:1.3rem;font-weight:700;color:#1a237e">${PERATURAN_PERUSAHAAN.nama}</div><div style="color:#888;font-size:.85rem">Peraturan Perusahaan — Versi ${PERATURAN_PERUSAHAAN.versi}</div></div>${renderPeraturanHTML(false)}</div>`;}

// ── GENERATOR SURAT ───────────────────────────────────────────
async function renderSurat(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>✉️ Generator Surat</span><button class="btn btn-primary btn-sm" onclick="modalSurat()">+ Generate</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Nomor</th><th>Jenis</th><th>Perihal</th><th>Tanggal</th></tr></thead><tbody id="tblSurat"></tbody></table></div></div>`;const snap=await db.collection('hrd_surat').get();let h='';if(snap.empty)h='<tr><td colspan="4" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();h+=`<tr><td class="fw-700">${escHtml(p.nomor)}</td><td>${escHtml(p.jenis)}</td><td>${escHtml(p.perihal)}</td><td>${formatDate(p.tanggal)}</td></tr>`;});document.getElementById('tblSurat').innerHTML=h;}
async function modalSurat(){const snap=await db.collection('hrd_surat').get();const seq=String(snap.size+1).padStart(3,'0');const now=new Date();const mo=String(now.getMonth()+1).padStart(2,'0');openModal(`<div class="modal-title">Generate Nomor Surat</div><div class="form-group"><label>Jenis</label><select class="form-control" id="srJenis"><option value="SK">SK</option><option value="SP">SP</option><option value="SPK">SPK</option><option value="SR">Referensi</option><option value="SKet">Keterangan</option></select></div><div class="form-group"><label>Perihal</label><input class="form-control" id="srPerihal"></div><div class="form-group"><label>Preview</label><input class="form-control" readonly value="${seq}/[JENIS]/IJEF/${mo}/${now.getFullYear()}" id="srPreview"></div><button class="btn btn-primary" onclick="simpanSurat('${seq}','${mo}','${now.getFullYear()}')">Generate</button>`);}
async function simpanSurat(seq,mo,yr){const jenis=document.getElementById('srJenis').value;const nomor=`${seq}/${jenis}/IJEF/${mo}/${yr}`;await db.collection('hrd_surat').add({nomor,jenis,perihal:document.getElementById('srPerihal').value,tanggal:todayStr(),dibuatOleh:currentUser.nama,createdAt:new Date().toISOString()});closeModalDirect();toast('Nomor surat digenerate','success');renderSurat();}

// ── PORTAL KARYAWAN ───────────────────────────────────────────
async function renderPortal(){const main=document.getElementById('mainContent');const u=currentUser;main.innerHTML=`<div class="page-title"><span>🏠 Portal Saya</span></div><div class="card" style="border-left:4px solid var(--primary)"><div class="flex gap-16" style="align-items:center"><div style="width:60px;height:60px;font-size:1.5rem;background:var(--primary);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center">${u.nama.charAt(0)}</div><div><div class="fw-700" style="font-size:1.1rem">${escHtml(u.nama)}</div><div class="text-sm" style="color:#999">${escHtml(u.departemen||'-')} • ${escHtml(u.role)}</div><div class="text-xs" style="color:#999">NIP: ${escHtml(u.nip||'-')}</div></div></div></div><div class="stats-grid"><div class="stat-card" style="cursor:pointer" onclick="navigateTo('portal-absensi')"><div class="stat-icon">📍</div><div class="stat-value" id="pAbsen">-</div><div class="stat-label">Kehadiran Bulan Ini</div></div><div class="stat-card" style="cursor:pointer" onclick="navigateTo('portal-cuti')"><div class="stat-icon">🏖️</div><div class="stat-value" id="pCuti">-</div><div class="stat-label">Sisa Cuti</div></div><div class="stat-card" style="cursor:pointer" onclick="navigateTo('inbox')"><div class="stat-icon">📥</div><div class="stat-value" id="pInbox">-</div><div class="stat-label">Inbox Meeting</div></div></div><div class="card"><div class="card-title">📢 Pengumuman</div><div id="portalAnnounce">Loading...</div></div><div class="card"><div class="card-title">📲 Download / Install Aplikasi</div><p class="text-sm mb-8" style="color:#666">Install aplikasi ini di perangkat Anda untuk akses lebih cepat.</p>${renderDownloadAppSection()}</div>`;
  const[absenSnap,cutiSnap,inboxSnap,pgSnap]=await Promise.all([db.collection('hrd_absensi').where('userId','==',u.id).where('tanggal','>=',monthStr()+'-01').get(),db.collection('hrd_cuti').where('userId','==',u.id).where('status','==','approved').get(),db.collection('hrd_meeting_invites').where('targetUser','==',u.id).where('read','==',false).get(),db.collection('hrd_pengumuman').get()]);
  document.getElementById('pAbsen').textContent=absenSnap.size+' hari';
  document.getElementById('pCuti').textContent=Math.max(0,12-cutiSnap.size)+' hari';
  document.getElementById('pInbox').textContent=inboxSnap.size;
  let pgH='';if(pgSnap.empty)pgH='<p class="text-sm" style="color:#999">Belum ada</p>';else pgSnap.forEach(d=>{const p=d.data();pgH+=`<div style="padding:8px 0;border-bottom:1px solid var(--border)"><div class="fw-700 text-sm">${escHtml(p.judul)}</div><div class="text-xs" style="color:#999">${formatDate(p.createdAt)}</div></div>`;});document.getElementById('portalAnnounce').innerHTML=pgH;
}
function renderPortalAbsensi(){navigateTo('absensi');}
async function renderPortalCuti(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>🏖️ Cuti Saya</span><button class="btn btn-primary btn-sm" onclick="modalCuti()">+ Ajukan</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Jenis</th><th>Tanggal</th><th>Durasi</th><th>Status</th></tr></thead><tbody id="tblPortalCuti"></tbody></table></div></div>`;const snap=await db.collection('hrd_cuti').where('userId','==',currentUser.id).get();let h='';if(snap.empty)h='<tr><td colspan="4" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();h+=`<tr><td>${escHtml(p.jenis)}</td><td>${formatDate(p.mulai)}-${formatDate(p.selesai)}</td><td>${p.durasi}h</td><td><span class="badge badge-${p.status==='approved'?'success':p.status==='rejected'?'danger':'warning'}">${p.status}</span></td></tr>`;});document.getElementById('tblPortalCuti').innerHTML=h;}
async function renderPortalGaji(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>💰 Slip Gaji Saya</span></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Periode</th><th>Gaji Pokok</th><th>Total</th><th>Aksi</th></tr></thead><tbody id="tblPortalGaji"></tbody></table></div></div>`;const snap=await db.collection('hrd_penggajian').where('nama','==',currentUser.nama).get();let h='';if(snap.empty)h='<tr><td colspan="4" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();h+=`<tr><td>${p.periode}</td><td>${formatCurrency(p.gajiPokok)}</td><td class="fw-700">${formatCurrency(p.totalBersih)}</td><td><button class="btn btn-xs btn-info" onclick="lihatSlip('${d.id}')">📄</button></td></tr>`;});document.getElementById('tblPortalGaji').innerHTML=h;}
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
function renderPortalPeraturan(){document.getElementById('mainContent').innerHTML=`<div class="page-title"><span>📜 Peraturan Perusahaan</span></div><div class="card">${renderPeraturanHTML(true)}</div>`;}

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


// ── DISC TEST PAGE (Admin/HR view with View, Edit, Delete, Sync KPI) ──────────
function renderDiscTestPage(){
  const main=document.getElementById('mainContent');
  main.innerHTML=`
  <div class="page-title"><span>🧠 DISC Personality Test</span></div>
  <div class="card">
    <div class="card-header"><div class="card-title">Tes Kepribadian DISC</div>
      <div class="flex gap-8">
        <a href="disc-test.html" target="_blank" class="btn btn-primary btn-sm">🔗 Link Tes (Calon Karyawan)</a>
        <button class="btn btn-warning btn-sm" onclick="modalDiscEvalKaryawan()">📊 Evaluasi Karyawan (Pilih)</button>
      </div>
    </div>
    <div style="background:#e3f2fd;border-radius:8px;padding:14px;margin-bottom:16px;border-left:4px solid var(--info)">
      <p class="text-sm" style="line-height:1.6"><strong>DISC</strong> = Dominance, Influence, Steadiness, Compliance.<br>
      • <strong>Calon Karyawan:</strong> Bagikan link tes kepada kandidat saat rekrutmen<br>
      • <strong>Evaluasi Periodik:</strong> Pilih karyawan dari database, data otomatis terisi<br>
      • <strong>Portal Karyawan:</strong> Karyawan aktif bisa tes langsung dari portal masing-masing<br>
      • <strong>Sinkron KPI:</strong> Hasil DISC bisa disinkronkan ke data KPI karyawan</p>
    </div>
  </div>
  <div class="card"><div class="card-header"><div class="card-title">📋 Riwayat Hasil Tes</div><div class="flex gap-8"><button class="btn btn-success btn-sm" onclick="syncAllDiscToKPI()">🔄 Sinkron Semua ke KPI</button><button class="btn btn-danger btn-sm" onclick="hapusSemuaDiscResults()">🗑️ Hapus Semua Riwayat</button></div></div>
    <div class="flex gap-8 mb-16"><input class="form-control" placeholder="Cari nama..." id="dSrc" oninput="fltDisc()" style="max-width:250px"><select class="form-control" id="dFlt" onchange="fltDisc()" style="max-width:180px"><option value="">Semua</option><option value="calon">Calon</option><option value="evaluasi">Evaluasi</option></select></div>
    <div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Nama</th><th>Mode</th><th>Posisi</th><th>Tipe</th><th>Profil</th><th>Aksi</th></tr></thead><tbody id="dTbl"><tr><td colspan="7" class="text-center">Memuat...</td></tr></tbody></table></div>
  </div>`;
  loadDiscHist();
}

async function modalDiscEvalKaryawan(){
  const snap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  let opts='<option value="">-- Pilih Karyawan --</option>';
  snap.forEach(d=>{const p=d.data();opts+=`<option value="${d.id}" data-nama="${escHtml(p.nama)}" data-nip="${escHtml(p.nip||'')}" data-dept="${escHtml(p.departemen||'')}" data-pos="${escHtml(p.posisi||'')}">${escHtml(p.nama)} — ${escHtml(p.departemen||'')} (${escHtml(p.nip||'')})</option>`;});
  openModal(`<div class="modal-title">📊 Evaluasi DISC — Pilih Karyawan</div>
    <div class="form-group"><label>Karyawan</label><select class="form-control" id="discEvalSelect" onchange="onDiscEvalSelect()">${opts}</select></div>
    <div id="discEvalInfo" style="display:none;background:#f8f9ff;border-radius:8px;padding:12px;margin-bottom:16px">
      <div class="grid-2" style="font-size:.82rem"><div><strong>Nama:</strong> <span id="deNama">-</span></div><div><strong>NIP:</strong> <span id="deNip">-</span></div><div><strong>Departemen:</strong> <span id="deDept">-</span></div><div><strong>Posisi:</strong> <span id="dePos">-</span></div></div>
    </div>
    <div class="form-group"><label>Periode Evaluasi</label><input class="form-control" id="discEvalPeriode" placeholder="Contoh: Q1 2026, Semester 1 2026"></div>
    <button class="btn btn-primary" onclick="startDiscEvalForKaryawan()">Mulai Tes DISC →</button>`,true);
}

function onDiscEvalSelect(){
  const sel=document.getElementById('discEvalSelect');
  const opt=sel.options[sel.selectedIndex];
  if(!sel.value){document.getElementById('discEvalInfo').style.display='none';return;}
  document.getElementById('discEvalInfo').style.display='block';
  document.getElementById('deNama').textContent=opt.dataset.nama;
  document.getElementById('deNip').textContent=opt.dataset.nip;
  document.getElementById('deDept').textContent=opt.dataset.dept;
  document.getElementById('dePos').textContent=opt.dataset.pos;
}

function startDiscEvalForKaryawan(){
  const sel=document.getElementById('discEvalSelect');
  const opt=sel.options[sel.selectedIndex];
  if(!sel.value)return toast('Pilih karyawan dulu','warning');
  const periode=document.getElementById('discEvalPeriode').value||'';
  const params=new URLSearchParams({nama:opt.dataset.nama,nip:opt.dataset.nip,dept:opt.dataset.dept,pos:opt.dataset.pos,periode,mode:'evaluasi'});
  closeModalDirect();
  window.open('disc-test.html#evaluasi?'+params.toString(),'_blank');
}

async function loadDiscHist(){const snap=await db.collection('hrd_disc_results').get();window._dData=[];snap.forEach(d=>window._dData.push({id:d.id,...d.data()}));fltDisc();}
function fltDisc(){
  const q=(document.getElementById('dSrc')?.value||'').toLowerCase(),m=document.getElementById('dFlt')?.value||'';
  const data=(window._dData||[]).filter(r=>{if(q&&!r.nama?.toLowerCase().includes(q))return false;if(m&&r.mode!==m)return false;return true;});
  let h='';if(!data.length)h='<tr><td colspan="7" class="text-center" style="color:var(--text-light)">Belum ada data</td></tr>';
  else data.forEach(r=>{const dt=r.createdAt?new Date(r.createdAt).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'-';const badge=r.mode==='evaluasi'?'<span class="badge badge-warning">Evaluasi</span>':'<span class="badge badge-info">Calon</span>';
    h+=`<tr><td>${dt}</td><td class="fw-700">${escHtml(r.nama)}</td><td>${badge}</td><td>${escHtml(r.posisi||'-')}</td><td class="fw-700" style="color:var(--primary)">${escHtml(r.pattern||'-')}</td><td>${escHtml(r.profileName||'-')}</td><td><button class="btn btn-xs btn-info" onclick="viewDiscResult('${r.id}')">👁️</button> <button class="btn btn-xs btn-warning" onclick="editDiscResult('${r.id}')">✏️</button> <button class="btn btn-xs btn-success" onclick="syncDiscToKPI('${r.id}')">📈</button> <button class="btn btn-xs btn-danger" onclick="deleteDiscResult('${r.id}')">🗑️</button></td></tr>`;
  });
  document.getElementById('dTbl').innerHTML=h;
}

async function viewDiscResult(id){
  const doc=await db.collection('hrd_disc_results').doc(id).get();if(!doc.exists)return toast('Data tidak ditemukan','error');
  const r=doc.data();const s1=r.seg1||{D:0,I:0,S:0,C:0};const s2=r.seg2||{D:0,I:0,S:0,C:0};const s3=r.seg3||{D:0,I:0,S:0,C:0};
  function bG(data,title,sub){const vals=['D','I','S','C'].map(t=>data[t]||0);const h=120;const toY=v=>h/2-((v/8)*(h/2));let dots='';vals.forEach((v,i)=>{dots+=`<circle cx="${15+i*40}" cy="${toY(v)}" r="3" fill="#1a237e"/><text x="${15+i*40}" y="${toY(v)-8}" text-anchor="middle" font-size="7" font-weight="700" fill="${v>=0?'#2e7d32':'#c62828'}">${v>0?'+':''}${typeof v==='number'?v.toFixed(1):v}</text>`;});const pts=vals.map((v,i)=>`${15+i*40},${toY(v)}`).join(' ');return`<div style="text-align:center;flex:1;min-width:150px"><div style="font-size:.63rem;font-weight:700;color:var(--primary)">${title}</div><div style="font-size:.55rem;color:#999">${sub}</div><svg width="155" height="${h+18}" viewBox="0 0 155 ${h+18}" style="border:1px solid #ddd;border-radius:4px;background:#fafafa"><line x1="5" y1="${h/2}" x2="150" y2="${h/2}" stroke="#999" stroke-width="0.5" stroke-dasharray="2"/><polyline points="${pts}" fill="none" stroke="#1a237e" stroke-width="1.5"/>${dots}<text x="15" y="${h+12}" text-anchor="middle" font-size="8" font-weight="700">D</text><text x="55" y="${h+12}" text-anchor="middle" font-size="8" font-weight="700">I</text><text x="95" y="${h+12}" text-anchor="middle" font-size="8" font-weight="700">S</text><text x="135" y="${h+12}" text-anchor="middle" font-size="8" font-weight="700">C</text></svg></div>`;}
  const graphs=bG(s1,'GRAPH 1 MOST','Mask Public Self')+bG(s2,'GRAPH 2 LEAST','Core Private Self')+bG(s3,'GRAPH 3 CHANGE','Mirror Perceived Self');
  const dt=r.createdAt?new Date(r.createdAt).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}):'-';
  const dProf={'D':{pos:['Individualis','High Motivation','Efektif','Percaya Diri','Kreatif','Leader'],neg:['Ego Tinggi','Kurang Sensitif','Agresif','Terlalu Dominan'],career:'Attorney, Sales Representative, Production Director, Strategic Planning, Self-Employment.'},'I':{pos:['Antusias','Optimis','Persuasif','Ramah','Inspirasional'],neg:['Emosional','Impulsif','Kurang fokus','Tidak terorganisir'],career:'Public Relations, Lecturing, Advertising, Hospitality, Human Resources.'},'S':{pos:['Stabil','Sabar','Loyal','Pendengar baik','Dapat diandalkan'],neg:['Anti Perubahan','Sulit Adaptasi','Menghindari Konflik','Lambat Memutuskan'],career:'Administrative Work, Accounting, Research, Retail, Service.'},'C':{pos:['Detail','Analitis','Rapi','Organized','Sistematis'],neg:['Pendiam','Anti Kritik','Kaku','Terlalu Detail'],career:'Planner, Engineer, IT Management, Quality Controller, Accountant.'},'D-I':{pos:['Pekerja Keras','Leader','Tegas','Logis'],neg:['Cepat Bosan','Dingin','Anti Aturan'],career:'General Management, Sales Management, Marketing, Consultancy.'},'D-S':{pos:['Objektif','Analitis','Mandiri','Stabil','Ulet'],neg:['Menghindari Konflik','Kurang fleksibel'],career:'Project Management, Researcher, Systems Analyst, IT.'},'D-C':{pos:['Tekun','Sensitif','Keputusan kuat','Kreatif'],neg:['Perfeksionis','Lambat keputusan'],career:'Engineering, Planning, Accountancy, Quality Control.'},'I-S':{pos:['Hangat','Simpati','Tenang','Pendengar baik','Toleran','Penjaga damai'],neg:['Kurang tegas','Terlalu toleran','Sulit membuat keputusan'],career:'Personnel, Training, Psychologist, Nursing, Social Work.'},'S-I':{pos:['Hangat','Simpati','Pendengar baik','Toleran','Penjaga damai','Moderat'],neg:['Kurang tegas','Terlalu toleran','Sulit membuat keputusan'],career:'Personnel, Training, Hotelier, Travel Agent, Psychologist, Nurse.'},'I-C':{pos:['Ramah','Suka berteman','Dapat mengendalikan diri','Perfeksionis alamiah'],neg:['Kadang salah menilai','Terlalu optimis'],career:'Teaching, Training, Specialist Selling, Marketing.'},'S-C':{pos:['Detail','Empati','Loyal','Teliti','Peduli'],neg:['Anti Kritik','Sulit Adaptasi','Introvert'],career:'Office Manager, Planner, Accountant, Health Care.'},'C-D':{pos:['Sensitif','Berorientasi tugas','Kukuh','Efektif'],neg:['Dingin','Menjaga jarak','Tidak mudah percaya'],career:'Engineering, Research, Planning, Accountancy.'},'C-S':{pos:['Detail','Sistematik','Bijaksana','Diplomatis'],neg:['Menghindari Konflik','Lambat Memutuskan','Anti Perubahan'],career:'Researcher, Engineer, IT Management, Planner.'}};
  function gPD(pat){if(dProf[pat])return dProf[pat];const p=pat?pat.split('-'):[];if(p.length>=2&&dProf[p[0]+'-'+p[1]])return dProf[p[0]+'-'+p[1]];if(dProf[p[0]])return dProf[p[0]];return{pos:[],neg:[],career:''};}
  const pD=gPD(r.pattern||'');const posT=r.positiveTraits&&r.positiveTraits.length?r.positiveTraits:pD.pos;const negT=r.negativeTraits&&r.negativeTraits.length?r.negativeTraits:pD.neg;const career=r.career||pD.career;
  let posH='',negH='',maskT='',coreT='',mirrorT='';
  posT.forEach(t=>{posH+=`<div style="padding:2px 0;font-size:.73rem;color:#2e7d32">✅ ${escHtml(t)}</div>`;maskT+=`<div style="font-size:.7rem">${escHtml(t)}</div>`;});
  negT.forEach(t=>{negH+=`<div style="padding:2px 0;font-size:.73rem;color:#c62828">⚠️ ${escHtml(t)}</div>`;coreT+=`<div style="font-size:.7rem">${escHtml(t)}</div>`;});
  [...posT,...negT].forEach(t=>{mirrorT+=`<div style="font-size:.7rem">${escHtml(t)}</div>`;});
  const dn={D:'Dominance',I:'Influence',S:'Steadiness',C:'Compliance'};const dd={D:'berorientasi pada hasil, suka tantangan, tegas, dan mandiri',I:'ramah, optimis, persuasif, dan suka bersosialisasi',S:'sabar, loyal, konsisten, dan kooperatif',C:'perfeksionis, detail, analitis, dan terorganisir'};const ddL={D:'pendiam, menghindari konfrontasi',I:'dingin, menjaga jarak, kurang percaya orang lain',S:'tidak sabar, suka perubahan',C:'spontan, fleksibel, kurang mengikuti aturan'};
  const sorted=Object.entries(s3).sort((a,b)=>b[1]-a[1]);const dom=sorted.filter(([_,v])=>v>0);const weak=sorted.filter(([_,v])=>v<0);
  let kes=`Berdasarkan hasil tes, <b>${escHtml(r.nama)}</b> memiliki profil kepribadian dominan <b>${escHtml(r.pattern||'-')}</b>. Ini berarti ia adalah seorang <b>${escHtml(r.profileName||'-')}</b>.<br><br>`;
  kes+=`<b>1. Profil Konsisten</b><br>Ketiga grafik menunjukkan pola serupa. Ini menandakan bahwa ia adalah <b>pribadi yang otentik dan apa adanya</b>. Cara ia menampilkan diri ke publik sama dengan karakter aslinya.<br><br>`;
  kes+=`<b>2. Karakter Utama: "${escHtml(r.profileName||'-')}"</b><br>Profilnya adalah gabungan dari tipe yang kuat:<br>`;
  dom.forEach(([t])=>{kes+=`<b>Sisi ${t} (${dn[t]}) yang tinggi:</b> Ini membuatnya menjadi pribadi yang <b>${dd[t]}</b>.<br>`;});
  weak.forEach(([t])=>{kes+=`<b>Sisi ${t} (${dn[t]}) yang rendah:</b> Ini menjelaskan mengapa ia cenderung <b>${ddL[t]}</b>.<br>`;});
  kes+=`<br><b>Kesimpulan Karakter</b><br>Secara keseluruhan, ${escHtml(r.nama)} adalah seorang "<b>${escHtml(r.profileName||'-')}</b>".<br><b>Kekuatan:</b> ${posT.join(', ')}.<br><b>Potensi Tantangan:</b> ${negT.join(', ')}.`;
  const descMap={'D':'Memiliki rasa ego yang tinggi dan cenderung individualis dengan standard yang sangat tinggi. Mampu memimpin situasi dan orang lain dalam rangka mencapai sasarannya. Ia menghindari sesuatu yang biasa-biasa dan cenderung mencari tantangan baru.','I':'Merupakan seorang yang antusias dan optimistik, ia lebih suka mencapai sasarannya melalui orang lain. Sangat menonjol dalam keterampilan berkomunikasi. Memiliki kemampuan untuk memotivasi dan memberi semangat.','S':'Merupakan individu konsisten yang berusaha menjaga lingkungan yang tidak berubah. Sabar, loyal dan suka menolong. Sangat baik bekerja dengan petunjuk dan peraturan yang jelas.','C':'Seorang yang praktis, cakap dan unik. Menyukai hal yang detil dan logis; secara alamiah sangat analitis. Hati-hati dalam membuat keputusan berdasarkan logika, bukan emosi.','D-I':'Tidak basa-basi dan tegas, berpandangan jauh ke depan, progresif dan mau berkompetisi. Mempunyai kemampuan memimpin yang baik dan minat dengan cakupan yang luas.','D-S':'Seorang yang obyektif dan analitis. Ingin terlibat dalam situasi dan memberikan bantuan. Termotivasi oleh target pribadi, ulet dalam memulai pekerjaan.','D-C':'Sensitif terhadap permasalahan, memiliki kreativitas baik dalam memecahkan masalah. Dapat menyelesaikan tugas penting dalam waktu singkat.','I-S':'Mengesankan orang akan kehangatan, simpati dan pengertiannya. Memiliki ketenangan dalam situasi sosial. Merupakan pendengar yang baik dan penjaga damai.','S-I':'Mengesankan orang akan kehangatan dan simpati. Penjaga damai yang sebenarnya dan akan bekerja untuk menjaga kedamaian dalam setiap keadaan.','I-C':'Ramah dan suka berteman; merasa nyaman walaupun dengan orang asing. Perfeksionis secara alamiah.','S-C':'Orang yang baik secara alamiah dan sangat berorientasi detil. Peduli dan teliti dalam penyelesaian tugas.','C-D':'Sangat berorientasi pada tugas dan sensitif pada permasalahan. Kukuh dan mempunyai pendekatan efektif dalam pemecahan masalah. Membuat keputusan berdasar fakta.','C-S':'Berpikir sistematis dan mengikuti prosedur. Teratur, teliti dan fokus pada detil. Sangat berhati-hati, mengharapkan akurasi dan standard tinggi.'};
  function gDesc(p){if(descMap[p])return descMap[p];const x=p?p.split('-'):[];if(x.length>=2&&descMap[x[0]+'-'+x[1]])return descMap[x[0]+'-'+x[1]];return descMap[x[0]]||'';}
  const kpiScore=r.kpiScore||70;const kpiGrade=kpiScore>=90?'A':kpiScore>=80?'B':kpiScore>=70?'C':kpiScore>=60?'D':'E';
  openModal(`<div class="modal-title">📊 D.I.S.C. Personality System Graph Page</div>
    <div style="font-size:.78rem;margin-bottom:8px;background:#f8f9ff;padding:10px;border-radius:8px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:3px"><div><b>Name:</b> ${escHtml(r.nama)}</div><div><b>Tanggal:</b> ${dt}</div><div><b>Mode:</b> ${r.mode==='evaluasi'?'Evaluasi':'Calon'}</div><div><b>Posisi:</b> ${escHtml(r.posisi||'-')}</div>${r.departemen?`<div><b>Dept:</b> ${escHtml(r.departemen)}</div>`:''}${r.evaluasiPeriode?`<div><b>Periode:</b> ${escHtml(r.evaluasiPeriode)}</div>`:''}<div><b>KPI:</b> <span class="badge badge-${kpiScore>=80?'success':kpiScore>=60?'warning':'danger'}">${kpiScore} (${kpiGrade})</span></div></div></div>
    <div style="text-align:center;margin-bottom:8px"><span style="display:inline-block;padding:5px 14px;background:linear-gradient(135deg,var(--primary),#283593);color:#fff;border-radius:14px;font-weight:700;font-size:.85rem">${escHtml(r.profileName||'-')} (${escHtml(r.pattern||'-')})</span></div>
    <div style="overflow-x:auto;margin-bottom:8px"><table style="width:auto;margin:0 auto;border-collapse:collapse;font-size:.7rem"><thead><tr style="background:var(--primary);color:#fff"><th style="padding:3px 7px">Line</th><th style="padding:3px 7px">D</th><th style="padding:3px 7px">I</th><th style="padding:3px 7px">S</th><th style="padding:3px 7px">C</th><th style="padding:3px 7px">tot</th></tr></thead><tbody><tr><td style="padding:3px 7px;border:1px solid #ddd;font-weight:700">1(P)</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawP?.D||0}</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawP?.I||0}</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawP?.S||0}</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawP?.C||0}</td><td style="padding:3px 7px;border:1px solid #ddd;color:red">24</td></tr><tr><td style="padding:3px 7px;border:1px solid #ddd;font-weight:700">2(K)</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawK?.D||0}</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawK?.I||0}</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawK?.S||0}</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawK?.C||0}</td><td style="padding:3px 7px;border:1px solid #ddd;color:red">24</td></tr><tr><td style="padding:3px 7px;border:1px solid #ddd;font-weight:700">3</td><td style="padding:3px 7px;border:1px solid #ddd">${typeof s3.D==='number'?s3.D.toFixed(1):s3.D}</td><td style="padding:3px 7px;border:1px solid #ddd">${typeof s3.I==='number'?s3.I.toFixed(1):s3.I}</td><td style="padding:3px 7px;border:1px solid #ddd">${typeof s3.S==='number'?s3.S.toFixed(1):s3.S}</td><td style="padding:3px 7px;border:1px solid #ddd">${typeof s3.C==='number'?s3.C.toFixed(1):s3.C}</td><td style="padding:3px 7px;border:1px solid #ddd"></td></tr></tbody></table></div>
    <div style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap">${graphs}</div>
    <div style="margin-bottom:10px"><div style="font-size:.75rem;font-weight:700;color:var(--primary);text-align:center;margin-bottom:6px">Gambaran Karakter</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><div><div style="font-size:.65rem;font-weight:700;text-decoration:underline;margin-bottom:3px">Mask Public Self</div><div style="font-size:.68rem;font-weight:700;color:var(--primary)">${escHtml(r.profileName||'-')}</div>${maskT}</div><div><div style="font-size:.65rem;font-weight:700;text-decoration:underline;margin-bottom:3px">Core Private Self</div><div style="font-size:.68rem;font-weight:700;color:var(--primary)">${escHtml(r.profileName||'-')}</div>${coreT}</div><div><div style="font-size:.65rem;font-weight:700;text-decoration:underline;margin-bottom:3px">Mirror Perceived Self</div><div style="font-size:.68rem;font-weight:700;color:var(--primary)">${escHtml(r.profileName||'-')}</div>${mirrorT}</div></div></div>
    <div style="background:#f8f9ff;border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:10px;font-size:.76rem;line-height:1.6"><b>📝 Deskripsi Kepribadian:</b><br>${escHtml(gDesc(r.pattern||''))}</div>
    <div style="border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:10px;font-size:.76rem;line-height:1.7"><b>🔍 Analisis & Kesimpulan Karakter:</b><br><br>${kes}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px"><div style="background:#e8f5e9;border-radius:6px;padding:8px"><div style="font-size:.7rem;font-weight:700;color:#2e7d32;margin-bottom:3px">✅ Sifat Positif</div>${posH||'-'}</div><div style="background:#ffebee;border-radius:6px;padding:8px"><div style="font-size:.7rem;font-weight:700;color:#c62828;margin-bottom:3px">⚠️ Sifat Negatif</div>${negH||'-'}</div></div>
    ${career?`<div style="background:#e8f5e9;border-radius:6px;padding:10px;margin-bottom:10px"><div style="font-size:.72rem;font-weight:700;color:#1b5e20;margin-bottom:6px">💼 Rekomendasi Bidang Pekerjaan yang Cocok</div><div style="font-size:.75rem;color:#2e7d32;line-height:1.6">Melihat profilnya yang kuat dalam ${dom.map(([t])=>dn[t].toLowerCase()).join(' dan ')}, <b>${escHtml(r.nama)}</b> akan sangat unggul dalam pekerjaan yang membutuhkan keahlian mendalam${dom.some(([t])=>t==='D')?', otonomi, dan kepemimpinan':dom.some(([t])=>t==='I')?', komunikasi, dan kerjasama':dom.some(([t])=>t==='S')?', kesabaran, dan konsistensi':', ketelitian, dan analisis'}.<br><br><b>Bidang pekerjaan yang sangat cocok antara lain:</b><br>${escHtml(career)}<br><br>Ia akan berkembang di lingkungan yang menghargai <b>${posT.slice(0,3).join(', ')}</b>. Peran yang kurang cocok untuknya adalah yang membutuhkan ${weak.length>0?ddL[weak[0][0]]:'karakteristik yang berlawanan'}.</div></div>`:''}
    <div style="background:#f8f9ff;border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:10px"><div style="display:flex;align-items:center;gap:12px"><div style="text-align:center;padding:10px 16px;border-radius:8px;border:2px solid ${kpiScore>=80?'var(--success)':'var(--warning)'}"><div style="font-size:1.5rem;font-weight:700;color:${kpiScore>=80?'var(--success)':'var(--warning)'}">${kpiScore}</div><div style="font-size:.65rem">Grade ${kpiGrade}</div></div><div style="font-size:.75rem;line-height:1.6"><b>📈 Dampak KPI</b><br>Kekuatan: ${posT.length} poin (+${Math.min(posT.length*3,20)})<br>Area Pengembangan: ${negT.length} poin (-${Math.min(negT.length*2,15)})</div></div></div>
    <div class="flex gap-8 flex-wrap"><button class="btn btn-success btn-sm" onclick="syncDiscToKPI('${id}');closeModalDirect()">📈 Sinkron ke KPI</button><button class="btn btn-warning btn-sm" onclick="closeModalDirect();editDiscResult('${id}')">✏️ Edit</button><button class="btn btn-primary btn-sm" onclick="printDiscResult()">🖨️ Cetak/Download</button></div>`,true);
}
function getDiscDesc(p){return '';}

function printDiscResult(){
  const modal=document.getElementById('modalContent');if(!modal)return;
  const printWin=window.open('','_blank','width=800,height=900');
  printWin.document.write(`<!DOCTYPE html><html><head><title>Hasil DISC Test - IJEF Corp</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;padding:20px;font-size:12px;color:#333}h1,h2,h3{color:#1a237e}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#1a237e;color:#fff}.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #1a237e;padding-bottom:10px}svg{max-width:100%}.section{margin-bottom:16px;page-break-inside:avoid}.badge{display:inline-block;padding:4px 12px;background:#1a237e;color:#fff;border-radius:12px;font-weight:700}@media print{body{padding:10px}}</style></head><body><div class="header"><h1>D.I.S.C. Personality System</h1><p>LPK IJEF CORP — Human Resource Assessment</p></div>${modal.innerHTML}<script>setTimeout(()=>{window.print();},500)<\/script></body></html>`);
  printWin.document.close();
}



async function editDiscResult(id){
  const doc=await db.collection('hrd_disc_results').doc(id).get();if(!doc.exists)return toast('Data tidak ditemukan','error');
  const r=doc.data();
  openModal(`<div class="modal-title">✏️ Edit Hasil DISC</div>
    <div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="edNama" value="${escHtml(r.nama||'')}"></div><div class="form-group"><label>NIP</label><input class="form-control" id="edNip" value="${escHtml(r.nip||'')}"></div><div class="form-group"><label>Departemen</label><input class="form-control" id="edDept" value="${escHtml(r.departemen||'')}"></div><div class="form-group"><label>Posisi</label><input class="form-control" id="edPos" value="${escHtml(r.posisi||'')}"></div><div class="form-group"><label>Periode</label><input class="form-control" id="edPeriode" value="${escHtml(r.evaluasiPeriode||'')}"></div><div class="form-group"><label>Mode</label><select class="form-control" id="edMode"><option value="calon" ${r.mode==='calon'?'selected':''}>Calon</option><option value="evaluasi" ${r.mode==='evaluasi'?'selected':''}>Evaluasi</option></select></div></div>
    <div class="form-group"><label>Catatan HR</label><textarea class="form-control" id="edNote" placeholder="Catatan tambahan dari HR...">${escHtml(r.catatanHR||'')}</textarea></div>
    <button class="btn btn-primary" onclick="saveEditDisc('${id}')">Simpan Perubahan</button>`,true);
}

async function saveEditDisc(id){
  const data={nama:document.getElementById('edNama').value,nip:document.getElementById('edNip').value,departemen:document.getElementById('edDept').value,posisi:document.getElementById('edPos').value,evaluasiPeriode:document.getElementById('edPeriode').value,mode:document.getElementById('edMode').value,catatanHR:document.getElementById('edNote').value,updatedAt:new Date().toISOString()};
  await db.collection('hrd_disc_results').doc(id).update(data);
  closeModalDirect();toast('Data DISC diperbarui','success');loadDiscHist();
}

async function deleteDiscResult(id){
  if(!confirm('Yakin hapus hasil tes DISC ini?'))return;
  await db.collection('hrd_disc_results').doc(id).delete();
  toast('Hasil tes dihapus','success');loadDiscHist();
}

async function hapusSemuaDiscResults(){
  if(!confirm('⚠️ HAPUS SEMUA riwayat hasil tes DISC? Tindakan ini tidak bisa dibatalkan!'))return;
  if(!confirm('Konfirmasi sekali lagi: Yakin hapus SEMUA data DISC?'))return;
  const snap=await db.collection('hrd_disc_results').get();
  const batch=db.batch();
  snap.forEach(doc=>batch.delete(doc.ref));
  await batch.commit();
  toast(`${snap.size} hasil tes DISC dihapus`,'success');
  loadDiscHist();
}

async function syncDiscToKPI(id){
  const doc=await db.collection('hrd_disc_results').doc(id).get();if(!doc.exists)return toast('Data tidak ditemukan','error');
  const r=doc.data();
  const kpiScore=r.kpiScore||70;
  const grade=kpiScore>=90?'A':kpiScore>=80?'B':kpiScore>=70?'C':kpiScore>=60?'D':'E';
  await db.collection('hrd_kpi').add({
    nama:r.nama,periode:r.evaluasiPeriode||r.tanggalTes||todayStr(),
    produktivitas:kpiScore,kualitas:kpiScore,kedisiplinan:kpiScore,kerjasama:kpiScore,skor:kpiScore,
    catatan:`[DISC] Tipe: ${r.pattern||'-'} | Profil: ${r.profileName||'-'} | Grade: ${grade}\nPositif: ${(r.positiveTraits||[]).join(', ')}\nNegatif: ${(r.negativeTraits||[]).join(', ')}\nKarir: ${(r.career||'').substring(0,100)}`,
    penilai:'DISC Auto-Sync',discResultId:id,discPattern:r.pattern||'',discProfile:r.profileName||'',
    createdAt:new Date().toISOString()
  });
  toast(`DISC ${r.nama} disinkronkan ke KPI (Skor: ${kpiScore}, Grade: ${grade})`,'success');
}

async function syncAllDiscToKPI(){
  if(!confirm('Sinkronkan semua hasil DISC terbaru ke KPI?'))return;
  const snap=await db.collection('hrd_disc_results').get();
  let count=0;
  for(const doc of snap.docs){
    const r=doc.data();
    const existing=await db.collection('hrd_kpi').where('discResultId','==',doc.id).limit(1).get();
    if(existing.empty){
      const kpiScore=r.kpiScore||70;
      await db.collection('hrd_kpi').add({nama:r.nama,periode:r.evaluasiPeriode||r.tanggalTes||todayStr(),produktivitas:kpiScore,kualitas:kpiScore,kedisiplinan:kpiScore,kerjasama:kpiScore,skor:kpiScore,catatan:`[DISC] Tipe: ${r.pattern||'-'} | Profil: ${r.profileName||'-'}`,penilai:'DISC Auto-Sync',discResultId:doc.id,discPattern:r.pattern||'',discProfile:r.profileName||'',createdAt:new Date().toISOString()});
      count++;
    }
  }
  toast(`${count} hasil DISC disinkronkan ke KPI`,'success');
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
