'use strict';
// ============================================================
// ABSENSI-IJEF.JS — Selfie+GPS + Dinas Luar + Setting + Rekap
// ============================================================

let absensiStream = null, capturedPhoto = null, currentGPS = null;
let dinasStream = null, dinasPhoto = null, dinasGPS = null;

// ── MAIN RENDER ───────────────────────────────────────────────
function renderAbsensiIJEF() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>📍 Absensi IJEF</span></div>
    <div class="tabs" id="absenTabs">
      <div class="tab active" onclick="showAbsenTab('clock')">⏰ Clock In/Out</div>
      <div class="tab" onclick="showAbsenTab('dinas')">🚗 Dinas Luar</div>
      <div class="tab" onclick="showAbsenTab('rekap')">📊 Rekap</div>
      <div class="tab" onclick="showAbsenTab('import')">📥 Import</div>
      ${hasAccess(3)?'<div class="tab" onclick="showAbsenTab(\'setting\')">⚙️ Setting</div>':''}
    </div><div id="absenContent"></div>`;
  showAbsenTab('clock');
}

function showAbsenTab(tab) {
  document.querySelectorAll('#absenTabs .tab').forEach((t,i)=>t.classList.remove('active'));
  document.querySelectorAll('#absenTabs .tab').forEach(t=>{if(t.textContent.toLowerCase().includes(tab==='clock'?'clock':tab==='dinas'?'dinas':tab==='rekap'?'rekap':tab==='import'?'import':'setting'))t.classList.add('active');});
  const c=document.getElementById('absenContent');
  if(tab==='clock')renderClockInOut(c);
  else if(tab==='dinas')renderDinasLuar(c);
  else if(tab==='rekap')renderRekapAbsensi(c);
  else if(tab==='import')renderImportCSV(c);
  else if(tab==='setting')renderAbsenSetting(c);
}

// ══════════════════════════════════════════════════════════════
// ── SETTING ABSENSI — Lokasi, Radius, Shift, Jam Operasional ──
// ══════════════════════════════════════════════════════════════

async function renderAbsenSetting(container) {
  container.innerHTML = `<div class="card"><div class="card-title mb-16">⚙️ Setting Absensi</div><div id="settingContent">Loading...</div></div>`;
  const doc = await db.collection('hrd_settings').doc('absensi').get();
  const s = doc.exists ? doc.data() : {};
  
  document.getElementById('settingContent').innerHTML = `
    <div class="tabs mb-16">
      <div class="tab active" onclick="showSettingSection('lokasi')">📍 Lokasi & Radius</div>
      <div class="tab" onclick="showSettingSection('shift')">🕐 Shift & Jam</div>
    </div>
    <div id="settingSection"></div>`;
  showSettingSection('lokasi');
}

async function showSettingSection(section) {
  document.querySelectorAll('.tabs .tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tabs .tab').forEach(t=>{if(t.textContent.toLowerCase().includes(section==='lokasi'?'lokasi':'shift'))t.classList.add('active');});
  const el = document.getElementById('settingSection');
  const doc = await db.collection('hrd_settings').doc('absensi').get();
  const s = doc.exists ? doc.data() : {};

  if (section === 'lokasi') {
    const lokasi = s.lokasi || [];
    let lokasiHtml = '';
    lokasi.forEach((l,i) => {
      lokasiHtml += `<tr><td class="fw-700">${escHtml(l.nama)}</td><td>${l.lat}, ${l.lng}</td><td>${l.radius}m</td><td><button class="btn btn-xs btn-danger" onclick="hapusLokasiAbsen(${i})">🗑️</button></td></tr>`;
    });

    el.innerHTML = `
      <div class="card">
        <div class="card-header"><div class="card-title">📍 Lokasi Kantor & Radius Absensi</div><button class="btn btn-primary btn-sm" onclick="modalTambahLokasi()">+ Tambah Lokasi</button></div>
        <p class="text-sm mb-16" style="color:#666">Karyawan hanya bisa clock in/out jika berada dalam radius lokasi yang terdaftar. Bisa tambah beberapa lokasi (kantor pusat, cabang, dll).</p>
        <div class="table-wrap"><table><thead><tr><th>Nama Lokasi</th><th>Koordinat</th><th>Radius</th><th>Aksi</th></tr></thead><tbody id="tblLokasiAbsen">${lokasiHtml||'<tr><td colspan="4" class="text-center">Belum ada lokasi. Tambahkan lokasi kantor.</td></tr>'}</tbody></table></div>
        <div class="mt-16" style="padding:12px;background:#f8f9ff;border-radius:8px">
          <div class="text-sm fw-700 mb-8">💡 Tips:</div>
          <ul class="text-xs" style="padding-left:16px;line-height:1.8;color:#666">
            <li>Gunakan Google Maps untuk mendapatkan koordinat (klik kanan → "What's here?")</li>
            <li>Radius 10-50m cocok untuk kantor kecil, 100-200m untuk area pabrik/kampus</li>
            <li>Jika ada beberapa cabang, tambahkan semua lokasi</li>
          </ul>
        </div>
      </div>`;
  } else {
    const shifts = s.shifts || [
      { nama: 'Reguler', jamMasuk: '08:00', jamPulang: '17:00', toleransi: 10 }
    ];
    let shiftHtml = '';
    shifts.forEach((sh,i) => {
      shiftHtml += `<tr><td class="fw-700">${escHtml(sh.nama)}</td><td>${sh.jamMasuk}</td><td>${sh.jamPulang}</td><td>${sh.toleransi} menit</td><td><button class="btn btn-xs btn-info" onclick="modalEditShift(${i})">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusShift(${i})">🗑️</button></td></tr>`;
    });

    el.innerHTML = `
      <div class="card">
        <div class="card-header"><div class="card-title">🕐 Shift & Jam Operasional</div><button class="btn btn-primary btn-sm" onclick="modalTambahShift()">+ Tambah Shift</button></div>
        <p class="text-sm mb-16" style="color:#666">Atur shift kerja dan jam operasional. Toleransi keterlambatan dihitung dari jam masuk + toleransi.</p>
        <div class="table-wrap"><table><thead><tr><th>Nama Shift</th><th>Jam Masuk</th><th>Jam Pulang</th><th>Toleransi</th><th>Aksi</th></tr></thead><tbody id="tblShift">${shiftHtml}</tbody></table></div>
        <div class="mt-16 card" style="background:#fff8e1;border-left:4px solid var(--warning)">
          <div class="text-sm fw-700 mb-8">📋 Keterangan:</div>
          <ul class="text-xs" style="padding-left:16px;line-height:1.8">
            <li><b>Toleransi:</b> Waktu tambahan setelah jam masuk sebelum dianggap terlambat</li>
            <li><b>Contoh:</b> Jam masuk 08:00, toleransi 10 menit → terlambat jika clock in setelah 08:10</li>
            <li>Shift berlaku untuk semua karyawan. Untuk shift khusus per departemen, buat shift terpisah.</li>
          </ul>
        </div>
      </div>`;
  }
}

