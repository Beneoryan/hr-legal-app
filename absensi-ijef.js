'use strict';
// ============================================================
// ABSENSI-IJEF.JS — Selfie+GPS + Dinas Luar + Setting + Rekap
// ============================================================

let absensiStream = null, capturedPhoto = null, currentGPS = null;
let dinasStream = null, dinasPhoto = null, dinasGPS = null;

// ── MAIN RENDER ───────────────────────────────────────────────
function renderAbsensiIJEF() {
  const main = document.getElementById('mainContent');
  const isPortal=window._portalAbsensiMode||currentUser.role==='karyawan';
  const showImport=hasAccess(3);
  main.innerHTML = `<div class="page-title"><span>📍 Absensi IJEF</span></div>
    <div class="tabs" id="absenTabs">
      <div class="tab active" onclick="showAbsenTab('clock')">⏰ Clock In/Out</div>
      <div class="tab" onclick="showAbsenTab('dinas')">🚗 Dinas Luar</div>
      <div class="tab" onclick="showAbsenTab('rekap')">📊 Rekap</div>
      ${showImport?'<div class="tab" onclick="showAbsenTab(\'import\')">📥 Import</div>':''}
      ${hasAccess(3)?'<div class="tab" onclick="showAbsenTab(\'setting\')">⚙️ Setting</div>':''}
    </div><div id="absenContent"></div>`;
  window._portalAbsensiMode=isPortal;
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
      <div class="tab" onclick="showSettingSection('jamkerja')">⏰ Jam Kerja</div>
      <div class="tab" onclick="showSettingSection('log')">📋 Log Lokasi</div>
    </div>
    <div id="settingSection"></div>`;
  showSettingSection('lokasi');
}

async function showSettingSection(section) {
  document.querySelectorAll('.tabs .tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tabs .tab').forEach(t=>{
    if(section==='lokasi'&&t.textContent.includes('Lokasi & Radius'))t.classList.add('active');
    else if(section==='jamkerja'&&t.textContent.includes('Jam Kerja'))t.classList.add('active');
    else if(section==='log'&&t.textContent.includes('Log Lokasi'))t.classList.add('active');
  });
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
            <li>Gunakan Google Maps untuk mendapatkan koordinat (klik kanan > "What's here?")</li>
            <li>Radius 10-50m cocok untuk kantor kecil, 100-200m untuk area pabrik/kampus</li>
            <li>Jika ada beberapa cabang, tambahkan semua lokasi</li>
          </ul>
        </div>
      </div>`;
  } else if (section === 'jamkerja') {
    const flex = s.flexTime || { enabled: true, durasiKerja: 8, durasiIstirahat: 1, jamMasukMin: '06:00', jamMasukMax: '12:00', coreHoursEnabled: true, coreHoursStart: '10:00', coreHoursEnd: '15:00', jamPulangMax: '22:00', weeklyAccEnabled: true, weeklyTarget: 40 };
    el.innerHTML = `
      <div class="card">
        <div class="card-header"><div class="card-title">⏰ Jam Kerja Fleksibel</div></div>
        <p class="text-sm mb-16" style="color:#666">IJEF Corp menggunakan jam kerja fleksibel. Karyawan bisa clock in kapan saja, clock out setelah memenuhi durasi kerja + istirahat.</p>

        <div class="text-sm fw-700 mb-8" style="color:var(--primary)">Grup 1: Jam Kerja Dasar</div>
        <div class="form-group">
          <label>Jam Kerja Fleksibel</label>
          <div style="display:flex;align-items:center;gap:12px;margin-top:4px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="flexEnabled" ${flex.enabled?'checked':''}> <span class="text-sm fw-700">${flex.enabled?'Aktif':'Nonaktif'}</span></label>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group"><label>Durasi Kerja per Hari (jam)</label><input class="form-control" type="number" id="flexDurasiKerja" value="${flex.durasiKerja}" min="1" max="12"></div>
          <div class="form-group"><label>Durasi Istirahat (jam)</label><input class="form-control" type="number" id="flexDurasiIstirahat" value="${flex.durasiIstirahat}" min="0" max="3" step="0.5"></div>
        </div>
        <div class="grid-2">
          <div class="form-group"><label>Jam Masuk Paling Awal</label><input class="form-control" type="time" id="flexJamMin" value="${flex.jamMasukMin||'06:00'}"></div>
          <div class="form-group"><label>Jam Masuk Paling Akhir</label><input class="form-control" type="time" id="flexJamMax" value="${flex.jamMasukMax||'12:00'}"></div>
        </div>

        <hr style="margin:20px 0;border:none;border-top:1px solid var(--border)">
        <div class="text-sm fw-700 mb-8" style="color:var(--primary)">Grup 2: Core Hours</div>
        <div class="form-group">
          <label>Core Hours</label>
          <div style="display:flex;align-items:center;gap:12px;margin-top:4px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="flexCoreHoursEnabled" ${flex.coreHoursEnabled?'checked':''}> <span class="text-sm fw-700">${flex.coreHoursEnabled?'Aktif':'Nonaktif'}</span></label>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group"><label>Core Hours Mulai</label><input class="form-control" type="time" id="flexCoreHoursStart" value="${flex.coreHoursStart||'10:00'}"></div>
          <div class="form-group"><label>Core Hours Selesai</label><input class="form-control" type="time" id="flexCoreHoursEnd" value="${flex.coreHoursEnd||'15:00'}"></div>
        </div>
        <p class="text-xs mb-16" style="color:#666">Karyawan harus clock in sebelum core hours dimulai dan clock out setelah core hours berakhir.</p>

        <hr style="margin:20px 0;border:none;border-top:1px solid var(--border)">
        <div class="text-sm fw-700 mb-8" style="color:var(--primary)">Grup 3: Lembur & Batas</div>
        <div class="grid-2">
          <div class="form-group"><label>Jam Pulang Maksimal</label><input class="form-control" type="time" id="flexJamPulangMax" value="${flex.jamPulangMax||'22:00'}"></div>
          <div class="form-group" style="display:flex;align-items:center">
            <p class="text-xs" style="color:#666;margin-top:20px">Auto-deteksi lembur selalu aktif. Jika kerja > durasi kerja, otomatis ditandai lembur.</p>
          </div>
        </div>

        <hr style="margin:20px 0;border:none;border-top:1px solid var(--border)">
        <div class="text-sm fw-700 mb-8" style="color:var(--primary)">Grup 4: Akumulasi Mingguan</div>
        <div class="form-group">
          <label>Akumulasi Mingguan</label>
          <div style="display:flex;align-items:center;gap:12px;margin-top:4px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="flexWeeklyAccEnabled" ${flex.weeklyAccEnabled?'checked':''}> <span class="text-sm fw-700">${flex.weeklyAccEnabled?'Aktif':'Nonaktif'}</span></label>
          </div>
        </div>
        <div class="form-group"><label>Target Jam per Minggu</label><input class="form-control" type="number" id="flexWeeklyTarget" value="${flex.weeklyTarget||40}" min="1" max="80"></div>

        <button class="btn btn-primary mt-16" onclick="simpanFlexTime()">💾 Simpan Pengaturan</button>
        <div class="mt-16 card" style="background:#e8f5e9;border-left:4px solid var(--success)">
          <div class="text-sm fw-700 mb-8">📋 Cara Kerja:</div>
          <ul class="text-xs" style="padding-left:16px;line-height:1.8">
            <li>Karyawan clock in kapan saja (dalam rentang jam masuk yang diizinkan)</li>
            <li>Total jam di kantor = durasi kerja + durasi istirahat</li>
            <li>Contoh: Clock in 09:00, durasi 8+1=9 jam, expected clock out 18:00</li>
            <li>Jika clock out sebelum waktunya, sistem akan menampilkan peringatan</li>
            <li>Lembur otomatis terdeteksi jika jam kerja > durasi kerja yang ditentukan</li>
            <li>Core hours: karyawan wajib hadir dalam rentang core hours</li>
            <li>Akumulasi mingguan menampilkan progres jam kerja per minggu</li>
          </ul>
        </div>
      </div>`;
  } else if (section === 'log') {
    el.innerHTML = '<div class="card"><div class="card-title mb-16">📋 Log Lokasi Absensi</div><div id="logLokasiContent">Loading...</div></div>';
    const snap = await db.collection('hrd_absensi').get();
    let logHtml = '';
    if (snap.empty) {
      logHtml = '<p class="text-sm" style="color:#999">Belum ada data absensi.</p>';
    } else {
      logHtml = '<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Tanggal</th><th>Waktu</th><th>Tipe</th><th>Lokasi GPS</th><th>Kantor</th><th>Jarak</th></tr></thead><tbody>';
      snap.forEach(d => {
        const p = d.data();
        const tipeLabel = p.tipe==='masuk'?'Clock In':p.tipe==='pulang'?'Clock Out':p.tipe==='dinas_luar'?'Dinas Luar':p.tipe==='istirahat_mulai'?'Mulai Istirahat':p.tipe==='istirahat_selesai'?'Selesai Istirahat':p.tipe;
        const gps = (p.lat && p.lng) ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : '-';
        const office = p.officeLocation || '-';
        const distance = p.officeDistance ? `${p.officeDistance.toFixed(1)}m` : '-';
        logHtml += `<tr><td class="fw-700">${escHtml(p.nama||'-')}</td><td>${p.tanggal||'-'}</td><td>${p.waktu||'-'}</td><td><span class="badge badge-${p.tipe==='masuk'?'success':p.tipe==='pulang'?'info':'warning'}">${tipeLabel}</span></td><td class="text-xs">${gps}</td><td class="text-xs">${escHtml(office)}</td><td class="text-xs">${distance}</td></tr>`;
      });
      logHtml += '</tbody></table></div>';
    }
    document.getElementById('logLokasiContent').innerHTML = logHtml;
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

async function simpanFlexTime() {
  const enabled = document.getElementById('flexEnabled').checked;
  const durasiKerja = parseFloat(document.getElementById('flexDurasiKerja').value) || 8;
  const durasiIstirahat = parseFloat(document.getElementById('flexDurasiIstirahat').value) || 1;
  const jamMasukMin = document.getElementById('flexJamMin').value || '06:00';
  const jamMasukMax = document.getElementById('flexJamMax').value || '12:00';
  const coreHoursEnabled = document.getElementById('flexCoreHoursEnabled').checked;
  const coreHoursStart = document.getElementById('flexCoreHoursStart').value || '10:00';
  const coreHoursEnd = document.getElementById('flexCoreHoursEnd').value || '15:00';
  const jamPulangMax = document.getElementById('flexJamPulangMax').value || '22:00';
  const weeklyAccEnabled = document.getElementById('flexWeeklyAccEnabled').checked;
  const weeklyTarget = parseInt(document.getElementById('flexWeeklyTarget').value) || 40;
  const flexTime = { enabled, durasiKerja, durasiIstirahat, jamMasukMin, jamMasukMax, coreHoursEnabled, coreHoursStart, coreHoursEnd, jamPulangMax, weeklyAccEnabled, weeklyTarget };
  await db.collection('hrd_settings').doc('absensi').set({ flexTime }, { merge: true });
  toast('Pengaturan jam kerja fleksibel disimpan', 'success');
  showSettingSection('jamkerja');
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
  container.innerHTML = `<div class="card"><div class="card-title mb-16">📍 Absensi — Selfie + GPS</div>
    <div class="grid-2" style="gap:16px">
      <!-- KAMERA SELFIE (WAJIB) -->
      <div>
        <div class="text-sm fw-700 mb-8" style="color:var(--primary)">📸 Foto Selfie <span class="badge badge-danger" style="font-size:.6rem">WAJIB</span></div>
        <div style="position:relative;border-radius:12px;overflow:hidden;background:#000;aspect-ratio:4/3">
          <video id="selfieVideo" autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video>
          <canvas id="selfieCanvas" style="display:none"></canvas>
        </div>
        <div class="mt-8 flex gap-8">
          <button class="btn btn-primary btn-sm" onclick="startCamera()">📷 Buka Kamera</button>
          <button class="btn btn-success btn-sm" onclick="captureMainPhoto()">📸 Ambil Foto</button>
        </div>
        <div id="selfiePreview" class="mt-8"></div>
      </div>
      <!-- GPS & STATUS -->
      <div>
        <div class="text-sm fw-700 mb-8" style="color:var(--primary)">📍 Lokasi GPS</div>
        <div style="background:#f8f9ff;border-radius:12px;padding:16px;margin-bottom:12px">
          <div id="absenGpsStatus" style="font-size:.85rem;color:var(--text-light);margin-bottom:8px">📍 Mendeteksi lokasi...</div>
          <div id="absenLocationName" style="font-size:1rem;font-weight:700;color:var(--primary);margin-bottom:4px">-</div>
          <div id="absenDistance" style="font-size:.8rem;color:var(--text-light)">-</div>
        </div>
        <div id="absenAutoStatus" style="margin-bottom:12px"></div>
        <div id="clockStatus" class="mb-12"></div>
        <div id="breakActions" class="mb-8"></div>
        <div id="breakStatus" class="mb-8"></div>
        <div id="coreHoursStatus" class="mb-8"></div>
        <div class="card mb-8" id="weeklyAccCard" style="display:none;padding:12px"></div>
      </div>
    </div>
    <!-- TOMBOL ABSEN -->
    <div style="text-align:center;padding:20px 0">
      <button class="btn btn-primary btn-lg" id="btnAbsenAction" onclick="doAbsenWithSelfie()" style="padding:16px 40px;font-size:1rem;border-radius:12px" disabled>
        ⏳ Mendeteksi lokasi...
      </button>
    </div>
    <div style="background:#fff3e0;border-radius:8px;padding:12px;margin-top:8px;border-left:4px solid var(--warning)">
      <p class="text-xs" style="line-height:1.6"><b>Cara Kerja:</b><br>• Buka kamera dan ambil foto selfie (WAJIB sebagai validasi)<br>• Lokasi GPS otomatis terdeteksi<br>• Jika dalam radius kantor & foto sudah diambil → tombol aktif<br>• Sistem otomatis menentukan: <b>Clock In</b> atau <b>Clock Out</b></p>
    </div></div>
    <div class="card mt-16"><div class="card-title mb-8">📋 Riwayat Hari Ini</div><div id="todayHistory"></div></div>`;
  loadTodayHistory(); checkTodayStatus(); autoDetectLocation(); loadBreakStatus(); loadCoreHoursStatus(); loadWeeklyAccumulation();
  setTimeout(()=>startCamera(), 300);
}

async function autoDetectLocation(){
  const statusEl=document.getElementById('absenGpsStatus');
  const locEl=document.getElementById('absenLocationName');
  const distEl=document.getElementById('absenDistance');
  const btn=document.getElementById('btnAbsenAction');
  const autoEl=document.getElementById('absenAutoStatus');
  if(!statusEl||!btn)return;
  if(!navigator.geolocation){statusEl.textContent='❌ GPS tidak tersedia';return;}
  statusEl.textContent='📍 Mendeteksi lokasi...';
  navigator.geolocation.getCurrentPosition(async(pos)=>{
    try{
      currentGPS={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy};
      statusEl.textContent=`📍 ${currentGPS.lat.toFixed(5)}, ${currentGPS.lng.toFixed(5)} (±${currentGPS.accuracy?.toFixed(0)||'?'}m)`;
      // Check nearest office
      const locStatus=await getNearestOfficeLocation(currentGPS.lat,currentGPS.lng);
      if(locStatus.allowed){
        locEl.textContent=`✅ ${locStatus.nearest.nama}`;
        distEl.textContent=`Jarak: ${locStatus.dist.toFixed(0)}m (dalam radius ${locStatus.nearest.radius||locStatus.radius}m)`;
        // Determine: clock in or clock out
        try{
          const todaySnap=await db.collection('hrd_absensi').where('userId','==',currentUser.id).where('tanggal','==',todayStr()).get();
          let hasMasuk=false,hasPulang=false;
          todaySnap.forEach(d=>{if(d.data().tipe==='masuk')hasMasuk=true;if(d.data().tipe==='pulang')hasPulang=true;});
          if(!hasMasuk){
            btn.textContent='⏰ ABSEN MASUK (Selfie + GPS)';btn.style.background='var(--success)';btn.disabled=false;
            if(autoEl)autoEl.innerHTML='<span class="badge badge-info">Belum absen hari ini — Ambil foto lalu klik untuk Clock In</span>';
          }else if(!hasPulang){
            btn.textContent='🏠 ABSEN PULANG (Selfie + GPS)';btn.style.background='var(--warning)';btn.disabled=false;
            if(autoEl)autoEl.innerHTML='<span class="badge badge-success">Sudah Clock In — Ambil foto lalu klik untuk Clock Out</span>';
          }else{
            btn.textContent='✅ Sudah Lengkap';btn.disabled=true;btn.style.background='#9e9e9e';
            if(autoEl)autoEl.innerHTML='<span class="badge badge-success">✅ Absen hari ini sudah lengkap (masuk & pulang)</span>';
          }
        }catch(e){
          console.error('Error check today status:',e);
          // Tetap aktifkan tombol meskipun gagal cek status
          btn.textContent='⏰ ABSEN (Selfie + GPS)';btn.style.background='var(--success)';btn.disabled=false;
          if(autoEl)autoEl.innerHTML='<span class="badge badge-warning">⚠️ Gagal cek status hari ini, tapi lokasi valid</span>';
        }
      }else{
        locEl.textContent=`❌ Di luar radius kantor`;
        distEl.textContent=locStatus.nearest?`Jarak: ${locStatus.dist.toFixed(0)}m (radius max: ${locStatus.nearest.radius||locStatus.radius}m)`:'Tidak ada lokasi kantor terdaftar';
        btn.textContent='❌ Tidak Bisa Absen';btn.disabled=true;btn.style.background='var(--danger)';
        if(autoEl)autoEl.innerHTML='<span class="badge badge-danger">Anda berada di luar radius lokasi kantor yang terdaftar</span>';
      }
    }catch(e){
      console.error('Error autoDetectLocation:',e);
      statusEl.textContent=`❌ Error: ${e.message}`;
      btn.textContent='🔄 Coba Lagi';btn.disabled=false;btn.style.background='var(--primary)';btn.onclick=()=>autoDetectLocation();
    }
  },(err)=>{
    statusEl.textContent='❌ Gagal deteksi: '+err.message;
    btn.textContent='📍 Coba Lagi';btn.disabled=false;btn.onclick=()=>autoDetectLocation();
  },{enableHighAccuracy:true,timeout:10000});
}

// ── ABSEN DENGAN SELFIE — Validasi foto wajib sebelum clock in/out ──
async function doAbsenWithSelfie(){
  if(!capturedPhoto) return toast('📸 Ambil foto selfie dulu! Foto wajib sebagai validasi kehadiran.','warning');
  if(!currentGPS) return toast('📍 Lokasi GPS belum terdeteksi. Tunggu sebentar...','warning');
  // Determine action: clock in or clock out
  const todaySnap=await db.collection('hrd_absensi').where('userId','==',currentUser.id).where('tanggal','==',todayStr()).get();
  let hasMasuk=false,hasPulang=false;
  todaySnap.forEach(d=>{if(d.data().tipe==='masuk')hasMasuk=true;if(d.data().tipe==='pulang')hasPulang=true;});
  if(!hasMasuk){
    await doClockIn();
  }else if(!hasPulang){
    await doClockOut();
  }else{
    toast('✅ Sudah absen masuk & pulang hari ini','info');
  }
}

async function doAbsenOtomatis(){
  // Legacy fallback — redirect ke doAbsenWithSelfie
  return doAbsenWithSelfie();
}

async function loadShiftInfo() {
  const doc = await db.collection('hrd_settings').doc('absensi').get();
  const s = doc.exists ? doc.data() : {};
  const flex = s.flexTime || { enabled: true, durasiKerja: 8, durasiIstirahat: 1, jamMasukMin: '06:00', jamMasukMax: '12:00' };
  const el = document.getElementById('shiftInfo');
  if (!el) return;

  if (flex.enabled) {
    const totalJam = flex.durasiKerja + flex.durasiIstirahat;
    el.innerHTML = `<div class="text-xs" style="background:#e8f5e9;padding:8px 12px;border-radius:6px"><b>⏰ Jam Kerja Fleksibel:</b><br>
      ${flex.durasiKerja} jam kerja + ${flex.durasiIstirahat} jam istirahat = ${totalJam} jam total.<br>
      Clock in kapan saja (${flex.jamMasukMin} - ${flex.jamMasukMax}), clock out setelah ${totalJam} jam.</div>`;
  } else {
    const shifts = s.shifts || [{nama:'Reguler',jamMasuk:'08:00',jamPulang:'17:00',toleransi:10}];
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
  // Matikan kamera setelah foto diambil
  if(absensiStream){absensiStream.getTracks().forEach(t=>t.stop());absensiStream=null;}
  v.srcObject=null;
  // Langsung deteksi status absen setelah foto diambil
  autoDetectAndReady();
}

// Setelah foto diambil, langsung cek GPS & status absen
async function autoDetectAndReady(){
  const btn=document.getElementById('btnAbsenAction');
  const autoEl=document.getElementById('absenAutoStatus');
  if(!btn)return;
  // Jika GPS sudah ada, langsung cek status
  if(currentGPS){
    try{
      const locStatus=await getNearestOfficeLocation(currentGPS.lat,currentGPS.lng);
      if(locStatus.allowed){
        const todaySnap=await db.collection('hrd_absensi').where('userId','==',currentUser.id).where('tanggal','==',todayStr()).get();
        let hasMasuk=false,hasPulang=false;
        todaySnap.forEach(d=>{if(d.data().tipe==='masuk')hasMasuk=true;if(d.data().tipe==='pulang')hasPulang=true;});
        if(!hasMasuk){
          btn.textContent='⏰ ABSEN MASUK (Selfie + GPS)';btn.style.background='var(--success)';btn.disabled=false;
          if(autoEl)autoEl.innerHTML='<span class="badge badge-success">✅ Foto & lokasi siap — Klik untuk Clock In</span>';
        }else if(!hasPulang){
          btn.textContent='🏠 ABSEN PULANG (Selfie + GPS)';btn.style.background='var(--warning)';btn.disabled=false;
          if(autoEl)autoEl.innerHTML='<span class="badge badge-success">✅ Foto & lokasi siap — Klik untuk Clock Out</span>';
        }else{
          btn.textContent='✅ Sudah Lengkap';btn.disabled=true;btn.style.background='#9e9e9e';
          if(autoEl)autoEl.innerHTML='<span class="badge badge-success">✅ Absen hari ini sudah lengkap</span>';
        }
      }
    }catch(e){console.error('autoDetectAndReady error:',e);}
  }else{
    // GPS belum ada, trigger deteksi
    autoDetectLocation();
  }
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

  return { nearest, dist: nearestDist, distance: nearestDist, radius, allowed: nearestDist <= radius };
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

  // Check if today is a holiday
  const holidayInfo = await checkHoliday(todayStr());
  if (holidayInfo) {
    const tipeLabel = holidayInfo.tipe === 'nasional' ? 'Nasional' : holidayInfo.tipe === 'cuti_bersama' ? 'Cuti Bersama' : 'Perusahaan';
    const lanjut = confirm(`ℹ️ Hari ini adalah hari libur: ${holidayInfo.nama} (${tipeLabel}). Tetap ingin clock in?`);
    if (!lanjut) return;
  }

  const locationStatus = await getNearestOfficeLocation(currentGPS.lat, currentGPS.lng);
  if (!locationStatus.allowed) return toast(`Lokasi di luar radius "${locationStatus.nearest.nama}". Absen hanya boleh dari lokasi kantor terdaftar.`,'warning');
  const existing=await db.collection('hrd_absensi').where('userId','==',currentUser.id).where('tanggal','==',todayStr()).where('tipe','==','masuk').get();
  if(!existing.empty)return toast('Sudah clock in hari ini','warning');
  const now=new Date();

  // Check flex time settings
  const settDoc = await db.collection('hrd_settings').doc('absensi').get();
  const sett = settDoc.exists ? settDoc.data() : {};
  const flex = sett.flexTime || { enabled: true, durasiKerja: 8, durasiIstirahat: 1, jamMasukMin: '06:00', jamMasukMax: '12:00' };

  let status = 'tepat_waktu';
  let coreHoursViolation = false;

  if (flex.enabled) {
    // Flex mode: check if within allowed clock-in window
    const waktuSekarang = now.getHours()*60 + now.getMinutes();
    if (flex.jamMasukMin) {
      const [hMin,mMin] = flex.jamMasukMin.split(':').map(Number);
      if (waktuSekarang < hMin*60 + mMin) return toast(`Belum boleh clock in. Jam masuk paling awal: ${flex.jamMasukMin}`, 'warning');
    }
    if (flex.jamMasukMax) {
      const [hMax,mMax] = flex.jamMasukMax.split(':').map(Number);
      if (waktuSekarang > hMax*60 + mMax) return toast(`Sudah melewati batas clock in. Jam masuk paling akhir: ${flex.jamMasukMax}`, 'warning');
    }
    // Core hours check
    if (flex.coreHoursEnabled && flex.coreHoursStart) {
      const [chH, chM] = flex.coreHoursStart.split(':').map(Number);
      if (waktuSekarang > chH*60 + chM) {
        coreHoursViolation = true;
      }
    }
    status = 'tepat_waktu'; // No lateness check in flex mode
  } else {
    // Fixed shift mode: check lateness
    const shift = await getActiveShift();
    const [h,m] = shift.jamMasuk.split(':').map(Number);
    const batasWaktu = h*60 + m + (shift.toleransi||10);
    const waktuSekarang = now.getHours()*60 + now.getMinutes();
    status = waktuSekarang > batasWaktu ? 'terlambat' : 'tepat_waktu';
  }

  const shift = await getActiveShift();
  await db.collection('hrd_absensi').add({userId:currentUser.id,nama:currentUser.nama,departemen:currentUser.departemen||'',tanggal:todayStr(),waktu:now.toTimeString().slice(0,5),tipe:'masuk',foto:capturedPhoto,lat:currentGPS.lat,lng:currentGPS.lng,accuracy:currentGPS.accuracy,shift:shift.nama,status,coreHoursViolation,officeLocation:locationStatus.nearest.nama,officeDistance:locationStatus.dist,officeRadius:locationStatus.radius,flexMode:flex.enabled,createdAt:now.toISOString()});
  let clockInMsg = `✅ Clock In: ${now.toTimeString().slice(0,5)} ${flex.enabled?'(Jam Kerja Fleksibel)':status==='terlambat'?'(⚠️ Terlambat)':'(Tepat Waktu)'}`;
  if (coreHoursViolation) clockInMsg += ` ⚠️ Melewati core hours (${flex.coreHoursStart})`;
  toast(clockInMsg,'success');
  capturedPhoto=null;currentGPS=null;loadTodayHistory();checkTodayStatus();loadBreakStatus();loadCoreHoursStatus();
}

async function doClockOut() {
  if(!capturedPhoto)return toast('Ambil foto selfie dulu','warning');
  if(!currentGPS)return toast('Deteksi lokasi GPS dulu','warning');
  const locationStatus = await getNearestOfficeLocation(currentGPS.lat, currentGPS.lng);
  if (!locationStatus.allowed) return toast(`Lokasi di luar radius "${locationStatus.nearest.nama}". Absen hanya boleh dari lokasi kantor terdaftar.`,'warning');
  const existing=await db.collection('hrd_absensi').where('userId','==',currentUser.id).where('tanggal','==',todayStr()).where('tipe','==','pulang').get();
  if(!existing.empty)return toast('Sudah clock out hari ini','warning');
  const now=new Date();

  // Check flex time settings
  const settDoc = await db.collection('hrd_settings').doc('absensi').get();
  const sett = settDoc.exists ? settDoc.data() : {};
  const flex = sett.flexTime || { enabled: true, durasiKerja: 8, durasiIstirahat: 1, jamMasukMin: '06:00', jamMasukMax: '12:00' };

  let statusPulang = 'pulang';
  let jamKerjaActual = null;
  let lembur = false;
  let lemburJam = 0;
  let coreHoursViolation = false;

  if (flex.enabled) {
    // Get today's clock-in record
    const clockInSnap = await db.collection('hrd_absensi').where('userId','==',currentUser.id).where('tanggal','==',todayStr()).where('tipe','==','masuk').get();
    if (clockInSnap.empty) return toast('Belum clock in hari ini', 'warning');
    const clockInData = clockInSnap.docs[0].data();
    const [ciH, ciM] = clockInData.waktu.split(':').map(Number);
    const clockInMinutes = ciH * 60 + ciM;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const totalMinutesPresent = nowMinutes - clockInMinutes;

    // Calculate actual break duration from break records
    const breakStartSnap = await db.collection('hrd_absensi').where('userId','==',currentUser.id).where('tanggal','==',todayStr()).where('tipe','==','istirahat_mulai').get();
    const breakEndSnap = await db.collection('hrd_absensi').where('userId','==',currentUser.id).where('tanggal','==',todayStr()).where('tipe','==','istirahat_selesai').get();
    let actualBreakMinutes = 0;
    if (!breakStartSnap.empty && !breakEndSnap.empty) {
      const breakStarts = [];
      breakStartSnap.forEach(d => breakStarts.push(d.data()));
      const breakEnds = [];
      breakEndSnap.forEach(d => breakEnds.push(d.data()));
      for (let i = 0; i < Math.min(breakStarts.length, breakEnds.length); i++) {
        const [bsH, bsM] = breakStarts[i].waktu.split(':').map(Number);
        const [beH, beM] = breakEnds[i].waktu.split(':').map(Number);
        actualBreakMinutes += (beH*60 + beM) - (bsH*60 + bsM);
      }
    } else if (!breakStartSnap.empty && breakEndSnap.empty) {
      // Still on break - count from break start to now
      const bData = breakStartSnap.docs[0].data();
      const [bsH, bsM] = bData.waktu.split(':').map(Number);
      actualBreakMinutes = nowMinutes - (bsH*60 + bsM);
    }

    const configuredBreakMinutes = flex.durasiIstirahat * 60;
    const excessBreak = Math.max(0, actualBreakMinutes - configuredBreakMinutes);
    const effectiveWorkMinutes = totalMinutesPresent - actualBreakMinutes;
    const requiredWorkMinutes = flex.durasiKerja * 60;

    jamKerjaActual = effectiveWorkMinutes / 60;

    // Check overtime
    if (effectiveWorkMinutes > requiredWorkMinutes) {
      lembur = true;
      lemburJam = parseFloat(((effectiveWorkMinutes - requiredWorkMinutes) / 60).toFixed(1));
      statusPulang = 'lengkap';
    } else if (effectiveWorkMinutes >= requiredWorkMinutes) {
      statusPulang = 'lengkap';
    } else {
      const sisaJam = Math.floor((requiredWorkMinutes - effectiveWorkMinutes) / 60);
      const sisaMenit = (requiredWorkMinutes - effectiveWorkMinutes) % 60;
      const jamKerjaH = Math.floor(effectiveWorkMinutes / 60);
      const jamKerjaM = Math.round(effectiveWorkMinutes % 60);
      const confirmed = confirm(`Anda baru bekerja ${jamKerjaH} jam ${jamKerjaM} menit (ekskl. istirahat). Minimal ${flex.durasiKerja} jam kerja. Sisa waktu: ${sisaJam} jam ${Math.round(sisaMenit)} menit. Yakin clock out?`);
      if (!confirmed) return;
      statusPulang = 'kurang_jam';
    }

    // Core hours violation on clock-out
    if (flex.coreHoursEnabled && flex.coreHoursEnd) {
      const [ceH, ceM] = flex.coreHoursEnd.split(':').map(Number);
      if (nowMinutes < ceH*60 + ceM) {
        coreHoursViolation = true;
        toast(`⚠️ Anda keluar sebelum core hours berakhir (${flex.coreHoursEnd})`, 'warning');
      }
    }

    // Max clock-out time warning
    if (flex.jamPulangMax) {
      const [pmH, pmM] = flex.jamPulangMax.split(':').map(Number);
      if (nowMinutes > pmH*60 + pmM) {
        toast(`⚠️ Clock out melewati jam pulang maksimal (${flex.jamPulangMax})`, 'warning');
      }
    }
  }

  await db.collection('hrd_absensi').add({userId:currentUser.id,nama:currentUser.nama,departemen:currentUser.departemen||'',tanggal:todayStr(),waktu:now.toTimeString().slice(0,5),tipe:'pulang',foto:capturedPhoto,lat:currentGPS.lat,lng:currentGPS.lng,accuracy:currentGPS.accuracy,status:statusPulang,officeLocation:locationStatus.nearest.nama,officeDistance:locationStatus.dist,officeRadius:locationStatus.radius,flexMode:flex.enabled,jamKerjaActual:jamKerjaActual,lembur:lembur,lemburJam:lemburJam,coreHoursViolation:coreHoursViolation,createdAt:now.toISOString()});
  let msg = '';
  if (flex.enabled) {
    if (lembur) msg = `(🟣 Lembur ${lemburJam} jam)`;
    else if (statusPulang==='lengkap') msg = '(✅ Jam kerja lengkap)';
    else msg = `(⚠️ Kurang jam - ${jamKerjaActual.toFixed(1)} jam)`;
  }
  toast(`✅ Clock Out: ${now.toTimeString().slice(0,5)} ${msg}`,'success');
  capturedPhoto=null;currentGPS=null;loadTodayHistory();checkTodayStatus();loadBreakStatus();loadWeeklyAccumulation();
}

async function checkTodayStatus(){const snap=await db.collection('hrd_absensi').where('userId','==',currentUser.id).where('tanggal','==',todayStr()).get();let masuk=false,pulang=false;snap.forEach(d=>{if(d.data().tipe==='masuk')masuk=true;if(d.data().tipe==='pulang')pulang=true;});const el=document.getElementById('clockStatus');if(el){if(masuk&&pulang)el.innerHTML='<div class="badge badge-success" style="font-size:.9rem;padding:8px 16px">✅ Sudah In & Out</div>';else if(masuk)el.innerHTML='<div class="badge badge-info" style="font-size:.9rem;padding:8px 16px">⏰ Sudah In, belum Out</div>';else el.innerHTML='<div class="badge badge-warning" style="font-size:.9rem;padding:8px 16px">⚠️ Belum absen</div>';}}

async function loadTodayHistory(){const snap=await db.collection('hrd_absensi').where('tanggal','==',todayStr()).get();let h='';if(snap.empty)h='<p class="text-sm" style="color:#999">Belum ada absensi hari ini</p>';else snap.forEach(d=>{const p=d.data();const tipeLabel=p.tipe==='masuk'?'Clock In':p.tipe==='pulang'?'Clock Out':p.tipe==='dinas_luar'?'Dinas Luar':p.tipe==='istirahat_mulai'?'Mulai Istirahat':p.tipe==='istirahat_selesai'?'Selesai Istirahat':p.tipe;const badgeColor=p.tipe==='masuk'?'success':p.tipe==='pulang'?'info':p.tipe==='istirahat_mulai'?'warning':p.tipe==='istirahat_selesai'?'info':'warning';let lemburBadge='';if(p.lembur&&p.lemburJam)lemburBadge=` <span class="badge" style="background:#f3e5f5;color:#7b1fa2">Lembur ${p.lemburJam} jam</span>`;let coreViolBadge='';if(p.coreHoursViolation)coreViolBadge=' <span class="badge badge-warning">⚠️ Core Hours</span>';h+=`<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">${p.foto?`<img src="${p.foto}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">`:'<div style="width:36px;height:36px;border-radius:50%;background:#eee;display:flex;align-items:center;justify-content:center">👤</div>'}<div style="flex:1"><div class="fw-700 text-sm">${escHtml(p.nama)} ${p.tipe==='dinas_luar'?'<span class="badge badge-info">Dinas Luar</span>':''}${lemburBadge}${coreViolBadge}</div><div class="text-xs" style="color:#999">${tipeLabel} — ${p.waktu}</div></div><span class="badge badge-${badgeColor}">${p.status||p.tipe}</span></div>`;});const el=document.getElementById('todayHistory');if(el)el.innerHTML=h;}

// ── BREAK TRACKING ────────────────────────────────────────────

async function loadBreakStatus() {
  const breakActionsEl = document.getElementById('breakActions');
  const breakStatusEl = document.getElementById('breakStatus');
  if (!breakActionsEl || !breakStatusEl) return;

  // Check if clocked in today
  const masukSnap = await db.collection('hrd_absensi').where('userId','==',currentUser.id).where('tanggal','==',todayStr()).where('tipe','==','masuk').get();
  const pulangSnap = await db.collection('hrd_absensi').where('userId','==',currentUser.id).where('tanggal','==',todayStr()).where('tipe','==','pulang').get();

  if (masukSnap.empty || !pulangSnap.empty) {
    breakActionsEl.innerHTML = '';
    breakStatusEl.innerHTML = '';
    return;
  }

  // Check break status
  const breakStartSnap = await db.collection('hrd_absensi').where('userId','==',currentUser.id).where('tanggal','==',todayStr()).where('tipe','==','istirahat_mulai').get();
  const breakEndSnap = await db.collection('hrd_absensi').where('userId','==',currentUser.id).where('tanggal','==',todayStr()).where('tipe','==','istirahat_selesai').get();

  const startCount = breakStartSnap.size;
  const endCount = breakEndSnap.size;
  const isOnBreak = startCount > endCount;

  if (isOnBreak) {
    const lastBreakStart = breakStartSnap.docs[breakStartSnap.size - 1].data();
    breakActionsEl.innerHTML = `<button class="btn btn-info btn-sm" onclick="doEndBreak()">🔙 Selesai Istirahat</button>`;
    breakStatusEl.innerHTML = `<div class="text-xs" style="background:#fff3e0;padding:6px 10px;border-radius:6px">☕ Sedang istirahat sejak ${lastBreakStart.waktu}</div>`;
  } else {
    breakActionsEl.innerHTML = `<button class="btn btn-sm" style="background:#795548;color:#fff" onclick="doStartBreak()">☕ Mulai Istirahat</button>`;
    if (endCount > 0) {
      // Calculate total break time
      let totalBreakMin = 0;
      const starts = []; breakStartSnap.forEach(d => starts.push(d.data()));
      const ends = []; breakEndSnap.forEach(d => ends.push(d.data()));
      for (let i = 0; i < Math.min(starts.length, ends.length); i++) {
        const [bsH, bsM] = starts[i].waktu.split(':').map(Number);
        const [beH, beM] = ends[i].waktu.split(':').map(Number);
        totalBreakMin += (beH*60 + beM) - (bsH*60 + bsM);
      }
      breakStatusEl.innerHTML = `<div class="text-xs" style="background:#e8f5e9;padding:6px 10px;border-radius:6px">Istirahat: ${totalBreakMin} menit</div>`;
    } else {
      breakStatusEl.innerHTML = '';
    }
  }
}

async function doStartBreak() {
  const now = new Date();
  await db.collection('hrd_absensi').add({userId:currentUser.id,nama:currentUser.nama,departemen:currentUser.departemen||'',tanggal:todayStr(),waktu:now.toTimeString().slice(0,5),tipe:'istirahat_mulai',createdAt:now.toISOString()});
  toast('☕ Istirahat dimulai', 'info');
  loadBreakStatus(); loadTodayHistory();
}

async function doEndBreak() {
  const now = new Date();
  await db.collection('hrd_absensi').add({userId:currentUser.id,nama:currentUser.nama,departemen:currentUser.departemen||'',tanggal:todayStr(),waktu:now.toTimeString().slice(0,5),tipe:'istirahat_selesai',createdAt:now.toISOString()});
  toast('🔙 Istirahat selesai', 'success');
  loadBreakStatus(); loadTodayHistory();
}

// ── WEEKLY ACCUMULATION ───────────────────────────────────────

function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = d => d.toISOString().split('T')[0];
  return { start: fmt(monday), end: fmt(sunday) };
}

async function loadWeeklyAccumulation() {
  const el = document.getElementById('weeklyAccCard');
  if (!el) return;

  const settDoc = await db.collection('hrd_settings').doc('absensi').get();
  const sett = settDoc.exists ? settDoc.data() : {};
  const flex = sett.flexTime || {};
  if (!flex.weeklyAccEnabled) { el.style.display = 'none'; return; }

  const target = flex.weeklyTarget || 40;
  const { start, end } = getWeekDates();

  const snap = await db.collection('hrd_absensi').where('userId','==',currentUser.id).where('tanggal','>=',start).where('tanggal','<=',end).where('tipe','==','pulang').get();
  let totalHours = 0;
  snap.forEach(d => {
    const p = d.data();
    if (p.jamKerjaActual) totalHours += p.jamKerjaActual;
  });

  const pct = Math.min(100, (totalHours / target) * 100);
  const today = new Date();
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); // 1=Monday...7=Sunday
  const expectedByNow = (target / 5) * Math.min(dayOfWeek, 5);
  let color = '#4caf50'; // green
  if (totalHours < expectedByNow * 0.7) color = '#f44336'; // red - significantly behind
  else if (totalHours < expectedByNow * 0.9) color = '#ff9800'; // yellow - behind

  let warningHtml = '';
  if (dayOfWeek >= 5 && totalHours < target) {
    warningHtml = `<div class="text-xs mt-8" style="color:#f57f17">⚠️ Target mingguan belum tercapai (${totalHours.toFixed(1)}/${target} jam)</div>`;
  }

  el.style.display = 'block';
  el.innerHTML = `<div class="card-title mb-8">📊 Akumulasi Minggu Ini</div>
    <div style="display:flex;align-items:center;gap:12px">
      <div style="flex:1;background:#eee;border-radius:8px;height:20px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${color};border-radius:8px;transition:width .3s"></div>
      </div>
      <span class="fw-700" style="color:${color}">${totalHours.toFixed(1)}/${target} jam</span>
    </div>
    ${warningHtml}
    <div class="text-xs mt-8" style="color:#999">Senin - Minggu (${start} s/d ${end})</div>`;
}

