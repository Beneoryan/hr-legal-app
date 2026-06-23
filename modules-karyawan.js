'use strict';
// ============================================================
// MODULES.JS — HRD & Legal IJEF Corp v5.0
// ============================================================

// ── DASHBOARD ─────────────────────────────────────────────────
async function renderDashboard() {
  const main = document.getElementById('mainContent');
  main.innerHTML =
    '<div class="page-title"><span>🏠 Beranda</span></div><div class="stats-grid" id="dashStats">Loading...</div><div class="grid-2" id="dashWidgets"></div>';
  const [karyawan, cuti, absen, pengumuman, overtime, reimburse, dinas] = await Promise.all([
    db.collection('hrd_karyawan').where('status', '==', 'aktif').get(),
    db.collection('hrd_cuti').where('status', '==', 'pending').get(),
    db.collection('hrd_absensi').where('tanggal', '==', todayStr()).get(),
    db.collection('hrd_pengumuman').get(),
    db.collection('hrd_overtime').where('status', '==', 'pending').get(),
    db.collection('hrd_reimbursement').where('status', '==', 'pending').get(),
    db.collection('hrd_dinas_luar').where('status', '==', 'pending').get(),
  ]);
  const totalPending = cuti.size + overtime.size + reimburse.size + dinas.size;
  document.getElementById('dashStats').innerHTML = `
    <div class="stat-card" style="cursor:pointer" onclick="navigateTo('karyawan')"><div class="stat-icon">👥</div><div class="stat-value">${karyawan.size}</div><div class="stat-label">Total Karyawan</div></div>
    <div class="stat-card" style="cursor:pointer" onclick="navigateTo('absensi')"><div class="stat-icon">📍</div><div class="stat-value">${absen.size}</div><div class="stat-label">Hadir Hari Ini</div></div>
    <div class="stat-card" style="cursor:pointer" onclick="navigateTo('approval-center')"><div class="stat-icon">📋</div><div class="stat-value">${totalPending}</div><div class="stat-label">Pengajuan Pending</div></div>
    <div class="stat-card" style="cursor:pointer" onclick="navigateTo('pengumuman')"><div class="stat-icon">📢</div><div class="stat-value">${pengumuman.size}</div><div class="stat-label">Pengumuman</div></div>`;
  // Widgets
  let widgetLeft =
    '<div class="card"><div class="card-title mb-8">📋 Pengajuan Menunggu Approval</div>';
  if (!totalPending)
    widgetLeft += '<p class="text-sm" style="color:#999">Tidak ada pengajuan pending</p>';
  else {
    widgetLeft += `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px">`;
    if (cuti.size)
      widgetLeft += `<div style="cursor:pointer;padding:8px 12px;background:#fff3e0;border-radius:8px;font-size:.82rem" onclick="navigateTo('cuti')"><span class="fw-700">${cuti.size}</span> Cuti/Izin</div>`;
    if (overtime.size)
      widgetLeft += `<div style="cursor:pointer;padding:8px 12px;background:#e3f2fd;border-radius:8px;font-size:.82rem" onclick="navigateTo('overtime')"><span class="fw-700">${overtime.size}</span> Overtime</div>`;
    if (reimburse.size)
      widgetLeft += `<div style="cursor:pointer;padding:8px 12px;background:#e8f5e9;border-radius:8px;font-size:.82rem" onclick="navigateTo('reimbursement')"><span class="fw-700">${reimburse.size}</span> Reimburse</div>`;
    if (dinas.size)
      widgetLeft += `<div style="cursor:pointer;padding:8px 12px;background:#fce4ec;border-radius:8px;font-size:.82rem" onclick="navigateTo('absensi')"><span class="fw-700">${dinas.size}</span> Dinas Luar</div>`;
    widgetLeft += `</div>`;
  }
  widgetLeft += '</div>';
  // Pengumuman
  widgetLeft += '<div class="card"><div class="card-title mb-8">📢 Pengumuman Terbaru</div>';
  if (pengumuman.empty) widgetLeft += '<p class="text-sm" style="color:#999">Belum ada</p>';
  else {
    const items = [];
    pengumuman.forEach((d) => items.push({ id: d.id, ...d.data() }));
    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    items.slice(0, 5).forEach((p) => {
      widgetLeft += `<div style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="viewPengumuman('${p.id}')"><div class="fw-700 text-sm">${escHtml(p.judul)}</div><div class="text-xs" style="color:#999">${formatDate(p.createdAt)}</div></div>`;
    });
  }
  widgetLeft += '</div>';
  // Right: Aksi Cepat + Info User
  let widgetRight = `<div class="card" style="border-left:4px solid var(--accent)"><div class="card-title mb-8">👤 ${escHtml(currentUser.nama)}</div><div class="text-sm" style="color:#666">${escHtml(currentUser.posisi || currentUser.role)} • ${escHtml(currentUser.departemen || '-')}</div></div>`;
  widgetRight +=
    '<div class="card"><div class="card-title mb-8">⚡ Aksi Cepat</div><div class="flex flex-wrap gap-8"><button class="btn btn-sm" style="background:#0d47a1;color:#fff" onclick="navigateTo(\'daily-task\')">📋 Daily Task</button><button class="btn btn-primary btn-sm" onclick="navigateTo(\'absensi\')">📍 Absensi</button><button class="btn btn-info btn-sm" onclick="navigateTo(\'cuti\')">🏖️ Cuti</button><button class="btn btn-sm" style="background:#ff6f00;color:#fff" onclick="navigateTo(\'overtime\')">⏰ Overtime</button><button class="btn btn-success btn-sm" onclick="navigateTo(\'karyawan\')">👥 Karyawan</button><button class="btn btn-warning btn-sm" onclick="navigateTo(\'approval-center\')">✅ Approval</button><button class="btn btn-sm" style="background:#7b1fa2;color:#fff" onclick="navigateTo(\'penggajian\')">💰 Penggajian</button><button class="btn btn-sm" style="background:#00796b;color:#fff" onclick="navigateTo(\'reimbursement\')">🧾 Reimburse</button><button class="btn btn-sm" style="background:#1565c0;color:#fff" onclick="navigateTo(\'meeting\')">📅 Meeting</button><button class="btn btn-sm" style="background:#4e342e;color:#fff" onclick="navigateTo(\'chat\')">💬 Obrolan</button><button class="btn btn-sm" style="background:#37474f;color:#fff" onclick="navigateTo(\'broadcast\')">📡 Broadcast</button></div></div>';
  document.getElementById('dashWidgets').innerHTML = widgetLeft + widgetRight;
  // Birthday Reminder — only for manager+ and admin (level 3+)
  if (hasAccess(3)) {
    try {
      const allKary = [];
      karyawan.forEach((d) => allKary.push({ id: d.id, ...d.data() }));
      const today = new Date();
      const todayMD =
        String(today.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(today.getDate()).padStart(2, '0');
      // Check upcoming 7 days
      const upcoming = [];
      allKary.forEach((k) => {
        if (!k.tanggalLahir) return;
        const parts = k.tanggalLahir.split('-'); // YYYY-MM-DD
        if (parts.length < 3) return;
        const bMonth = parseInt(parts[1]);
        const bDay = parseInt(parts[2]);
        // Calculate days until birthday
        const thisYear = today.getFullYear();
        let bDate = new Date(thisYear, bMonth - 1, bDay);
        if (bDate < today) bDate = new Date(thisYear + 1, bMonth - 1, bDay);
        const diffDays = Math.floor((bDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          const age = thisYear - parseInt(parts[0]) + (diffDays < 0 ? 1 : 0);
          upcoming.push({ ...k, diffDays, age, bDay, bMonth });
        }
      });
      upcoming.sort((a, b) => a.diffDays - b.diffDays);
      if (upcoming.length) {
        let bdHtml =
          '<div class="card" style="border-left:4px solid #e91e63"><div class="card-title mb-8">🎂 Birthday Reminder</div>';
        upcoming.forEach((k) => {
          const label =
            k.diffDays === 0
              ? '<span class="badge badge-danger">HARI INI! 🎉</span>'
              : k.diffDays === 1
                ? '<span class="badge badge-warning">Besok</span>'
                : `<span class="badge badge-info">${k.diffDays} hari lagi</span>`;
          const avatar = k.foto
            ? `<img src="${k.foto}" style="width:32px;height:32px;border-radius:50%;object-fit:cover">`
            : `<div style="width:32px;height:32px;border-radius:50%;background:#e91e63;color:#fff;display:flex;align-items:center;justify-content:center;font-size:.8rem">${(k.nama || '?').charAt(0)}</div>`;
          bdHtml += `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
            ${avatar}
            <div style="flex:1"><div class="fw-700 text-sm">${escHtml(k.nama)}</div><div class="text-xs" style="color:#999">${escHtml(k.departemen || '-')} • ${escHtml(k.posisi || '-')}</div></div>
            <div style="text-align:right"><div>${label}</div><div class="text-xs" style="color:#999">${k.bDay}/${k.bMonth} (${k.age} tahun)</div></div>
          </div>`;
        });
        bdHtml += '</div>';
        document.getElementById('dashWidgets').innerHTML += bdHtml;
      }
    } catch (e) {
      console.warn('Birthday widget error:', e);
    }
  }
  // Load Daily Task summary for dashboard
  try {
    const dtSnap = await db.collection('hrd_daily_tasks').get();
    let totalTask = 0,
      doneTask = 0;
    const todayDate = todayStr();
    dtSnap.forEach((d) => {
      const data = d.data();
      if (data.userId === currentUser.id && data.tanggal === todayDate) {
        totalTask++;
        if (data.done) doneTask++;
      }
    });
    const pendingTask = totalTask - doneTask;
    let dtWidget =
      '<div class="card" style="border-left:4px solid #0d47a1"><div class="card-title mb-8">📋 Daily Task Hari Ini</div>';
    dtWidget += `<div style="display:flex;gap:16px;margin:8px 0"><div style="text-align:center"><div class="fw-700" style="font-size:1.3rem;color:#0d47a1">${totalTask}</div><div class="text-xs" style="color:#666">Total</div></div><div style="text-align:center"><div class="fw-700" style="font-size:1.3rem;color:#2e7d32">${doneTask}</div><div class="text-xs" style="color:#666">Selesai</div></div><div style="text-align:center"><div class="fw-700" style="font-size:1.3rem;color:#e65100">${pendingTask}</div><div class="text-xs" style="color:#666">Pending</div></div></div>`;
    dtWidget += `<button class="btn btn-sm" style="background:#0d47a1;color:#fff;margin-top:8px" onclick="navigateTo('daily-task')">Lihat Semua Task &rarr;</button></div>`;
    document.getElementById('dashWidgets').innerHTML += dtWidget;
  } catch (_e) {}
}

// ── DEPARTEMEN ────────────────────────────────────────────────
async function renderDepartemen() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>🏢 Departemen</span><div class="flex gap-8"><button class="btn btn-primary btn-sm" onclick="modalDepartemen()">+ Tambah</button><button class="btn btn-info btn-sm" onclick="syncDeptFromKaryawan()">🔄 Sinkron dari Karyawan</button></div></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Kode</th><th>Kepala</th><th>Jumlah</th><th>Aksi</th></tr></thead><tbody id="tblDept"></tbody></table></div></div>`;
  const snap = await db.collection('hrd_departemen').get();
  const karySnap = await db.collection('hrd_karyawan').where('status', '==', 'aktif').get();
  const countMap = {};
  karySnap.forEach((d) => {
    const dept = d.data().departemen || '';
    if (dept) countMap[dept] = (countMap[dept] || 0) + 1;
  });
  let h = '';
  if (snap.empty) h = '<tr><td colspan="5" class="text-center">Belum ada</td></tr>';
  else
    snap.forEach((d) => {
      const p = d.data();
      h += `<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.kode || '-')}</td><td>${escHtml(p.kepala || '-')}</td><td>${countMap[p.nama] || 0}</td><td><button class="btn btn-xs btn-info" onclick="modalDepartemen('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_departemen','${d.id}','departemen')">🗑️</button></td></tr>`;
    });
  document.getElementById('tblDept').innerHTML = h;
}
function modalDepartemen(id) {
  if (id)
    db.collection('hrd_departemen')
      .doc(id)
      .get()
      .then((d) => showDeptForm(id, d.data() || {}));
  else showDeptForm(null, {});
}
function showDeptForm(id, p) {
  openModal(
    `<div class="modal-title">${id ? 'Edit' : 'Tambah'} Departemen</div><div class="form-group"><label>Nama</label><input class="form-control" id="dNama" value="${escHtml(p.nama || '')}"></div><div class="form-group"><label>Kode</label><input class="form-control" id="dKode" value="${escHtml(p.kode || '')}"></div><div class="form-group"><label>Kepala</label><input class="form-control" id="dKepala" value="${escHtml(p.kepala || '')}"></div><button class="btn btn-primary" onclick="simpanDepartemen('${id || ''}')">Simpan</button>`
  );
}
async function simpanDepartemen(id) {
  const data = {
    nama: document.getElementById('dNama').value,
    kode: document.getElementById('dKode').value,
    kepala: document.getElementById('dKepala').value,
    updatedAt: new Date().toISOString(),
  };
  if (!data.nama) return toast('Nama wajib', 'warning');
  if (id) await db.collection('hrd_departemen').doc(id).update(data);
  else await db.collection('hrd_departemen').add({ ...data, createdAt: new Date().toISOString() });
  closeModalDirect();
  toast('Disimpan', 'success');
  renderDepartemen();
}

async function syncDeptFromKaryawan() {
  const kSnap = await db.collection('hrd_karyawan').where('status', '==', 'aktif').get();
  const depts = new Map();
  kSnap.forEach((d) => {
    const p = d.data();
    const dept = p.departemen;
    if (dept) {
      if (!depts.has(dept)) depts.set(dept, { count: 0, head: '' });
      depts.get(dept).count++;
      const pos = (p.posisi || '').toUpperCase();
      if (pos.includes('HEAD') || pos.includes('MANAGER') || pos.includes('GENERAL'))
        depts.get(dept).head = p.nama;
    }
  });
  const existSnap = await db.collection('hrd_departemen').get();
  const existing = new Set();
  existSnap.forEach((d) => existing.add(d.data().nama));
  let added = 0;
  for (const [nama, info] of depts) {
    if (!existing.has(nama)) {
      await db.collection('hrd_departemen').add({
        nama,
        kode: nama.substring(0, 3).toUpperCase(),
        kepala: info.head,
        createdAt: new Date().toISOString(),
      });
      added++;
    }
  }
  toast(`Sinkronisasi selesai: ${added} departemen baru ditambahkan`, 'success');
  renderDepartemen();
}

// ── POSISI ────────────────────────────────────────────────────
async function renderPosisi() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>💼 Posisi</span><div class="flex gap-8"><button class="btn btn-primary btn-sm" onclick="modalPosisi()">+ Tambah</button><button class="btn btn-info btn-sm" onclick="syncPosFromKaryawan()">🔄 Sinkron dari Karyawan</button></div></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Departemen</th><th>Level</th><th>Aksi</th></tr></thead><tbody id="tblPos"></tbody></table></div></div>`;
  const snap = await db.collection('hrd_posisi').get();
  let h = '';
  if (snap.empty) h = '<tr><td colspan="4" class="text-center">Belum ada</td></tr>';
  else
    snap.forEach((d) => {
      const p = d.data();
      h += `<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.departemen || '-')}</td><td>${escHtml(p.level || '-')}</td><td><button class="btn btn-xs btn-info" onclick="modalPosisi('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_posisi','${d.id}','posisi')">🗑️</button></td></tr>`;
    });
  document.getElementById('tblPos').innerHTML = h;
}
function modalPosisi(id) {
  if (id)
    db.collection('hrd_posisi')
      .doc(id)
      .get()
      .then((d) => showPosForm(id, d.data() || {}));
  else showPosForm(null, {});
}
function showPosForm(id, p) {
  openModal(
    `<div class="modal-title">${id ? 'Edit' : 'Tambah'} Posisi</div><div class="form-group"><label>Nama</label><input class="form-control" id="pNama" value="${escHtml(p.nama || '')}"></div><div class="form-group"><label>Departemen</label><input class="form-control" id="pDept" value="${escHtml(p.departemen || '')}"></div><div class="form-group"><label>Level</label><input class="form-control" id="pLevel" value="${escHtml(p.level || '')}"></div><button class="btn btn-primary" onclick="simpanPosisi('${id || ''}')">Simpan</button>`
  );
}
async function simpanPosisi(id) {
  const data = {
    nama: document.getElementById('pNama').value,
    departemen: document.getElementById('pDept').value,
    level: document.getElementById('pLevel').value,
    updatedAt: new Date().toISOString(),
  };
  if (!data.nama) return toast('Nama wajib', 'warning');
  if (id) await db.collection('hrd_posisi').doc(id).update(data);
  else await db.collection('hrd_posisi').add({ ...data, createdAt: new Date().toISOString() });
  closeModalDirect();
  toast('Disimpan', 'success');
  renderPosisi();
}