function modalTambahLokasi() {
  openModal(`<div class="modal-title">📍 Tambah Lokasi Absensi</div>
    <div class="form-group"><label>Nama Lokasi</label><input class="form-control" id="setLokNama" placeholder="Kantor Pusat / Cabang A"></div>
    <div class="grid-3">
      <div class="form-group"><label>Latitude</label><input class="form-control" id="setLokLat" placeholder="-7.2575"></div>
      <div class="form-group"><label>Longitude</label><input class="form-control" id="setLokLng" placeholder="112.7521"></div>
      <div class="form-group"><label>Radius (meter)</label><input class="form-control" type="number" id="setLokRadius" value="50"></div>
    </div>
    <button class="btn btn-info btn-sm mb-16" onclick="detectCurrentForSetting()">📍 Gunakan Lokasi Saya Sekarang</button>
    <div id="setLokPreview" class="mb-16"></div>
    <button class="btn btn-primary" onclick="simpanLokasiAbsen()">Simpan</button>`);
}

function detectCurrentForSetting() {
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById('setLokLat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('setLokLng').value = pos.coords.longitude.toFixed(6);
    document.getElementById('setLokPreview').innerHTML = `<span class="badge badge-success">✅ Lokasi terdeteksi: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}</span>`;
  }, err => toast('Gagal deteksi: ' + err.message, 'error'), {enableHighAccuracy:true});
}

async function simpanLokasiAbsen() {
  const nama = document.getElementById('setLokNama').value;
  const lat = parseFloat(document.getElementById('setLokLat').value);
  const lng = parseFloat(document.getElementById('setLokLng').value);
  const radius = parseInt(document.getElementById('setLokRadius').value) || 50;
  if (!nama || !lat || !lng) return toast('Lengkapi semua field', 'warning');

  const doc = await db.collection('hrd_settings').doc('absensi').get();
  const s = doc.exists ? doc.data() : {};
  const lokasi = s.lokasi || [];
  lokasi.push({ nama, lat, lng, radius });
  await db.collection('hrd_settings').doc('absensi').set({...s, lokasi}, {merge:true});
  closeModalDirect(); toast('Lokasi ditambahkan', 'success'); showSettingSection('lokasi');
}

async function hapusLokasiAbsen(idx) {
  if (!confirm('Hapus lokasi ini?')) return;
  const doc = await db.collection('hrd_settings').doc('absensi').get();
  const s = doc.data() || {};
  s.lokasi.splice(idx, 1);
  await db.collection('hrd_settings').doc('absensi').set(s);
  toast('Dihapus', 'success'); showSettingSection('lokasi');
}

function modalTambahShift() { showShiftForm(-1, {}); }
function modalEditShift(idx) {
  db.collection('hrd_settings').doc('absensi').get().then(doc => {
    const s = doc.data() || {};
    const shift = (s.shifts || [])[idx] || {};
    showShiftForm(idx, shift);
  });
}

function showShiftForm(idx, sh) {
  openModal(`<div class="modal-title">${idx>=0?'Edit':'Tambah'} Shift</div>
    <div class="form-group"><label>Nama Shift</label><input class="form-control" id="shNama" value="${escHtml(sh.nama||'')}" placeholder="Reguler / Pagi / Malam"></div>
    <div class="grid-3">
      <div class="form-group"><label>Jam Masuk</label><input class="form-control" type="time" id="shMasuk" value="${sh.jamMasuk||'08:00'}"></div>
      <div class="form-group"><label>Jam Pulang</label><input class="form-control" type="time" id="shPulang" value="${sh.jamPulang||'17:00'}"></div>
      <div class="form-group"><label>Toleransi (menit)</label><input class="form-control" type="number" id="shToleransi" value="${sh.toleransi||10}"></div>
    </div>
    <button class="btn btn-primary" onclick="simpanShift(${idx})">Simpan</button>`);
}

async function simpanShift(idx) {
  const shift = { nama: document.getElementById('shNama').value, jamMasuk: document.getElementById('shMasuk').value, jamPulang: document.getElementById('shPulang').value, toleransi: parseInt(document.getElementById('shToleransi').value)||10 };
  if (!shift.nama) return toast('Nama shift wajib', 'warning');
  const doc = await db.collection('hrd_settings').doc('absensi').get();
  const s = doc.exists ? doc.data() : {};
  const shifts = s.shifts || [];
  if (idx >= 0) shifts[idx] = shift; else shifts.push(shift);
  await db.collection('hrd_settings').doc('absensi').set({...s, shifts}, {merge:true});
  closeModalDirect(); toast('Shift disimpan', 'success'); showSettingSection('shift');
}