// ── CORE HOURS STATUS ─────────────────────────────────────────

async function loadCoreHoursStatus() {
  const el = document.getElementById('coreHoursStatus');
  if (!el) return;

  const settDoc = await db.collection('hrd_settings').doc('absensi').get();
  const sett = settDoc.exists ? settDoc.data() : {};
  const flex = sett.flexTime || {};
  if (!flex.coreHoursEnabled) { el.innerHTML = ''; return; }

  const masukSnap = await db.collection('hrd_absensi').where('userId','==',currentUser.id).where('tanggal','==',todayStr()).where('tipe','==','masuk').get();
  if (masukSnap.empty) { el.innerHTML = ''; return; }

  const clockInData = masukSnap.docs[0].data();
  if (clockInData.coreHoursViolation) {
    el.innerHTML = `<div class="text-xs" style="background:#fff3e0;padding:6px 10px;border-radius:6px;color:#e65100">⚠️ Melewati core hours (${flex.coreHoursStart})</div>`;
  } else {
    el.innerHTML = `<div class="text-xs" style="background:#e8f5e9;padding:6px 10px;border-radius:6px;color:#2e7d32">✅ Core hours: ${flex.coreHoursStart} - ${flex.coreHoursEnd}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════
// ── DINAS LUAR — Form Pengajuan + Absen Selfie+GPS di Lokasi ──
// ── Uses BENEFIT_CONFIG_BY_GRADE via getGradeConfig/getUserGrade for grade-based benefit display ──
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
    const isPortal=!hasAccess(3);
    const snap = await db.collection('hrd_dinas_luar').get();
    let h = '<div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Tanggal</th><th>Tujuan</th><th>Grade</th><th>Rincian Biaya</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
    let hasData=false;
    snap.forEach(d=>{const p=d.data();
      // Portal staff: only show own data
      if(isPortal&&p.userId!==currentUser.id&&p.nama?.toLowerCase()!==currentUser.nama?.toLowerCase())return;
      hasData=true;
      // Build detailed benefit breakdown for Rincian Biaya column
      let rincian='-';
      if(p.totalEstimasi||p.biayaHarian||p.biayaTransportPP||p.biayaPenginapan||p.biayaMakan||p.uangHarian||p.maxTransport||p.maxHotel||p.maxMakan){
        rincian=`<div style="font-size:11px;line-height:1.6;white-space:nowrap">`;
        if(p.biayaHarian||p.uangHarian)rincian+=`<div>Uang Harian: <b>${formatCurrency(p.biayaHarian||p.uangHarian)}</b></div>`;
        if(p.biayaTransportPP!=null)rincian+=`<div>Transport PP: <b>${formatCurrency(p.biayaTransportPP)}</b></div>`;
        else if(p.maxTransport)rincian+=`<div>Transport: <b>${formatCurrency(p.maxTransport)}</b></div>`;
        if(p.biayaTransportLokal)rincian+=`<div>Transport Lokal: <b>${formatCurrency(p.biayaTransportLokal)}</b></div>`;
        if(p.biayaPenginapan!=null){
          rincian+=`<div>Penginapan: <b>${formatCurrency(p.biayaPenginapan)}</b>${p.jumlahMalam===0?' <span style="color:#e65100">(tdk menginap)</span>':''}</div>`;
        } else if(p.maxHotel)rincian+=`<div>Hotel: <b>${formatCurrency(p.maxHotel)}</b></div>`;
        if(p.biayaMakan!=null)rincian+=`<div>Makan: <b>${formatCurrency(p.biayaMakan)}</b></div>`;
        else if(p.maxMakan)rincian+=`<div>Makan: <b>${formatCurrency(p.maxMakan)}</b></div>`;
        if(p.biayaUangSaku)rincian+=`<div>Uang Saku: <b>${formatCurrency(p.biayaUangSaku)}</b></div>`;
        if(p.biayaLain)rincian+=`<div>Lain-lain: <b>${formatCurrency(p.biayaLain)}</b></div>`;
        if(p.totalEstimasi)rincian+=`<div style="border-top:1px solid #ccc;margin-top:2px;padding-top:2px;font-weight:700;color:var(--primary)">Total: ${formatCurrency(p.totalEstimasi)}</div>`;
        rincian+=`</div>`;
      }
      const badge=p.status==='approved'?'badge-success':p.status==='rejected'?'badge-danger':'badge-warning';h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${formatDate(p.tanggal)}</td><td>${escHtml(p.tujuan)}</td><td>${p.gradeJabatan?`<span class="badge badge-info">${escHtml(p.gradeJabatan)}</span>`:'-'}</td><td>${rincian}</td><td><span class="badge ${badge}">${p.status}</span></td><td><button class="btn btn-xs btn-info" onclick="viewDinasLuar('${d.id}')">👁️</button>${(!isPortal||p.userId===currentUser.id)?` <button class="btn btn-xs btn-primary" onclick="editDinasLuar('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_dinas_luar','${d.id}','dinas')">🗑️</button>`:''} ${p.status==='pending'&&hasAccess(3)?`<button class="btn btn-xs btn-success" onclick="approveDinas('${d.id}','approved')">✅</button>`:''}</td></tr>`;});
    if(!hasData) h += '<tr><td colspan="7" class="text-center">Belum ada pengajuan</td></tr>';
    h += '</tbody></table></div>';
    el.innerHTML = h;
  } else {
    // Riwayat absen dinas luar (selfie+GPS)
    const snap = await db.collection('hrd_absensi').where('tipe','==','dinas_luar').get();
    let h = '<div class="table-wrap"><table><thead><tr><th>Foto</th><th>Karyawan</th><th>Tanggal</th><th>Waktu</th><th>Lokasi</th><th>Tujuan</th><th>Aksi</th></tr></thead><tbody>';
    if(snap.empty) h += '<tr><td colspan="7" class="text-center">Belum ada absen dinas luar</td></tr>';
    else snap.forEach(d=>{const p=d.data();h+=`<tr><td>${p.foto?`<img src="${p.foto}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">`:'👤'}</td><td class="fw-700">${escHtml(p.nama)}</td><td>${formatDate(p.tanggal)}</td><td>${p.waktu}</td><td class="text-xs">${p.lat?.toFixed(4)||'-'}, ${p.lng?.toFixed(4)||'-'}</td><td>${escHtml(p.tujuanDinas||'-')}</td><td><button class="btn btn-xs btn-info" onclick="viewAbsenDinas('${d.id}')">👁️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_absensi','${d.id}','absensi')">🗑️</button></td></tr>`;});
    h += '</tbody></table></div>';
    el.innerHTML = h;
  }
}