async function syncPosFromKaryawan() {
  const kSnap = await db.collection('hrd_karyawan').where('status', '==', 'aktif').get();
  const positions = new Map();
  kSnap.forEach((d) => {
    const p = d.data();
    const pos = p.posisi;
    const dept = p.departemen || '';
    if (pos && !positions.has(pos)) positions.set(pos, dept);
  });
  const existSnap = await db.collection('hrd_posisi').get();
  const existing = new Set();
  existSnap.forEach((d) => existing.add(d.data().nama));
  let added = 0;
  for (const [nama, dept] of positions) {
    if (!existing.has(nama)) {
      await db
        .collection('hrd_posisi')
        .add({ nama, departemen: dept, level: '', createdAt: new Date().toISOString() });
      added++;
    }
  }
  toast(`Sinkronisasi selesai: ${added} posisi baru ditambahkan`, 'success');
  renderPosisi();
}

// ── CABANG ────────────────────────────────────────────────────
async function renderCabang() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>🏛️ Cabang</span><button class="btn btn-primary btn-sm" onclick="modalCabang()">+ Tambah</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Kota</th><th>Lat/Lng</th><th>Radius</th><th>Aksi</th></tr></thead><tbody id="tblCab"></tbody></table></div></div>`;
  const snap = await db.collection('hrd_cabang').get();
  let h = '';
  if (snap.empty) h = '<tr><td colspan="5" class="text-center">Belum ada</td></tr>';
  else
    snap.forEach((d) => {
      const p = d.data();
      h += `<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.kota || '-')}</td><td>${p.lat || 0},${p.lng || 0}</td><td>${p.radius || 10}m</td><td><button class="btn btn-xs btn-info" onclick="modalCabang('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_cabang','${d.id}','cabang')">🗑️</button></td></tr>`;
    });
  document.getElementById('tblCab').innerHTML = h;
}
function modalCabang(id) {
  if (id)
    db.collection('hrd_cabang')
      .doc(id)
      .get()
      .then((d) => showCabForm(id, d.data() || {}));
  else showCabForm(null, {});
}
function showCabForm(id, p) {
  openModal(
    `<div class="modal-title">${id ? 'Edit' : 'Tambah'} Cabang</div><div class="form-group"><label>Nama</label><input class="form-control" id="cNama" value="${escHtml(p.nama || '')}"></div><div class="grid-2"><div class="form-group"><label>Kota</label><input class="form-control" id="cKota" value="${escHtml(p.kota || '')}"></div><div class="form-group"><label>Radius (m)</label><input class="form-control" type="number" id="cRadius" value="${p.radius || 10}"></div></div><div class="grid-2"><div class="form-group"><label>Latitude</label><input class="form-control" id="cLat" value="${p.lat || ''}"></div><div class="form-group"><label>Longitude</label><input class="form-control" id="cLng" value="${p.lng || ''}"></div></div><button class="btn btn-primary" onclick="simpanCabang('${id || ''}')">Simpan</button>`
  );
}
async function simpanCabang(id) {
  const data = {
    nama: document.getElementById('cNama').value,
    kota: document.getElementById('cKota').value,
    lat: parseFloat(document.getElementById('cLat').value) || 0,
    lng: parseFloat(document.getElementById('cLng').value) || 0,
    radius: parseInt(document.getElementById('cRadius').value) || 10,
    updatedAt: new Date().toISOString(),
  };
  if (!data.nama) return toast('Nama wajib', 'warning');
  if (id) await db.collection('hrd_cabang').doc(id).update(data);
  else await db.collection('hrd_cabang').add({ ...data, createdAt: new Date().toISOString() });
  closeModalDirect();
  toast('Disimpan', 'success');
  renderCabang();
}

// ── KARYAWAN ──────────────────────────────────────────────────
async function renderKaryawan() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>👥 Data Karyawan</span><div><button class="btn btn-primary btn-sm" onclick="modalKaryawan()">+ Tambah</button> <button class="btn btn-secondary btn-sm" onclick="modalImportKaryawan()">⬇️ Import</button></div></div><div class="card"><div class="flex gap-8 mb-16"><input class="form-control" placeholder="🔍 Cari nama/NIP..." id="srcKary" oninput="filterKaryawan()"><select class="form-control" style="max-width:180px" id="filterDept" onchange="filterKaryawan()"><option value="">Semua Dept</option></select></div><div class="table-wrap"><table><thead><tr><th>NIP</th><th>Nama</th><th>Departemen</th><th>Posisi</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblKary"></tbody></table></div></div>`;
  const snap = await db.collection('hrd_karyawan').get();
  window._karyawanData = [];
  const depts = new Set();
  snap.forEach((d) => {
    const p = { id: d.id, ...d.data() };
    window._karyawanData.push(p);
    depts.add(p.departemen || '');
  });
  const sel = document.getElementById('filterDept');
  depts.forEach((d) => {
    if (d) sel.innerHTML += `<option>${escHtml(d)}</option>`;
  });
  filterKaryawan();
}
function filterKaryawan() {
  const q = (document.getElementById('srcKary')?.value || '').toLowerCase(),
    dept = document.getElementById('filterDept')?.value || '';
  const filtered = (window._karyawanData || []).filter((k) => {
    if (q && !k.nama?.toLowerCase().includes(q) && !k.nip?.toLowerCase().includes(q)) return false;
    if (dept && k.departemen !== dept) return false;
    return true;
  });
  let h = '';
  if (!filtered.length) h = '<tr><td colspan="6" class="text-center">Tidak ada data</td></tr>';
  else
    filtered.forEach((k) => {
      h += `<tr><td>${escHtml(k.nip || '-')}</td><td class="fw-700">${escHtml(k.nama)}</td><td>${escHtml(k.departemen || '-')}</td><td>${escHtml(k.posisi || '-')}</td><td><span class="badge badge-${k.status === 'aktif' ? 'success' : 'danger'}">${k.status || 'aktif'}</span></td><td><button class="btn btn-xs btn-info" onclick="modalKaryawan('${k.id}')">✏️</button> <button class="btn btn-xs btn-primary" onclick="detailKaryawan('${k.id}')">👁️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_karyawan','${k.id}','karyawan')">🗑️</button></td></tr>`;
    });
  document.getElementById('tblKary').innerHTML = h;
}
function modalKaryawan(id) {
  if (id)
    db.collection('hrd_karyawan')
      .doc(id)
      .get()
      .then((d) => showKaryForm(id, d.data() || {}));
  else showKaryForm(null, {});
}
function showKaryForm(id, p) {
  openModal(
    `<div class="modal-title">${id ? 'Edit' : 'Tambah'} Karyawan</div>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;padding-bottom:16px;border-bottom:2px solid var(--border)">
      <div id="kFotoPreview" style="width:72px;height:72px;border-radius:50%;border:3px solid var(--accent);overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f5f5f5;font-size:1.8rem;cursor:pointer" onclick="document.getElementById('kFotoFile').click()">${p.foto ? `<img src="${p.foto}" style="width:100%;height:100%;object-fit:cover">` : (p.nama || '?').charAt(0)}</div>
      <div><input type="file" id="kFotoFile" accept="image/png,image/jpeg" style="display:none" onchange="previewKaryFoto(this)"><button class="btn btn-sm btn-primary" onclick="document.getElementById('kFotoFile').click()">📷 Upload Foto</button><div class="text-xs mt-4" style="color:#999">Foto profil karyawan (sinkron ke struktur org & portal)</div></div>
    </div>
    <div style="border-bottom:2px solid var(--border);padding-bottom:14px;margin-bottom:14px"><div class="fw-700 color-primary mb-8">👤 Data Personal</div><div class="grid-2"><div class="form-group"><label>Nama Lengkap</label><input class="form-control" id="kNama" value="${escHtml(p.nama || '')}"></div><div class="form-group"><label>NIP</label><input class="form-control" id="kNip" value="${escHtml(p.nip || generateNIP())}"></div><div class="form-group"><label>NIK (KTP)</label><input class="form-control" id="kNIK" value="${escHtml(p.nik || '')}" placeholder="16 digit"></div><div class="form-group"><label>No. Kartu Keluarga</label><input class="form-control" id="kNoKK" value="${escHtml(p.noKK || '')}"></div><div class="form-group"><label>No. Passport</label><input class="form-control" id="kPassport" value="${escHtml(p.noPassport || '')}"></div><div class="form-group"><label>Jenis Kelamin</label><select class="form-control" id="kGender"><option value="">-- Pilih --</option><option value="Laki-laki" ${p.jenisKelamin === 'Laki-laki' ? 'selected' : ''}>Laki-laki</option><option value="Perempuan" ${p.jenisKelamin === 'Perempuan' ? 'selected' : ''}>Perempuan</option></select></div><div class="form-group"><label>Tanggal Lahir</label><input class="form-control" type="date" id="kTglLahir" value="${p.tanggalLahir || ''}"></div><div class="form-group"><label>Tempat Lahir</label><input class="form-control" id="kTmptLahir" value="${escHtml(p.tempatLahir || '')}"></div><div class="form-group"><label>Email</label><input class="form-control" id="kEmail" value="${escHtml(p.email || '')}"></div><div class="form-group"><label>Telepon</label><input class="form-control" id="kTelp" value="${escHtml(p.telepon || '')}"></div></div><div class="form-group"><label>Alamat</label><textarea class="form-control" id="kAlamat" style="min-height:50px">${escHtml(p.alamat || '')}</textarea></div></div>
    <div style="border-bottom:2px solid var(--border);padding-bottom:14px;margin-bottom:14px"><div class="fw-700 color-primary mb-8">🏢 Office Detail</div><div class="grid-2"><div class="form-group"><label>Departemen</label><input class="form-control" id="kDept" value="${escHtml(p.departemen || '')}"></div><div class="form-group"><label>Posisi</label><input class="form-control" id="kPos" value="${escHtml(p.posisi || '')}"></div><div class="form-group"><label>Cabang</label><input class="form-control" id="kCabang" value="${escHtml(p.cabang || '')}"></div><div class="form-group"><label>Jadwal Kantor</label><input class="form-control" id="kJadwal" value="${escHtml(p.jadwalKantor || '')}" placeholder="Senin-Jumat 08:00-17:00"></div><div class="form-group"><label>Tipe Karyawan</label><select class="form-control" id="kTipeKary"><option value="PKWTT" ${p.tipeKaryawan === 'PKWTT' || p.tipeKaryawan === 'tetap' ? 'selected' : ''}>PKWTT</option><option value="PKWT" ${p.tipeKaryawan === 'PKWT' || p.tipeKaryawan === 'kontrak' ? 'selected' : ''}>PKWT</option><option value="PROBATION" ${p.tipeKaryawan === 'PROBATION' || p.tipeKaryawan === 'magang' ? 'selected' : ''}>PROBATION</option><option value="FREELANCE" ${p.tipeKaryawan === 'FREELANCE' || p.tipeKaryawan === 'freelance' ? 'selected' : ''}>FREELANCE</option></select></div><div class="form-group"><label>Tipe User</label><select class="form-control" id="kTipeUser"><option value="office" ${p.tipeUser === 'office' ? 'selected' : ''}>Office</option><option value="field" ${p.tipeUser === 'field' ? 'selected' : ''}>Field</option><option value="remote" ${p.tipeUser === 'remote' ? 'selected' : ''}>Remote</option><option value="hybrid" ${p.tipeUser === 'hybrid' ? 'selected' : ''}>Hybrid</option></select></div><div class="form-group"><label>Ruang Kerja</label><input class="form-control" id="kRuangKerja" value="${escHtml(p.ruangKerja || '')}" placeholder="Office, Lantai 2, dll"></div><div class="form-group"><label>Tgl Bergabung</label><input class="form-control" type="date" id="kJoin" value="${p.tanggalMasuk || ''}"></div><div class="form-group"><label>Status</label><select class="form-control" id="kStatus"><option value="aktif" ${p.status === 'aktif' ? 'selected' : ''}>Aktif</option><option value="nonaktif" ${p.status === 'nonaktif' ? 'selected' : ''}>Nonaktif</option><option value="probation" ${p.status === 'probation' ? 'selected' : ''}>Probation</option><option value="kontrak" ${p.status === 'kontrak' ? 'selected' : ''}>Kontrak</option></select></div><div class="form-group"><label>Atasan</label><input class="form-control" id="kAtasan" value="${escHtml(p.atasan || '')}"></div></div></div>
    <div style="border-bottom:2px solid var(--border);padding-bottom:14px;margin-bottom:14px"><div class="fw-700 color-primary mb-8">💳 Detail Rekening & BPJS</div><div class="grid-2"><div class="form-group"><label>Nama Bank / E-Wallet</label><input class="form-control" id="kBank" value="${escHtml(p.namaBank || '')}" placeholder="BCA, Mandiri, GoPay, dll"></div><div class="form-group"><label>No. Rekening / E-Wallet</label><input class="form-control" id="kNoRek" value="${escHtml(p.noRekening || '')}"></div><div class="form-group"><label>Nama di Rekening</label><input class="form-control" id="kNamaRek" value="${escHtml(p.namaDiRekening || '')}"></div><div class="form-group"><label>Tipe Rekening</label><select class="form-control" id="kTipeRek"><option value="salary" ${p.tipeRekening === 'salary' ? 'selected' : ''}>Salary</option><option value="savings" ${p.tipeRekening === 'savings' ? 'selected' : ''}>Savings</option><option value="ewallet" ${p.tipeRekening === 'ewallet' ? 'selected' : ''}>E-Wallet</option></select></div><div class="form-group"><label>No. BPJS TK</label><input class="form-control" id="kBPJSTK" value="${escHtml(p.bpjsKetenagakerjaan || '')}"></div><div class="form-group"><label>No. Asuransi</label><input class="form-control" id="kAsuransi" value="${escHtml(p.asuransi || '')}"></div><div class="form-group"><label>Gaji Pokok</label><input class="form-control" type="number" id="kGaji" value="${p.gajiPokok || 0}"></div><div class="form-group"><label>Grade Jabatan</label><input class="form-control" id="kGrade" value="${escHtml(p.gradeJabatan || '')}" placeholder="BOD/HEAD/SENIOR HEAD/STAFF"></div></div></div>
    <div style="border-bottom:2px solid var(--border);padding-bottom:14px;margin-bottom:14px"><div class="fw-700 color-primary mb-8">📚 Pendidikan & Pribadi</div><div class="grid-2"><div class="form-group"><label>Pendidikan Terakhir</label><select class="form-control" id="kPendidikan"><option value="">-- Pilih --</option><option ${p.pendidikan === 'SD' ? 'selected' : ''}>SD</option><option ${p.pendidikan === 'SMP' ? 'selected' : ''}>SMP</option><option ${p.pendidikan === 'SMA' ? 'selected' : ''}>SMA</option><option ${p.pendidikan === 'SMK' ? 'selected' : ''}>SMK</option><option ${p.pendidikan === 'D3' ? 'selected' : ''}>D3</option><option ${p.pendidikan === 'S1' ? 'selected' : ''}>S1</option><option ${p.pendidikan === 'S2' ? 'selected' : ''}>S2</option></select></div><div class="form-group"><label>Nama Sekolah/Universitas</label><input class="form-control" id="kSekolah" value="${escHtml(p.namaSekolah || '')}"></div><div class="form-group"><label>Status Pernikahan</label><select class="form-control" id="kNikah"><option value="">-- Pilih --</option><option ${p.statusPernikahan === 'Belum Menikah' ? 'selected' : ''}>Belum Menikah</option><option ${p.statusPernikahan === 'Menikah' ? 'selected' : ''}>Menikah</option><option ${p.statusPernikahan === 'Bercerai' ? 'selected' : ''}>Bercerai</option></select></div><div class="form-group"><label>Agama</label><select class="form-control" id="kAgama"><option value="">-- Pilih --</option><option ${p.agama === 'Islam' ? 'selected' : ''}>Islam</option><option ${p.agama === 'Kristen' ? 'selected' : ''}>Kristen</option><option ${p.agama === 'Katolik' ? 'selected' : ''}>Katolik</option><option ${p.agama === 'Hindu' ? 'selected' : ''}>Hindu</option><option ${p.agama === 'Buddha' ? 'selected' : ''}>Buddha</option><option ${p.agama === 'Konghucu' ? 'selected' : ''}>Konghucu</option></select></div><div class="form-group"><label>Kendaraan</label><input class="form-control" id="kKendaraan" value="${escHtml(p.kendaraan || '')}" placeholder="Sepeda Motor/Mobil/Umum"></div><div class="form-group"><label>Alamat Domisili</label><input class="form-control" id="kAlamatDom" value="${escHtml(p.alamatDomisili || '')}"></div></div></div>
    <div style="border-bottom:2px solid var(--border);padding-bottom:14px;margin-bottom:14px"><div class="fw-700 color-primary mb-8">🆘 Kontak Darurat</div><div class="grid-2"><div class="form-group"><label>Nama Kontak Darurat</label><input class="form-control" id="kKontakNama" value="${escHtml(p.kontakDaruratNama || '')}"></div><div class="form-group"><label>No. Kontak Darurat</label><input class="form-control" id="kKontakNo" value="${escHtml(p.kontakDaruratNo || '')}"></div><div class="form-group"><label>Hubungan</label><input class="form-control" id="kKontakHub" value="${escHtml(p.kontakDaruratHubungan || '')}" placeholder="Istri/Suami/Orang Tua/Saudara"></div><div class="form-group"><label>Alamat Kontak Darurat</label><input class="form-control" id="kKontakAlamat" value="${escHtml(p.kontakDaruratAlamat || '')}"></div></div></div>
    <div style="border-bottom:2px solid var(--border);padding-bottom:14px;margin-bottom:14px"><div class="fw-700 color-primary mb-8">📁 Kelengkapan Dokumen</div>
    <div class="grid-2">
      <div class="form-group"><label>SIM</label><select class="form-control" id="kDocSIM" onchange="toggleDocDetail('SIM')"><option value="TIDAK ADA" ${p.docSIM === 'TIDAK ADA' || !p.docSIM ? 'selected' : ''}>TIDAK ADA</option><option value="ADA" ${p.docSIM === 'ADA' ? 'selected' : ''}>ADA</option></select></div>
      <div class="form-group" id="kDocSIMDetail" style="${p.docSIM === 'ADA' ? '' : 'display:none'}"><label>No. SIM A</label><input class="form-control" id="kNoSIMA" value="${escHtml(p.noSIMA || '')}" placeholder="No. SIM A"><label class="mt-8">No. SIM C</label><input class="form-control" id="kNoSIMC" value="${escHtml(p.noSIMC || '')}" placeholder="No. SIM C"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Ijazah Terakhir</label><select class="form-control" id="kDocIjazah" onchange="toggleDocDetail('Ijazah')"><option value="TIDAK ADA" ${p.docIjazah === 'TIDAK ADA' || !p.docIjazah ? 'selected' : ''}>TIDAK ADA</option><option value="ADA" ${p.docIjazah === 'ADA' ? 'selected' : ''}>ADA</option></select></div>
      <div class="form-group" id="kDocIjazahDetail" style="${p.docIjazah === 'ADA' ? '' : 'display:none'}"><label>No. Ijazah</label><input class="form-control" id="kNoIjazah" value="${escHtml(p.noIjazah || '')}" placeholder="No. Ijazah"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>SKCK</label><select class="form-control" id="kDocSKCK" onchange="toggleDocDetail('SKCK')"><option value="TIDAK ADA" ${p.docSKCK === 'TIDAK ADA' || !p.docSKCK ? 'selected' : ''}>TIDAK ADA</option><option value="ADA" ${p.docSKCK === 'ADA' ? 'selected' : ''}>ADA</option></select></div>
      <div class="form-group" id="kDocSKCKDetail" style="${p.docSKCK === 'ADA' ? '' : 'display:none'}"><label>No. SKCK</label><input class="form-control" id="kNoSKCK" value="${escHtml(p.noSKCK || '')}" placeholder="No. SKCK"><label class="mt-8">Masa Berlaku SKCK</label><input class="form-control" type="date" id="kSKCKBerlaku" value="${p.skckBerlaku || ''}"></div>
    </div>
    <div class="grid-3">
      <div class="form-group"><label>CV Lamaran</label><select class="form-control" id="kDocCV"><option value="TIDAK ADA" ${p.docCV === 'TIDAK ADA' || !p.docCV ? 'selected' : ''}>TIDAK ADA</option><option value="ADA" ${p.docCV === 'ADA' ? 'selected' : ''}>ADA</option></select></div>
      <div class="form-group"><label>Form CV</label><select class="form-control" id="kDocFormCV"><option value="TIDAK ADA" ${p.docFormCV === 'TIDAK ADA' || !p.docFormCV ? 'selected' : ''}>TIDAK ADA</option><option value="ADA" ${p.docFormCV === 'ADA' ? 'selected' : ''}>ADA</option></select></div>
      <div class="form-group"><label>Status Kontrak Dok</label><select class="form-control" id="kDocKontrak"><option value="TIDAK ADA" ${p.docKontrak === 'TIDAK ADA' || !p.docKontrak ? 'selected' : ''}>TIDAK ADA</option><option value="ADA" ${p.docKontrak === 'ADA' ? 'selected' : ''}>ADA</option></select></div>
    </div></div>
    <div style="border-bottom:2px solid var(--border);padding-bottom:14px;margin-bottom:14px"><div class="fw-700 color-primary mb-8">📄 Data Kontrak</div><div class="grid-2"><div class="form-group"><label>Jenis Kontrak</label><select class="form-control" id="kKontrakJenis"><option value="tetap" ${p.kontrakJenis === 'tetap' ? 'selected' : ''}>Karyawan Tetap (PKWTT)</option><option value="kontrak" ${p.kontrakJenis === 'kontrak' ? 'selected' : ''}>Kontrak (PKWT)</option><option value="magang" ${p.kontrakJenis === 'magang' ? 'selected' : ''}>Magang</option></select></div><div class="form-group"><label>Durasi Kontrak</label><input class="form-control" id="kKontrakDurasi" value="${escHtml(p.kontrakDurasi || '')}" placeholder="12 bulan"></div><div class="form-group"><label>Kontrak Mulai</label><input class="form-control" type="date" id="kKontrakMulai" value="${p.kontrakMulai || ''}"></div><div class="form-group"><label>Kontrak Berakhir</label><input class="form-control" type="date" id="kKontrakAkhir" value="${p.kontrakAkhir || ''}"></div></div><div class="form-group"><label>Kontrak Ke-</label><input class="form-control" type="number" id="kKontrakKe" value="${p.kontrakKe || 1}" min="1"></div></div>
    <div class="flex gap-8 mt-16"><button class="btn btn-primary" onclick="simpanKaryawan('${id || ''}')">💾 Simpan</button>${id ? `<button class="btn btn-danger" onclick="hapusDoc('hrd_karyawan','${id}','karyawan')">🗑️ Hapus</button><button class="btn btn-info" onclick="lihatHistoryKontrak('${id}')">📋 History Kontrak</button>` : ''}</div>`,
    true
  );
}
function previewKaryFoto(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2,
        sy = (img.height - size) / 2;
      ctx.beginPath();
      ctx.arc(64, 64, 64, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 128, 128);
      window._karyFoto = canvas.toDataURL('image/jpeg', 0.8);
      document.getElementById('kFotoPreview').innerHTML =
        `<img src="${window._karyFoto}" style="width:100%;height:100%;object-fit:cover">`;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function toggleDocDetail(type) {
  const sel = document.getElementById('kDoc' + type);
  const detail = document.getElementById('kDoc' + type + 'Detail');
  if (sel && detail) detail.style.display = sel.value === 'ADA' ? '' : 'none';
}
async function simpanKaryawan(id) {
  const data = {
    nama: document.getElementById('kNama').value,
    nip: document.getElementById('kNip').value,
    nik: document.getElementById('kNIK').value,
    noKK: document.getElementById('kNoKK').value,
    noPassport: document.getElementById('kPassport').value,
    jenisKelamin: document.getElementById('kGender').value,
    tanggalLahir: document.getElementById('kTglLahir').value,
    tempatLahir: document.getElementById('kTmptLahir').value,
    email: document.getElementById('kEmail').value,
    telepon: document.getElementById('kTelp').value,
    alamat: document.getElementById('kAlamat').value,
    departemen: document.getElementById('kDept').value,
    posisi: document.getElementById('kPos').value,
    cabang: document.getElementById('kCabang').value,
    jadwalKantor: document.getElementById('kJadwal').value,
    tipeKaryawan: document.getElementById('kTipeKary').value,
    tipeUser: document.getElementById('kTipeUser').value,
    ruangKerja: document.getElementById('kRuangKerja').value,
    tanggalMasuk: document.getElementById('kJoin').value,
    status: document.getElementById('kStatus').value,
    atasan: document.getElementById('kAtasan').value,
    namaBank: document.getElementById('kBank').value,
    noRekening: document.getElementById('kNoRek').value,
    namaDiRekening: document.getElementById('kNamaRek')?.value || '',
    tipeRekening: document.getElementById('kTipeRek').value,
    bpjsKetenagakerjaan: document.getElementById('kBPJSTK').value,
    asuransi: document.getElementById('kAsuransi')?.value || '',
    gajiPokok: Number(document.getElementById('kGaji').value) || 0,
    gradeJabatan: document.getElementById('kGrade')?.value || '',
    pendidikan: document.getElementById('kPendidikan')?.value || '',
    namaSekolah: document.getElementById('kSekolah')?.value || '',
    statusPernikahan: document.getElementById('kNikah')?.value || '',
    agama: document.getElementById('kAgama')?.value || '',
    kendaraan: document.getElementById('kKendaraan')?.value || '',
    alamatDomisili: document.getElementById('kAlamatDom')?.value || '',
    kontakDaruratNama: document.getElementById('kKontakNama')?.value || '',
    kontakDaruratNo: document.getElementById('kKontakNo')?.value || '',
    kontakDaruratHubungan: document.getElementById('kKontakHub')?.value || '',
    kontakDaruratAlamat: document.getElementById('kKontakAlamat')?.value || '',
    docSIM: document.getElementById('kDocSIM')?.value || '',
    noSIMA: document.getElementById('kNoSIMA')?.value || '',
    noSIMC: document.getElementById('kNoSIMC')?.value || '',
    docIjazah: document.getElementById('kDocIjazah')?.value || '',
    noIjazah: document.getElementById('kNoIjazah')?.value || '',
    docSKCK: document.getElementById('kDocSKCK')?.value || '',
    noSKCK: document.getElementById('kNoSKCK')?.value || '',
    skckBerlaku: document.getElementById('kSKCKBerlaku')?.value || '',
    docCV: document.getElementById('kDocCV')?.value || '',
    docFormCV: document.getElementById('kDocFormCV')?.value || '',
    docKontrak: document.getElementById('kDocKontrak')?.value || '',
    kontrakJenis: document.getElementById('kKontrakJenis').value,
    kontrakDurasi: document.getElementById('kKontrakDurasi').value,
    kontrakMulai: document.getElementById('kKontrakMulai').value,
    kontrakAkhir: document.getElementById('kKontrakAkhir').value,
    kontrakKe: Number(document.getElementById('kKontrakKe').value) || 1,
    updatedAt: new Date().toISOString(),
  };
  if (window._karyFoto) data.foto = window._karyFoto;
  if (!data.nama) return toast('Nama wajib', 'warning');
  window._karyFoto = null;
  if (id) {
    // Save contract history if contract dates changed
    const oldDoc = await db.collection('hrd_karyawan').doc(id).get();
    const old = oldDoc.data() || {};
    if (
      data.kontrakMulai &&
      data.kontrakAkhir &&
      (data.kontrakMulai !== old.kontrakMulai || data.kontrakAkhir !== old.kontrakAkhir)
    ) {
      await db.collection('hrd_kontrak_history').add({
        karyawanId: id,
        nama: data.nama,
        kontrakKe: data.kontrakKe,
        jenis: data.kontrakJenis,
        mulai: data.kontrakMulai,
        akhir: data.kontrakAkhir,
        durasi: data.kontrakDurasi,
        createdAt: new Date().toISOString(),
      });
    }
    await db.collection('hrd_karyawan').doc(id).update(data);
  } else await db.collection('hrd_karyawan').add({ ...data, createdAt: new Date().toISOString() });
  // Sync to linked user account (auto-update portal karyawan)
  try {
    const usersSnap = await db
      .collection('hrd_users')
      .where('linkedKaryawan', '==', id || '__none__')
      .get();
    if (!usersSnap.empty) {
      const userDoc = usersSnap.docs[0];
      const syncData = {
        nama: data.nama,
        departemen: data.departemen,
        posisi: data.posisi,
        telepon: data.telepon,
        email: data.email,
        updatedAt: new Date().toISOString(),
      };
      if (data.foto) syncData.profilePic = data.foto;
      if (data.nip) syncData.nip = data.nip;
      await db.collection('hrd_users').doc(userDoc.id).update(syncData);
    } else {
      // Try match by nama
      const byNameSnap = await db.collection('hrd_users').where('nama', '==', data.nama).get();
      if (!byNameSnap.empty) {
        const syncData = {
          departemen: data.departemen,
          posisi: data.posisi,
          telepon: data.telepon,
          email: data.email,
          updatedAt: new Date().toISOString(),
        };
        if (data.foto) syncData.profilePic = data.foto;
        if (data.nip) syncData.nip = data.nip;
        await db.collection('hrd_users').doc(byNameSnap.docs[0].id).update(syncData);
      }
    }
  } catch (e) {
    console.warn('Sync to user failed:', e);
  }
  closeModalDirect();
  toast('Disimpan & disinkronkan ke portal', 'success');
  renderKaryawan();
}

async function lihatHistoryKontrak(karyawanId) {
  const snap = await db
    .collection('hrd_kontrak_history')
    .where('karyawanId', '==', karyawanId)
    .get();
  let h = `<div class="modal-title">📋 History Kontrak Kerja</div>`;
  if (snap.empty) h += '<p class="text-sm" style="color:#999">Belum ada riwayat kontrak</p>';
  else {
    h +=
      '<div class="table-wrap"><table><thead><tr><th>Kontrak Ke-</th><th>Jenis</th><th>Mulai</th><th>Berakhir</th><th>Durasi</th></tr></thead><tbody>';
    snap.forEach((d) => {
      const p = d.data();
      h += `<tr><td class="fw-700">${p.kontrakKe || '-'}</td><td>${escHtml(p.jenis || '-')}</td><td>${formatDate(p.mulai)}</td><td>${formatDate(p.akhir)}</td><td>${escHtml(p.durasi || '-')}</td></tr>`;
    });
    h += '</tbody></table></div>';
  }
  openModal(h, true);
}
async function detailKaryawan(id) {
  const d = await db.collection('hrd_karyawan').doc(id).get();
  const p = d.data();
  // Load documents for this employee
  const dokSnap = await db.collection('hrd_dokumen_karyawan').where('karyawanId', '==', id).get();
  let dokHtml = '';
  if (dokSnap.empty) {
    dokHtml =
      '<p class="text-sm" style="color:#999">Belum ada dokumen diupload untuk karyawan ini.</p>';
  } else {
    dokHtml =
      '<div class="table-wrap"><table><thead><tr><th>Tipe</th><th>Nama File</th><th>Keterangan</th><th>Tanggal</th><th>Aksi</th></tr></thead><tbody>';
    dokSnap.forEach((dd) => {
      const doc = dd.data();
      dokHtml += `<tr><td><span class="badge badge-info">${escHtml(doc.tipeDokumen || '-')}</span></td><td class="text-xs">${escHtml(doc.fileName || '-')}</td><td class="text-xs">${escHtml(doc.keterangan || '-')}</td><td class="text-xs">${doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('id-ID') : '-'}</td><td><button class="btn btn-xs btn-success" onclick="lihatDokumen('${dd.id}')">👁️</button></td></tr>`;
    });
    dokHtml += '</tbody></table></div>';
  }
  // Load kontrak for this employee
  const kontrakSnap = await db.collection('hrd_kontrak').where('karyawanId', '==', id).get();
  let kontrakHtml = '';
  if (!kontrakSnap.empty) {
    kontrakHtml =
      '<div class="table-wrap"><table><thead><tr><th>Kontrak Ke-</th><th>Jenis</th><th>Mulai</th><th>Berakhir</th><th>File</th><th>Aksi</th></tr></thead><tbody>';
    kontrakSnap.forEach((kd) => {
      const k = kd.data();
      const hasFile = k.fileURL || k.fileData ? '✅' : '-';
      kontrakHtml += `<tr><td class="fw-700">${k.kontrakKe || '-'}</td><td>${escHtml(k.jenis === 'kerja' ? 'PKWT' : k.jenis === 'tetap' ? 'PKWTT' : k.jenis || '-')}</td><td>${formatDate(k.mulai)}</td><td>${formatDate(k.berakhir)}</td><td>${hasFile}</td><td>${k.fileURL || k.fileData ? `<button class="btn btn-xs btn-success" onclick="lihatFileKontrak('${kd.id}')">👁️</button>` : '—'}</td></tr>`;
    });
    kontrakHtml += '</tbody></table></div>';
  } else {
    kontrakHtml = '<p class="text-sm" style="color:#999">Belum ada kontrak.</p>';
  }

  openModal(
    `<div class="modal-title">👤 Detail Karyawan</div>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;padding-bottom:16px;border-bottom:2px solid var(--border)">
      ${p.foto ? `<img src="${p.foto}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid var(--accent)">` : `<div style="width:64px;height:64px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.5rem">${(p.nama || '?').charAt(0)}</div>`}
      <div><div class="fw-700" style="font-size:1.1rem">${escHtml(p.nama)}</div><div class="text-sm" style="color:#999">${escHtml(p.departemen || '-')} • ${escHtml(p.posisi || '-')}</div><div class="text-xs" style="color:#999">NIP: ${escHtml(p.nip || '-')}</div></div>
    </div>
    <div class="grid-2 mb-16">
      <div><b>Email:</b> ${escHtml(p.email || '-')}</div><div><b>Telp:</b> ${escHtml(p.telepon || '-')}</div>
      <div><b>Tgl Masuk:</b> ${formatDate(p.tanggalMasuk)}</div><div><b>Status:</b> <span class="badge badge-${p.status === 'aktif' ? 'success' : 'warning'}">${p.status || 'aktif'}</span></div>
      <div><b>Tipe:</b> ${escHtml(p.tipeKaryawan || '-')}</div><div><b>Cabang:</b> ${escHtml(p.cabang || '-')}</div>
      <div><b>Grade:</b> ${escHtml(p.gradeJabatan || '-')}</div><div><b>Gaji:</b> ${formatCurrency(p.gajiPokok)}</div>
    </div>
    <div style="border-top:2px solid var(--border);padding-top:16px;margin-top:8px">
      <div class="fw-700 mb-8" style="color:var(--primary)">📄 Kontrak Kerja</div>
      ${kontrakHtml}
    </div>
    <div style="border-top:2px solid var(--border);padding-top:16px;margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:center" class="mb-8"><div class="fw-700" style="color:var(--primary)">📁 Berkas & Dokumen</div><button class="btn btn-xs btn-primary" onclick="closeModalDirect();modalUploadDokumen('${id}')">+ Upload</button></div>
      ${dokHtml}
    </div>`,
    true
  );
}

function modalImportKaryawan() {
  openModal(
    `<div class="modal-title">📥 Import Data Karyawan</div>
    <div class="tabs mb-16"><div class="tab active" onclick="switchImportTab('kary','file')">📄 Upload CSV</div><div class="tab" onclick="switchImportTab('kary','api')">🔗 API Google Sheets</div></div>
    <div id="importKaryTab">
      <p class="text-sm mb-8" style="color:#666">Upload file CSV. Header: Nama, NIP, Email, Telepon, Departemen, Posisi, Tanggal Masuk, Status, Gaji Pokok, Atasan.</p>
      <div class="form-group"><label>File CSV</label><input class="form-control" type="file" accept=".csv" id="importKaryawanFile"></div>
      <div class="flex gap-8 mb-16"><button class="btn btn-primary" onclick="processImportKaryawan()">📥 Proses Import</button><button class="btn btn-outline btn-sm" onclick="downloadKaryawanTemplate()">📄 Download Template</button></div>
      <div class="text-xs" style="color:#666">Template CSV akan membantu memastikan header sesuai dengan format sheet.</div>
    </div>`,
    true
  );
}

function switchImportTab(type, mode) {
  document
    .querySelectorAll('.tabs .tab')
    .forEach((t, i) => t.classList.toggle('active', i === (mode === 'file' ? 0 : 1)));
  const el = document.getElementById(type === 'kary' ? 'importKaryTab' : 'importGajiTab');
  if (!el) return;
  if (mode === 'api') {
    el.innerHTML = `<div style="padding:12px;background:#e8f5e9;border-radius:8px;margin-bottom:16px;border-left:4px solid var(--success)">
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
    if (type === 'kary') {
      el.innerHTML = `<p class="text-sm mb-8" style="color:#666">Upload file CSV. Header: Nama, NIP, Email, Telepon, Departemen, Posisi, Tanggal Masuk, Status, Gaji Pokok, Atasan.</p><div class="form-group"><label>File CSV</label><input class="form-control" type="file" accept=".csv" id="importKaryawanFile"></div><button class="btn btn-primary" onclick="processImportKaryawan()">📥 Proses Import</button>`;
    } else {
      el.innerHTML = `<p class="text-sm mb-8" style="color:#666">Upload file CSV. Header: Nama, Periode, Gaji Pokok, Tunjangan, Potongan, PPH21, Total Bersih.</p><div class="form-group"><label>File CSV</label><input class="form-control" type="file" accept=".csv" id="importGajiFile"></div><button class="btn btn-primary" onclick="processImportPenggajian()">📥 Proses Import</button>`;
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

async function previewApiImport(type) {
  const rawUrl = document.getElementById('importApiUrl').value.trim();
  if (!rawUrl) return toast('Paste URL Google Sheets dulu', 'warning');
  const url = convertToGSheetCSV(rawUrl);
  document.getElementById('importApiStatus').innerHTML =
    '<span class="badge badge-warning">⏳ Mengambil data dari Google Sheets...</span>';
  try {
    const resp = await fetch(url);
    if (!resp.ok)
      throw new Error(
        'HTTP ' + resp.status + ' — Pastikan sheet bersifat publik (Anyone with the link can view)'
      );
    const text = await resp.text();
    // Check if we got HTML instead of CSV (common error)
    if (text.trim().startsWith('<!') || text.trim().startsWith('<html')) {
      throw new Error(
        'Response bukan CSV. Pastikan Google Sheets di-share sebagai "Anyone with the link can view"'
      );
    }
    const rows = parseCsvRows(text);
    if (rows.length < 2) {
      document.getElementById('importApiStatus').innerHTML =
        '<span class="badge badge-danger">❌ Data kosong atau format tidak valid</span>';
      return;
    }
    document.getElementById('importApiStatus').innerHTML =
      `<span class="badge badge-success">✅ ${rows.length - 1} baris data ditemukan (${rows[0].length} kolom)</span>`;
    // Show preview table (max 5 rows)
    let h = '<div class="table-wrap" style="max-height:250px;overflow:auto"><table><thead><tr>';
    rows[0].forEach((col) => {
      h += `<th style="font-size:.7rem">${escHtml(col)}</th>`;
    });
    h += '</tr></thead><tbody>';
    rows.slice(1, 6).forEach((row) => {
      h += '<tr>';
      row.forEach((col) => {
        h += `<td style="font-size:.75rem">${escHtml(col)}</td>`;
      });
      h += '</tr>';
    });
    if (rows.length > 6)
      h += `<tr><td colspan="${rows[0].length}" class="text-center text-xs" style="color:#999">... dan ${rows.length - 6} baris lainnya</td></tr>`;
    h += '</tbody></table></div>';
    document.getElementById('importApiPreview').innerHTML = h;
    window._apiImportData = text;
  } catch (e) {
    document.getElementById('importApiStatus').innerHTML =
      `<span class="badge badge-danger">❌ Gagal: ${e.message}</span>
      <div class="text-xs mt-8" style="color:#666;line-height:1.8">
        <b>Solusi:</b><br>
        1. Buka Google Sheets → klik "Share" → ubah ke "Anyone with the link" → Viewer<br>
        2. Paste URL biasa (misal: https://docs.google.com/spreadsheets/d/xxx/edit?usp=sharing)<br>
        3. Sistem akan otomatis convert ke format CSV
      </div>`;
  }
}

async function processApiImport(type) {
  if (!window._apiImportData) {
    const rawUrl = document.getElementById('importApiUrl').value.trim();
    if (!rawUrl) return toast('Paste URL dan preview dulu', 'warning');
    const url = convertToGSheetCSV(rawUrl);
    try {
      const resp = await fetch(url);
      const text = await resp.text();
      if (text.trim().startsWith('<!'))
        return toast('Response bukan CSV. Share sheet sebagai "Anyone with link"', 'error');
      window._apiImportData = text;
    } catch (e) {
      return toast('Gagal fetch: ' + e.message, 'error');
    }
  }
  const text = window._apiImportData;
  if (type === 'kary') {
    await processImportKaryawanFromText(text);
  } else {
    await processImportPenggajianFromText(text);
  }
  window._apiImportData = null;
}

async function processImportKaryawanFromText(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return toast('Data kosong', 'warning');
  const headers = rows[0].map((h) => normalizeHeader(h));
  const map = {};
  headers.forEach((h, i) => {
    if (['nama', 'name', 'nama lengkap', 'nama karyawan'].includes(h)) map.nama = i;
    else if (['nip', 'employee id', 'employee no', 'id karyawan', 'nik'].includes(h)) map.nip = i;
    else if (['email', 'email address', 'e-mail'].includes(h)) map.email = i;
    else if (['telepon', 'telephone', 'phone', 'hp', 'no hp', 'no. hp', 'handphone'].includes(h))
      map.telepon = i;
    else if (['departemen', 'department', 'divisi', 'dept'].includes(h)) map.departemen = i;
    else if (['posisi', 'position', 'jabatan', 'job title'].includes(h)) map.posisi = i;
    else if (
      [
        'tanggal masuk',
        'tgl masuk',
        'join date',
        'date joined',
        'mulai kerja',
        'tanggal bergabung',
      ].includes(h)
    )
      map.tanggalMasuk = i;
    else if (['status', 'status karyawan'].includes(h)) map.status = i;
    else if (['gaji pokok', 'salary', 'basic salary', 'gaji', 'upah'].includes(h))
      map.gajiPokok = i;
    else if (['atasan', 'manager', 'supervisor', 'kepala'].includes(h)) map.atasan = i;
    else if (['alamat', 'address'].includes(h)) map.alamat = i;
    else if (['jenis kelamin', 'gender', 'kelamin'].includes(h)) map.jenisKelamin = i;
    else if (['tempat lahir', 'kota lahir'].includes(h)) map.tempatLahir = i;
    else if (['tanggal lahir', 'tgl lahir', 'birth date'].includes(h)) map.tanggalLahir = i;
  });
  if (map.nama === undefined) return toast('Header harus berisi kolom "Nama"', 'warning');
  let added = 0,
    updated = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const nama = (row[map.nama] || '').trim();
    if (!nama) continue;
    const nip = map.nip !== undefined ? (row[map.nip] || '').trim() : generateNIP();
    const payload = {
      nama,
      nip,
      email: (map.email !== undefined ? row[map.email] || '' : '').trim(),
      telepon: (map.telepon !== undefined ? row[map.telepon] || '' : '').trim(),
      departemen: (map.departemen !== undefined ? row[map.departemen] || '' : '').trim(),
      posisi: (map.posisi !== undefined ? row[map.posisi] || '' : '').trim(),
      tanggalMasuk: (map.tanggalMasuk !== undefined ? row[map.tanggalMasuk] || '' : '').trim(),
      status: (map.status !== undefined ? row[map.status] || '' : '').trim() || 'aktif',
      gajiPokok:
        Number(
          String(map.gajiPokok !== undefined ? row[map.gajiPokok] : '').replace(/[^0-9.-]/g, '')
        ) || 0,
      atasan: (map.atasan !== undefined ? row[map.atasan] || '' : '').trim(),
      alamat: (map.alamat !== undefined ? row[map.alamat] || '' : '').trim(),
      jenisKelamin: (map.jenisKelamin !== undefined ? row[map.jenisKelamin] || '' : '').trim(),
      tempatLahir: (map.tempatLahir !== undefined ? row[map.tempatLahir] || '' : '').trim(),
      tanggalLahir: (map.tanggalLahir !== undefined ? row[map.tanggalLahir] || '' : '').trim(),
      updatedAt: new Date().toISOString(),
    };
    if (nip) {
      const snap = await db.collection('hrd_karyawan').where('nip', '==', nip).limit(1).get();
      if (!snap.empty) {
        await db.collection('hrd_karyawan').doc(snap.docs[0].id).update(payload);
        updated++;
      } else {
        await db
          .collection('hrd_karyawan')
          .add({ ...payload, createdAt: new Date().toISOString() });
        added++;
      }
    } else {
      await db.collection('hrd_karyawan').add({ ...payload, createdAt: new Date().toISOString() });
      added++;
    }
  }
  closeModalDirect();
  toast(`✅ Import selesai: ${added} baru, ${updated} terupdate`, 'success');
  renderKaryawan();
}

async function processImportKaryawan() {
  const file = document.getElementById('importKaryawanFile')?.files?.[0];
  if (!file) return toast('Pilih file CSV', 'warning');
  const text = await file.text();
  await processImportKaryawanFromText(text);
}

function downloadKaryawanTemplate() {
  const csv =
    'Nama,NIP,Email,Telepon,Departemen,Posisi,Tanggal Masuk,Status,Gaji Pokok,Atasan\nBudi Santoso,EMP001,budi@ijef.co,08123456789,HRD,Manager,2024-01-10,aktif,5000000,Andi Pratama';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'template_data_karyawan.csv';
  a.click();
  toast('Template karyawan didownload', 'success');
}

function downloadPenggajianTemplate() {
  const csv =
    'Nama,Periode,Gaji Pokok,Tunjangan,Potongan,PPH21,Total Bersih\nBudi Santoso,2026-05,5000000,1000000,200000,150000,5650000';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'template_penggajian.csv';
  a.click();
  toast('Template penggajian didownload', 'success');
}

function normalizeHeader(value) {
  return (value || '').toString().trim().toLowerCase();
}

function parseCsvRows(text) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim());
  return lines.map((line) => {
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          cols.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
    }
    cols.push(cur);
    return cols.map((c) => c.trim());
  });
}

// ── STRUKTUR ORG ──────────────────────────────────────────────
async function renderStrukturOrg() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>🌳 Struktur Organisasi</span></div><div class="card" id="orgChart" style="overflow-x:auto;padding:30px 20px">Loading...</div>`;
  const snap = await db.collection('hrd_karyawan').where('status', '!=', 'nonaktif').get();
  const karyawan = [];
  snap.forEach((d) => karyawan.push({ id: d.id, ...d.data() }));
  // Filter out resigned/PHK
  const active = karyawan.filter(
    (k) => k.status !== 'nonaktif' && !(k.tipeKaryawan || '').toLowerCase().includes('resign')
  );

  const personBox = (k, cls) => {
    const foto = k.foto
      ? `<img src="${k.foto}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;margin:0 auto 4px;display:block">`
      : `<div style="width:44px;height:44px;border-radius:50%;background:${cls === 'box' ? '#fce4ec' : '#f0f0f0'};display:flex;align-items:center;justify-content:center;margin:0 auto 4px;font-weight:700;font-size:.9rem;color:var(--accent)">${(k.nama || '?').charAt(0)}</div>`;
    return `<div class="${cls}">${foto}<div class="n">${escHtml(k.nama)}</div><div class="p">${escHtml(k.posisi || '-')}</div></div>`;
  };

  // Build tree by atasan
  const childrenOf = (name) =>
    active.filter((k) => (k.atasan || '').toLowerCase() === name.toLowerCase());
  const founders = active.filter((k) => (k.posisi || '').toLowerCase().includes('founder'));
  const gm = active.filter(
    (k) =>
      (k.atasan || '').toLowerCase() === 'founder' &&
      !(k.posisi || '').toLowerCase().includes('founder')
  );

  let html = `<style>
.org{text-align:center;min-width:900px}
.org h2{font-size:1.2rem;font-weight:700;color:var(--accent);margin:0}.org .sub{font-size:.8rem;color:#666;margin-bottom:24px}
.org .box{border:2px solid var(--accent);border-radius:10px;padding:10px 14px;display:inline-block;text-align:center;background:#fff;min-width:110px;box-shadow:0 2px 8px rgba(198,40,40,.08);margin:4px;vertical-align:top}
.org .box .n{font-weight:700;font-size:.7rem;color:#1a1a1a}.org .box .p{font-size:.58rem;color:#666;margin-top:2px;text-transform:uppercase}
.org .sbox{border:1.5px solid #ddd;border-radius:8px;padding:8px 10px;display:inline-block;text-align:center;background:#fff;min-width:90px;margin:4px;vertical-align:top}
.org .sbox .n{font-weight:600;font-size:.65rem;color:#333}.org .sbox .p{font-size:.55rem;color:#888;margin-top:1px}
.org .line-v{width:2px;height:24px;background:var(--accent);margin:0 auto}
.org .line-h{height:2px;background:var(--accent);margin:0 auto}
.org .level{display:flex;justify-content:center;align-items:flex-start;flex-wrap:wrap;gap:6px;position:relative;padding-top:16px}
.org .level::before{content:'';position:absolute;top:0;left:20%;right:20%;height:2px;background:var(--accent)}
.org .node{display:inline-flex;flex-direction:column;align-items:center}
.org .node::before{content:'';width:2px;height:16px;background:var(--accent);display:block}
.org .sub-level{display:flex;justify-content:center;gap:4px;margin-top:8px;padding-top:8px;border-top:1.5px solid #ddd}
</style><div class="org"><h2>STRUKTUR ORGANISASI</h2><div class="sub">LPK IJEF CORP — IMS</div>`;

  // Row 1: Founders
  if (founders.length) {
    html += `<div style="display:flex;justify-content:center;gap:8px">${founders.map((k) => personBox(k, 'box')).join('')}</div>`;
    html += `<div class="line-v"></div>`;
  }
  // Row 2: GM
  if (gm.length) {
    html += `<div style="display:flex;justify-content:center;gap:8px">${gm.map((k) => personBox(k, 'box')).join('')}</div>`;
    html += `<div class="line-v"></div>`;
  }
  // Row 3: Heads (direct reports to GM)
  const gmName = gm.length ? gm[0].nama : '';
  const heads = gmName ? childrenOf(gmName) : [];
  if (heads.length) {
    html += `<div class="line-h" style="width:${Math.min(80, heads.length * 20)}%"></div>`;
    html += `<div class="level">`;
    heads.forEach((head) => {
      const staffUnderHead = childrenOf(head.nama);
      html += `<div class="node">${personBox(head, 'box')}`;
      // Staff under this head
      if (staffUnderHead.length) {
        html += `<div class="sub-level">`;
        staffUnderHead.forEach((s) => {
          const subSub = childrenOf(s.nama);
          html += `<div style="display:inline-flex;flex-direction:column;align-items:center">`;
          html += personBox(s, 'sbox');
          // Sub-subordinates (e.g. Rafa under Maharani, Galih under Winnie)
          if (subSub.length) {
            html += `<div style="margin-top:4px;padding-top:4px;border-top:1px dashed var(--accent)">`;
            subSub.forEach((ss) => {
              html += personBox(ss, 'sbox');
            });
            html += `</div>`;
          }
          html += `</div>`;
        });
        html += `</div>`;
      }
      html += `</div>`;
    });
    html += `</div>`;
  }
  if (!active.length)
    html += `<div class="empty-state"><div class="icon">🌳</div><p>Belum ada data karyawan.</p></div>`;
  html += `</div>`;
  document.getElementById('orgChart').innerHTML = html;
}

// ── ONBOARDING ────────────────────────────────────────────────
async function renderOnboarding() {
  const main = document.getElementById('mainContent');
  const snap = await db.collection('hrd_onboarding').get();
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));

  let h = `<div class="page-title"><span>🚀 Onboarding</span><button class="btn btn-primary btn-sm" onclick="modalOnboarding()">+ Tambah</button></div>`;

  if (!items.length) {
    h += `<div class="card"><p class="text-center">Belum ada data onboarding</p></div>`;
  } else {
    h += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">`;
    items.forEach((p) => {
      const done = (p.checklist || []).filter((c) => c.done).length;
      const total = (p.checklist || []).length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      const statusColor = pct === 100 ? '#2e7d32' : pct >= 50 ? '#f57f17' : '#c62828';

      h += `<div class="card" style="padding:16px;border-left:4px solid ${statusColor}">`;
      h += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">`;
      h += `<div><div class="fw-700" style="font-size:.95rem">${escHtml(p.nama)}</div><div class="text-xs" style="color:var(--text-light)">Mulai: ${formatDate(p.tanggalMulai)}</div></div>`;
      h += `<div style="display:flex;gap:4px"><button class="btn btn-xs btn-info" onclick="viewOnboarding('${p.id}')" title="Detail">👁️</button><button class="btn btn-xs btn-warning" onclick="editOnboarding('${p.id}')" title="Edit">✏️</button><button class="btn btn-xs btn-danger" onclick="hapusOnboarding('${p.id}')" title="Hapus">🗑️</button></div>`;
      h += `</div>`;

      // Progress bar
      h += `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span class="text-xs fw-700">Progress</span><span class="text-xs fw-700" style="color:${statusColor}">${done}/${total} (${pct}%)</span></div>`;
      h += `<div style="background:#eee;border-radius:4px;height:6px;overflow:hidden"><div style="background:${statusColor};height:100%;width:${pct}%;border-radius:4px;transition:width .3s"></div></div></div>`;

      // Checklist items
      h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">`;
      (p.checklist || []).forEach((c, i) => {
        h += `<label style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:${c.done ? '#e8f5e9' : '#f5f5f5'};border-radius:6px;cursor:pointer;font-size:.78rem;transition:background .2s">`;
        h += `<input type="checkbox" ${c.done ? 'checked' : ''} onchange="toggleOnboardingCheck('${p.id}',${i})" style="accent-color:${statusColor}">`;
        h += `<span style="${c.done ? 'text-decoration:line-through;color:#999' : ''}">${escHtml(c.task)}</span></label>`;
      });
      h += `</div>`;

      // Status badge
      h += `<div style="margin-top:12px;text-align:right"><span class="badge badge-${pct === 100 ? 'success' : 'warning'}">${pct === 100 ? 'Selesai' : 'Proses'}</span></div>`;
      h += `</div>`;
    });
    h += `</div>`;
  }
  main.innerHTML = h;
}
function modalOnboarding() {
  openModal(
    `<div class="modal-title">Tambah Onboarding</div><div class="form-group"><label>Nama</label><input class="form-control" id="obNama"></div><div class="form-group"><label>Tanggal Mulai</label><input class="form-control" type="date" id="obTgl" value="${todayStr()}"></div><div class="form-group"><label>Checklist (per baris)</label><textarea class="form-control" id="obCheck">Orientasi perusahaan\nSetup email & akun\nTraining SOP\nPerkenalan tim\nSerah terima perlengkapan</textarea></div><button class="btn btn-primary" onclick="simpanOnboarding()">Simpan</button>`
  );
}
async function simpanOnboarding() {
  const nama = document.getElementById('obNama').value;
  if (!nama) return toast('Nama wajib', 'warning');
  const items = document
    .getElementById('obCheck')
    .value.split('\n')
    .filter((x) => x.trim())
    .map((x) => ({ task: x.trim(), done: false }));
  await db.collection('hrd_onboarding').add({
    nama,
    tanggalMulai: document.getElementById('obTgl').value,
    checklist: items,
    createdAt: new Date().toISOString(),
  });
  closeModalDirect();
  toast('Ditambahkan', 'success');
  renderOnboarding();
}

async function viewOnboarding(id) {
  const doc = await db.collection('hrd_onboarding').doc(id).get();
  if (!doc.exists) return toast('Data tidak ditemukan', 'warning');
  const p = doc.data();
  const done = (p.checklist || []).filter((c) => c.done).length,
    total = (p.checklist || []).length;
  let checkHtml = '';
  (p.checklist || []).forEach((c, i) => {
    checkHtml += `<div style="padding:4px 0"><label style="cursor:pointer"><input type="checkbox" ${c.done ? 'checked' : ''} onchange="toggleOnboardingCheck('${id}',${i})"> ${escHtml(c.task)}</label></div>`;
  });
  openModal(`<div class="modal-title">Detail Onboarding</div>
    <table style="width:100%;border-collapse:collapse">
      <tr><td class="fw-700" style="padding:6px 8px;width:120px">Nama</td><td style="padding:6px 8px">${escHtml(p.nama || '-')}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Tanggal Mulai</td><td style="padding:6px 8px">${formatDate(p.tanggalMulai)}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Progress</td><td style="padding:6px 8px">${done}/${total}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Status</td><td style="padding:6px 8px"><span class="badge badge-${done === total ? 'success' : 'warning'}">${done === total ? 'Selesai' : 'Proses'}</span></td></tr>
    </table>
    <div class="mt-16"><div class="fw-700 mb-8">Checklist:</div>${checkHtml}</div>
    <div class="mt-16"><button class="btn btn-outline" onclick="closeModalDirect()">Tutup</button></div>`);
}

async function editOnboarding(id) {
  const doc = await db.collection('hrd_onboarding').doc(id).get();
  if (!doc.exists) return toast('Data tidak ditemukan', 'warning');
  const p = doc.data();
  const checkText = (p.checklist || []).map((c) => c.task).join('\n');
  openModal(`<div class="modal-title">Edit Onboarding</div>
    <div class="form-group"><label>Nama</label><input class="form-control" id="obEditNama" value="${escHtml(p.nama || '')}"></div>
    <div class="form-group"><label>Tanggal Mulai</label><input class="form-control" type="date" id="obEditTgl" value="${p.tanggalMulai || ''}"></div>
    <div class="form-group"><label>Checklist (per baris)</label><textarea class="form-control" id="obEditCheck" style="min-height:100px">${escHtml(checkText)}</textarea></div>
    <button class="btn btn-primary" onclick="updateOnboarding('${id}')">Simpan</button>`);
}

async function updateOnboarding(id) {
  const nama = document.getElementById('obEditNama').value;
  if (!nama) return toast('Nama wajib', 'warning');
  const oldDoc = await db.collection('hrd_onboarding').doc(id).get();
  const oldChecklist = oldDoc.exists ? oldDoc.data().checklist || [] : [];
  const newTasks = document
    .getElementById('obEditCheck')
    .value.split('\n')
    .filter((x) => x.trim());
  const checklist = newTasks.map((t, i) => {
    const existing = oldChecklist[i];
    return { task: t.trim(), done: existing ? existing.done : false };
  });
  await db
    .collection('hrd_onboarding')
    .doc(id)
    .update({ nama, tanggalMulai: document.getElementById('obEditTgl').value, checklist });
  closeModalDirect();
  toast('Diperbarui', 'success');
  renderOnboarding();
}

async function toggleOnboardingCheck(id, index) {
  try {
    const ref = db.collection('hrd_onboarding').doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      toast('Data tidak ditemukan', 'error');
      return;
    }
    const p = doc.data();
    const checklist = p.checklist || [];
    if (checklist[index]) {
      checklist[index].done = !checklist[index].done;
      await ref.update({ checklist: checklist });
      console.log('[Onboarding] Saved check', id, index, '->', checklist[index].done);
    }
  } catch (e) {
    console.error('[Onboarding] Toggle error:', e);
    toast('Gagal menyimpan checklist: ' + e.message, 'error');
  }
  renderOnboarding();
}