async function hapusShift(idx) {
  if (!confirm('Hapus shift ini?')) return;
  const doc = await db.collection('hrd_settings').doc('absensi').get();
  const s = doc.data() || {};
  (s.shifts||[]).splice(idx, 1);
  await db.collection('hrd_settings').doc('absensi').set(s);
  toast('Dihapus', 'success'); showSettingSection('shift');
}

// ══════════════════════════════════════════════════════════════
// ── CLOCK IN/OUT — Menggunakan setting lokasi & shift ─────────
// ══════════════════════════════════════════════════════════════

function renderClockInOut(container) {
  container.innerHTML = `<div class="card"><div class="card-title mb-16">📸 Absensi Selfie + GPS</div>
    <div class="grid-2"><div>
      <div style="position:relative;border-radius:12px;overflow:hidden;background:#000;aspect-ratio:4/3;max-width:400px"><video id="selfieVideo" autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video><canvas id="selfieCanvas" style="display:none"></canvas></div>
      <div class="mt-8 flex gap-8"><button class="btn btn-primary btn-sm" onclick="startCamera()">📷 Kamera</button><button class="btn btn-info btn-sm" onclick="captureMainPhoto()">📸 Ambil</button></div>
      <div id="selfiePreview" class="mt-8"></div>
    </div><div>
      <div class="form-group"><label>📍 GPS</label><div id="gpsStatus" class="text-sm" style="color:#999">Belum terdeteksi</div></div>
      <div class="form-group"><label>Jarak ke Lokasi Terdekat</label><div id="gpsDistance" class="text-sm">-</div></div>
      <button class="btn btn-success btn-sm mb-8" onclick="getGPSLocation()">📍 Deteksi Lokasi</button>
      <div id="shiftInfo" class="mt-8 mb-8"></div>
      <div class="mt-16" id="clockActions"><button class="btn btn-success" onclick="doClockIn()">⏰ Clock In</button> <button class="btn btn-warning" onclick="doClockOut()">🏠 Clock Out</button></div>
      <div id="clockStatus" class="mt-16"></div>
    </div></div></div>
    <div class="card mt-16"><div class="card-title mb-8">📋 Riwayat Hari Ini</div><div id="todayHistory"></div></div>`;
  loadTodayHistory(); checkTodayStatus(); loadShiftInfo();
}

async function loadShiftInfo() {
  const doc = await db.collection('hrd_settings').doc('absensi').get();
  const s = doc.exists ? doc.data() : {};
  const shifts = s.shifts || [{nama:'Reguler',jamMasuk:'08:00',jamPulang:'17:00',toleransi:10}];
  const el = document.getElementById('shiftInfo');
  if (el) {
    let html = '<div class="text-xs" style="background:#f0f4ff;padding:8px 12px;border-radius:6px"><b>Shift Aktif:</b><br>';
    shifts.forEach(sh => { html += `• ${sh.nama}: ${sh.jamMasuk} - ${sh.jamPulang} (toleransi ${sh.toleransi} mnt)<br>`; });
    html += '</div>';
    el.innerHTML = html;
  }
}

function startCamera() {
  const v = document.getElementById('selfieVideo');
  if (absensiStream) { absensiStream.getTracks().forEach(t=>t.stop()); }
  navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false})
    .then(s=>{absensiStream=s;v.srcObject=s;})
    .catch(e=>toast('Gagal kamera: '+e.message,'error'));
}

function captureMainPhoto() {
  const v=document.getElementById('selfieVideo'),c=document.getElementById('selfieCanvas');
  if(!v.srcObject)return toast('Buka kamera dulu','warning');
  c.width=v.videoWidth||320;c.height=v.videoHeight||240;
  c.getContext('2d').drawImage(v,0,0);
  capturedPhoto=c.toDataURL('image/jpeg',0.6);
  document.getElementById('selfiePreview').innerHTML=`<img src="${capturedPhoto}" style="width:100px;border-radius:8px;border:2px solid var(--success)"><div class="text-xs color-success">✅ Foto diambil</div>`;
  if(absensiStream){absensiStream.getTracks().forEach(t=>t.stop());absensiStream=null;}
}

function getGPSLocation() {
  document.getElementById('gpsStatus').innerHTML='<span style="color:var(--warning)">⏳ Mendeteksi...</span>';
  if(!navigator.geolocation)return toast('GPS tidak didukung','error');
  navigator.geolocation.getCurrentPosition(pos=>{
    currentGPS={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy};
    document.getElementById('gpsStatus').innerHTML=`<span style="color:var(--success)">✅ ${currentGPS.lat.toFixed(6)}, ${currentGPS.lng.toFixed(6)}</span><div class="text-xs">Akurasi: ${currentGPS.accuracy.toFixed(0)}m</div>`;
    calculateDistanceToOffice();
  },err=>{
    document.getElementById('gpsStatus').innerHTML=`<span style="color:var(--danger)">❌ ${err.message}</span>`;
  },{enableHighAccuracy:true,timeout:10000});
}

async function calculateDistanceToOffice() {
  if (!currentGPS) return;
  const status = await getNearestOfficeLocation(currentGPS.lat, currentGPS.lng);
  const el = document.getElementById('gpsDistance');
  if (!el) return;
  if (status.allowed) {
    el.innerHTML = `<span class="badge badge-success">${status.dist.toFixed(1)}m ✅ Dalam radius "${status.nearest.nama}" (${status.radius}m)</span>`;
  } else {
    el.innerHTML = `<span class="badge badge-danger">${status.dist.toFixed(1)}m ❌ Luar radius "${status.nearest.nama}" (max ${status.radius}m)</span>`;
  }
}