async function modalDinasLuar() {
  const grade = await getUserGrade();
  const cfg = await getGradeConfig(grade);
  openModal(`<div class="modal-title">📝 Ajukan Dinas Luar (SPPD)</div>
    <div style="background:#e8f5e9;padding:12px;border-radius:8px;margin-bottom:16px;border-left:4px solid var(--success)">
      <div class="fw-700 text-sm mb-4">🎯 Grade Anda: <span class="badge badge-info">${escHtml(grade || 'STAFF')}</span> (${escHtml(cfg.label)})</div>
      <div class="text-sm" style="color:#555;line-height:1.6">
        <div>Uang Harian: ${formatCurrency(cfg.uangHarian)}/hari | Transport PP: max ${formatCurrency(cfg.maxTransport)}</div>
        <div>Hotel: max ${formatCurrency(cfg.maxHotel)}/malam (${escHtml(cfg.kelasHotel)}) | Makan: max ${formatCurrency(cfg.maxMakan)}/hari</div>
        <div>Uang Saku: ${formatCurrency(cfg.uangSaku)}/hari | Total Max/Hari: ${formatCurrency(cfg.totalMaxPerDay)}</div>
      </div>
    </div>
    <div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="dlNama" value="${escHtml(currentUser.nama)}"></div><div class="form-group"><label>Departemen</label><input class="form-control" id="dlDept" value="${escHtml(currentUser.departemen||'')}" readonly></div></div>
    <div class="grid-2"><div class="form-group"><label>Tanggal Mulai</label><input class="form-control" type="date" id="dlTgl" value="${todayStr()}" onchange="hitungEstimasiDinas()"></div><div class="form-group"><label>Tanggal Selesai</label><input class="form-control" type="date" id="dlTglSelesai" value="${todayStr()}" onchange="hitungEstimasiDinas()"></div></div>
    <div id="dlEstimasiInfo" class="mb-8"></div>
    <div class="fw-700 text-sm mb-8 mt-8 color-primary">💰 Rincian Biaya SPPD</div>
    <div class="form-group"><label>Uang Harian / Tunjangan Harian (Rp)</label><input class="form-control" type="number" id="dlBiayaHarian" value="0" oninput="hitungTotalDinas()"><div id="dlHelperHarian" class="text-sm" style="color:#888;margin-top:2px"></div></div>
    <div class="grid-2">
      <div class="form-group"><label>Biaya Transport PP (Rp)</label><input class="form-control" type="number" id="dlBiayaTransportPP" value="0" oninput="hitungTotalDinas()"><div id="dlHelperTransportPP" class="text-sm" style="color:#888;margin-top:2px">Berangkat + Pulang</div></div>
      <div class="form-group"><label>Biaya Transport Lokal (Rp)</label><input class="form-control" type="number" id="dlBiayaTransportLokal" value="0" oninput="hitungTotalDinas()"><div class="text-sm" style="color:#888;margin-top:2px">Di lokasi tujuan (taxi, ojol, dll)</div></div>
    </div>
    <div class="form-group"><label>Biaya Penginapan / Hotel (Rp)</label><input class="form-control" type="number" id="dlBiayaPenginapan" value="0" oninput="hitungTotalDinas()"><div id="dlHelperHotel" class="text-sm" style="color:#888;margin-top:2px"></div></div>
    <div class="grid-2">
      <div class="form-group"><label>Biaya Makan (Rp)</label><input class="form-control" type="number" id="dlBiayaMakan" value="0" oninput="hitungTotalDinas()"><div id="dlHelperMakan" class="text-sm" style="color:#888;margin-top:2px"></div></div>
      <div class="form-group"><label>Uang Saku (Rp)</label><input class="form-control" type="number" id="dlBiayaUangSaku" value="0" oninput="hitungTotalDinas()"><div id="dlHelperSaku" class="text-sm" style="color:#888;margin-top:2px"></div></div>
    </div>
    <div class="form-group"><label>Biaya Lain-lain (Rp)</label><input class="form-control" type="number" id="dlBiayaLain" value="0" oninput="hitungTotalDinas()"><div class="text-sm" style="color:#888;margin-top:2px">Parkir, tol, materai, dll</div></div>
    <div id="dlWarningGrade" class="mb-8"></div>
    <div id="dlTotalSection" style="background:#f0f4ff;padding:12px;border-radius:8px;margin-bottom:16px;border:2px solid var(--primary)">
      <div class="fw-700" style="font-size:1rem;color:var(--primary)">💰 Total Estimasi Biaya: <span id="dlTotalBiaya">Rp 0</span></div>
    </div>
    <div class="form-group"><label>Tujuan / Lokasi</label><input class="form-control" id="dlTujuan" placeholder="Nama klien / alamat tujuan"></div>
    <div class="form-group"><label>Keperluan</label><textarea class="form-control" id="dlKeperluan" placeholder="Jelaskan keperluan dinas luar"></textarea></div>
    <div class="grid-2"><div class="form-group"><label>Jam Berangkat</label><input class="form-control" type="time" id="dlJamGo"></div><div class="form-group"><label>Estimasi Kembali</label><input class="form-control" type="time" id="dlJamBack"></div></div>
    <button class="btn btn-primary" style="width:100%;padding:12px" onclick="simpanDinasLuar()">📝 Ajukan Dinas Luar</button>`);
  hitungEstimasiDinas();
}