async function hapusOnboarding(id) {
  if (!confirm('Hapus data onboarding ini?')) return;
  await db.collection('hrd_onboarding').doc(id).delete();
  toast('Dihapus', 'success');
  renderOnboarding();
}

// ── OFFBOARDING ───────────────────────────────────────────────
async function renderOffboarding() {
  const main = document.getElementById('mainContent');
  const snap = await db.collection('hrd_offboarding').get();
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));

  let h = `<div class="page-title"><span>📦 Offboarding</span><button class="btn btn-primary btn-sm" onclick="modalOffboarding()">+ Tambah</button></div>`;

  if (!items.length) {
    h += `<div class="card"><p class="text-center">Belum ada data offboarding</p></div>`;
  } else {
    h += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">`;
    items.forEach((p) => {
      const done = (p.checklist || []).filter((c) => c.done).length;
      const total = (p.checklist || []).length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      const statusColor = pct === 100 ? '#2e7d32' : pct >= 50 ? '#f57f17' : '#c62828';

      h += `<div class="card" style="padding:16px;border-left:4px solid ${statusColor}">`;
      h += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">`;
      h += `<div><div class="fw-700" style="font-size:.95rem">${escHtml(p.nama)}</div><div class="text-xs" style="color:var(--text-light)">Keluar: ${formatDate(p.tanggalKeluar)} | ${escHtml(p.alasan || '-')}</div></div>`;
      h += `<div style="display:flex;gap:4px"><button class="btn btn-xs btn-info" onclick="viewOffboarding('${p.id}')" title="Detail">👁️</button><button class="btn btn-xs btn-warning" onclick="editOffboarding('${p.id}')" title="Edit">✏️</button><button class="btn btn-xs btn-danger" onclick="hapusOffboarding('${p.id}')" title="Hapus">🗑️</button></div>`;
      h += `</div>`;

      // Progress bar
      h += `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span class="text-xs fw-700">Progress</span><span class="text-xs fw-700" style="color:${statusColor}">${done}/${total} (${pct}%)</span></div>`;
      h += `<div style="background:#eee;border-radius:4px;height:6px;overflow:hidden"><div style="background:${statusColor};height:100%;width:${pct}%;border-radius:4px;transition:width .3s"></div></div></div>`;

      // Checklist items
      h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">`;
      (p.checklist || []).forEach((c, i) => {
        h += `<label style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:${c.done ? '#e8f5e9' : '#f5f5f5'};border-radius:6px;cursor:pointer;font-size:.78rem;transition:background .2s">`;
        h += `<input type="checkbox" ${c.done ? 'checked' : ''} onchange="toggleOffboardingCheck('${p.id}',${i})" style="accent-color:${statusColor}">`;
        h += `<span style="${c.done ? 'text-decoration:line-through;color:#999' : ''}">${escHtml(c.task)}</span></label>`;
      });
      h += `</div>`;

      // Status badge
      h += `<div style="margin-top:12px;text-align:right"><span class="badge badge-${pct === 100 ? 'success' : 'warning'}">${pct === 100 ? 'Selesai' : 'Proses'}</span></div>`;
      h += `</div>`;
    });
    h += `</div>`;
  }
  main.innerHTML = h;
}
function modalOffboarding() {
  openModal(
    `<div class="modal-title">Tambah Offboarding</div><div class="form-group"><label>Nama</label><input class="form-control" id="offNama"></div><div class="form-group"><label>Tgl Keluar</label><input class="form-control" type="date" id="offTgl" value="${todayStr()}"></div><div class="form-group"><label>Alasan</label><select class="form-control" id="offAlasan"><option>Resign</option><option>PHK</option><option>Kontrak Habis</option><option>Pensiun</option></select></div><div class="form-group"><label>Checklist (per baris)</label><textarea class="form-control" id="offCheck" style="min-height:100px">Serah terima tugas\nPengembalian aset\nDeaktivasi akun\nExit interview\nSurat referensi</textarea></div><button class="btn btn-primary" onclick="simpanOffboarding()">Simpan</button>`
  );
}
async function simpanOffboarding() {
  const checklist = document
    .getElementById('offCheck')
    .value.split('\n')
    .filter((x) => x.trim())
    .map((x) => ({ task: x.trim(), done: false }));
  const data = {
    nama: document.getElementById('offNama').value,
    tanggalKeluar: document.getElementById('offTgl').value,
    alasan: document.getElementById('offAlasan').value,
    status: 'proses',
    checklist,
    createdAt: new Date().toISOString(),
  };
  if (!data.nama) return toast('Nama wajib', 'warning');
  await db.collection('hrd_offboarding').add(data);
  closeModalDirect();
  toast('Ditambahkan', 'success');
  renderOffboarding();
}