async function getNearestOfficeLocation(lat, lng) {
  const doc = await db.collection('hrd_settings').doc('absensi').get();
  const s = doc.exists ? doc.data() : {};
  const lokasi = s.lokasi || [];
  let nearest = null;
  let nearestDist = Infinity;
  let radius = 50;

  if (!lokasi.length) {
    const cabSnap = await db.collection('hrd_cabang').limit(1).get();
    let oLat=-7.2575, oLng=112.7521;
    if (!cabSnap.empty) { const c=cabSnap.docs[0].data(); oLat=c.lat||oLat; oLng=c.lng||oLng; radius=c.radius||50; }
    nearest = { nama:'Default Office', lat:oLat, lng:oLng, radius };
    nearestDist = haversine(lat, lng, oLat, oLng);
  } else {
    lokasi.forEach(l => {
      const dist = haversine(lat, lng, l.lat, l.lng);
      if (dist < nearestDist) { nearestDist = dist; nearest = l; radius = l.radius || 50; }
    });
  }

  return { nearest, dist: nearestDist, radius, allowed: nearestDist <= radius };
}

function haversine(lat1,lon1,lat2,lon2){const R=6371000,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180,a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}

async function getActiveShift() {
  const doc = await db.collection('hrd_settings').doc('absensi').get();
  const s = doc.exists ? doc.data() : {};
  return (s.shifts || [{nama:'Reguler',jamMasuk:'08:00',jamPulang:'17:00',toleransi:10}])[0];
}

async function doClockIn() {
  if(!capturedPhoto)return toast('Ambil foto selfie dulu','warning');
  if(!currentGPS)return toast('Deteksi lokasi GPS dulu','warning');
  const locationStatus = await getNearestOfficeLocation(currentGPS.lat, currentGPS.lng);
  if (!locationStatus.allowed) return toast(`Lokasi di luar radius "${locationStatus.nearest.nama}". Absen hanya boleh dari lokasi kantor terdaftar.`,'warning');
  const existing=await db.collection('hrd_absensi').where('userId','==',currentUser.id).where('tanggal','==',todayStr()).where('tipe','==','masuk').get();
  if(!existing.empty)return toast('Sudah clock in hari ini','warning');
  const now=new Date();
  const shift = await getActiveShift();
  const [h,m] = shift.jamMasuk.split(':').map(Number);
  const batasWaktu = h*60 + m + (shift.toleransi||10);
  const waktuSekarang = now.getHours()*60 + now.getMinutes();
  const status = waktuSekarang > batasWaktu ? 'terlambat' : 'tepat_waktu';

  await db.collection('hrd_absensi').add({userId:currentUser.id,nama:currentUser.nama,departemen:currentUser.departemen||'',tanggal:todayStr(),waktu:now.toTimeString().slice(0,5),tipe:'masuk',foto:capturedPhoto,lat:currentGPS.lat,lng:currentGPS.lng,accuracy:currentGPS.accuracy,shift:shift.nama,status,officeLocation:locationStatus.nearest.nama,officeDistance:locationStatus.dist,officeRadius:locationStatus.radius,createdAt:now.toISOString()});
  toast(`✅ Clock In: ${now.toTimeString().slice(0,5)} (${status==='terlambat'?'⚠️ Terlambat':'Tepat Waktu'})`,'success');
  capturedPhoto=null;currentGPS=null;loadTodayHistory();checkTodayStatus();
}

async function doClockOut() {
  if(!capturedPhoto)return toast('Ambil foto selfie dulu','warning');
  if(!currentGPS)return toast('Deteksi lokasi GPS dulu','warning');
  const locationStatus = await getNearestOfficeLocation(currentGPS.lat, currentGPS.lng);
  if (!locationStatus.allowed) return toast(`Lokasi di luar radius "${locationStatus.nearest.nama}". Absen hanya boleh dari lokasi kantor terdaftar.`,'warning');
  const existing=await db.collection('hrd_absensi').where('userId','==',currentUser.id).where('tanggal','==',todayStr()).where('tipe','==','pulang').get();
  if(!existing.empty)return toast('Sudah clock out hari ini','warning');
  const now=new Date();
  await db.collection('hrd_absensi').add({userId:currentUser.id,nama:currentUser.nama,departemen:currentUser.departemen||'',tanggal:todayStr(),waktu:now.toTimeString().slice(0,5),tipe:'pulang',foto:capturedPhoto,lat:currentGPS.lat,lng:currentGPS.lng,accuracy:currentGPS.accuracy,status:'pulang',officeLocation:locationStatus.nearest.nama,officeDistance:locationStatus.dist,officeRadius:locationStatus.radius,createdAt:now.toISOString()});
  toast('✅ Clock Out: '+now.toTimeString().slice(0,5),'success');
  capturedPhoto=null;currentGPS=null;loadTodayHistory();checkTodayStatus();
}

async function checkTodayStatus(){const snap=await db.collection('hrd_absensi').where('userId','==',currentUser.id).where('tanggal','==',todayStr()).get();let masuk=false,pulang=false;snap.forEach(d=>{if(d.data().tipe==='masuk')masuk=true;if(d.data().tipe==='pulang')pulang=true;});const el=document.getElementById('clockStatus');if(el){if(masuk&&pulang)el.innerHTML='<div class="badge badge-success" style="font-size:.9rem;padding:8px 16px">✅ Sudah In & Out</div>';else if(masuk)el.innerHTML='<div class="badge badge-info" style="font-size:.9rem;padding:8px 16px">⏰ Sudah In, belum Out</div>';else el.innerHTML='<div class="badge badge-warning" style="font-size:.9rem;padding:8px 16px">⚠️ Belum absen</div>';}}