function hitungEstimasiDinas(){
  const mulai=document.getElementById('dlTgl')?.value;
  const selesai=document.getElementById('dlTglSelesai')?.value;
  if(!mulai||!selesai)return;
  const hari=Math.ceil((new Date(selesai)-new Date(mulai))/(1000*60*60*24)+1);
  if(hari<=0)return;
  const grade=currentUser.gradeJabatan||'STAFF';
  const cfg=getGradeConfigSync(grade);
  const malam=Math.max(hari-1,0);

  // Auto-fill detailed fields
  const estHarian=cfg.uangHarian*hari;
  const estTransportPP=cfg.maxTransport;
  const estTransportLokal=0;
  const estPenginapan=cfg.maxHotel*malam;
  const estMakan=cfg.maxMakan*hari;
  const estSaku=cfg.uangSaku*hari;
  const estLain=0;

  document.getElementById('dlBiayaHarian').value=estHarian;
  document.getElementById('dlBiayaTransportPP').value=estTransportPP;
  document.getElementById('dlBiayaTransportLokal').value=estTransportLokal;
  document.getElementById('dlBiayaPenginapan').value=estPenginapan;
  document.getElementById('dlBiayaMakan').value=estMakan;
  document.getElementById('dlBiayaUangSaku').value=estSaku;
  document.getElementById('dlBiayaLain').value=estLain;

  // Helper texts with formula breakdown
  const helperHarian=document.getElementById('dlHelperHarian');
  if(helperHarian) helperHarian.innerHTML=`${hari} hari @ ${formatCurrency(cfg.uangHarian)}/hari`;

  const helperTransportPP=document.getElementById('dlHelperTransportPP');
  if(helperTransportPP) helperTransportPP.innerHTML=`Max transport PP: ${formatCurrency(cfg.maxTransport)} (Berangkat + Pulang)`;

  const helperHotel=document.getElementById('dlHelperHotel');
  if(helperHotel){
    if(malam===0){
      helperHotel.innerHTML='<span style="color:#e65100;font-weight:600">⚠️ Tidak menginap (pulang hari yang sama) - 0 malam</span>';
    } else {
      helperHotel.innerHTML=`${malam} malam @ ${formatCurrency(cfg.maxHotel)}/malam (${escHtml(cfg.kelasHotel)})`;
    }
  }

  const helperMakan=document.getElementById('dlHelperMakan');
  if(helperMakan) helperMakan.innerHTML=`${hari} hari @ ${formatCurrency(cfg.maxMakan)}/hari`;

  const helperSaku=document.getElementById('dlHelperSaku');
  if(helperSaku) helperSaku.innerHTML=`${hari} hari @ ${formatCurrency(cfg.uangSaku)}/hari`;

  // Info summary
  const infoEl=document.getElementById('dlEstimasiInfo');
  if(infoEl) infoEl.innerHTML=`<div class="text-sm" style="background:#fff3cd;padding:8px;border-radius:6px;color:#856404">📊 Durasi: <b>${hari} hari, ${malam} malam</b> | Grade: ${escHtml(grade)}${malam===0?' | <b>Tidak menginap</b>':''}</div>`;

  hitungTotalDinas();
  cekBatasGradeDinas();
}