async function viewOffboarding(id) {
  const doc = await db.collection('hrd_offboarding').doc(id).get();
  if (!doc.exists) return toast('Data tidak ditemukan', 'warning');
  const p = doc.data();
  const done = (p.checklist || []).filter((c) => c.done).length,
    total = (p.checklist || []).length;
  let checkHtml = '';
  (p.checklist || []).forEach((c, i) => {
    checkHtml += `<div style="padding:4px 0"><label style="cursor:pointer"><input type="checkbox" ${c.done ? 'checked' : ''} onchange="toggleOffboardingCheck('${id}',${i})"> ${escHtml(c.task)}</label></div>`;
  });
  openModal(`<div class="modal-title">Detail Offboarding</div>
    <table style="width:100%;border-collapse:collapse">
      <tr><td class="fw-700" style="padding:6px 8px;width:120px">Nama</td><td style="padding:6px 8px">${escHtml(p.nama || '-')}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Tgl Keluar</td><td style="padding:6px 8px">${formatDate(p.tanggalKeluar)}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Alasan</td><td style="padding:6px 8px">${escHtml(p.alasan || '-')}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Status</td><td style="padding:6px 8px"><span class="badge badge-${p.status === 'selesai' ? 'success' : 'warning'}">${p.status || 'proses'}</span></td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Progress</td><td style="padding:6px 8px">${done}/${total}</td></tr>
    </table>
    <div class="mt-16"><div class="fw-700 mb-8">Checklist:</div>${checkHtml || '<p class="text-sm">Tidak ada checklist</p>'}</div>
    <div class="mt-16"><button class="btn btn-outline" onclick="closeModalDirect()">Tutup</button></div>`);
}