async function loadTodayHistory(){const snap=await db.collection('hrd_absensi').where('tanggal','==',todayStr()).orderBy('createdAt','desc').limit(20).get();let h='';if(snap.empty)h='<p class="text-sm" style="color:#999">Belum ada absensi hari ini</p>';else snap.forEach(d=>{const p=d.data();h+=`<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">${p.foto?`<img src="${p.foto}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">`:'<div style="width:36px;height:36px;border-radius:50%;background:#eee;display:flex;align-items:center;justify-content:center">👤</div>'}<div style="flex:1"><div class="fw-700 text-sm">${escHtml(p.nama)} ${p.tipe==='dinas_luar'?'<span class="badge badge-info">Dinas Luar</span>':''}</div><div class="text-xs" style="color:#999">${p.tipe==='masuk'?'Clock In':p.tipe==='pulang'?'Clock Out':'Dinas'} — ${p.waktu}</div></div><span class="badge badge-${p.status==='terlambat'?'warning':'success'}">${p.status||p.tipe}</span></div>`;});const el=document.getElementById('todayHistory');if(el)el.innerHTML=h;}

// ══════════════════════════════════════════════════════════════
// ── DINAS LUAR — Form Pengajuan + Absen Selfie+GPS di Lokasi ──
// ══════════════════════════════════════════════════════════════

function renderDinasLuar(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">🚗 Dinas Luar</div>
        <div class="flex gap-8">
          <button class="btn btn-primary btn-sm" onclick="modalDinasLuar()">📝 Ajukan Dinas</button>
          <button class="btn btn-success btn-sm" onclick="modalAbsenDinasLuar()">📸 Absen Dinas Luar</button>
        </div>
      </div>
      <div class="tabs mb-16">
        <div class="tab active" onclick="loadDinasTab('pengajuan')">📝 Pengajuan</div>
        <div class="tab" onclick="loadDinasTab('absen')">📸 Riwayat Absen Dinas</div>
      </div>
      <div id="dinasContent"></div>
    </div>`;
  loadDinasTab('pengajuan');
}

async function loadDinasTab(tab) {
  document.querySelectorAll('.tabs .tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tabs .tab').forEach(t=>{if(t.textContent.includes(tab==='pengajuan'?'Pengajuan':'Riwayat'))t.classList.add('active');});
  const el = document.getElementById('dinasContent');

  if (tab === 'pengajuan') {
    const snap = await db.collection('hrd_dinas_luar').orderBy('createdAt','desc').get();
    let h = '<div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Tanggal</th><th>Tujuan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
    if(snap.empty) h += '<tr><td colspan="5" class="text-center">Belum ada pengajuan</td></tr>';
    else snap.forEach(d=>{const p=d.data();const badge=p.status==='approved'?'badge-success':p.status==='rejected'?'badge-danger':'badge-warning';h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${formatDate(p.tanggal)}</td><td>${escHtml(p.tujuan)}</td><td><span class="badge ${badge}">${p.status}</span></td><td>${p.status==='pending'&&hasAccess(3)?`<button class="btn btn-xs btn-success" onclick="approveDinas('${d.id}','approved')">✅</button> <button class="btn btn-xs btn-danger" onclick="approveDinas('${d.id}','rejected')">❌</button>`:'-'}</td></tr>`;});
    h += '</tbody></table></div>';
    el.innerHTML = h;
  } else {
    // Riwayat absen dinas luar (selfie+GPS)
    const snap = await db.collection('hrd_absensi').where('tipe','==','dinas_luar').orderBy('createdAt','desc').limit(30).get();
    let h = '<div class="table-wrap"><table><thead><tr><th>Foto</th><th>Karyawan</th><th>Tanggal</th><th>Waktu</th><th>Lokasi</th><th>Tujuan</th></tr></thead><tbody>';
    if(snap.empty) h += '<tr><td colspan="6" class="text-center">Belum ada absen dinas luar</td></tr>';
    else snap.forEach(d=>{const p=d.data();h+=`<tr><td>${p.foto?`<img src="${p.foto}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">`:'👤'}</td><td class="fw-700">${escHtml(p.nama)}</td><td>${formatDate(p.tanggal)}</td><td>${p.waktu}</td><td class="text-xs">${p.lat?.toFixed(4)||'-'}, ${p.lng?.toFixed(4)||'-'}</td><td>${escHtml(p.tujuanDinas||'-')}</td></tr>`;});
    h += '</tbody></table></div>';
    el.innerHTML = h;
  }
}

function modalDinasLuar() {
  openModal(`<div class="modal-title">📝 Ajukan Dinas Luar</div>
    <div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="dlNama" value="${currentUser.nama}"></div><div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="dlTgl" value="${todayStr()}"></div></div>
    <div class="form-group"><label>Tujuan / Lokasi</label><input class="form-control" id="dlTujuan" placeholder="Nama klien / alamat tujuan"></div>
    <div class="form-group"><label>Keperluan</label><textarea class="form-control" id="dlKeperluan" placeholder="Jelaskan keperluan dinas luar"></textarea></div>
    <div class="grid-2"><div class="form-group"><label>Jam Berangkat</label><input class="form-control" type="time" id="dlJamGo"></div><div class="form-group"><label>Estimasi Kembali</label><input class="form-control" type="time" id="dlJamBack"></div></div>
    <button class="btn btn-primary" onclick="simpanDinasLuar()">📝 Ajukan</button>`);
}

async function simpanDinasLuar() {
  const data = {nama:document.getElementById('dlNama').value,tanggal:document.getElementById('dlTgl').value,tujuan:document.getElementById('dlTujuan').value,keperluan:document.getElementById('dlKeperluan').value,jamBerangkat:document.getElementById('dlJamGo').value,jamKembali:document.getElementById('dlJamBack').value,status:'pending',userId:currentUser.id,createdAt:new Date().toISOString()};
  if(!data.tujuan)return toast('Tujuan wajib','warning');
  await db.collection('hrd_dinas_luar').add(data);
  await sendNotification('hr','Dinas Luar',`${data.nama} → ${data.tujuan}`);
  closeModalDirect();toast('Pengajuan dinas luar terkirim','success');loadDinasTab('pengajuan');
}