function hitungTotalDinas(){
  const biayaHarian=parseInt(document.getElementById('dlBiayaHarian')?.value)||0;
  const biayaTransportPP=parseInt(document.getElementById('dlBiayaTransportPP')?.value)||0;
  const biayaTransportLokal=parseInt(document.getElementById('dlBiayaTransportLokal')?.value)||0;
  const biayaPenginapan=parseInt(document.getElementById('dlBiayaPenginapan')?.value)||0;
  const biayaMakan=parseInt(document.getElementById('dlBiayaMakan')?.value)||0;
  const biayaUangSaku=parseInt(document.getElementById('dlBiayaUangSaku')?.value)||0;
  const biayaLain=parseInt(document.getElementById('dlBiayaLain')?.value)||0;
  const total=biayaHarian+biayaTransportPP+biayaTransportLokal+biayaPenginapan+biayaMakan+biayaUangSaku+biayaLain;
  const totalEl=document.getElementById('dlTotalBiaya');
  if(totalEl) totalEl.textContent=formatCurrency(total);
  cekBatasGradeDinas();
}

function cekBatasGradeDinas(){
  const mulai=document.getElementById('dlTgl')?.value;
  const selesai=document.getElementById('dlTglSelesai')?.value;
  const warnEl=document.getElementById('dlWarningGrade');
  if(!warnEl||!mulai||!selesai)return;
  const hari=Math.ceil((new Date(selesai)-new Date(mulai))/(1000*60*60*24)+1);
  if(hari<=0){warnEl.innerHTML='';return;}
  const grade=currentUser.gradeJabatan||'STAFF';
  const cfg=getGradeConfigSync(grade);
  const malam=Math.max(hari-1,0);
  const warnings=[];

  const biayaHarian=parseInt(document.getElementById('dlBiayaHarian')?.value)||0;
  const biayaTransportPP=parseInt(document.getElementById('dlBiayaTransportPP')?.value)||0;
  const biayaPenginapan=parseInt(document.getElementById('dlBiayaPenginapan')?.value)||0;
  const biayaMakan=parseInt(document.getElementById('dlBiayaMakan')?.value)||0;
  const biayaUangSaku=parseInt(document.getElementById('dlBiayaUangSaku')?.value)||0;

  if(biayaHarian>cfg.uangHarian*hari) warnings.push('Uang Harian melebihi batas grade (max '+formatCurrency(cfg.uangHarian*hari)+' untuk '+hari+' hari)');
  if(biayaTransportPP>cfg.maxTransport) warnings.push('Transport PP melebihi batas grade (max '+formatCurrency(cfg.maxTransport)+')');
  if(malam>0&&biayaPenginapan>cfg.maxHotel*malam) warnings.push('Penginapan melebihi batas grade (max '+formatCurrency(cfg.maxHotel*malam)+' untuk '+malam+' malam)');
  if(malam===0&&biayaPenginapan>0) warnings.push('Penginapan diisi namun tidak menginap (0 malam). Harap sesuaikan jika memang pulang hari yang sama.');
  if(biayaMakan>cfg.maxMakan*hari) warnings.push('Biaya Makan melebihi batas grade (max '+formatCurrency(cfg.maxMakan*hari)+' untuk '+hari+' hari)');
  if(biayaUangSaku>cfg.uangSaku*hari) warnings.push('Uang Saku melebihi batas grade (max '+formatCurrency(cfg.uangSaku*hari)+' untuk '+hari+' hari)');

  if(warnings.length) warnEl.innerHTML='<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:8px;color:#856404" class="text-sm">\u26a0\ufe0f '+warnings.join('<br>\u26a0\ufe0f ')+'</div>';
  else warnEl.innerHTML='';
}