async function editOffboarding(id) {
  const doc = await db.collection('hrd_offboarding').doc(id).get();
  if (!doc.exists) return toast('Data tidak ditemukan', 'warning');
  const p = doc.data();
  const checkText = (p.checklist || []).map((c) => c.task).join('\n');
  openModal(`<div class="modal-title">Edit Offboarding</div>
    <div class="form-group"><label>Nama</label><input class="form-control" id="offEditNama" value="${escHtml(p.nama || '')}"></div>
    <div class="form-group"><label>Tgl Keluar</label><input class="form-control" type="date" id="offEditTgl" value="${p.tanggalKeluar || ''}"></div>
    <div class="form-group"><label>Alasan</label><select class="form-control" id="offEditAlasan"><option ${p.alasan === 'Resign' ? 'selected' : ''}>Resign</option><option ${p.alasan === 'PHK' ? 'selected' : ''}>PHK</option><option ${p.alasan === 'Kontrak Habis' ? 'selected' : ''}>Kontrak Habis</option><option ${p.alasan === 'Pensiun' ? 'selected' : ''}>Pensiun</option></select></div>
    <div class="form-group"><label>Checklist (per baris)</label><textarea class="form-control" id="offEditCheck" style="min-height:100px">${escHtml(checkText)}</textarea></div>
    <button class="btn btn-primary" onclick="updateOffboarding('${id}')">Simpan</button>`);
}