async function approveDinas(id,status){await db.collection('hrd_dinas_luar').doc(id).update({status,approvedBy:currentUser.nama,approvedAt:new Date().toISOString()});toast('Updated','success');loadDinasTab('pengajuan');}

// ── ABSEN DINAS LUAR — Selfie + GPS (tanpa batasan radius) ────
function modalAbsenDinasLuar() {
  dinasPhoto = null; dinasGPS = null;
  openModal(`<div class="modal-title">📸 Absen Dinas Luar (Selfie + GPS)</div>
    <p class="text-sm mb-16" style="color:#666">Absen dari lokasi dinas luar. Foto selfie dan GPS akan direkam sebagai bukti kehadiran di lokasi tujuan.</p>
    <div class="grid-2">
      <div>
        <div style="position:relative;border-radius:12px;overflow:hidden;background:#000;aspect-ratio:4/3">
          <video id="dinasVideo" autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video>
          <canvas id="dinasCanvas" style="display:none"></canvas>
        </div>
        <div class="mt-8 flex gap-8">
          <button class="btn btn-primary btn-sm" onclick="startDinasCamera()">📷 Kamera</button>
          <button class="btn btn-info btn-sm" onclick="captureDinasPhoto()">📸 Ambil</button>
        </div>
        <div id="dinasPhotoPreview" class="mt-8"></div>
      </div>
      <div>
        <div class="form-group"><label>📍 Lokasi GPS</label><div id="dinasGpsStatus" class="text-sm" style="color:#999">Belum terdeteksi</div></div>
        <button class="btn btn-success btn-sm mb-16" onclick="getDinasGPS()">📍 Deteksi Lokasi</button>
        <div class="form-group"><label>Tujuan Dinas</label><input class="form-control" id="dinasAbsenTujuan" placeholder="Nama klien / lokasi"></div>
        <div class="form-group"><label>Keterangan</label><textarea class="form-control" id="dinasAbsenKet" placeholder="Aktivitas yang dilakukan"></textarea></div>
      </div>
    </div>
    <button class="btn btn-success mt-16" style="width:100%;padding:12px" onclick="submitAbsenDinas()">📸 Simpan Absen Dinas Luar</button>`, true);
  setTimeout(()=>startDinasCamera(), 300);
}

function startDinasCamera() {
  const v = document.getElementById('dinasVideo');
  if(dinasStream){dinasStream.getTracks().forEach(t=>t.stop());}
  navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false})
    .then(s=>{dinasStream=s;v.srcObject=s;})
    .catch(e=>toast('Gagal kamera: '+e.message,'error'));
}

function captureDinasPhoto() {
  const v=document.getElementById('dinasVideo'),c=document.getElementById('dinasCanvas');
  if(!v.srcObject)return toast('Buka kamera dulu','warning');
  c.width=v.videoWidth||320;c.height=v.videoHeight||240;
  c.getContext('2d').drawImage(v,0,0);
  dinasPhoto=c.toDataURL('image/jpeg',0.6);
  document.getElementById('dinasPhotoPreview').innerHTML=`<img src="${dinasPhoto}" style="width:80px;border-radius:8px;border:2px solid var(--success)"><span class="text-xs color-success ml-8">✅</span>`;
  if(dinasStream){dinasStream.getTracks().forEach(t=>t.stop());dinasStream=null;}
}

function getDinasGPS() {
  document.getElementById('dinasGpsStatus').innerHTML='<span style="color:var(--warning)">⏳ Mendeteksi...</span>';
  navigator.geolocation.getCurrentPosition(pos=>{
    dinasGPS={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy};
    document.getElementById('dinasGpsStatus').innerHTML=`<span style="color:var(--success)">✅ ${dinasGPS.lat.toFixed(6)}, ${dinasGPS.lng.toFixed(6)}</span><div class="text-xs">Akurasi: ${dinasGPS.accuracy.toFixed(0)}m</div>`;
  },err=>{
    document.getElementById('dinasGpsStatus').innerHTML=`<span style="color:var(--danger)">❌ ${err.message}</span>`;
  },{enableHighAccuracy:true,timeout:10000});
}

async function submitAbsenDinas() {
  if(!dinasPhoto) return toast('Ambil foto selfie dulu','warning');
  if(!dinasGPS) return toast('Deteksi lokasi GPS dulu','warning');
  const tujuan = document.getElementById('dinasAbsenTujuan').value;
  if(!tujuan) return toast('Isi tujuan dinas','warning');

  const now = new Date();
  await db.collection('hrd_absensi').add({
    userId: currentUser.id,
    nama: currentUser.nama,
    departemen: currentUser.departemen || '',
    tanggal: todayStr(),
    waktu: now.toTimeString().slice(0,5),
    tipe: 'dinas_luar',
    foto: dinasPhoto,
    lat: dinasGPS.lat,
    lng: dinasGPS.lng,
    accuracy: dinasGPS.accuracy,
    tujuanDinas: tujuan,
    keteranganDinas: document.getElementById('dinasAbsenKet').value,
    status: 'dinas',
    createdAt: now.toISOString()
  });

  dinasPhoto = null; dinasGPS = null;
  closeModalDirect();
  toast('✅ Absen Dinas Luar berhasil! ' + now.toTimeString().slice(0,5), 'success');
  loadTodayHistory();
}