async function simpanDinasLuar() {
  const grade = await getUserGrade();
  const cfg = await getGradeConfig(grade);
  const tanggalSelesai = document.getElementById('dlTglSelesai')?.value || document.getElementById('dlTgl').value;
  const data = {nama:document.getElementById('dlNama').value,tanggal:document.getElementById('dlTgl').value,tanggalSelesai:tanggalSelesai,tujuan:document.getElementById('dlTujuan').value,keperluan:document.getElementById('dlKeperluan').value,jamBerangkat:document.getElementById('dlJamGo').value,jamKembali:document.getElementById('dlJamBack').value,status:'pending',userId:currentUser.id,createdAt:new Date().toISOString()};
  if(!data.tujuan)return toast('Tujuan wajib','warning');

  // Calculate duration
  const hari = Math.ceil((new Date(tanggalSelesai)-new Date(data.tanggal))/(1000*60*60*24)+1);
  const malam = Math.max(hari-1,0);

  // Read detailed cost fields
  const biayaHarian = parseInt(document.getElementById('dlBiayaHarian').value)||0;
  const biayaTransportPP = parseInt(document.getElementById('dlBiayaTransportPP').value)||0;
  const biayaTransportLokal = parseInt(document.getElementById('dlBiayaTransportLokal').value)||0;
  const biayaPenginapan = parseInt(document.getElementById('dlBiayaPenginapan').value)||0;
  const biayaMakan = parseInt(document.getElementById('dlBiayaMakan').value)||0;
  const biayaUangSaku = parseInt(document.getElementById('dlBiayaUangSaku').value)||0;
  const biayaLain = parseInt(document.getElementById('dlBiayaLain').value)||0;
  const totalEstimasi = biayaHarian + biayaTransportPP + biayaTransportLokal + biayaPenginapan + biayaMakan + biayaUangSaku + biayaLain;

  // Confirm if over limit
  const warnings = [];
  if(biayaHarian>cfg.uangHarian*hari) warnings.push('Uang Harian');
  if(biayaTransportPP>cfg.maxTransport) warnings.push('Transport PP');
  if(malam>0&&biayaPenginapan>cfg.maxHotel*malam) warnings.push('Penginapan');
  if(biayaMakan>cfg.maxMakan*hari) warnings.push('Makan');
  if(biayaUangSaku>cfg.uangSaku*hari) warnings.push('Uang Saku');
  if(warnings.length && !confirm('Beberapa item melebihi batas grade ('+warnings.join(', ')+'). Tetap ajukan?')) return;

  // Add grade and detailed benefit info
  data.gradeJabatan = grade || 'STAFF';
  data.jumlahHari = hari;
  data.jumlahMalam = malam;
  data.biayaHarian = biayaHarian;
  data.biayaTransportPP = biayaTransportPP;
  data.biayaTransportLokal = biayaTransportLokal;
  data.biayaPenginapan = biayaPenginapan;
  data.biayaMakan = biayaMakan;
  data.biayaUangSaku = biayaUangSaku;
  data.biayaLain = biayaLain;
  data.totalEstimasi = totalEstimasi;

  // Legacy fields for backward compatibility
  data.uangHarian = biayaHarian;
  data.maxTransport = biayaTransportPP + biayaTransportLokal;
  data.maxHotel = biayaPenginapan;
  data.maxMakan = biayaMakan + biayaUangSaku;

  const dinasLuarRef = await db.collection('hrd_dinas_luar').add(data);

  // Create linked SPPD record in hrd_perjalanan_dinas
  const noSPPD = 'SPPD/' + new Date().getFullYear() + '/' + String(Date.now()).slice(-6) + Math.random().toString(36).substr(2,3).toUpperCase();
  const sppdData = {
    noSPPD,
    nama: data.nama,
    departemen: currentUser.departemen || '',
    tujuan: data.tujuan,
    tanggalMulai: data.tanggal,
    tanggalSelesai: data.tanggalSelesai,
    keperluan: data.keperluan,
    status: 'pending',
    userId: currentUser.id,
    gradeJabatan: data.gradeJabatan,
    gradeConfigUsed: cfg.label,
    jumlahHari: hari,
    jumlahMalam: malam,
    biayaHarian: biayaHarian,
    biayaTransportPP: biayaTransportPP,
    biayaTransportLokal: biayaTransportLokal,
    biayaPenginapan: biayaPenginapan,
    biayaMakan: biayaMakan,
    biayaUangSaku: biayaUangSaku,
    biayaLain: biayaLain,
    totalEstimasi: totalEstimasi,
    dinasLuarId: dinasLuarRef.id,
    createdAt: new Date().toISOString()
  };
  const sppdRef = await db.collection('hrd_perjalanan_dinas').add(sppdData);

  // Update dinas luar record with SPPD reference
  await db.collection('hrd_dinas_luar').doc(dinasLuarRef.id).update({sppdId: sppdRef.id, noSPPD: noSPPD});

  await sendNotification('hr','Dinas Luar',`${data.nama} \u2192 ${data.tujuan} (SPPD: ${noSPPD})`);
  closeModalDirect();toast('Pengajuan dinas luar terkirim & SPPD dibuat','success');loadDinasTab('pengajuan');
}

async function approveDinas(id,status){
  await db.collection('hrd_dinas_luar').doc(id).update({status,approvedBy:currentUser.nama,approvedAt:new Date().toISOString()});
  // Propagate status to linked SPPD record
  const linkSnap=await db.collection('hrd_perjalanan_dinas').where('dinasLuarId','==',id).get();
  linkSnap.forEach(d=>d.ref.update({status,approvedBy:currentUser.nama,approvedAt:new Date().toISOString()}));
  toast('Updated','success');loadDinasTab('pengajuan');
}

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

function renderRekapAbsensi(container){container.innerHTML=`<div class="card"><div class="card-header"><div class="card-title">📊 Rekap Absensi</div><div class="flex gap-8"><input class="form-control" type="month" id="rekapBulan" value="${monthStr()}" onchange="loadRekapGrid()"><button class="btn btn-sm btn-info" onclick="loadRekapGrid()">🔍</button><button class="btn btn-sm btn-success" onclick="modalGenerateAbsensi()">⚡ Generate Periode</button></div></div><div id="rekapGrid">Loading...</div><div class="mt-16" id="rekapSummary"></div></div>`;loadRekapGrid();}