async function updateOffboarding(id) {
  const nama = document.getElementById('offEditNama').value;
  if (!nama) return toast('Nama wajib', 'warning');
  const oldDoc = await db.collection('hrd_offboarding').doc(id).get();
  const oldChecklist = oldDoc.exists ? oldDoc.data().checklist || [] : [];
  const newTasks = document
    .getElementById('offEditCheck')
    .value.split('\n')
    .filter((x) => x.trim());
  const checklist = newTasks.map((t, i) => {
    const existing = oldChecklist[i];
    return { task: t.trim(), done: existing ? existing.done : false };
  });
  await db
    .collection('hrd_offboarding')
    .doc(id)
    .update({
      nama,
      tanggalKeluar: document.getElementById('offEditTgl').value,
      alasan: document.getElementById('offEditAlasan').value,
      checklist,
    });
  closeModalDirect();
  toast('Diperbarui', 'success');
  renderOffboarding();
}

async function toggleOffboardingCheck(id, index) {
  try {
    const ref = db.collection('hrd_offboarding').doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      toast('Data tidak ditemukan', 'error');
      return;
    }
    const p = doc.data();
    const checklist = p.checklist || [];
    if (checklist[index]) {
      checklist[index].done = !checklist[index].done;
      await ref.update({ checklist: checklist });
      console.log('[Offboarding] Saved check', id, index, '->', checklist[index].done);
    }
  } catch (e) {
    console.error('[Offboarding] Toggle error:', e);
    toast('Gagal menyimpan checklist: ' + e.message, 'error');
  }
  renderOffboarding();
}