// ══════════════════════════════════════════════════════════════
// ── REKAP GRID ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function renderRekapAbsensi(container){container.innerHTML=`<div class="card"><div class="card-header"><div class="card-title">📊 Rekap Absensi</div><div class="flex gap-8"><input class="form-control" type="month" id="rekapBulan" value="${monthStr()}" onchange="loadRekapGrid()"><button class="btn btn-sm btn-info" onclick="loadRekapGrid()">🔍</button></div></div><div id="rekapGrid">Loading...</div><div class="mt-16" id="rekapSummary"></div></div>`;loadRekapGrid();}

async function loadRekapGrid(){
  const bulan=document.getElementById('rekapBulan')?.value||monthStr();
  const days=getMonthDays(bulan);
  const startDate=bulan+'-01',endDate=bulan+'-'+String(days).padStart(2,'0');
  const[usersSnap,absenSnap]=await Promise.all([db.collection('hrd_users').where('status','==','aktif').get(),db.collection('hrd_absensi').where('tanggal','>=',startDate).where('tanggal','<=',endDate).get()]);
  const users=[];usersSnap.forEach(d=>users.push({id:d.id,...d.data()}));
  const absenMap={};
  absenSnap.forEach(d=>{const p=d.data();if(!absenMap[p.userId])absenMap[p.userId]={};const day=parseInt(p.tanggal.split('-')[2]);if(p.tipe==='masuk')absenMap[p.userId][day]=p.status||'hadir';else if(p.tipe==='dinas_luar'&&!absenMap[p.userId][day])absenMap[p.userId][day]='dinas';});

  let h='<div class="table-wrap"><table><thead><tr><th style="min-width:120px">Nama</th>';
  for(let i=1;i<=days;i++)h+=`<th style="width:28px;text-align:center;font-size:.65rem">${i}</th>`;
  h+='<th>Total</th></tr></thead><tbody>';
  let totalH=0,totalT=0,totalD=0;

  users.forEach(u=>{
    h+=`<tr><td class="text-sm fw-700">${escHtml(u.nama)}</td>`;
    let ut=0;
    for(let i=1;i<=days;i++){
      const st=absenMap[u.id]?.[i];
      let color='#eee',text='-';
      if(st==='tepat_waktu'||st==='hadir'){color='#4caf50';text='✓';ut++;totalH++;}
      else if(st==='terlambat'){color='#ff9800';text='T';ut++;totalT++;}
      else if(st==='dinas'){color='#2196f3';text='D';ut++;totalD++;}
      h+=`<td style="text-align:center;background:${color};color:#fff;font-size:.6rem;font-weight:700;padding:3px">${text}</td>`;
    }
    h+=`<td class="fw-700 text-center">${ut}</td></tr>`;
  });
  h+='</tbody></table></div>';
  document.getElementById('rekapGrid').innerHTML=h;
  document.getElementById('rekapSummary').innerHTML=`
    <div class="stats-grid">
      <div class="stat-card" style="border-left-color:var(--success)"><div class="stat-value color-success">${totalH}</div><div class="stat-label">Tepat Waktu</div></div>
      <div class="stat-card" style="border-left-color:var(--warning)"><div class="stat-value" style="color:var(--warning)">${totalT}</div><div class="stat-label">Terlambat</div></div>
      <div class="stat-card" style="border-left-color:var(--info)"><div class="stat-value" style="color:var(--info)">${totalD}</div><div class="stat-label">Dinas Luar</div></div>
    </div>
    <div class="flex gap-8 mt-8">
      <span class="text-xs"><span style="display:inline-block;width:12px;height:12px;background:#4caf50;border-radius:2px"></span> Hadir</span>
      <span class="text-xs"><span style="display:inline-block;width:12px;height:12px;background:#ff9800;border-radius:2px"></span> Terlambat</span>
      <span class="text-xs"><span style="display:inline-block;width:12px;height:12px;background:#2196f3;border-radius:2px"></span> Dinas Luar</span>
      <span class="text-xs"><span style="display:inline-block;width:12px;height:12px;background:#eee;border-radius:2px"></span> Tidak Hadir</span>
    </div>`;
}

// ── IMPORT CSV ────────────────────────────────────────────────
function renderImportCSV(container){container.innerHTML=`<div class="card"><div class="card-title mb-16">📥 Import CSV</div>
    <div class="tabs mb-16"><div class="tab active" onclick="switchImportTabAbsensi('file')">📄 Upload CSV</div><div class="tab" onclick="switchImportTabAbsensi('api')">🔗 Google Sheets</div></div>
    <div id="importAbsensiTab"></div>
    <div id="csvResult" class="mt-16"></div>
  </div>`;
  switchImportTabAbsensi('file');}

function switchImportTabAbsensi(mode){const tabs=document.querySelectorAll('#absenContent .tabs .tab');tabs.forEach((t,i)=>t.classList.toggle('active',i=== (mode==='file'?0:1)));const el=document.getElementById('importAbsensiTab');if(!el)return;
  if(mode==='api'){el.innerHTML=`<p class="text-sm mb-8" style="color:#666">Import data absensi langsung dari Google Sheets. Header minimal: <code>nama,tanggal,waktu,tipe,status</code>.</p>
      <div class="form-group"><label>URL Google Sheets</label><input class="form-control" id="importAbsenApiUrl" placeholder="https://docs.google.com/spreadsheets/d/xxx/edit?usp=sharing"></div>
      <div id="importAbsenApiStatus" class="mb-8"></div>
      <div class="flex gap-8 mb-16"><button class="btn btn-info" onclick="previewAbsenApiImport()">👁️ Preview</button><button class="btn btn-primary" onclick="processAbsenApiImport()">📥 Import</button></div>
      <div id="importAbsenApiPreview"></div>`;} else {el.innerHTML=`<p class="text-sm mb-8" style="color:#666">Upload file CSV absensi. Header minimal: <code>nama,tanggal,waktu,tipe,status</code>.</p>
      <div class="form-group"><label>File CSV</label><input type="file" class="form-control" id="csvFile" accept=".csv"></div>
      <div class="flex gap-8 mb-16"><button class="btn btn-primary" onclick="processCSVImport()">📥 Import</button><button class="btn btn-outline btn-sm" onclick="downloadCSVTemplate()">📄 Download Template</button></div>
      <div class="text-xs" style="color:#666">Contoh: nama,tanggal(YYYY-MM-DD),waktu(HH:MM),tipe(masuk/pulang),status</div>`;}}