async function loadRekapGrid(){
  const bulan=document.getElementById('rekapBulan')?.value||monthStr();
  const days=getMonthDays(bulan);
  const startDate=bulan+'-01',endDate=bulan+'-'+String(days).padStart(2,'0');
  const[usersSnap,absenSnap,settDoc,cutiSnap,overtimeSnap,hariLiburSnap]=await Promise.all([db.collection('hrd_karyawan').where('status','==','aktif').get(),db.collection('hrd_absensi').get(),db.collection('hrd_settings').doc('absensi').get(),db.collection('hrd_cuti').where('status','==','approved').get(),db.collection('hrd_overtime').get(),db.collection('hrd_hari_libur').get()]);
  const sett = settDoc.exists ? settDoc.data() : {};
  const flex = sett.flexTime || { enabled: true, durasiKerja: 8, durasiIstirahat: 1 };
  // Build cuti map: userId -> {day: jenis}
  const cutiMap={};
  cutiSnap.forEach(d=>{const c=d.data();if(!c.mulai||!c.selesai)return;const uid=c.userId||c.nama;const start=new Date(c.mulai);const end=new Date(c.selesai);for(let dt=new Date(start);dt<=end;dt.setDate(dt.getDate()+1)){const ds=dt.toISOString().split('T')[0];if(ds>=startDate&&ds<=endDate){const day=dt.getDate();if(!cutiMap[uid])cutiMap[uid]={};cutiMap[uid][day]=c.jenis||'Cuti';}}});
  // Build overtime map: userId -> {day: true}
  const otMap={};
  overtimeSnap.forEach(d=>{const o=d.data();if(o.tanggal&&o.tanggal>=startDate&&o.tanggal<=endDate&&o.status==='approved'){const uid=o.userId||o.nama;const day=parseInt(o.tanggal.split('-')[2]);if(!otMap[uid])otMap[uid]={};otMap[uid][day]=true;}});
  // Build hari libur set
  const liburSet=new Set();hariLiburSnap.forEach(d=>{const h=d.data();if(h.tanggal&&h.tanggal>=startDate&&h.tanggal<=endDate)liburSet.add(parseInt(h.tanggal.split('-')[2]));});
  const users=[];usersSnap.forEach(d=>users.push({id:d.id,...d.data()}));
  // Portal mode: only show current user (unless GM/admin)
  const isPortalMode=window._portalAbsensiMode&&!hasAccess(2);
  const filteredUsers=isPortalMode?users.filter(u=>u.nama?.toLowerCase()===currentUser.nama?.toLowerCase()||u.id===currentUser.id):users;
  const absenMap={};
  const jamKerjaMap={};
  const lemburMap={};
  absenSnap.forEach(d=>{const p=d.data();if(!p.tanggal||p.tanggal<startDate||p.tanggal>endDate)return;const uid=p.userId||'';const pNama=(p.nama||'').toLowerCase();const day=parseInt(p.tanggal.split('-')[2]);
    // Index by userId
    if(uid){if(!absenMap[uid])absenMap[uid]={};if(p.tipe==='masuk')absenMap[uid][day]=p.status||'hadir';else if(p.tipe==='pulang'&&p.lembur){absenMap[uid][day]='lembur';if(!lemburMap[uid])lemburMap[uid]={};lemburMap[uid][day]=p.lemburJam||0;}else if(p.tipe==='pulang'&&(p.status==='kurang_jam'||p.status==='lengkap'))absenMap[uid][day]=p.status;else if(p.tipe==='pulang'&&p.jamKerjaActual){if(!jamKerjaMap[uid])jamKerjaMap[uid]={};jamKerjaMap[uid][day]=p.jamKerjaActual;}else if(p.tipe==='dinas_luar'&&!absenMap[uid][day])absenMap[uid][day]='dinas';}
    // Index by lowercase nama
    if(pNama){if(!absenMap[pNama])absenMap[pNama]={};if(p.tipe==='masuk'&&!absenMap[pNama][day])absenMap[pNama][day]=p.status||'hadir';else if(p.tipe==='dinas_luar'&&!absenMap[pNama][day])absenMap[pNama][day]='dinas';else if(p.tipe==='pulang'&&p.lembur&&!absenMap[pNama][day])absenMap[pNama][day]='lembur';else if(p.tipe==='pulang'&&p.status==='lengkap'&&!absenMap[pNama][day])absenMap[pNama][day]='lengkap';else if(p.tipe==='pulang'&&p.status==='kurang_jam'&&!absenMap[pNama][day])absenMap[pNama][day]='kurang_jam';}
  });

  let h='<div class="table-wrap"><table><thead><tr><th style="min-width:120px">Nama</th>';
  for(let i=1;i<=days;i++)h+=`<th style="width:28px;text-align:center;font-size:.65rem">${i}</th>`;
  h+='<th>Total</th><th>Lembur</th><th>Aksi</th></tr></thead><tbody>';
  let totalH=0,totalT=0,totalD=0,totalK=0,totalL=0,totalLembur=0,totalLemburJam=0;

  filteredUsers.forEach(u=>{
    // Merge absenMap from all possible keys (id, nama lowercase)
    const namaLow=(u.nama||'').toLowerCase();
    const userAbsen={...(absenMap[u.id]||{}),...(absenMap[namaLow]||{})};
    const userJamKerja={...(jamKerjaMap[u.id]||{}),...(jamKerjaMap[namaLow]||{})};
    const userLemburMap2={...(lemburMap[u.id]||{}),...(lemburMap[namaLow]||{})};
    h+=`<tr><td class="text-sm fw-700">${escHtml(u.nama)}</td>`;
    let ut=0;
    let userLemburJam=0;
    for(let i=1;i<=days;i++){
      const st=userAbsen[i];
      const jamKerja=userJamKerja[i];
      const lemburJam=userLemburMap2[i];
      // Check cuti/izin first (by userId or nama)
      const cutiStatus=cutiMap[u.id]?.[i]||cutiMap[u.nama]?.[i]||cutiMap[u.nama?.toLowerCase()]?.[i];
      const isOT=otMap[u.id]?.[i]||otMap[u.nama]?.[i];
      const isLibur=liburSet.has(i);
      let color='#eee',text='-',title='';
      if(isLibur&&!st){color='#9e9e9e';text='H';title=' title="Hari Libur"';}
      else if(cutiStatus&&!st){color='#00bcd4';text='C';title=` title="${cutiStatus}"`;ut++;}
      else if(st==='lembur'||isOT){color='#7b1fa2';text='L';ut++;totalLembur++;if(lemburJam){userLemburJam+=lemburJam;totalLemburJam+=lemburJam;}}
      else if(st==='tepat_waktu'||st==='hadir'){color='#4caf50';text='✓';ut++;totalH++;}
      else if(st==='terlambat'){color='#ff9800';text='T';ut++;totalT++;}
      else if(st==='dinas'){color='#2196f3';text='D';ut++;totalD++;}
      else if(st==='lengkap'){color='#4caf50';text='✓';ut++;totalL++;}
      else if(st==='kurang_jam'){color='#ff5722';text='K';ut++;totalK++;}
      if(flex.enabled&&jamKerja){title=` title="${jamKerja.toFixed(1)} jam"`;}
      h+=`<td style="text-align:center;background:${color};color:#fff;font-size:.6rem;font-weight:700;padding:3px"${title}>${text}</td>`;
    }
    h+=`<td class="fw-700 text-center">${ut}</td>`;
    h+=`<td class="fw-700 text-center" style="color:#7b1fa2">${userLemburJam>0?userLemburJam.toFixed(1)+'j':'-'}</td>`;
    h+=`<td><button class="btn btn-xs btn-info" onclick="editAbsenKaryawan('${u.id}','${(u.nama||'').replace(/'/g,"\\'")}','${bulan}')">✏️</button></td></tr>`;
  });
  h+='</tbody></table></div>';
  document.getElementById('rekapGrid').innerHTML=h;

  let summaryHtml = `<div class="stats-grid">
      <div class="stat-card" style="border-left-color:var(--success)"><div class="stat-value color-success">${totalH+totalL}</div><div class="stat-label">${flex.enabled?'Jam Lengkap':'Tepat Waktu'}</div></div>
      <div class="stat-card" style="border-left-color:var(--warning)"><div class="stat-value" style="color:var(--warning)">${totalT}</div><div class="stat-label">Terlambat</div></div>`;
  if(flex.enabled) summaryHtml += `<div class="stat-card" style="border-left-color:#ff5722"><div class="stat-value" style="color:#ff5722">${totalK}</div><div class="stat-label">Kurang Jam</div></div>`;
  summaryHtml += `<div class="stat-card" style="border-left-color:var(--info)"><div class="stat-value" style="color:var(--info)">${totalD}</div><div class="stat-label">Dinas Luar</div></div>
      <div class="stat-card" style="border-left-color:#7b1fa2"><div class="stat-value" style="color:#7b1fa2">${totalLembur}</div><div class="stat-label">Lembur (${totalLemburJam.toFixed(1)} jam)</div></div>
    </div>
    <div class="flex gap-8 mt-8 flex-wrap">
      <span class="text-xs"><span style="display:inline-block;width:12px;height:12px;background:#4caf50;border-radius:2px"></span> ${flex.enabled?'Lengkap':'Hadir'}</span>
      <span class="text-xs"><span style="display:inline-block;width:12px;height:12px;background:#ff9800;border-radius:2px"></span> Terlambat</span>`;
  if(flex.enabled) summaryHtml += `<span class="text-xs"><span style="display:inline-block;width:12px;height:12px;background:#ff5722;border-radius:2px"></span> Kurang Jam</span>`;
  summaryHtml += `<span class="text-xs"><span style="display:inline-block;width:12px;height:12px;background:#7b1fa2;border-radius:2px"></span> Lembur</span>
      <span class="text-xs"><span style="display:inline-block;width:12px;height:12px;background:#2196f3;border-radius:2px"></span> Dinas Luar</span>
      <span class="text-xs"><span style="display:inline-block;width:12px;height:12px;background:#00bcd4;border-radius:2px"></span> Cuti/Izin</span>
      <span class="text-xs"><span style="display:inline-block;width:12px;height:12px;background:#9e9e9e;border-radius:2px"></span> Hari Libur</span>
      <span class="text-xs"><span style="display:inline-block;width:12px;height:12px;background:#eee;border-radius:2px"></span> Tidak Hadir</span>
    </div>`;
  document.getElementById('rekapSummary').innerHTML=summaryHtml;
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



// ── EDIT ABSEN PER KARYAWAN ───────────────────────────────────
async function editAbsenKaryawan(userId, nama, bulan) {
  if(!userId||!bulan){toast('Data tidak valid','error');return;}
  window._editAbsenUserId=userId;
  window._editAbsenNama=nama;
  window._editAbsenBulan=bulan;
  const days = getMonthDays(bulan);
  const startDate = bulan + '-01', endDate = bulan + '-' + String(days).padStart(2, '0');
  let masuk=0,pulang=0,dinas=0,lembur=0;
  let records=[];
  try{
    const snap = await db.collection('hrd_absensi').get();
    snap.forEach(d => {
      const p = d.data();
      if(p.tanggal>=startDate&&p.tanggal<=endDate&&(p.userId===userId||p.nama===nama||(p.nama||'').toLowerCase()===nama.toLowerCase())){
        records.push({id:d.id,...p});
        if (p.tipe === 'masuk') masuk++;
        if (p.tipe === 'pulang') pulang++;
        if (p.tipe === 'dinas_luar') dinas++;
        if (p.tipe === 'pulang' && p.lembur) lembur += (p.lemburJam || 0);
      }
    });
  }catch(e){}
  records.sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||''));
  // Build records list
  let recHtml='';
  if(records.length){
    recHtml='<div class="fw-700 text-sm mb-8 mt-16">📋 Riwayat Absensi Bulan Ini:</div><div class="table-wrap" style="max-height:200px;overflow-y:auto"><table><thead><tr><th>Tgl</th><th>Tipe</th><th>Waktu</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
    records.forEach(r=>{recHtml+=`<tr><td>${r.tanggal?.split('-')[2]||'-'}</td><td>${r.tipe}</td><td>${r.waktu||'-'}</td><td>${r.status||'-'}</td><td><button class="btn btn-xs btn-danger" onclick="hapusSatuAbsen('${r.id}')">🗑️</button></td></tr>`;});
    recHtml+='</tbody></table></div>';
  }

  openModal(`<div class="modal-title">✏️ Edit Absensi — ${escHtml(nama)}</div>
    <div class="text-sm mb-16" style="color:#666">Periode: ${bulan} (${days} hari) | ID: ${userId}</div>
    <div class="stats-grid mb-16">
      <div class="stat-card"><div class="stat-value">${masuk}</div><div class="stat-label">Clock In</div></div>
      <div class="stat-card"><div class="stat-value">${pulang}</div><div class="stat-label">Clock Out</div></div>
      <div class="stat-card"><div class="stat-value">${dinas}</div><div class="stat-label">Dinas Luar</div></div>
      <div class="stat-card"><div class="stat-value">${lembur.toFixed(1)}</div><div class="stat-label">Lembur (jam)</div></div>
    </div>
    ${recHtml}
    <div class="fw-700 text-sm mb-8 mt-16 color-primary">➕ Tambah Absensi Manual</div>
    <div class="grid-2">
      <div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="editAbsTgl" value="${todayStr()}"></div>
      <div class="form-group"><label>Tipe</label><select class="form-control" id="editAbsTipe"><option value="masuk">Clock In</option><option value="pulang">Clock Out</option><option value="dinas_luar">Dinas Luar</option></select></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Waktu</label><input class="form-control" type="time" id="editAbsWaktu" value="08:00"></div>
      <div class="form-group"><label>Status</label><select class="form-control" id="editAbsStatus"><option value="hadir">Hadir</option><option value="tepat_waktu">Tepat Waktu</option><option value="terlambat">Terlambat</option><option value="lengkap">Lengkap</option><option value="kurang_jam">Kurang Jam</option></select></div>
    </div>
    <button class="btn btn-primary mt-8" onclick="simpanEditAbsen()">💾 Simpan</button>`, true);
}

async function simpanEditAbsen() {
  const tgl = document.getElementById('editAbsTgl').value;
  const tipe = document.getElementById('editAbsTipe').value;
  const waktu = document.getElementById('editAbsWaktu').value;
  const status = document.getElementById('editAbsStatus').value;
  if (!tgl) return toast('Pilih tanggal', 'warning');
  if (!waktu) return toast('Isi waktu', 'warning');
  const userId=window._editAbsenUserId;
  const nama=window._editAbsenNama||'';
  try{
    await db.collection('hrd_absensi').add({
      userId, nama, tanggal: tgl, waktu, tipe, status,
      departemen: currentUser.departemen||'', 
      manual: true, editedBy: currentUser.nama,
      createdAt: new Date().toISOString()
    });
    toast('✅ Absensi berhasil ditambahkan!', 'success');
    closeModalDirect();
    setTimeout(()=>loadRekapGrid(), 500);
  }catch(e){
    toast('Gagal simpan: '+e.message, 'error');
  }
}

async function hapusSatuAbsen(docId){
  if(!confirm('Hapus record absensi ini?'))return;
  await db.collection('hrd_absensi').doc(docId).delete();
  toast('Record dihapus','success');
  closeModalDirect();
  setTimeout(()=>loadRekapGrid(),300);
}

async function hapusAbsenHari() {
  const tgl = document.getElementById('editAbsTgl').value;
  if (!tgl) return toast('Pilih tanggal', 'warning');
  if (!confirm(`Hapus semua absensi ${tgl} untuk karyawan ini?`)) return;
  const userId=window._editAbsenUserId;
  const nama=window._editAbsenNama||'';
  const snap = await db.collection('hrd_absensi').get();
  const toDelete=[];
  snap.forEach(d=>{const p=d.data();if(p.tanggal===tgl&&(p.userId===userId||p.nama===nama||(p.nama||'').toLowerCase()===nama.toLowerCase()))toDelete.push(d.ref);});
  if(!toDelete.length)return toast('Tidak ada data di tanggal ini','info');
  const batch=db.batch();toDelete.forEach(ref=>batch.delete(ref));
  await batch.commit();
  toast(`${toDelete.length} record dihapus`, 'success');
  closeModalDirect();
  setTimeout(()=>loadRekapGrid(), 500);
}