async function hapusOffboarding(id) {
  if (!confirm('Hapus data offboarding ini?')) return;
  await db.collection('hrd_offboarding').doc(id).delete();
  toast('Dihapus', 'success');
  renderOffboarding();
}

// ── REKRUTMEN ─────────────────────────────────────────────────
async function renderLowongan() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>📝 Lowongan</span><button class="btn btn-primary btn-sm" onclick="modalLowongan()">+ Tambah</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Posisi</th><th>Dept</th><th>Status</th><th>Deadline</th><th>Aksi</th></tr></thead><tbody id="tblLow"></tbody></table></div></div>`;
  const snap = await db.collection('hrd_lowongan').get();
  let h = '';
  if (snap.empty) h = '<tr><td colspan="5" class="text-center">Belum ada</td></tr>';
  else
    snap.forEach((d) => {
      const p = d.data();
      h += `<tr><td class="fw-700">${escHtml(p.posisi)}</td><td>${escHtml(p.departemen || '-')}</td><td><span class="badge badge-${p.status === 'open' ? 'success' : 'danger'}">${p.status}</span></td><td>${formatDate(p.deadline)}</td><td><button class="btn btn-xs btn-info" onclick="modalLowongan('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_lowongan','${d.id}','lowongan')">🗑️</button></td></tr>`;
    });
  document.getElementById('tblLow').innerHTML = h;
}
async function modalLowongan(id) {
  if (id) {
    const d = await db.collection('hrd_lowongan').doc(id).get();
    await showLowForm(id, d.data() || {});
  } else await showLowForm(null, {});
}
async function showLowForm(id, p) {
  const [posSnap, deptSnap] = await Promise.all([
    db.collection('hrd_posisi').get(),
    db.collection('hrd_departemen').get(),
  ]);
  let posOpts = '<option value="">-- Pilih Posisi --</option>';
  posSnap.forEach((d) => {
    const r = d.data();
    posOpts += `<option value="${escHtml(r.nama)}" ${(p.posisi || '') === r.nama ? 'selected' : ''}>${escHtml(r.nama)}</option>`;
  });
  let deptOpts = '<option value="">-- Pilih Departemen --</option>';
  deptSnap.forEach((d) => {
    const r = d.data();
    deptOpts += `<option value="${escHtml(r.nama)}" ${(p.departemen || '') === r.nama ? 'selected' : ''}>${escHtml(r.nama)}</option>`;
  });
  openModal(
    `<div class="modal-title">${id ? 'Edit' : 'Tambah'} Lowongan</div><div class="grid-2"><div class="form-group"><label>Posisi</label><select class="form-control" id="lwPos">${posOpts}</select></div><div class="form-group"><label>Dept</label><select class="form-control" id="lwDept">${deptOpts}</select></div></div><div class="grid-2"><div class="form-group"><label>Status</label><select class="form-control" id="lwStatus"><option value="open" ${p.status === 'open' ? 'selected' : ''}>Open</option><option value="closed" ${p.status === 'closed' ? 'selected' : ''}>Closed</option></select></div><div class="form-group"><label>Deadline</label><input class="form-control" type="date" id="lwDead" value="${p.deadline || ''}"></div></div><div class="form-group"><label>Deskripsi</label><textarea class="form-control" id="lwDesc">${escHtml(p.deskripsi || '')}</textarea></div><button class="btn btn-primary" onclick="simpanLowongan('${id || ''}')">Simpan</button>`
  );
}
async function simpanLowongan(id) {
  const data = {
    posisi: document.getElementById('lwPos').value,
    departemen: document.getElementById('lwDept').value,
    status: document.getElementById('lwStatus').value,
    deadline: document.getElementById('lwDead').value,
    deskripsi: document.getElementById('lwDesc').value,
    updatedAt: new Date().toISOString(),
  };
  if (!data.posisi) return toast('Posisi wajib', 'warning');
  if (id) await db.collection('hrd_lowongan').doc(id).update(data);
  else await db.collection('hrd_lowongan').add({ ...data, createdAt: new Date().toISOString() });
  closeModalDirect();
  toast('Disimpan', 'success');
  renderLowongan();
}

async function renderPipeline() {
  const main = document.getElementById('mainContent');
  const stages = [
    'Applied',
    'DISC Test Done',
    'Screening',
    'Interview',
    'Offering',
    'Hired',
    'Rejected',
  ];
  const colors = ['#1565c0', '#7b1fa2', '#f57f17', '#6a1b9a', '#e65100', '#2e7d32', '#c62828'];
  main.innerHTML = `<div class="page-title"><span>🔄 Pipeline Rekrutmen</span></div><div class="kanban-board" id="kanbanBoard"></div>`;
  const snap = await db.collection('hrd_kandidat').get();
  const byStage = {};
  stages.forEach((s) => (byStage[s] = []));
  snap.forEach((d) => {
    const p = { id: d.id, ...d.data() };
    const st = p.stage || 'Applied';
    if (byStage[st]) byStage[st].push(p);
  });
  let h = '';
  stages.forEach((s, i) => {
    h += `<div class="kanban-col"><div class="kanban-col-title" style="background:${colors[i]}">${s} (${byStage[s].length})</div>`;
    byStage[s].forEach((k) => {
      h += `<div class="kanban-card" onclick="modalKandidat('${k.id}')"><div class="fw-700">${escHtml(k.nama)}</div><div class="text-xs" style="color:#999">${escHtml(k.posisi || '-')}</div></div>`;
    });
    h += `</div>`;
  });
  document.getElementById('kanbanBoard').innerHTML = h;
}

async function renderKandidat() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>🧑‍💼 Kandidat</span><div class="flex gap-8"><button class="btn btn-primary btn-sm" onclick="modalKandidat()">+ Tambah</button><button class="btn btn-success btn-sm" onclick="syncDiscCalonToKandidat()">🔄 Sinkron dari DISC</button></div></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Posisi</th><th>Stage</th><th>DISC</th><th>Aksi</th></tr></thead><tbody id="tblKand"></tbody></table></div></div>`;
  const snap = await db.collection('hrd_kandidat').get();
  let h = '';
  if (snap.empty) h = '<tr><td colspan="5" class="text-center">Belum ada</td></tr>';
  else
    snap.forEach((d) => {
      const p = d.data();
      h += `<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.posisi || '-')}</td><td><span class="badge badge-info">${p.stage || 'Applied'}</span></td><td>${p.discPattern ? `<span class="badge badge-primary">${escHtml(p.discPattern)}</span>` : '-'}</td><td><button class="btn btn-xs btn-info" onclick="modalKandidat('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_kandidat','${d.id}','kandidat')">🗑️</button></td></tr>`;
    });
  document.getElementById('tblKand').innerHTML = h;
}