function downloadCSVTemplate(){const csv='nama,tanggal,waktu,tipe,status\nRyan Benoe,2026-05-19,08:00,masuk,tepat_waktu\nRyan Benoe,2026-05-19,17:00,pulang,pulang';const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='template_absensi.csv';a.click();toast('Template absensi didownload','success');}

async function processCSVImport(){const file=document.getElementById('csvFile').files[0];if(!file)return toast('Pilih file','warning');const text=await file.text();await processAbsenImportText(text);}

function absensiConvertToGSheetCSV(inputUrl){const match=inputUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);if(match){return `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv&sheet=Sheet1`;}return inputUrl;}

function parseCsvRows(text){const lines=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim());return lines.map(line=>{const cols=[];let cur='';let inQuotes=false;for(let i=0;i<line.length;i++){const ch=line[i];if(inQuotes){if(ch==='"'){if(line[i+1]==='"'){cur+='"';i++;} else {inQuotes=false;}} else {cur+=ch;}} else {if(ch==='"'){inQuotes=true;} else if(ch===','){cols.push(cur);cur='';} else {cur+=ch;}}}cols.push(cur);return cols.map(c=>c.trim());});}

async function previewAbsenApiImport(){const rawUrl=document.getElementById('importAbsenApiUrl').value.trim();if(!rawUrl) return toast('Paste URL Google Sheets dulu','warning');const statusEl=document.getElementById('importAbsenApiStatus');statusEl.innerHTML='<span class="badge badge-info">Mengambil data...</span>';try{const url=(typeof convertToGSheetCSV==='function'?convertToGSheetCSV(rawUrl):absensiConvertToGSheetCSV(rawUrl));const resp=await fetch(url);if(!resp.ok)throw new Error('Gagal ambil sheet: '+resp.status);const text=await resp.text();if(!text.trim())throw new Error('Data kosong');const rows=parseCsvRows(text);if(rows.length<2)throw new Error('Data kosong atau format salah');const headers=rows[0].map(h=>h.toLowerCase());const colsToShow=Math.min(rows.length-1,5);let previewHtml='<div class="table-wrap" style="max-height:260px;overflow:auto"><table><thead><tr>'+headers.slice(0,5).map(h=>`<th>${escHtml(h)}</th>`).join('')+'</tr></thead><tbody>';for(let i=1;i<=colsToShow;i++){const row=rows[i];previewHtml+='<tr>'+row.slice(0,5).map(c=>`<td>${escHtml(c||'')}</td>`).join('')+'</tr>';}previewHtml+='</tbody></table></div>';document.getElementById('importAbsenApiPreview').innerHTML=previewHtml;statusEl.innerHTML=`<span class="badge badge-success">✅ ${rows.length-1} baris ditemukan</span>`;window._absenApiImportText=text;}catch(err){statusEl.innerHTML=`<span class="badge badge-danger">❌ ${escHtml(err.message)}</span>`;document.getElementById('importAbsenApiPreview').innerHTML='';}}

async function processAbsenApiImport(){const rawUrl=document.getElementById('importAbsenApiUrl').value.trim();if(!rawUrl) return toast('Paste URL Google Sheets dulu','warning');let text=window._absenApiImportText;const statusEl=document.getElementById('importAbsenApiStatus');statusEl.innerHTML='<span class="badge badge-info">Memproses import...</span>';try{if(!text){const url=(typeof convertToGSheetCSV==='function'?convertToGSheetCSV(rawUrl):absensiConvertToGSheetCSV(rawUrl));const resp=await fetch(url);if(!resp.ok)throw new Error('Gagal ambil sheet: '+resp.status);text=await resp.text();if(!text.trim())throw new Error('Data kosong');}await processAbsenImportText(text);window._absenApiImportText=null;statusEl.innerHTML='<span class="badge badge-success">✅ Import selesai</span>';}catch(err){statusEl.innerHTML=`<span class="badge badge-danger">❌ ${escHtml(err.message)}</span>`;}} 

async function processAbsenImportText(text){const rows=parseCsvRows(text);if(rows.length<2)return toast('Data kosong atau format salah','warning');const headers=rows[0].map(h=>h.toLowerCase());const ni=headers.indexOf('nama'),ti=headers.indexOf('tanggal');if(ni===-1||ti===-1)return toast('Header CSV harus berisi kolom nama dan tanggal','error');const wi=headers.indexOf('waktu'),tpi=headers.indexOf('tipe'),si=headers.indexOf('status');let imported=0;let batch=db.batch();for(let i=1;i<rows.length;i++){const cols=rows[i];if(!cols[ni]||!cols[ti])continue;const nama=cols[ni];const tanggal=cols[ti];const waktu=wi>=0?cols[wi]||'08:00':'08:00';const tipe=tpi>=0?cols[tpi]||'masuk':'masuk';const status=si>=0?cols[si]||'tepat_waktu':'tepat_waktu';batch.set(db.collection('hrd_absensi').doc(),{nama,userId:nama.toLowerCase().replace(/\s+/g,''),departemen:'',tanggal,waktu,tipe,status,createdAt:new Date().toISOString()});imported++;if(imported>400){await batch.commit();batch=db.batch();imported=0;}}await batch.commit();document.getElementById('csvResult').innerHTML='<div class="badge badge-success" style="font-size:.9rem;padding:8px 16px">✅ Import selesai</div>';toast('Import absensi selesai','success');}