// ── VIEW/EDIT DINAS LUAR ──────────────────────────────────────
function viewDinasLuar(id){
  db.collection('hrd_dinas_luar').doc(id).get().then(d=>{const p=d.data();
    let benefitHtml = '';
    if(p.gradeJabatan){
      const cfg = getGradeConfigSync(p.gradeJabatan);
      const hari = p.jumlahHari || 1;
      const malam = p.jumlahMalam != null ? p.jumlahMalam : Math.max(hari-1,0);
      benefitHtml = `<div style="background:#e8f5e9;padding:12px;border-radius:8px;margin-bottom:16px;border-left:4px solid var(--success)">
        <div class="fw-700 text-sm mb-4">🎯 Grade: <span class="badge badge-info">${escHtml(p.gradeJabatan)}</span> (${escHtml(cfg.label)})</div>
        <div class="text-sm mb-4" style="color:#555">Durasi: <b>${hari} hari, ${malam} malam</b>${malam===0?' (Tidak menginap)':''}</div>
        <table style="width:100%;font-size:0.85rem;border-collapse:collapse">
          <tr style="border-bottom:1px solid #c8e6c9"><td style="padding:4px 0">Uang Harian / Tunjangan</td><td style="text-align:right;font-weight:600">${formatCurrency(p.biayaHarian||p.uangHarian||0)}</td></tr>
          <tr style="border-bottom:1px solid #c8e6c9"><td style="padding:4px 0">Transport PP</td><td style="text-align:right;font-weight:600">${formatCurrency(p.biayaTransportPP||p.maxTransport||0)}</td></tr>
          <tr style="border-bottom:1px solid #c8e6c9"><td style="padding:4px 0">Transport Lokal</td><td style="text-align:right;font-weight:600">${formatCurrency(p.biayaTransportLokal||0)}</td></tr>
          <tr style="border-bottom:1px solid #c8e6c9"><td style="padding:4px 0">Penginapan / Hotel${malam===0?' <span style="color:#e65100">(Tidak menginap)</span>':''}</td><td style="text-align:right;font-weight:600">${formatCurrency(p.biayaPenginapan||p.maxHotel||0)}</td></tr>
          <tr style="border-bottom:1px solid #c8e6c9"><td style="padding:4px 0">Biaya Makan</td><td style="text-align:right;font-weight:600">${formatCurrency(p.biayaMakan||p.maxMakan||0)}</td></tr>
          <tr style="border-bottom:1px solid #c8e6c9"><td style="padding:4px 0">Uang Saku</td><td style="text-align:right;font-weight:600">${formatCurrency(p.biayaUangSaku||0)}</td></tr>
          <tr style="border-bottom:1px solid #c8e6c9"><td style="padding:4px 0">Lain-lain</td><td style="text-align:right;font-weight:600">${formatCurrency(p.biayaLain||0)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:700">Total Estimasi</td><td style="text-align:right;font-weight:700;color:var(--success);font-size:1rem">${formatCurrency(p.totalEstimasi||0)}</td></tr>
        </table>
      </div>`;
    }
    let sppdHtml = '';
    if(p.noSPPD){
      sppdHtml = `<div style="background:#f0f4ff;padding:10px;border-radius:8px;margin-bottom:16px;border-left:4px solid var(--primary)">
        <div class="fw-700 text-sm">🔗 Linked SPPD: <span class="badge badge-primary">${escHtml(p.noSPPD)}</span></div>
      </div>`;
    }
    openModal(`<div class="modal-title">📋 Detail Pengajuan Dinas Luar</div>
      ${benefitHtml}${sppdHtml}
      <div class="grid-2 mb-16"><div><b>Nama:</b> ${escHtml(p.nama)}</div><div><b>Tanggal:</b> ${formatDate(p.tanggal)}${p.tanggalSelesai?' s/d '+formatDate(p.tanggalSelesai):''}</div><div><b>Tujuan:</b> ${escHtml(p.tujuan||'-')}</div><div><b>Status:</b> <span class="badge badge-${p.status==='approved'?'success':p.status==='rejected'?'danger':'warning'}">${p.status}</span></div><div><b>Jam Berangkat:</b> ${p.jamBerangkat||'-'}</div><div><b>Estimasi Kembali:</b> ${p.jamKembali||'-'}</div></div>
      ${p.keperluan?`<div class="mb-16"><b>Keperluan:</b><div class="text-sm mt-8" style="background:#f8f9ff;padding:10px;border-radius:6px">${escHtml(p.keperluan)}</div></div>`:''}
      ${p.approvedBy?`<div><b>Diproses oleh:</b> ${escHtml(p.approvedBy)}</div>`:''}`);
  });
}

async function editDinasLuar(id){
  const d=await db.collection('hrd_dinas_luar').doc(id).get();const p=d.data();
  openModal(`<div class="modal-title">✏️ Edit Pengajuan Dinas Luar</div>
    <div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="edlNama" value="${escHtml(p.nama||'')}"></div><div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="edlTgl" value="${p.tanggal||''}"></div></div>
    <div class="form-group"><label>Tujuan / Lokasi</label><input class="form-control" id="edlTujuan" value="${escHtml(p.tujuan||'')}"></div>
    <div class="form-group"><label>Keperluan</label><textarea class="form-control" id="edlKeperluan">${escHtml(p.keperluan||'')}</textarea></div>
    <div class="grid-2"><div class="form-group"><label>Jam Berangkat</label><input class="form-control" type="time" id="edlJamGo" value="${p.jamBerangkat||''}"></div><div class="form-group"><label>Estimasi Kembali</label><input class="form-control" type="time" id="edlJamBack" value="${p.jamKembali||''}"></div></div>
    <button class="btn btn-primary" onclick="simpanEditDinas('${id}')">💾 Simpan</button>`);
}

async function simpanEditDinas(id){
  await db.collection('hrd_dinas_luar').doc(id).update({nama:document.getElementById('edlNama').value,tanggal:document.getElementById('edlTgl').value,tujuan:document.getElementById('edlTujuan').value,keperluan:document.getElementById('edlKeperluan').value,jamBerangkat:document.getElementById('edlJamGo').value,jamKembali:document.getElementById('edlJamBack').value,updatedAt:new Date().toISOString()});
  closeModalDirect();toast('Diupdate','success');loadDinasTab('pengajuan');
}

function viewAbsenDinas(id){
  db.collection('hrd_absensi').doc(id).get().then(d=>{const p=d.data();
    openModal(`<div class="modal-title">📸 Detail Absen Dinas Luar</div>
      <div style="text-align:center;margin-bottom:16px">${p.foto?`<img src="${p.foto}" style="width:120px;height:120px;border-radius:50%;object-fit:cover;border:3px solid var(--accent)">`:'<div style="width:80px;height:80px;border-radius:50%;background:#eee;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:2rem">👤</div>'}</div>
      <div class="grid-2 mb-16"><div><b>Nama:</b> ${escHtml(p.nama)}</div><div><b>Tanggal:</b> ${formatDate(p.tanggal)}</div><div><b>Waktu:</b> ${p.waktu||'-'}</div><div><b>Tujuan:</b> ${escHtml(p.tujuanDinas||'-')}</div><div><b>GPS:</b> ${p.lat?.toFixed(5)||'-'}, ${p.lng?.toFixed(5)||'-'}</div><div><b>Akurasi:</b> ${p.accuracy?p.accuracy.toFixed(0)+'m':'-'}</div></div>
      ${p.keteranganDinas?`<div><b>Keterangan:</b><div class="text-sm mt-8">${escHtml(p.keteranganDinas)}</div></div>`:''}`);
  });
}

// ── GENERATE ABSENSI PERIODE ──────────────────────────────────
function modalGenerateAbsensi(){
  openModal(`<div class="modal-title">⚡ Generate Absensi Periode</div>
    <p class="text-sm mb-16" style="color:#666">Generate kehadiran (Clock In + Clock Out) untuk semua karyawan aktif pada hari kerja (Senin-Jumat) dalam periode yang ditentukan.</p>
    <div class="grid-2">
      <div class="form-group"><label>Tanggal Mulai</label><input class="form-control" type="date" id="genAbsStart" value="2026-04-20"></div>
      <div class="form-group"><label>Tanggal Selesai</label><input class="form-control" type="date" id="genAbsEnd" value="2026-05-20"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Jam Masuk</label><input class="form-control" type="time" id="genAbsJamIn" value="08:00"></div>
      <div class="form-group"><label>Jam Pulang</label><input class="form-control" type="time" id="genAbsJamOut" value="17:00"></div>
    </div>
    <div class="form-group"><label>Status</label><select class="form-control" id="genAbsStatus"><option value="hadir">Hadir</option><option value="tepat_waktu">Tepat Waktu</option><option value="lengkap">Lengkap</option></select></div>
    <div style="background:#fff3e0;padding:10px;border-radius:6px;margin-bottom:16px;font-size:.78rem;border-left:4px solid var(--warning)">⚠️ Ini akan menambahkan data absensi untuk SEMUA karyawan aktif di setiap hari kerja dalam periode. Weekend (Sabtu-Minggu) akan di-skip. Data yang sudah ada TIDAK akan ditimpa.</div>
    <button class="btn btn-success" onclick="doGenerateAbsensi()">⚡ Generate Sekarang</button>`,true);
}

async function doGenerateAbsensi(){
  const startDate=document.getElementById('genAbsStart').value;
  const endDate=document.getElementById('genAbsEnd').value;
  const jamIn=document.getElementById('genAbsJamIn').value||'08:00';
  const jamOut=document.getElementById('genAbsJamOut').value||'17:00';
  const status=document.getElementById('genAbsStatus').value||'hadir';
  if(!startDate||!endDate)return toast('Isi tanggal mulai dan selesai','warning');
  if(!confirm(`Generate absensi dari ${startDate} s/d ${endDate} untuk semua karyawan aktif?\nHari kerja saja (Senin-Jumat).`))return;
  toast('Memproses generate...','info');
  // Load karyawan aktif
  const kSnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  const karyawan=[];kSnap.forEach(d=>karyawan.push({id:d.id,...d.data()}));
  // Load existing absensi to avoid duplicates
  const existSnap=await db.collection('hrd_absensi').get();
  const existSet=new Set();
  existSnap.forEach(d=>{const p=d.data();existSet.add(`${(p.nama||'').toLowerCase()}_${p.tanggal}_${p.tipe}`);});
  // Generate for each work day
  let count=0;
  const start=new Date(startDate);const end=new Date(endDate);
  for(let dt=new Date(start);dt<=end;dt.setDate(dt.getDate()+1)){
    const day=dt.getDay();
    if(day===0||day===6)continue; // Skip weekend
    const tgl=dt.toISOString().split('T')[0];
    for(const k of karyawan){
      const namaLow=(k.nama||'').toLowerCase();
      // Skip if already exists
      if(existSet.has(`${namaLow}_${tgl}_masuk`))continue;
      // Add Clock In
      await db.collection('hrd_absensi').add({userId:k.id,nama:k.nama,tanggal:tgl,waktu:jamIn,tipe:'masuk',status,departemen:k.departemen||'',manual:true,editedBy:currentUser.nama,createdAt:new Date().toISOString()});
      // Add Clock Out
      await db.collection('hrd_absensi').add({userId:k.id,nama:k.nama,tanggal:tgl,waktu:jamOut,tipe:'pulang',status:'lengkap',departemen:k.departemen||'',manual:true,editedBy:currentUser.nama,createdAt:new Date().toISOString()});
      count++;
    }
  }
  closeModalDirect();
  toast(`✅ ${count} hari absensi di-generate untuk ${karyawan.length} karyawan`,'success');
  loadRekapGrid();
}