async function syncDiscCalonToKandidat() {
  const discSnap = await db.collection('hrd_disc_results').where('mode', '==', 'calon').get();
  if (discSnap.empty) return toast('Tidak ada data DISC calon karyawan', 'info');
  const kandSnap = await db.collection('hrd_kandidat').get();
  const existingNames = new Set();
  kandSnap.forEach((d) => existingNames.add(d.data().nama?.toLowerCase()));
  let count = 0;
  for (const doc of discSnap.docs) {
    const r = doc.data();
    if (!r.nama || existingNames.has(r.nama.toLowerCase())) continue;
    await db.collection('hrd_kandidat').add({
      nama: r.nama,
      email: r.kontak || '',
      posisi: r.posisi || '',
      stage: 'DISC Test Done',
      sumber: 'DISC Test Online',
      discPattern: r.pattern || '',
      discProfile: r.profileName || '',
      discScore: r.kpiScore || 0,
      usia: r.usia || '',
      jenisKelamin: r.jenisKelamin || '',
      kontak: r.kontak || '',
      createdAt: r.createdAt || new Date().toISOString(),
    });
    existingNames.add(r.nama.toLowerCase());
    count++;
  }
  toast(`${count} kandidat dari DISC disinkronkan ke rekrutmen`, 'success');
  if (count > 0) renderKandidat();
}
function modalKandidat(id) {
  if (id)
    db.collection('hrd_kandidat')
      .doc(id)
      .get()
      .then((d) => showKandForm(id, d.data() || {}));
  else showKandForm(null, {});
}
function showKandForm(id, p) {
  openModal(
    `<div class="modal-title">${id ? 'Edit' : 'Tambah'} Kandidat</div><div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="kdNama" value="${escHtml(p.nama || '')}"></div><div class="form-group"><label>Posisi</label><input class="form-control" id="kdPos" value="${escHtml(p.posisi || '')}"></div></div><div class="grid-2"><div class="form-group"><label>Email</label><input class="form-control" id="kdEmail" value="${escHtml(p.email || '')}"></div><div class="form-group"><label>Stage</label><select class="form-control" id="kdStage"><option value="Applied" ${p.stage === 'Applied' ? 'selected' : ''}>Applied</option><option value="DISC Test Done" ${p.stage === 'DISC Test Done' ? 'selected' : ''}>DISC Test Done</option><option value="Screening" ${p.stage === 'Screening' ? 'selected' : ''}>Screening</option><option value="Interview" ${p.stage === 'Interview' ? 'selected' : ''}>Interview</option><option value="Offering" ${p.stage === 'Offering' ? 'selected' : ''}>Offering</option><option value="Hired" ${p.stage === 'Hired' ? 'selected' : ''}>Hired</option><option value="Rejected" ${p.stage === 'Rejected' ? 'selected' : ''}>Rejected</option></select></div></div><div class="grid-2"><div class="form-group"><label>DISC Pattern</label><input class="form-control" id="kdDisc" value="${escHtml(p.discPattern || '')}" placeholder="Otomatis dari DISC" readonly></div><div class="form-group"><label>Kontak</label><input class="form-control" id="kdKontak" value="${escHtml(p.kontak || p.email || '')}"></div></div><button class="btn btn-primary" onclick="simpanKandidat('${id || ''}')">Simpan</button>`
  );
}
async function simpanKandidat(id) {
  const data = {
    nama: document.getElementById('kdNama').value,
    posisi: document.getElementById('kdPos').value,
    email: document.getElementById('kdEmail').value,
    stage: document.getElementById('kdStage').value,
    updatedAt: new Date().toISOString(),
  };
  if (!data.nama) return toast('Nama wajib', 'warning');
  if (id) await db.collection('hrd_kandidat').doc(id).update(data);
  else await db.collection('hrd_kandidat').add({ ...data, createdAt: new Date().toISOString() });
  closeModalDirect();
  toast('Disimpan', 'success');
  renderKandidat();
}

// ══════════════════════════════════════════════════════════════
// ── KELOLA JOBDESK — Admin assign jobdesk ke karyawan ─────────
// ══════════════════════════════════════════════════════════════

async function renderJobdeskMgmt() {
  if (!hasAccess(3))
    return (document.getElementById('mainContent').innerHTML =
      '<div class="card"><p>Akses ditolak.</p></div>');
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>📋 Kelola Jobdesk Karyawan</span><button class="btn btn-primary btn-sm" onclick="modalJobdeskPilih()">+ Atur Jobdesk</button></div><div class="card"><p class="text-sm mb-16" style="color:#666">Atur deskripsi pekerjaan, tanggung jawab, dan KPI untuk setiap karyawan. Data diambil dari Data Karyawan.</p><div class="flex gap-8 mb-16"><input class="form-control" placeholder="🔍 Cari nama..." id="srcJobdesk" oninput="filterJobdeskList()"><select class="form-control" style="max-width:180px" id="filterJobdeskDept" onchange="filterJobdeskList()"><option value="">Semua Dept</option></select></div><div class="table-wrap"><table><thead><tr><th>NIP</th><th>Nama</th><th>Departemen</th><th>Posisi</th><th>Jobdesk</th><th>Aksi</th></tr></thead><tbody id="tblJobdesk"></tbody></table></div></div>`;
  // Get ALL karyawan (no status filter to avoid index issues)
  const [karySnap, jobdeskSnap] = await Promise.all([
    db.collection('hrd_karyawan').get(),
    db.collection('hrd_jobdesk').get(),
  ]);
  const jobdeskMap = {};
  jobdeskSnap.forEach((d) => {
    const data = d.data();
    jobdeskMap[data.karyawanId || data.userId || ''] = d.id;
  });
  window._jobdeskKaryawan = [];
  const depts = new Set();
  karySnap.forEach((d) => {
    const p = { id: d.id, ...d.data() };
    const st = (p.status || '').toLowerCase();
    if (st === 'nonaktif') return;
    p.hasJobdesk = !!jobdeskMap[d.id];
    p.jobdeskDocId = jobdeskMap[d.id] || null;
    window._jobdeskKaryawan.push(p);
    depts.add(p.departemen || '');
  });
  // Sort by nama
  window._jobdeskKaryawan.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
  const sel = document.getElementById('filterJobdeskDept');
  depts.forEach((d) => {
    if (d) sel.innerHTML += `<option>${escHtml(d)}</option>`;
  });
  filterJobdeskList();
}

async function modalJobdeskPilih() {
  // Show dropdown to pick karyawan
  const karySnap = await db.collection('hrd_karyawan').get();
  let opts = '<option value="">-- Pilih Karyawan --</option>';
  const list = [];
  karySnap.forEach((d) => {
    const p = d.data();
    if ((p.status || '').toLowerCase() !== 'nonaktif') list.push({ id: d.id, ...p });
  });
  list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
  list.forEach((k) => {
    opts += `<option value="${k.id}" data-nama="${escHtml(k.nama)}" data-posisi="${escHtml(k.posisi || '')}">${escHtml(k.nama)} — ${escHtml(k.departemen || '-')} (${escHtml(k.posisi || '-')})</option>`;
  });
  openModal(`<div class="modal-title">📋 Pilih Karyawan untuk Atur Jobdesk</div>
    <div class="form-group"><label>Karyawan</label><select class="form-control" id="jdPilihKary">${opts}</select></div>
    <button class="btn btn-primary" onclick="openJobdeskFromDropdown()">Lanjut →</button>`);
}

function openJobdeskFromDropdown() {
  const sel = document.getElementById('jdPilihKary');
  const id = sel.value;
  if (!id) return toast('Pilih karyawan dulu', 'warning');
  const nama = sel.options[sel.selectedIndex].dataset.nama || '';
  const posisi = sel.options[sel.selectedIndex].dataset.posisi || '';
  closeModalDirect();
  modalJobdesk(id, nama, posisi);
}

function filterJobdeskList() {
  const q = (document.getElementById('srcJobdesk')?.value || '').toLowerCase();
  const dept = document.getElementById('filterJobdeskDept')?.value || '';
  const filtered = (window._jobdeskKaryawan || []).filter((k) => {
    if (q && !k.nama?.toLowerCase().includes(q)) return false;
    if (dept && k.departemen !== dept) return false;
    return true;
  });
  let h = '';
  if (!filtered.length)
    h = '<tr><td colspan="6" class="text-center">Tidak ada data karyawan</td></tr>';
  else
    filtered.forEach((k) => {
      h += `<tr><td class="text-xs">${escHtml(k.nip || '-')}</td><td class="fw-700">${escHtml(k.nama)}</td><td>${escHtml(k.departemen || '-')}</td><td>${escHtml(k.posisi || '-')}</td><td><span class="badge badge-${k.hasJobdesk ? 'success' : 'warning'}">${k.hasJobdesk ? '✅ Sudah' : '⚠️ Belum'}</span></td><td><button class="btn btn-xs btn-info" onclick="modalJobdesk('${k.id}','${escHtml(k.nama)}','${escHtml(k.posisi || '')}')">${k.hasJobdesk ? '✏️ Edit' : '+ Atur'}</button></td></tr>`;
    });
  document.getElementById('tblJobdesk').innerHTML = h;
}

async function modalJobdesk(karyawanId, nama, posisi) {
  // Load existing jobdesk by karyawanId
  const snap = await db.collection('hrd_jobdesk').where('karyawanId', '==', karyawanId).get();
  let p = {},
    docId = null;
  if (!snap.empty) {
    p = snap.docs[0].data();
    docId = snap.docs[0].id;
  } else {
    // Fallback: check by userId (old format)
    const snap2 = await db.collection('hrd_jobdesk').where('userId', '==', karyawanId).get();
    if (!snap2.empty) {
      p = snap2.docs[0].data();
      docId = snap2.docs[0].id;
    }
  }

  openModal(
    `<div class="modal-title">📋 Jobdesk: ${escHtml(nama)}</div>
    <div style="background:#f0f4ff;padding:10px 14px;border-radius:8px;margin-bottom:16px"><div class="text-xs"><b>Posisi:</b> ${escHtml(posisi || '-')}</div></div>
    <div class="form-group"><label>Deskripsi Pekerjaan</label><textarea class="form-control" id="jdDesc" style="min-height:100px" placeholder="Deskripsi umum posisi dan pekerjaan...">${escHtml(p.deskripsi || '')}</textarea></div>
    <div class="form-group"><label>Tanggung Jawab (per baris)</label><textarea class="form-control" id="jdTanggung" style="min-height:120px" placeholder="Mengelola data karyawan\nMembuat laporan bulanan\nKoordinasi dengan tim">${escHtml(p.tanggungJawab || '')}</textarea></div>
    <div class="form-group"><label>Kualifikasi (per baris)</label><textarea class="form-control" id="jdKualifikasi" style="min-height:80px" placeholder="Min. S1 Manajemen\nPengalaman 2 tahun\nMenguasai MS Office">${escHtml(p.kualifikasi || '')}</textarea></div>
    <div class="form-group"><label>Target KPI</label><textarea class="form-control" id="jdKPI" placeholder="Target yang harus dicapai...">${escHtml(p.kpi || '')}</textarea></div>
    <div class="flex gap-8"><button class="btn btn-primary" onclick="simpanJobdesk('${karyawanId}','${docId || ''}')">💾 Simpan Jobdesk</button>${docId ? `<button class="btn btn-danger" onclick="hapusDoc('hrd_jobdesk','${docId}','jobdesk-mgmt')">🗑️ Hapus</button>` : ''}</div>`,
    true
  );
}

async function simpanJobdesk(karyawanId, docId) {
  const data = {
    karyawanId,
    userId: karyawanId,
    deskripsi: document.getElementById('jdDesc').value,
    tanggungJawab: document.getElementById('jdTanggung').value,
    kualifikasi: document.getElementById('jdKualifikasi').value,
    kpi: document.getElementById('jdKPI').value,
    updatedAt: new Date().toISOString(),
  };
  if (docId) await db.collection('hrd_jobdesk').doc(docId).update(data);
  else await db.collection('hrd_jobdesk').add({ ...data, createdAt: new Date().toISOString() });
  closeModalDirect();
  toast('Jobdesk disimpan', 'success');
  renderJobdeskMgmt();
}

// ══════════════════════════════════════════════════════════════
