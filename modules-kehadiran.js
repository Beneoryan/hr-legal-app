'use strict';
// ── CUTI / IZIN / WFH ─────────────────────────────────────────
async function renderCuti() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>🏖️ Cuti / Izin / WFH</span><button class="btn btn-primary btn-sm" onclick="modalCuti()">+ Pengajuan</button></div>
    ${hasAccess(3) ? '<div class="card mb-16"><div class="card-title mb-8">📊 Sisa Jatah Cuti Karyawan</div><div id="cutiQuotaList">Loading...</div></div>' : ''}
    <div class="card"><div class="card-title mb-8">📋 Daftar Pengajuan</div><div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Jenis</th><th>Tanggal</th><th>Durasi</th><th>Sisa Cuti</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblCuti"></tbody></table></div></div>`;
  // Load data
  const [cutiSnap, karySnap] = await Promise.all([
    !hasAccess(3)
      ? db.collection('hrd_cuti').where('userId', '==', currentUser.id).get()
      : db.collection('hrd_cuti').get(),
    db.collection('hrd_karyawan').where('status', '==', 'aktif').get(),
  ]);
  // Calculate quota per karyawan
  const cutiUsed = {}; // userId -> total hari cuti tahunan approved
  cutiSnap.forEach((d) => {
    const p = d.data();
    if (p.status === 'approved' && p.jenis === 'Cuti Tahunan') {
      const uid = p.userId || p.nama;
      cutiUsed[uid] = (cutiUsed[uid] || 0) + (p.durasi || 1);
    }
  });
  // Build quota table
  let quotaHtml =
    '<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Dept</th><th>Masa Kerja</th><th>Jatah/Tahun</th><th>Terpakai</th><th>Sisa</th></tr></thead><tbody>';
  const karyList = [];
  karySnap.forEach((d) => karyList.push({ id: d.id, ...d.data() }));
  karyList.forEach((k) => {
    const quota = hitungJatahCuti(k);
    const used = cutiUsed[k.id] || cutiUsed[k.nama] || 0;
    const sisa = Math.max(0, quota - used);
    const masaKerja = hitungMasaKerja(k.tanggalMasuk);
    const color = sisa <= 2 ? 'var(--danger)' : sisa <= 5 ? 'var(--warning)' : 'var(--success)';
    quotaHtml += `<tr><td class="fw-700">${escHtml(k.nama)}</td><td>${escHtml(k.departemen || '-')}</td><td>${masaKerja}</td><td>${quota} hari</td><td>${used} hari</td><td style="color:${color};font-weight:700">${sisa} hari</td></tr>`;
  });
  quotaHtml += '</tbody></table></div>';
  const cutiQuotaEl = document.getElementById('cutiQuotaList');
  if (cutiQuotaEl) cutiQuotaEl.innerHTML = quotaHtml;
  // Render cuti list with sisa info
  let h = '';
  if (cutiSnap.empty) h = '<tr><td colspan="7" class="text-center">Belum ada</td></tr>';
  else {
    const items = [];
    cutiSnap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    items.forEach((p) => {
      const badge =
        p.status === 'approved'
          ? 'badge-success'
          : p.status === 'rejected'
            ? 'badge-danger'
            : 'badge-warning';
      const uid = p.userId || p.nama;
      const kary = karyList.find((k) => k.id === uid || k.nama === p.nama);
      const quota = kary ? hitungJatahCuti(kary) : 12;
      const used = cutiUsed[uid] || 0;
      const sisa = Math.max(0, quota - used);
      h += `<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.jenis)}</td><td>${formatDate(p.mulai)}-${formatDate(p.selesai)}</td><td>${p.durasi || 1}h</td><td><span class="badge badge-${sisa <= 2 ? 'danger' : sisa <= 5 ? 'warning' : 'success'}">${sisa}/${quota}</span></td><td><span class="badge ${badge}">${p.status}</span></td><td><button class="btn btn-xs btn-info" onclick="viewCutiDetail('${p.id}')" title="Lihat Detail">👁️</button> ${p.status === 'pending' && hasAccess(3) ? `<button class="btn btn-xs btn-success" onclick="approveCuti('${p.id}','approved')">✅</button> <button class="btn btn-xs btn-danger" onclick="approveCuti('${p.id}','rejected')">❌</button>` : ''} ${hasAccess(6) || (p.userId === currentUser.id && p.status === 'pending') ? `<button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_cuti','${p.id}','cuti')">🗑️</button>` : ''}</td></tr>`;
    });
  }
  document.getElementById('tblCuti').innerHTML = h;
}

// Hitung jatah cuti berdasarkan masa kerja, status, dan ketentuan
function hitungJatahCuti(karyawan) {
  // UU Cipta Kerja: minimal 12 hari/tahun setelah 1 tahun kerja
  // < 1 tahun: proporsional (1 hari per bulan kerja)
  // Karyawan tetap: 12 hari
  // Kontrak: proporsional
  // Probation: 0
  if (!karyawan.tanggalMasuk) return 12;
  const masuk = new Date(karyawan.tanggalMasuk);
  const now = new Date();
  const bulanKerja = Math.floor((now - masuk) / (30 * 24 * 60 * 60 * 1000));
  const tahunKerja = Math.floor(bulanKerja / 12);

  if (karyawan.status === 'probation') return 0;
  if (bulanKerja < 12) return Math.min(12, bulanKerja); // Proporsional
  // Setelah 1 tahun: 12 hari (standar UU)
  // Bonus: +1 hari per 2 tahun kerja (kebijakan perusahaan, max 18)
  const bonus = Math.min(3, Math.floor(tahunKerja / 2));
  return Math.min(18, 12 + bonus);
}

function hitungMasaKerja(tanggalMasuk) {
  if (!tanggalMasuk) return '-';
  const masuk = new Date(tanggalMasuk);
  const now = new Date();
  const bulan = Math.floor((now - masuk) / (30 * 24 * 60 * 60 * 1000));
  const tahun = Math.floor(bulan / 12);
  const sisaBulan = bulan % 12;
  if (tahun > 0) return `${tahun} thn ${sisaBulan} bln`;
  return `${bulan} bulan`;
}
function modalCuti() {
  openModal(
    `<div class="modal-title">Pengajuan Cuti/Izin/WFH</div><div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="ctNama" value="${currentUser.nama}"></div><div class="form-group"><label>Jenis</label><select class="form-control" id="ctJenis"><option>Cuti Tahunan</option><option>Cuti Sakit</option><option>Izin Pribadi</option><option>WFH</option><option>Cuti Melahirkan</option></select></div></div><div class="grid-2"><div class="form-group"><label>Mulai</label><input class="form-control" type="date" id="ctMulai" value="${todayStr()}"></div><div class="form-group"><label>Selesai</label><input class="form-control" type="date" id="ctSelesai" value="${todayStr()}"></div></div><div class="form-group"><label>Keterangan</label><textarea class="form-control" id="ctKet"></textarea></div><button class="btn btn-primary" onclick="simpanCuti()">Ajukan</button>`
  );
}
async function simpanCuti() {
  const mulai = document.getElementById('ctMulai').value,
    selesai = document.getElementById('ctSelesai').value;
  const durasi = Math.max(1, Math.ceil((new Date(selesai) - new Date(mulai)) / 86400000) + 1);
  const data = {
    nama: document.getElementById('ctNama').value,
    jenis: document.getElementById('ctJenis').value,
    mulai,
    selesai,
    durasi,
    keterangan: document.getElementById('ctKet').value,
    status: 'pending',
    userId: currentUser.id,
    createdAt: new Date().toISOString(),
  };
  if (!data.nama) return toast('Nama wajib', 'warning');
  // Find atasan (supervisor) from karyawan data for hierarchical approval
  const kSnap = await db
    .collection('hrd_karyawan')
    .where('nama', '==', currentUser.nama)
    .limit(1)
    .get();
  if (!kSnap.empty) {
    const kData = kSnap.docs[0].data();
    data.atasan = kData.atasan || '';
    data.departemen = kData.departemen || '';
  }
  await db.collection('hrd_cuti').add(data);
  // Notify atasan first, then HR
  if (data.atasan) {
    const atasanSnap = await db
      .collection('hrd_users')
      .where('nama', '==', data.atasan)
      .limit(1)
      .get();
    if (!atasanSnap.empty)
      await sendNotification(
        atasanSnap.docs[0].id,
        '📋 Pengajuan Cuti',
        `${data.nama} mengajukan ${data.jenis} (${durasi} hari)`,
        'approval-center'
      );
  }
  await sendNotification(
    'hr',
    '📋 Pengajuan Cuti',
    `${data.nama} mengajukan ${data.jenis}`,
    'approval-center'
  );
  closeModalDirect();
  toast('Diajukan ke atasan & HR', 'success');
  renderCuti();
}
async function approveCuti(id, status) {
  await db
    .collection('hrd_cuti')
    .doc(id)
    .update({ status, approvedBy: currentUser.nama, approvedAt: new Date().toISOString() });
  toast('Updated', 'success');
  renderCuti();
}

async function viewCutiDetail(id) {
  const doc = await db.collection('hrd_cuti').doc(id).get();
  if (!doc.exists) return toast('Data tidak ditemukan', 'warning');
  const p = doc.data();
  openModal(`<div class="modal-title">Detail Cuti/Izin</div>
    <table style="width:100%;border-collapse:collapse">
      <tr><td class="fw-700" style="padding:6px 8px;width:120px">Nama</td><td style="padding:6px 8px">${escHtml(p.nama || '-')}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Jenis</td><td style="padding:6px 8px">${escHtml(p.jenis || '-')}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Mulai</td><td style="padding:6px 8px">${formatDate(p.mulai)}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Selesai</td><td style="padding:6px 8px">${formatDate(p.selesai)}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Durasi</td><td style="padding:6px 8px">${p.durasi || 1} hari</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Keterangan</td><td style="padding:6px 8px">${escHtml(p.keterangan || '-')}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Status</td><td style="padding:6px 8px"><span class="badge badge-${p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'danger' : 'warning'}">${p.status || 'pending'}</span></td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Approved By</td><td style="padding:6px 8px">${escHtml(p.approvedBy || '-')}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Created At</td><td style="padding:6px 8px">${p.createdAt ? formatDate(p.createdAt.split('T')[0]) : '-'}</td></tr>
    </table>
    <div class="mt-16"><button class="btn btn-outline" onclick="closeModalDirect()">Tutup</button></div>`);
}

// ── OVERTIME ──────────────────────────────────────────────────
async function renderOvertime() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>⏰ Overtime</span><button class="btn btn-primary btn-sm" onclick="modalOvertime()">+ Pengajuan</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Tanggal</th><th>Jam</th><th>Durasi</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblOT"></tbody></table></div></div>`;
  const snap = await (!hasAccess(3)
    ? db.collection('hrd_overtime').where('userId', '==', currentUser.id).get()
    : db.collection('hrd_overtime').get());
  let h = '';
  if (snap.empty) h = '<tr><td colspan="6" class="text-center">Belum ada</td></tr>';
  else
    snap.forEach((d) => {
      const p = d.data();
      const badge =
        p.status === 'approved'
          ? 'badge-success'
          : p.status === 'rejected'
            ? 'badge-danger'
            : 'badge-warning';
      h += `<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${formatDate(p.tanggal)}</td><td>${p.jamMulai || '-'}-${p.jamSelesai || '-'}</td><td>${p.durasi || 0}j</td><td><span class="badge ${badge}">${p.status}</span></td><td>${p.status === 'pending' && hasAccess(3) ? `<button class="btn btn-xs btn-success" onclick="approveOT('${d.id}','approved')">✅</button> <button class="btn btn-xs btn-danger" onclick="approveOT('${d.id}','rejected')">❌</button>` : ''} ${hasAccess(6) ? `<button class="btn btn-xs btn-warning" onclick="editOTDoc('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_overtime','${d.id}','overtime')">🗑️</button>` : ''}</td></tr>`;
    });
  document.getElementById('tblOT').innerHTML = h;
}
function modalOvertime() {
  openModal(
    `<div class="modal-title">Pengajuan Overtime</div><div class="form-group"><label>Nama</label><input class="form-control" id="otNama" value="${currentUser.nama}"></div><div class="grid-3"><div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="otTgl" value="${todayStr()}"></div><div class="form-group"><label>Mulai</label><input class="form-control" type="time" id="otStart"></div><div class="form-group"><label>Selesai</label><input class="form-control" type="time" id="otEnd"></div></div><div class="form-group"><label>Alasan</label><textarea class="form-control" id="otAlasan"></textarea></div><button class="btn btn-primary" onclick="simpanOvertime()">Ajukan</button>`
  );
}
async function simpanOvertime() {
  const s = document.getElementById('otStart').value,
    e = document.getElementById('otEnd').value;
  const durasi =
    s && e
      ? Math.max(0, (new Date('2000-01-01T' + e) - new Date('2000-01-01T' + s)) / 3600000).toFixed(
          1
        )
      : 0;
  await db.collection('hrd_overtime').add({
    nama: document.getElementById('otNama').value,
    tanggal: document.getElementById('otTgl').value,
    jamMulai: s,
    jamSelesai: e,
    durasi: parseFloat(durasi),
    alasan: document.getElementById('otAlasan').value,
    status: 'pending',
    userId: currentUser.id,
    createdAt: new Date().toISOString(),
  });
  closeModalDirect();
  toast('Diajukan', 'success');
  renderOvertime();
}
async function approveOT(id, status) {
  await db.collection('hrd_overtime').doc(id).update({ status, approvedBy: currentUser.nama });
  toast('Updated', 'success');
  renderOvertime();
}

// ── HARI LIBUR ────────────────────────────────────────────────

// Indonesian National Holidays 2025
const HARI_LIBUR_NASIONAL_2025 = [
  { tanggal: '2025-01-01', nama: 'Tahun Baru Masehi', tipe: 'nasional' },
  { tanggal: '2025-01-27', nama: "Isra Mi'raj Nabi Muhammad SAW", tipe: 'nasional' },
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
  { tanggal: '2025-12-26', nama: 'Cuti Bersama Natal', tipe: 'cuti_bersama' },
];

const HARI_LIBUR_NASIONAL_2026 = [
  { tanggal: '2026-01-01', nama: 'Tahun Baru Masehi', tipe: 'nasional' },
  { tanggal: '2026-01-16', nama: "Isra Mi'raj Nabi Muhammad SAW", tipe: 'nasional' },
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
  { tanggal: '2026-05-27', nama: 'Hari Raya Idul Adha 1447 H', tipe: 'nasional' },
  { tanggal: '2026-05-28', nama: 'Cuti Bersama Idul Adha', tipe: 'cuti_bersama' },
  { tanggal: '2026-05-29', nama: 'Cuti Bersama Idul Adha', tipe: 'cuti_bersama' },
  { tanggal: '2026-05-31', nama: 'Hari Raya Waisak 2570 BE', tipe: 'nasional' },
  { tanggal: '2026-06-01', nama: 'Hari Lahir Pancasila', tipe: 'nasional' },
  { tanggal: '2026-06-16', nama: 'Tahun Baru Islam 1448 H', tipe: 'nasional' },
  { tanggal: '2026-08-17', nama: 'Hari Kemerdekaan RI', tipe: 'nasional' },
  { tanggal: '2026-08-26', nama: 'Maulid Nabi Muhammad SAW', tipe: 'nasional' },
  { tanggal: '2026-12-24', nama: 'Cuti Bersama Natal', tipe: 'cuti_bersama' },
  { tanggal: '2026-12-25', nama: 'Hari Natal', tipe: 'nasional' },
  { tanggal: '2026-12-31', nama: 'Cuti Bersama Tahun Baru', tipe: 'cuti_bersama' },
];

let hariLiburCalendarMonth = null;
let hariLiburViewMode = 'myCalendar'; // 'myCalendar' or 'daftar'

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
        <div class="tab ${hariLiburViewMode === 'myCalendar' ? 'active' : ''}" onclick="switchHariLiburView('myCalendar')">📅 Kalender</div>
        <div class="tab ${hariLiburViewMode === 'daftar' ? 'active' : ''}" onclick="switchHariLiburView('daftar')">📋 Daftar Libur</div>
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
  if (hariLiburCalendarMonth.month < 0) {
    hariLiburCalendarMonth.month = 11;
    hariLiburCalendarMonth.year--;
  }
  loadHariLiburView();
}

function hariLiburNextMonth() {
  hariLiburCalendarMonth.month++;
  if (hariLiburCalendarMonth.month > 11) {
    hariLiburCalendarMonth.month = 0;
    hariLiburCalendarMonth.year++;
  }
  loadHariLiburView();
}

async function loadHariLiburView() {
  const y = hariLiburCalendarMonth.year;
  const m = hariLiburCalendarMonth.month;
  const container = document.getElementById('hariLiburContent');
  if (!container) return;
  window._hariLiburUserReminders = [];
  window._hariLiburUserNotes = [];

  if (hariLiburViewMode === 'myCalendar') {
    renderMyCalendarView(container);
  } else {
    const monthNames = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];
    const startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const endDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`;
    let holidays = [];
    try {
      const snap = await db.collection('hrd_hari_libur').get();
      snap.forEach((d) => {
        const data = d.data();
        if (data.tanggal >= startDate && data.tanggal <= endDate)
          holidays.push({ id: d.id, ...data });
      });
    } catch (e) {
      console.warn('Failed to load holidays:', e);
    }
    let navHtml = `<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn btn-sm btn-outline" onclick="hariLiburPrevMonth()">&lt;</button>
        <span class="fw-700 color-primary" style="min-width:140px;text-align:center">${monthNames[m]} ${y}</span>
        <button class="btn btn-sm btn-outline" onclick="hariLiburNextMonth()">&gt;</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${hasAccess(6) ? '<button class="btn btn-info btn-sm" onclick="syncHariLiburNasional()">🔄 Sinkron Nasional</button>' : ''}
        ${hasAccess(6) ? '<button class="btn btn-primary btn-sm" onclick="modalHariLibur()">+ Tambah Custom</button>' : ''}
      </div>
    </div>`;
    container.innerHTML = navHtml;
    const listDiv = document.createElement('div');
    container.appendChild(listDiv);
    renderHariLiburList(listDiv, y, m, holidays);
  }
}

function renderHariLiburList(container, year, month, holidays) {
  let html =
    '<div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Nama</th><th>Tipe</th><th>Aksi</th></tr></thead><tbody>';
  if (!holidays.length) {
    html += '<tr><td colspan="4" class="text-center">Tidak ada hari libur bulan ini</td></tr>';
  } else {
    holidays.forEach((h) => {
      const tipeBadge =
        h.tipe === 'nasional'
          ? 'badge-danger'
          : h.tipe === 'cuti_bersama'
            ? 'badge-warning'
            : 'badge-info';
      const tipeLabel =
        h.tipe === 'nasional'
          ? 'Nasional'
          : h.tipe === 'cuti_bersama'
            ? 'Cuti Bersama'
            : 'Perusahaan';
      html += `<tr>
        <td>${formatDate(h.tanggal)}</td>
        <td class="fw-700">${escHtml(h.nama)}</td>
        <td><span class="badge ${tipeBadge}">${tipeLabel}</span></td>
        <td>
          <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&dates=${h.tanggal.replace(/-/g, '')}/${h.tanggal.replace(/-/g, '')}&text=${encodeURIComponent(h.nama)}" target="_blank" class="btn btn-xs btn-info" title="Tambah ke Google Calendar">📅</a>
          ${hasAccess(6) ? '<button class="btn btn-xs btn-danger" onclick="hapusHariLibur(\'' + h.id + '\')">🗑️</button>' : ''}
        </td>
      </tr>`;
    });
  }
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

async function renderMyCalendarView(container) {
  const y = hariLiburCalendarMonth.year;
  const m = hariLiburCalendarMonth.month;
  const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const today = todayStr();

  // Navigation
  let navHtml = `<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:8px">
      <button class="btn btn-sm btn-outline" onclick="hariLiburPrevMonth()">&lt;</button>
      <span class="fw-700 color-primary" style="min-width:140px;text-align:center">${monthNames[m]} ${y}</span>
      <button class="btn btn-sm btn-outline" onclick="hariLiburNextMonth()">&gt;</button>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      ${hasAccess(6) ? '<button class="btn btn-info btn-sm" onclick="syncHariLiburNasional()">🔄 Sinkron</button>' : ''}
      ${hasAccess(6) ? '<button class="btn btn-primary btn-sm" onclick="modalHariLibur()">+ Hari Libur</button>' : ''}
    </div>
  </div>`;

  let legendHtml =
    '<div style="margin-bottom:12px"><span style="font-size:.75rem;color:var(--text-light)">🔴 Libur &nbsp; 🔵 Pending &nbsp; 🟢 Selesai &nbsp; 🟠 Terlambat &nbsp; 🟣 Ditugaskan</span></div>';
  container.innerHTML =
    navHtml +
    legendHtml +
    '<div style="text-align:center;padding:24px;color:var(--text-light)">Memuat kalender...</div>';

  // Load holidays and tasks for this month
  const startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const endDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`;
  let holidays = [];
  let tasks = [];

  try {
    const [holSnap, taskSnap] = await Promise.all([
      db.collection('hrd_hari_libur').get(),
      db.collection('hrd_daily_tasks').get(),
    ]);
    holSnap.forEach((d) => {
      const data = d.data();
      if (data.tanggal >= startDate && data.tanggal <= endDate)
        holidays.push({ id: d.id, ...data });
    });
    taskSnap.forEach((d) => {
      const t = d.data();
      if (t.userId === currentUser.id && t.tanggal >= startDate && t.tanggal <= endDate) {
        tasks.push({ id: d.id, ...t });
      }
      if (
        hasAccess(3) &&
        t.assignedBy === currentUser.id &&
        t.userId !== currentUser.id &&
        t.tanggal >= startDate &&
        t.tanggal <= endDate
      ) {
        tasks.push({ id: d.id, ...t, _isAssigned: true });
      }
    });
  } catch (e) {
    console.warn('Failed to load calendar data:', e);
  }

  // Build calendar grid
  const firstDay = new Date(y, m, 1).getDay(); // 0=Sun,1=Mon,...
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrevMonth = new Date(y, m, 0).getDate();
  // Adjust to Monday start: Mon=0, Tue=1,...Sun=6
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  // Map holidays and tasks by day
  const holidayMap = {};
  holidays.forEach((h) => {
    const day = parseInt(h.tanggal.split('-')[2]);
    if (!holidayMap[day]) holidayMap[day] = [];
    holidayMap[day].push(h);
  });
  const taskMap = {};
  tasks.forEach((t) => {
    const day = parseInt(t.tanggal.split('-')[2]);
    if (!taskMap[day]) taskMap[day] = [];
    taskMap[day].push(t);
  });

  let calHtml =
    '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:#e0e0e0;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">';
  // Header
  dayNames.forEach((dn) => {
    calHtml += `<div style="background:#f5f5f5;padding:8px;text-align:center;font-weight:700;font-size:.8rem">${dn}</div>`;
  });

  // Previous month padding days
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    calHtml += `<div style="background:#fafafa;min-height:80px;padding:4px;opacity:.4"><div style="font-size:.8rem;color:#999">${d}</div></div>`;
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const dayHolidays = holidayMap[day] || [];
    const dayTasks = taskMap[day] || [];
    const bgColor = isToday ? '#e3f2fd' : '#fff';
    const borderStyle = isToday ? 'box-shadow:inset 0 0 0 2px #1565c0;' : '';

    calHtml += `<div style="background:${bgColor};min-height:80px;padding:4px;${borderStyle}position:relative">`;
    calHtml += `<div style="font-weight:700;font-size:.85rem;${isToday ? 'color:#1565c0' : ''}">${day}</div>`;

    // Show holidays
    dayHolidays.forEach((h) => {
      const label = h.nama.length > 15 ? h.nama.substring(0, 15) + '...' : h.nama;
      calHtml += `<div style="font-size:.6rem;background:#c62828;color:#fff;padding:1px 4px;border-radius:3px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escHtml(h.nama)}">${escHtml(label)}</div>`;
    });

    // Show tasks
    dayTasks.forEach((t) => {
      let bgTask;
      if (t._isAssigned) {
        bgTask = '#7b1fa2';
      } else if (t.done) {
        bgTask = '#4caf50';
      } else if (t.tanggal < today) {
        bgTask = '#c62828';
      } else {
        bgTask = '#1565c0';
      }
      const priorityMark = t.priority === 'high' ? '! ' : '';
      const taskLabel =
        (priorityMark + t.title).length > 14
          ? (priorityMark + t.title).substring(0, 14) + '...'
          : priorityMark + t.title;
      calHtml += `<div style="font-size:.6rem;background:${bgTask};color:#fff;padding:1px 4px;border-radius:3px;margin-top:2px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escHtml(t.title)}${t._isAssigned ? ' (ditugaskan ke ' + escHtml(t.targetUserName || '') + ')' : ''}" onclick="navigateTo('daily-task')">${escHtml(taskLabel)}</div>`;
    });

    calHtml += '</div>';
  }

  // Next month padding days
  const totalCells = startOffset + daysInMonth;
  const remainder = totalCells % 7;
  if (remainder > 0) {
    for (let i = 1; i <= 7 - remainder; i++) {
      calHtml += `<div style="background:#fafafa;min-height:80px;padding:4px;opacity:.4"><div style="font-size:.8rem;color:#999">${i}</div></div>`;
    }
  }

  calHtml += '</div>';

  container.innerHTML = navHtml + legendHtml + calHtml;
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
    tanggal,
    nama,
    tipe,
    tahun,
    createdAt: new Date().toISOString(),
  });
  closeModalDirect();
  toast('Hari libur ditambahkan', 'success');
  loadHariLiburView();
}

async function checkHariLiburReminders() {}

async function syncHariLiburNasional() {
  const year = hariLiburCalendarMonth.year;
  let dataToSync = [];
  if (year === 2025) dataToSync = HARI_LIBUR_NASIONAL_2025;
  else if (year === 2026) dataToSync = HARI_LIBUR_NASIONAL_2026;
  else {
    toast(`Data hari libur nasional tahun ${year} belum tersedia. Tersedia: 2025, 2026`, 'warning');
    return;
  }

  if (
    !confirm(
      `Sinkronisasi ${dataToSync.length} hari libur nasional tahun ${year}? Data yang sudah ada (nasional/cuti_bersama) akan diperbarui.`
    )
  )
    return;

  toast('Memproses sinkronisasi...', 'info');

  // Delete ALL existing national/cuti_bersama holidays for this year (by date range)
  const startYear = `${year}-01-01`,
    endYear = `${year}-12-31`;
  const existingSnap = await db.collection('hrd_hari_libur').get();
  const batch1 = [];
  existingSnap.forEach((d) => {
    const data = d.data();
    const tgl = data.tanggal || '';
    const tipe = data.tipe || '';
    if (tgl >= startYear && tgl <= endYear && (tipe === 'nasional' || tipe === 'cuti_bersama'))
      batch1.push(d.ref.delete());
  });
  await Promise.all(batch1);

  // Add all national holidays
  const batch2 = [];
  dataToSync.forEach((h) => {
    batch2.push(
      db.collection('hrd_hari_libur').add({
        tanggal: h.tanggal,
        nama: h.nama,
        tipe: h.tipe,
        tahun: year,
        createdAt: new Date().toISOString(),
      })
    );
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

  const existingSnap = await db.collection('hrd_hari_libur').where('tahun', '==', year).get();
  let alreadyPopulated = false;
  existingSnap.forEach((d) => {
    const t = d.data().tipe;
    if (t === 'nasional' || t === 'cuti_bersama') alreadyPopulated = true;
  });
  if (alreadyPopulated) return; // Already populated

  const batch = [];
  dataToSync.forEach((h) => {
    batch.push(
      db.collection('hrd_hari_libur').add({
        tanggal: h.tanggal,
        nama: h.nama,
        tipe: h.tipe,
        tahun: year,
        createdAt: new Date().toISOString(),
      })
    );
  });
  await Promise.all(batch);
}

// Check if a given date is a holiday - returns holiday info or null
async function checkHoliday(dateStr) {
  const snap = await db.collection('hrd_hari_libur').where('tanggal', '==', dateStr).limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].data();
}

// ── PENALTY ───────────────────────────────────────────────────
async function renderPenalty() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>⚠️ Penalty Point</span><div class="flex gap-8">${hasAccess(4) ? '<button class="btn btn-info btn-sm" onclick="syncPenaltyToKPI()">🔄 Sinkronisasi ke KPI</button>' : ''}<button class="btn btn-primary btn-sm" onclick="modalPenalty()">+ Tambah</button></div></div>
    <div class="card mb-16"><div class="card-title mb-8">📊 Ringkasan Poin per Karyawan</div><div id="penaltySummary">Loading...</div></div>
    <div class="card"><div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Tanggal</th><th>Jenis</th><th>Poin</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblPenalty"></tbody></table></div></div>`;
  const [penSnap, karyawanSnap] = await Promise.all([
    db.collection('hrd_penalty').get(),
    db.collection('hrd_karyawan').where('status', '==', 'aktif').get(),
  ]);
  // Build karyawan dept map
  const karyDeptMap = {};
  karyawanSnap.forEach((d) => {
    const k = d.data();
    karyDeptMap[(k.nama || '').toLowerCase().trim()] = k.departemen || '-';
  });
  const myDept = (currentUser.departemen || '').toLowerCase().trim();
  const myNama = (currentUser.nama || '').toLowerCase().trim();
  // Filter penalty data based on role
  const allPenalty = [];
  penSnap.forEach((d) => allPenalty.push({ id: d.id, ...d.data() }));
  let visiblePenalty = allPenalty;
  if (!hasAccess(4)) {
    // Staff/leader (level 1-2): only see own penalty
    visiblePenalty = allPenalty.filter((p) => (p.nama || '').toLowerCase().trim() === myNama);
  } else if (!hasAccess(6)) {
    // Manager/Head (level 3-4): see own department only
    visiblePenalty = allPenalty.filter((p) => {
      const pDept = (karyDeptMap[(p.nama || '').toLowerCase().trim()] || p.departemen || '')
        .toLowerCase()
        .trim();
      return pDept === myDept || (p.nama || '').toLowerCase().trim() === myNama;
    });
  }
  // Admin (level 6): sees all — no filter
  // Build summary grouped by employee name
  const summary = {};
  karyawanSnap.forEach((d) => {
    const k = d.data();
    // Only include karyawan visible to current user
    if (!hasAccess(6)) {
      if (!hasAccess(4)) {
        if ((k.nama || '').toLowerCase().trim() !== myNama) return;
      } else if (!hasAccess(6)) {
        if ((k.departemen || '').toLowerCase().trim() !== myDept) return;
      }
    }
    summary[k.nama] = { nama: k.nama, departemen: k.departemen || '-', poin: 0 };
  });
  visiblePenalty.forEach((p) => {
    if (!summary[p.nama])
      summary[p.nama] = {
        nama: p.nama,
        departemen: karyDeptMap[(p.nama || '').toLowerCase().trim()] || '-',
        poin: 0,
      };
    summary[p.nama].poin += parseInt(p.poin) || 0;
  });
  // Render summary - only employees with points > 0
  const summaryItems = Object.values(summary).filter((s) => s.poin > 0);
  summaryItems.sort((a, b) => b.poin - a.poin);
  let sumH = '';
  if (!summaryItems.length) {
    sumH = '<p class="text-sm" style="color:#999">Belum ada karyawan dengan penalty point</p>';
  } else {
    sumH =
      '<div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Departemen</th><th>Total Poin</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
    summaryItems.forEach((s) => {
      const badgeClass =
        s.poin >= 10 ? 'badge-danger' : s.poin >= 5 ? 'badge-warning' : 'badge-info';
      const statusLabel =
        s.poin >= 10
          ? '<span class="badge badge-danger">SP III</span>'
          : s.poin >= 7
            ? '<span class="badge badge-danger">SP II</span>'
            : s.poin >= 4
              ? '<span class="badge badge-warning">SP I</span>'
              : '<span class="badge badge-info">Peringatan</span>';
      const jsName = escHtml(s.nama).replace(/'/g, "\\'");
      sumH += `<tr><td class="fw-700">${escHtml(s.nama)}</td><td>${escHtml(s.departemen)}</td><td><span class="badge ${badgeClass}">${s.poin}</span></td><td>${statusLabel}</td><td><button class="btn btn-xs btn-info" onclick="viewPenaltyDetail('${jsName}')">👁️</button>${hasAccess(2) ? ` <button class="btn btn-xs btn-primary" onclick="modalPenalty('${jsName}')">+ Tambah</button>` : ''}</td></tr>`;
    });
    sumH += '</tbody></table></div>';
  }
  document.getElementById('penaltySummary').innerHTML = sumH;
  // Render detail table
  let h = '';
  if (!visiblePenalty.length) h = '<tr><td colspan="6" class="text-center">Belum ada</td></tr>';
  else {
    visiblePenalty.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
    visiblePenalty.forEach((p) => {
      const statusBadge =
        p.jenis === 'SP III'
          ? '<span class="badge badge-danger">Berat</span>'
          : p.jenis === 'SP II'
            ? '<span class="badge badge-warning">Sedang</span>'
            : p.jenis === 'SP I'
              ? '<span class="badge badge-warning">Ringan</span>'
              : p.jenis === 'Mangkir'
                ? '<span class="badge badge-danger">Mangkir</span>'
                : '<span class="badge badge-info">Ringan</span>';
      h += `<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${formatDate(p.tanggal)}</td><td>${escHtml(p.jenis)}</td><td><span class="badge badge-danger">${p.poin}</span></td><td>${statusBadge}</td><td><button class="btn btn-xs btn-info" onclick="viewPenaltyItem('${p.id}')">👁️</button>${hasAccess(2) ? ` <button class="btn btn-xs btn-primary" onclick="editPenalty('${p.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_penalty','${p.id}','penalty')">🗑️</button>` : ''}</td></tr>`;
    });
  }
  document.getElementById('tblPenalty').innerHTML = h;
}

function viewPenaltyDetail(nama) {
  db.collection('hrd_penalty')
    .get()
    .then((snap) => {
      const items = [];
      snap.forEach((d) => {
        const p = d.data();
        if (p.nama === nama) items.push({ id: d.id, ...p });
      });
      items.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
      const totalPoin = items.reduce((sum, p) => sum + (parseInt(p.poin) || 0), 0);
      const statusLabel =
        totalPoin >= 10
          ? '🔴 SP III - Pelanggaran Berat'
          : totalPoin >= 7
            ? '🟠 SP II - Pelanggaran Sedang'
            : totalPoin >= 4
              ? '🟡 SP I - Pelanggaran Ringan'
              : '⚪ Peringatan';
      let h = `<div class="modal-title">👁️ Detail Penalty - ${escHtml(nama)}</div>
      <div style="background:#f8f9ff;padding:16px;border-radius:8px;margin-bottom:16px;border-left:4px solid var(--accent)">
        <div class="fw-700" style="font-size:1.05rem">${escHtml(nama)}</div>
        <div class="text-sm mt-8">Total Poin: <span class="badge badge-danger">${totalPoin}</span></div>
        <div class="text-sm mt-4">Status: <b>${statusLabel}</b></div>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Poin</th></tr></thead><tbody>`;
      items.forEach((p) => {
        h += `<tr><td>${formatDate(p.tanggal)}</td><td>${escHtml(p.jenis)}</td><td><span class="badge badge-danger">${p.poin}</span></td></tr>`;
      });
      h += '</tbody></table></div>';
      openModal(h, true);
    });
}

async function viewPenaltyItem(id) {
  const doc = await db.collection('hrd_penalty').doc(id).get();
  if (!doc.exists) return toast('Data tidak ditemukan', 'warning');
  const p = doc.data();
  const statusBadge =
    p.jenis === 'SP III'
      ? '🔴 Berat'
      : p.jenis === 'SP II'
        ? '🟠 Sedang'
        : p.jenis === 'SP I'
          ? '🟡 Ringan'
          : p.jenis === 'Mangkir'
            ? '🔴 Mangkir'
            : '⚪ Ringan';
  openModal(`<div class="modal-title">👁️ Detail Penalty</div>
    <div style="background:#f8f9ff;padding:16px;border-radius:8px;border-left:4px solid var(--danger)">
      <div class="text-sm" style="line-height:2">
        <div><b>Karyawan:</b> ${escHtml(p.nama)}</div>
        <div><b>Tanggal:</b> ${formatDate(p.tanggal)}</div>
        <div><b>Jenis:</b> ${escHtml(p.jenis)}</div>
        <div><b>Poin:</b> <span class="badge badge-danger">${p.poin}</span></div>
        <div><b>Status:</b> ${statusBadge}</div>
        <div><b>Dibuat:</b> ${formatDate(p.createdAt)}</div>
      </div>
    </div>`);
}

async function editPenalty(id) {
  const doc = await db.collection('hrd_penalty').doc(id).get();
  if (!doc.exists) return toast('Data tidak ditemukan', 'warning');
  const p = doc.data();
  openModal(`<div class="modal-title">✏️ Edit Penalty</div>
    <div class="grid-2">
      <div class="form-group"><label>Karyawan</label><input class="form-control" id="editPenNama" value="${escHtml(p.nama || '')}"></div>
      <div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="editPenTgl" value="${p.tanggal || ''}"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Jenis</label><select class="form-control" id="editPenJenis"><option ${p.jenis === 'Terlambat' ? 'selected' : ''}>Terlambat</option><option ${p.jenis === 'Mangkir' ? 'selected' : ''}>Mangkir</option><option ${p.jenis === 'SP I' ? 'selected' : ''}>SP I</option><option ${p.jenis === 'SP II' ? 'selected' : ''}>SP II</option><option ${p.jenis === 'SP III' ? 'selected' : ''}>SP III</option></select></div>
      <div class="form-group"><label>Poin</label><input class="form-control" type="number" id="editPenPoin" value="${p.poin || 1}"></div>
    </div>
    <button class="btn btn-primary" onclick="updatePenalty('${id}')">💾 Simpan</button>`);
}

async function updatePenalty(id) {
  const data = {
    nama: document.getElementById('editPenNama').value,
    tanggal: document.getElementById('editPenTgl').value,
    jenis: document.getElementById('editPenJenis').value,
    poin: parseInt(document.getElementById('editPenPoin').value) || 1,
    updatedAt: new Date().toISOString(),
  };
  if (!data.nama) return toast('Nama wajib', 'warning');
  await db.collection('hrd_penalty').doc(id).update(data);
  closeModalDirect();
  toast('Penalty diperbarui', 'success');
  renderPenalty();
}

async function syncPenaltyToKPI() {
  if (
    !confirm(
      'Sinkronisasi penalty point ke data KPI?\n\nIni akan menghitung ulang skor akhir KPI berdasarkan total penalty masing-masing karyawan.\nJika karyawan belum punya KPI, akan dibuatkan record KPI default.'
    )
  )
    return;
  const [kpiSnap, penSnap, karySnap] = await Promise.all([
    db.collection('hrd_kpi').get(),
    db.collection('hrd_penalty').get(),
    db.collection('hrd_karyawan').where('status', '==', 'aktif').get(),
  ]);
  // Calculate total penalty per nama
  const penaltyMap = {};
  penSnap.forEach((d) => {
    const p = d.data();
    const n = (p.nama || '').toLowerCase().trim();
    penaltyMap[n] = (penaltyMap[n] || 0) + (parseInt(p.poin) || 0);
  });
  // Track which names already have KPI records
  const kpiNames = new Set();
  let count = 0;
  // Update existing KPI records
  for (const doc of kpiSnap.docs) {
    const r = doc.data();
    const n = (r.nama || '').toLowerCase().trim();
    kpiNames.add(n);
    const totalPenalty = penaltyMap[n] || 0;
    const skorMurni = r.skorMurni != null ? r.skorMurni : r.skor;
    const skorAkhir = Math.max(0, skorMurni - totalPenalty * 2);
    if (r.penaltyPoin !== totalPenalty || r.skor !== skorAkhir || r.skorMurni == null) {
      await db
        .collection('hrd_kpi')
        .doc(doc.id)
        .update({
          skorMurni: skorMurni,
          skor: skorAkhir,
          penaltyPoin: totalPenalty,
          penaltyDeduction: totalPenalty * 2,
          syncedAt: new Date().toISOString(),
        });
      count++;
    }
  }
  // Create KPI records for employees that have penalty but NO KPI record yet
  for (const [namaLower, totalPenalty] of Object.entries(penaltyMap)) {
    if (totalPenalty > 0 && !kpiNames.has(namaLower)) {
      // Find original nama from karyawan
      let originalNama = namaLower;
      karySnap.forEach((d) => {
        const k = d.data();
        if ((k.nama || '').toLowerCase().trim() === namaLower) originalNama = k.nama;
      });
      const skorMurni = 80; // Default skor murni
      const skorAkhir = Math.max(0, skorMurni - totalPenalty * 2);
      await db.collection('hrd_kpi').add({
        nama: originalNama,
        periode: new Date().toISOString().slice(0, 7),
        produktivitas: 80,
        kualitas: 80,
        kedisiplinan: 80,
        kerjasama: 80,
        skorMurni: skorMurni,
        skor: skorAkhir,
        penaltyPoin: totalPenalty,
        penaltyDeduction: totalPenalty * 2,
        penilai: 'Auto-Sync Penalty',
        catatan: `Auto-generated dari sinkronisasi penalty (${totalPenalty} poin)`,
        createdAt: new Date().toISOString(),
        syncedAt: new Date().toISOString(),
      });
      count++;
    }
  }
  toast(`Sinkronisasi selesai: ${count} data KPI diperbarui/dibuat`, 'success');
}

async function modalPenalty(prefillNama) {
  // Load active employees for dropdown — leader/manager only see own dept
  const kSnap = await db.collection('hrd_karyawan').where('status', '==', 'aktif').get();
  const myDept = (currentUser.departemen || '').toLowerCase().trim();
  let opts = '<option value="">-- Pilih Karyawan --</option>';
  kSnap.forEach((d) => {
    const k = d.data();
    // Non-admin/head: only show karyawan from same department
    if (!hasAccess(4)) {
      if ((k.departemen || '').toLowerCase().trim() !== myDept) return;
    }
    const sel = prefillNama && k.nama === prefillNama ? ' selected' : '';
    opts += `<option value="${escHtml(k.nama)}"${sel}>${escHtml(k.nama)} — ${escHtml(k.departemen || '-')} (${escHtml(k.posisi || '-')})</option>`;
  });
  openModal(`<div class="modal-title">Tambah Penalty</div>
    <div class="grid-2">
      <div class="form-group"><label>Karyawan</label>
        <select class="form-control" id="penNamaSelect" onchange="document.getElementById('penNama').value=this.value">${opts}</select>
        <input class="form-control mt-4" id="penNama" placeholder="Atau ketik nama manual..." value="${escHtml(prefillNama || '')}">
      </div>
      <div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="penTgl" value="${todayStr()}"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Jenis</label><select class="form-control" id="penJenis"><option>Terlambat</option><option>Mangkir</option><option>SP I</option><option>SP II</option><option>SP III</option></select></div>
      <div class="form-group"><label>Poin</label><input class="form-control" type="number" id="penPoin" value="1"></div>
    </div>
    <button class="btn btn-primary" onclick="simpanPenalty()">Simpan</button>`);
}

async function simpanPenalty() {
  const selectVal = document.getElementById('penNamaSelect').value;
  const inputVal = document.getElementById('penNama').value;
  const nama = selectVal || inputVal;
  if (!nama) return toast('Nama wajib', 'warning');
  // Look up departemen for this karyawan
  let dept = '';
  try {
    const kSnap = await db.collection('hrd_karyawan').get();
    kSnap.forEach((d) => {
      const k = d.data();
      if ((k.nama || '').toLowerCase().trim() === nama.toLowerCase().trim())
        dept = k.departemen || '';
    });
  } catch (e) {}
  const data = {
    nama: nama,
    departemen: dept,
    tanggal: document.getElementById('penTgl').value,
    jenis: document.getElementById('penJenis').value,
    poin: parseInt(document.getElementById('penPoin').value) || 1,
    createdBy: currentUser.id,
    createdByName: currentUser.nama,
    createdAt: new Date().toISOString(),
  };
  await db.collection('hrd_penalty').add(data);
  closeModalDirect();
  toast('Ditambahkan', 'success');
  renderPenalty();
}

// ── DAILY TASK & REMINDER ─────────────────────────────────────
function buildGCalUrl(t) {
  const title = encodeURIComponent(t.title);
  let dates;
  if (t.waktu) {
    const startDT = t.tanggal.replace(/-/g, '') + 'T' + t.waktu.replace(':', '') + '00';
    const startDate = new Date(t.tanggal + 'T' + t.waktu + ':00');
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const endDT =
      endDate
        .toISOString()
        .replace(/[-:]/g, '')
        .replace('.000Z', '')
        .split('T')[0]
        .substring(0, 8) +
      'T' +
      String(endDate.getHours()).padStart(2, '0') +
      String(endDate.getMinutes()).padStart(2, '0') +
      '00';
    dates = startDT + '/' + endDT;
  } else {
    const d = t.tanggal.replace(/-/g, '');
    const nextDay = new Date(t.tanggal);
    nextDay.setDate(nextDay.getDate() + 1);
    const endD = nextDay.toISOString().split('T')[0].replace(/-/g, '');
    dates = d + '/' + endD;
  }
  let details = '';
  if (t.description) details += t.description + '\n\n';
  details +=
    'Prioritas: ' + (t.priority === 'high' ? 'Tinggi' : t.priority === 'low' ? 'Rendah' : 'Sedang');
  if (t.assignedByName) details += '\nDitugaskan oleh: ' + t.assignedByName;
  details += '\n\n[IMS Daily Task]';
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${encodeURIComponent(details)}&trp=false`;
}

async function renderDailyTask() {
  const main = document.getElementById('mainContent');
  // Build tabs based on role hierarchy
  let tabs = '<div class="tab active" onclick="filterDailyTasks(\'all\')">Semua</div>';
  tabs += '<div class="tab" onclick="filterDailyTasks(\'today\')">Hari Ini</div>';
  if (!hasAccess(5)) {
    // Staff to Head have tasks
    tabs += '<div class="tab" onclick="filterDailyTasks(\'upcoming\')">Mendatang</div>';
    tabs += '<div class="tab" onclick="filterDailyTasks(\'done\')">Selesai</div>';
    tabs += '<div class="tab" onclick="filterDailyTasks(\'overdue\')">Terlambat</div>';
  }
  tabs += '<div class="tab" onclick="filterDailyTasks(\'report\')">📝 Daily Report</div>';
  if (hasAccess(2)) {
    // Leader+ can see team reports
    tabs += '<div class="tab" onclick="filterDailyTasks(\'team-report\')">📊 Report Tim</div>';
  }
  if (hasAccess(4)) {
    // Head+ sees all divisions
    tabs += '<div class="tab" onclick="filterDailyTasks(\'all-report\')">🏢 Semua Divisi</div>';
  }
  if (hasAccess(2) && !hasAccess(5)) {
    // Leader/Manager/Head can assign tasks
    tabs += '<div class="tab" onclick="filterDailyTasks(\'assigned\')">📋 Ditugaskan</div>';
  }

  // Button: Staff only sees report, Leader+ sees both
  let addBtn = '';
  if (hasAccess(5)) {
    // BOD: no task, only view reports
    addBtn = '';
  } else if (hasAccess(2)) {
    // Leader/Manager/Head: can add task + report
    addBtn =
      '<button class="btn btn-primary btn-sm" onclick="modalAddTaskChoice()">+ Tambah</button>';
  } else {
    // Staff: can only add report
    addBtn =
      '<button class="btn btn-primary btn-sm" onclick="modalAddDailyReport()">+ Daily Report</button>';
  }

  main.innerHTML = `
    <div class="page-title"><span>📋 Daily Task & Report</span>${addBtn}</div>
    <div class="stats-grid mb-16" id="taskStats"></div>
    <div class="card">
      <div class="tabs mb-16" id="taskTabs">${tabs}</div>
      <div id="taskList">Loading...</div>
    </div>`;
  await loadDailyTasks('all');
}

function modalAddTaskChoice() {
  openModal(`<div class="modal-title">+ Tambah</div>
    <p class="text-sm mb-16" style="color:#666">Pilih jenis yang ingin Anda buat:</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:200px;padding:20px;border:2px solid var(--border);border-radius:12px;cursor:pointer;text-align:center;transition:all .2s" onclick="closeModalDirect();modalAddTask()" onmouseover="this.style.borderColor='var(--primary)';this.style.background='#f8f9ff'" onmouseout="this.style.borderColor='var(--border)';this.style.background=''">
        <div style="font-size:2rem;margin-bottom:8px">📋</div>
        <div class="fw-700">Daily Task</div>
        <div class="text-xs" style="color:#666;margin-top:4px">Tugas harian, reminder, deadline</div>
      </div>
      <div style="flex:1;min-width:200px;padding:20px;border:2px solid var(--border);border-radius:12px;cursor:pointer;text-align:center;transition:all .2s" onclick="closeModalDirect();modalAddDailyReport()" onmouseover="this.style.borderColor='var(--accent)';this.style.background='#fff8f8'" onmouseout="this.style.borderColor='var(--border)';this.style.background=''">
        <div style="font-size:2rem;margin-bottom:8px">📝</div>
        <div class="fw-700">Daily Report</div>
        <div class="text-xs" style="color:#666;margin-top:4px">Laporan aktivitas harian</div>
      </div>
    </div>`);
}

let _dailyTaskFilter = 'all';
let _dailyTaskData = [];

async function loadDailyTasks(filter) {
  _dailyTaskFilter = filter || 'all';
  document.querySelectorAll('#taskTabs .tab').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('#taskTabs .tab').forEach((t) => {
    const map = {
      all: 'Semua',
      today: 'Hari Ini',
      upcoming: 'Mendatang',
      done: 'Selesai',
      overdue: 'Terlambat',
      assigned: '📋 Ditugaskan',
      report: '📝 Daily Report',
      'team-report': '📊 Report Tim',
      'all-report': '🏢 Semua Divisi',
    };
    if (t.textContent.trim() === map[filter]) t.classList.add('active');
  });
  try {
    const snap = await db.collection('hrd_daily_tasks').get();
    _dailyTaskData = [];
    const myDept = (currentUser.departemen || '').toLowerCase().trim();
    const myId = currentUser.id;
    const myLevel = ROLES[currentUser.role] || 0;
    snap.forEach((d) => {
      const t = d.data();
      const taskDept = (t.departemen || '').toLowerCase().trim();
      const ownerLevel = t.ownerLevel || 0;
      // Hierarchy-based visibility:
      if (hasAccess(6)) {
        // Admin: all access
        _dailyTaskData.push({ id: d.id, ...t });
      } else if (hasAccess(5)) {
        // BOD: sees all reports (gabungan semua divisi), no tasks
        if (t.type === 'report') _dailyTaskData.push({ id: d.id, ...t });
      } else if (hasAccess(4)) {
        // Head: own data + all divisions reports + own dept tasks
        if (t.userId === myId || t.assignedBy === myId) {
          _dailyTaskData.push({ id: d.id, ...t });
        } else if (t.type === 'report') {
          _dailyTaskData.push({ id: d.id, ...t }); // All divisions reports
        } else if (taskDept === myDept) {
          _dailyTaskData.push({ id: d.id, ...t }); // Own dept tasks
        }
      } else if (hasAccess(2)) {
        // Leader/Manager: own data + own dept (but NOT reports from manager+ level — those are private)
        if (t.userId === myId || t.assignedBy === myId) {
          _dailyTaskData.push({ id: d.id, ...t });
        } else if (taskDept === myDept) {
          // Only show data from same or lower level (manager+ reports are private to staff/leader)
          if (ownerLevel <= myLevel || ownerLevel === 0) _dailyTaskData.push({ id: d.id, ...t });
        }
      } else {
        // Staff: own data only + tasks assigned to them
        // Cannot see leader/manager/head reports (those are private)
        if (t.userId === myId) _dailyTaskData.push({ id: d.id, ...t });
      }
    });
  } catch (e) {
    _dailyTaskData = [];
  }
  const today = todayStr();
  let filtered = _dailyTaskData;
  if (filter === 'today')
    filtered = _dailyTaskData.filter((t) => t.tanggal === today && !t.done && t.type !== 'report');
  else if (filter === 'upcoming')
    filtered = _dailyTaskData.filter((t) => t.tanggal > today && !t.done && t.type !== 'report');
  else if (filter === 'done')
    filtered = _dailyTaskData.filter((t) => t.done && t.type !== 'report');
  else if (filter === 'overdue')
    filtered = _dailyTaskData.filter((t) => t.tanggal < today && !t.done && t.type !== 'report');
  else if (filter === 'assigned')
    filtered = _dailyTaskData.filter(
      (t) => t.assignedBy === currentUser.id && t.userId !== currentUser.id
    );
  else if (filter === 'report')
    filtered = _dailyTaskData.filter((t) => t.type === 'report' && t.userId === currentUser.id);
  else if (filter === 'team-report') {
    const myDept2 = (currentUser.departemen || '').toLowerCase().trim();
    filtered = _dailyTaskData.filter(
      (t) => t.type === 'report' && (t.departemen || '').toLowerCase().trim() === myDept2
    );
    // Sort by kategori then date
    filtered.sort(
      (a, b) =>
        (a.kategori || '').localeCompare(b.kategori || '') ||
        (b.tanggal || '').localeCompare(a.tanggal || '')
    );
  } else if (filter === 'all-report') {
    filtered = _dailyTaskData.filter((t) => t.type === 'report');
    // Sort by departemen then kategori then date
    filtered.sort(
      (a, b) =>
        (a.departemen || '').localeCompare(b.departemen || '') ||
        (a.kategori || '').localeCompare(b.kategori || '') ||
        (b.tanggal || '').localeCompare(a.tanggal || '')
    );
  } else if (filter === 'team')
    filtered = _dailyTaskData.filter((t) => t.userId !== currentUser.id);
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  filtered.sort((a, b) => {
    if (!a.done && !b.done) {
      if (a.tanggal < today && b.tanggal >= today) return -1;
      if (b.tanggal < today && a.tanggal >= today) return 1;
    }
    if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal);
    return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
  });
  const totalTasks = _dailyTaskData.length;
  const doneTasks = _dailyTaskData.filter((t) => t.done).length;
  const todayTasks = _dailyTaskData.filter((t) => t.tanggal === today && !t.done).length;
  const overdueTasks = _dailyTaskData.filter((t) => t.tanggal < today && !t.done).length;
  const statsEl = document.getElementById('taskStats');
  if (statsEl)
    statsEl.innerHTML = `<div class="stat-card" style="border-left-color:#1565c0"><div class="stat-value" style="color:#1565c0">${totalTasks}</div><div class="stat-label">Total Task</div></div><div class="stat-card" style="border-left-color:#f57f17"><div class="stat-value" style="color:#f57f17">${todayTasks}</div><div class="stat-label">Hari Ini</div></div><div class="stat-card" style="border-left-color:#c62828"><div class="stat-value" style="color:#c62828">${overdueTasks}</div><div class="stat-label">Terlambat</div></div><div class="stat-card" style="border-left-color:#2e7d32"><div class="stat-value" style="color:#2e7d32">${doneTasks}</div><div class="stat-label">Selesai</div></div>`;
  const listEl = document.getElementById('taskList');
  if (!listEl) return;
  if (!filtered.length) {
    listEl.innerHTML =
      '<div style="text-align:center;padding:32px;color:var(--text-light)"><div style="font-size:2rem;margin-bottom:8px">✅</div><p>Tidak ada task</p></div>';
    return;
  }
  const isAdmin = hasAccess(3);
  let html = '';
  filtered.forEach((t) => {
    // Daily Report display
    if (t.type === 'report') {
      const moodMapList = {
        sangat_baik: '🤩',
        baik: '😊',
        cukup: '😐',
        kurang: '😟',
        buruk: '😞',
        sangat_buruk: '😫',
      };
      const moodIcon = moodMapList[t.mood] || '😐';
      const progressColor =
        (t.progress || 0) >= 80 ? '#2e7d32' : (t.progress || 0) >= 50 ? '#f57f17' : '#c62828';
      html += `<div style="display:flex;align-items:flex-start;gap:12px;padding:12px;border-left:4px solid #7b1fa2;margin-bottom:8px;background:#faf5ff;border-radius:0 8px 8px 0;cursor:pointer" onclick="viewDailyReport('${t.id}')">`;
      html += `<div style="font-size:1.5rem">📝</div>`;
      html += `<div style="flex:1"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-weight:700;font-size:.9rem">${escHtml(t.title || 'Daily Report')}</span><span style="font-size:.65rem;padding:2px 6px;border-radius:4px;background:#7b1fa220;color:#7b1fa2;font-weight:600">Report</span>${t.kategori ? `<span style="font-size:.6rem;padding:2px 6px;border-radius:4px;background:#e3f2fd;color:#1565c0;font-weight:600">${escHtml(t.kategori)}</span>` : ''}${moodIcon ? `<span>${moodIcon}</span>` : ''}</div>`;
      html += `<div style="font-size:.8rem;color:var(--text-light);margin-top:4px">${escHtml((t.aktivitas || '').substring(0, 100))}${(t.aktivitas || '').length > 100 ? '...' : ''}</div>`;
      html += `<div style="font-size:.7rem;color:#999;margin-top:4px">👤 ${escHtml(t.targetUserName || '')} | 🏢 ${escHtml(t.departemen || '-')} | 📅 ${formatDate(t.tanggal)} | Progress: <span style="color:${progressColor};font-weight:600">${t.progress || 0}%</span></div>`;
      html += `</div>`;
      html += `<div style="display:flex;gap:4px"><button class="btn btn-xs btn-info" onclick="event.stopPropagation();viewDailyReport('${t.id}')">👁️</button>${t.userId === currentUser.id || hasAccess(6) ? `<button class="btn btn-xs btn-danger" onclick="event.stopPropagation();hapusDailyTask('${t.id}')">🗑️</button>` : ''}</div></div>`;
      return;
    }
    // Regular task display
    const isOverdue = t.tanggal < today && !t.done;
    const isToday2 = t.tanggal === today;
    const priorityColor =
      t.priority === 'high' ? '#c62828' : t.priority === 'low' ? '#666' : '#f57f17';
    const priorityLabel =
      t.priority === 'high' ? 'Tinggi' : t.priority === 'low' ? 'Rendah' : 'Sedang';
    const borderColor = t.done
      ? '#2e7d32'
      : isOverdue
        ? '#c62828'
        : isToday2
          ? '#1565c0'
          : '#e0e0e0';
    html += `<div style="display:flex;align-items:flex-start;gap:12px;padding:12px;border-left:4px solid ${borderColor};margin-bottom:8px;background:${t.done ? '#f1f8e9' : isOverdue ? '#fff8f8' : '#fff'};border-radius:0 8px 8px 0">`;
    html += `<input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleDailyTask('${t.id}')" style="margin-top:4px;width:18px;height:18px;accent-color:#2e7d32;cursor:pointer">`;
    html += `<div style="flex:1"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-weight:700;font-size:.9rem;${t.done ? 'text-decoration:line-through;color:#999' : ''}">${escHtml(t.title)}</span><span style="font-size:.65rem;padding:2px 6px;border-radius:4px;background:${priorityColor}20;color:${priorityColor};font-weight:600">${priorityLabel}</span>`;
    if (isOverdue)
      html += `<span class="badge badge-danger" style="font-size:.6rem">Terlambat</span>`;
    if (isToday2 && !t.done)
      html += `<span class="badge badge-info" style="font-size:.6rem">Hari Ini</span>`;
    html += `</div>`;
    if (t.description)
      html += `<div style="font-size:.8rem;color:var(--text-light);margin-top:4px;${t.done ? 'text-decoration:line-through' : ''}">${escHtml(t.description)}</div>`;
    html += `<div style="font-size:.7rem;color:#999;margin-top:4px">`;
    if (isAdmin && t.targetUserName)
      html += `👤 Untuk: <strong>${escHtml(t.targetUserName)}</strong> | `;
    html += `📅 ${formatDate(t.tanggal)}${t.waktu ? ' ⏰ ' + t.waktu : ''}${t.reminder ? ' 🔔 ' + t.reminder : ''}${t.assignedByName ? ' | 👤 Ditugaskan oleh: ' + escHtml(t.assignedByName) : ''}`;
    html += `</div></div>`;
    // Determine action buttons: admin always gets edit+delete, assigned tasks from others get view only
    const isAssignedByOther =
      t.assignedBy && t.assignedBy !== currentUser.id && t.userId === currentUser.id;
    if (isAdmin || !isAssignedByOther) {
      html += `<div style="display:flex;gap:4px;flex-wrap:wrap"><a href="${buildGCalUrl(t)}" target="_blank" class="btn btn-xs btn-info" title="Tambah ke Google Calendar" style="text-decoration:none">📅</a><button class="btn btn-xs btn-info" onclick="viewDailyTask('${t.id}')" title="Lihat">👁️</button><button class="btn btn-xs btn-warning" onclick="editDailyTask('${t.id}')">✏️</button><button class="btn btn-xs btn-danger" onclick="hapusDailyTask('${t.id}')">🗑️</button></div></div>`;
    } else {
      html += `<div style="display:flex;gap:4px;flex-wrap:wrap"><a href="${buildGCalUrl(t)}" target="_blank" class="btn btn-xs btn-info" title="Tambah ke Google Calendar" style="text-decoration:none">📅</a><button class="btn btn-xs btn-info" onclick="viewDailyTask('${t.id}')" title="Lihat">👁️</button></div></div>`;
    }
  });
  listEl.innerHTML = html;
}

function filterDailyTasks(f) {
  loadDailyTasks(f);
}

function viewDailyTask(id) {
  const task = _dailyTaskData.find((t) => t.id === id);
  if (!task) return;
  const priorityLabel =
    task.priority === 'high' ? 'Tinggi' : task.priority === 'low' ? 'Rendah' : 'Sedang';
  const priorityColor =
    task.priority === 'high' ? '#c62828' : task.priority === 'low' ? '#666' : '#f57f17';
  const statusLabel = task.done
    ? '<span class="badge badge-success">Selesai</span>'
    : task.tanggal < todayStr()
      ? '<span class="badge badge-danger">Terlambat</span>'
      : '<span class="badge badge-info">Aktif</span>';
  openModal(`<div class="modal-title">📋 Detail Task</div>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px;font-weight:700;width:140px">Judul</td><td style="padding:8px">${escHtml(task.title)}</td></tr>
      <tr><td style="padding:8px;font-weight:700">Deskripsi</td><td style="padding:8px">${escHtml(task.description || '-')}</td></tr>
      <tr><td style="padding:8px;font-weight:700">Tanggal</td><td style="padding:8px">${formatDate(task.tanggal)}</td></tr>
      <tr><td style="padding:8px;font-weight:700">Waktu</td><td style="padding:8px">${task.waktu || '-'}</td></tr>
      <tr><td style="padding:8px;font-weight:700">Prioritas</td><td style="padding:8px"><span style="color:${priorityColor};font-weight:600">${priorityLabel}</span></td></tr>
      <tr><td style="padding:8px;font-weight:700">Pengingat</td><td style="padding:8px">${task.reminder || 'Tidak ada'}</td></tr>
      <tr><td style="padding:8px;font-weight:700">Status</td><td style="padding:8px">${statusLabel}</td></tr>
      ${task.assignedByName ? `<tr><td style="padding:8px;font-weight:700">Ditugaskan oleh</td><td style="padding:8px">${escHtml(task.assignedByName)}</td></tr>` : ''}
      ${task.targetUserName ? `<tr><td style="padding:8px;font-weight:700">Untuk</td><td style="padding:8px">${escHtml(task.targetUserName)}</td></tr>` : ''}
      ${task.doneAt ? `<tr><td style="padding:8px;font-weight:700">Selesai pada</td><td style="padding:8px">${formatDate(task.doneAt.split('T')[0])} ${task.doneAt.split('T')[1] ? task.doneAt.split('T')[1].substring(0, 5) : ''}</td></tr>` : ''}
    </table>
    <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end"><a href="${buildGCalUrl(task)}" target="_blank" class="btn btn-sm btn-info" style="text-decoration:none">📅 Tambah ke Google Calendar</a><button class="btn btn-sm btn-outline" onclick="closeModalDirect()">Tutup</button></div>`);
}

async function modalAddTask() {
  // Leader/Manager/Head can assign tasks to subordinates in SAME department only
  let assignHtml = '';
  if (hasAccess(2) && !hasAccess(5)) {
    // Leader to Head (not BOD)
    try {
      const usersSnap = await db.collection('hrd_users').get();
      const myDept = (currentUser.departemen || '').toLowerCase().trim();
      let opts =
        '<option value="self">\u{1F4DD} Untuk Diri Sendiri</option><option disabled>\u2500\u2500 Tugaskan ke Anggota Tim \u2500\u2500</option>';
      usersSnap.forEach((d) => {
        const u = d.data();
        if (u.status !== 'nonaktif' && d.id !== currentUser.id) {
          // Non-admin: only show same department
          if (!hasAccess(6) && (u.departemen || '').toLowerCase().trim() !== myDept) return;
          opts += `<option value="${d.id}" data-nama="${escHtml(u.nama)}">${escHtml(u.nama)} (${escHtml(u.departemen || '-')})</option>`;
        }
      });
      assignHtml = `<div class="form-group"><label>Tugaskan Ke</label><select class="form-control" id="dtAssignUser">${opts}</select></div>`;
    } catch (_e) {
      assignHtml = '';
    }
  } else if (hasAccess(6)) {
    // Admin: all users
    try {
      const usersSnap = await db.collection('hrd_users').get();
      let opts =
        '<option value="self">\u{1F4DD} Untuk Diri Sendiri</option><option disabled>\u2500\u2500 Tugaskan ke Karyawan \u2500\u2500</option>';
      usersSnap.forEach((d) => {
        const u = d.data();
        if (u.status !== 'nonaktif' && d.id !== currentUser.id)
          opts += `<option value="${d.id}" data-nama="${escHtml(u.nama)}">${escHtml(u.nama)} (${escHtml(u.departemen || '-')})</option>`;
      });
      assignHtml = `<div class="form-group"><label>Tugaskan Ke</label><select class="form-control" id="dtAssignUser">${opts}</select></div>`;
    } catch (_e) {
      assignHtml = '';
    }
  }
  openModal(`<div class="modal-title">+ Tambah Task</div>
    ${assignHtml}
    <div class="form-group"><label>Judul Task *</label><input class="form-control" id="dtTitle" placeholder="Contoh: Meeting dengan klien"></div>
    <div class="form-group"><label>Deskripsi</label><textarea class="form-control" id="dtDesc" rows="2" placeholder="Detail task..."></textarea></div>
    <div class="grid-2"><div class="form-group"><label>Tanggal *</label><input class="form-control" type="date" id="dtDate" value="${todayStr()}"></div><div class="form-group"><label>Waktu</label><input class="form-control" type="time" id="dtTime"></div></div>
    <div class="grid-2"><div class="form-group"><label>Prioritas</label><select class="form-control" id="dtPriority"><option value="medium">Sedang</option><option value="high">Tinggi</option><option value="low">Rendah</option></select></div><div class="form-group"><label>Pengingat</label><select class="form-control" id="dtReminder"><option value="">Tidak ada</option><option value="15 menit">15 menit</option><option value="30 menit">30 menit</option><option value="1 jam">1 jam</option><option value="1 hari">1 hari</option></select></div></div>
    <div class="form-group"><label>Ulangi</label><select class="form-control" id="dtRepeat"><option value="">Tidak</option><option value="daily">Setiap Hari</option><option value="weekly">Setiap Minggu</option><option value="monthly">Setiap Bulan</option></select></div>
    <button class="btn btn-primary" onclick="simpanDailyTask()">💾 Simpan</button>`);
}

async function simpanDailyTask() {
  const title = document.getElementById('dtTitle').value.trim();
  const tanggal = document.getElementById('dtDate').value;
  if (!title || !tanggal) return toast('Judul dan tanggal wajib', 'warning');
  const assignEl = document.getElementById('dtAssignUser');
  // Determine target user: self if no dropdown, value is 'self', or empty
  const isSelf = !assignEl || assignEl.value === 'self';
  const targetUserId = isSelf ? currentUser.id : assignEl.value;
  const targetUserName = isSelf
    ? currentUser.nama
    : assignEl.options[assignEl.selectedIndex].getAttribute('data-nama') ||
      assignEl.options[assignEl.selectedIndex].text;
  const assignedBy = targetUserId !== currentUser.id ? currentUser.id : '';
  const assignedByName = targetUserId !== currentUser.id ? currentUser.nama : '';
  try {
    await db.collection('hrd_daily_tasks').add({
      title,
      description: document.getElementById('dtDesc').value.trim(),
      tanggal,
      waktu: document.getElementById('dtTime').value || '',
      priority: document.getElementById('dtPriority').value,
      reminder: document.getElementById('dtReminder').value,
      repeat: document.getElementById('dtRepeat').value || '',
      done: false,
      type: 'task',
      userId: targetUserId,
      targetUserName,
      departemen: currentUser.departemen || '',
      assignedBy,
      assignedByName,
      createdAt: new Date().toISOString(),
    });
    toast('Task ditambahkan', 'success');
    // Notify target user if assigned to someone else
    if (targetUserId !== currentUser.id) {
      await db.collection('hrd_notifikasi').add({
        targetUser: targetUserId,
        title: '📋 Task Baru Ditugaskan',
        message: `${currentUser.nama} menugaskan: ${title}`,
        read: false,
        type: 'daily-task',
        createdAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    toast('Gagal: ' + e.message, 'error');
  }
  closeModalDirect();
  await loadDailyTasks(_dailyTaskFilter);
}

async function toggleDailyTask(id) {
  try {
    const ref = db.collection('hrd_daily_tasks').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return;
    const t = doc.data();
    await ref.update({ done: !t.done, doneAt: !t.done ? new Date().toISOString() : null });
  } catch (e) {
    toast('Gagal: ' + e.message, 'error');
  }
  await loadDailyTasks(_dailyTaskFilter);
}

async function editDailyTask(id) {
  const task = _dailyTaskData.find((t) => t.id === id);
  if (!task) return;
  // If admin, show re-assignment dropdown
  let reassignHtml = '';
  if (hasAccess(3)) {
    try {
      const usersSnap = await db.collection('hrd_users').get();
      let opts = `<option value="self" ${task.userId === currentUser.id ? 'selected' : ''}>\u{1F4DD} Untuk Diri Sendiri (Catatan Pribadi)</option><option disabled>\u2500\u2500 Tugaskan ke Karyawan \u2500\u2500</option>`;
      usersSnap.forEach((d) => {
        const u = d.data();
        if (u.status !== 'nonaktif')
          opts += `<option value="${d.id}" data-nama="${escHtml(u.nama)}" ${d.id === task.userId && d.id !== currentUser.id ? 'selected' : ''}>${escHtml(u.nama)} (${u.role})</option>`;
      });
      reassignHtml = `<div class="form-group"><label>Untuk Siapa</label><select class="form-control" id="dtEditAssignUser">${opts}</select></div>`;
    } catch (_e) {
      reassignHtml = '';
    }
  }
  openModal(`<div class="modal-title">✏️ Edit Task</div>
    ${reassignHtml}
    <div class="form-group"><label>Judul *</label><input class="form-control" id="dtEditTitle" value="${escHtml(task.title)}"></div>
    <div class="form-group"><label>Deskripsi</label><textarea class="form-control" id="dtEditDesc" rows="2">${escHtml(task.description || '')}</textarea></div>
    <div class="grid-2"><div class="form-group"><label>Tanggal *</label><input class="form-control" type="date" id="dtEditDate" value="${task.tanggal}"></div><div class="form-group"><label>Waktu</label><input class="form-control" type="time" id="dtEditTime" value="${task.waktu || ''}"></div></div>
    <div class="grid-2"><div class="form-group"><label>Prioritas</label><select class="form-control" id="dtEditPriority"><option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Sedang</option><option value="high" ${task.priority === 'high' ? 'selected' : ''}>Tinggi</option><option value="low" ${task.priority === 'low' ? 'selected' : ''}>Rendah</option></select></div><div class="form-group"><label>Pengingat</label><select class="form-control" id="dtEditReminder"><option value="" ${!task.reminder ? 'selected' : ''}>Tidak ada</option><option value="15 menit" ${task.reminder === '15 menit' ? 'selected' : ''}>15 menit</option><option value="30 menit" ${task.reminder === '30 menit' ? 'selected' : ''}>30 menit</option><option value="1 jam" ${task.reminder === '1 jam' ? 'selected' : ''}>1 jam</option><option value="1 hari" ${task.reminder === '1 hari' ? 'selected' : ''}>1 hari</option></select></div></div>
    <div class="form-group"><label>Ulangi</label><select class="form-control" id="dtEditRepeat"><option value="" ${!task.repeat ? 'selected' : ''}>Tidak</option><option value="daily" ${task.repeat === 'daily' ? 'selected' : ''}>Setiap Hari</option><option value="weekly" ${task.repeat === 'weekly' ? 'selected' : ''}>Setiap Minggu</option><option value="monthly" ${task.repeat === 'monthly' ? 'selected' : ''}>Setiap Bulan</option></select></div>
    <button class="btn btn-primary" onclick="updateDailyTask('${id}')">💾 Simpan</button>`);
}

async function updateDailyTask(id) {
  const title = document.getElementById('dtEditTitle').value.trim();
  const tanggal = document.getElementById('dtEditDate').value;
  if (!title || !tanggal) return toast('Judul dan tanggal wajib', 'warning');
  const updateData = {
    title,
    description: document.getElementById('dtEditDesc').value.trim(),
    tanggal,
    waktu: document.getElementById('dtEditTime').value || '',
    priority: document.getElementById('dtEditPriority').value,
    reminder: document.getElementById('dtEditReminder').value,
    repeat: document.getElementById('dtEditRepeat').value || '',
    updatedAt: new Date().toISOString(),
  };
  // Handle re-assignment for admin
  const reassignEl = document.getElementById('dtEditAssignUser');
  if (reassignEl) {
    const task = _dailyTaskData.find((t) => t.id === id);
    const isSelf = reassignEl.value === 'self';
    const newUserId = isSelf ? currentUser.id : reassignEl.value;
    const newUserName = isSelf
      ? currentUser.nama
      : reassignEl.options[reassignEl.selectedIndex].getAttribute('data-nama') ||
        reassignEl.options[reassignEl.selectedIndex].text;
    updateData.userId = newUserId;
    updateData.targetUserName = newUserName;
    if (newUserId !== currentUser.id) {
      updateData.assignedBy = currentUser.id;
      updateData.assignedByName = currentUser.nama;
    } else {
      updateData.assignedBy = '';
      updateData.assignedByName = '';
    }
    // Notify if re-assigned to different user
    if (task && newUserId !== task.userId && newUserId !== currentUser.id) {
      try {
        await db.collection('hrd_notifikasi').add({
          targetUser: newUserId,
          title: '\u{1F4CB} Task Dialihkan',
          message: `${currentUser.nama} mengalihkan task: ${title}`,
          read: false,
          type: 'daily-task',
          createdAt: new Date().toISOString(),
        });
      } catch (_e) {}
    }
  }
  try {
    await db.collection('hrd_daily_tasks').doc(id).update(updateData);
    toast('Diperbarui', 'success');
  } catch (e) {
    toast('Gagal: ' + e.message, 'error');
  }
  closeModalDirect();
  await loadDailyTasks(_dailyTaskFilter);
}

async function hapusDailyTask(id) {
  if (!confirm('Hapus task ini?')) return;
  try {
    await db.collection('hrd_daily_tasks').doc(id).delete();
    toast('Dihapus', 'success');
  } catch (e) {
    toast('Gagal: ' + e.message, 'error');
  }
  await loadDailyTasks(_dailyTaskFilter);
}

// ── TASK REMINDER SYSTEM ──────────────────────────────────────
let _reminderCheckInterval = null;

async function checkTaskReminders() {
  if (!currentUser) return;
  try {
    const snap = await db.collection('hrd_daily_tasks').get();
    const now = new Date();
    const today = todayStr();
    const tasks = [];
    snap.forEach((d) => {
      const t = d.data();
      if (t.userId === currentUser.id && !t.done) tasks.push({ id: d.id, ...t });
    });

    for (const task of tasks) {
      if (!task.reminder || !task.tanggal) continue;
      // Calculate reminder time
      const taskDateTime = new Date(task.tanggal + 'T' + (task.waktu || '09:00') + ':00');
      let reminderMs = 0;
      if (task.reminder === '15 menit') reminderMs = 15 * 60 * 1000;
      else if (task.reminder === '30 menit') reminderMs = 30 * 60 * 1000;
      else if (task.reminder === '1 jam') reminderMs = 60 * 60 * 1000;
      else if (task.reminder === '1 hari') reminderMs = 24 * 60 * 60 * 1000;
      const reminderTime = new Date(taskDateTime.getTime() - reminderMs);
      // Check if reminder should fire (within last 5 minutes window)
      const diffMs = now.getTime() - reminderTime.getTime();
      if (diffMs >= 0 && diffMs < 5 * 60 * 1000) {
        // Check if we already sent this reminder (use localStorage to avoid duplicates)
        const reminderKey = 'task_reminder_' + task.id + '_' + task.tanggal;
        if (localStorage.getItem(reminderKey)) continue;
        localStorage.setItem(reminderKey, '1');
        // Create notification in Firestore
        await db.collection('hrd_notifikasi').add({
          targetUser: currentUser.id,
          title: '⏰ Pengingat Task',
          message: task.title + (task.waktu ? ' (' + task.waktu + ')' : ''),
          read: false,
          type: 'task-reminder',
          createdAt: new Date().toISOString(),
        });
        // Show browser notification
        showSystemNotification(
          '⏰ Pengingat Task',
          task.title + (task.waktu ? ' - ' + task.waktu : '')
        );
        toast('⏰ Pengingat: ' + task.title, 'info');
      }
      // Also check overdue tasks (past the task date+time and not reminded as overdue)
      if (task.tanggal < today) {
        const overdueKey = 'task_overdue_' + task.id + '_' + today;
        if (localStorage.getItem(overdueKey)) continue;
        localStorage.setItem(overdueKey, '1');
        await db.collection('hrd_notifikasi').add({
          targetUser: currentUser.id,
          title: '⚠️ Task Terlambat',
          message: task.title + ' (tenggat: ' + formatDate(task.tanggal) + ')',
          read: false,
          type: 'task-overdue',
          createdAt: new Date().toISOString(),
        });
      }
    }
  } catch (_e) {
    /* silent */
  }
}

function startTaskReminderCheck() {
  if (_reminderCheckInterval) clearInterval(_reminderCheckInterval);
  // Check immediately then every 2 minutes
  checkTaskReminders();
  _reminderCheckInterval = setInterval(checkTaskReminders, 2 * 60 * 1000);
}

// ── DAILY REPORT ──────────────────────────────────────────────
const REPORT_CATEGORIES = {
  ACADEMIC: ['SISWA', 'TSK-JOB', 'SENSEI', 'CURRICULUM'],
  OFFICE: ["FACILITY'S", 'FINANCE', 'HR & LEGAL', 'PROMOSI', 'DOCUMENT', 'MARKETING & SALES'],
};

function getReportCategoryOptions() {
  const dept = (currentUser.departemen || '').toUpperCase().trim();
  const cats = REPORT_CATEGORIES[dept] || REPORT_CATEGORIES['OFFICE'] || [];
  let opts = '<option value="">-- Pilih Kategori --</option>';
  cats.forEach((c) => {
    opts += `<option value="${c}">${c}</option>`;
  });
  return opts;
}

async function modalAddDailyReport() {
  const catOpts = getReportCategoryOptions();
  openModal(
    `<div class="modal-title">📝 Daily Report</div>
    <p class="text-sm mb-16" style="color:#666">Isi laporan aktivitas harian Anda.</p>
    <div class="grid-2">
      <div class="form-group"><label>Tanggal Laporan *</label><input class="form-control" type="date" id="drTanggal" value="${todayStr()}"></div>
      <div class="form-group"><label>Kategori *</label><select class="form-control" id="drKategori">${catOpts}</select></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Jam Masuk</label><input class="form-control" type="time" id="drJamMasuk" value="08:00"></div>
      <div class="form-group"><label>Jam Keluar</label><input class="form-control" type="time" id="drJamKeluar" value="17:00"></div>
    </div>
    <div class="form-group"><label>Aktivitas Hari Ini *</label><textarea class="form-control" id="drAktivitas" rows="4" placeholder="1. Meeting dengan tim marketing\n2. Follow up client ABC\n3. Buat proposal project X\n..."></textarea></div>
    <div class="form-group"><label>Hasil / Output</label><textarea class="form-control" id="drHasil" rows="2" placeholder="Proposal selesai 80%, meeting berhasil dapat approval..."></textarea></div>
    <div class="form-group"><label>Kendala / Hambatan</label><textarea class="form-control" id="drKendala" rows="2" placeholder="Tidak ada / Menunggu data dari divisi lain..."></textarea></div>
    <div class="form-group"><label>Solusi / Tindakan atas Kendala</label><textarea class="form-control" id="drSolusi" rows="2" placeholder="Koordinasi dengan divisi terkait / Eskalasi ke atasan..."></textarea></div>
    <div class="form-group"><label>Rencana Besok</label><textarea class="form-control" id="drRencana" rows="2" placeholder="1. Finalisasi proposal\n2. Kirim ke client..."></textarea></div>
    <div class="grid-2">
      <div class="form-group"><label>Durasi Pekerjaan (hari)</label><input class="form-control" type="number" id="drDurasi" min="0" max="30" step="0.5" value="1" placeholder="Contoh: 1"></div>
      <div class="form-group"><label>Progress Keseluruhan (%)</label><input class="form-control" type="number" id="drProgress" min="0" max="100" value="100" placeholder="0-100"></div>
    </div>
    <div class="form-group"><label>Mood Hari Ini</label><select class="form-control" id="drMood"><option value="sangat_baik">🤩 Sangat Baik / Luar Biasa Produktif</option><option value="baik">😊 Baik / Produktif</option><option value="cukup">😐 Cukup / Biasa Saja</option><option value="kurang">😟 Kurang / Ada Hambatan</option><option value="buruk">😞 Buruk / Banyak Masalah</option><option value="sangat_buruk">😫 Sangat Buruk / Overwhelmed</option></select></div>
    <div class="form-group"><label>Komentar untuk Atasan</label><textarea class="form-control" id="drKomentarAtasan" rows="2" placeholder="Pesan/catatan khusus untuk atasan (opsional)..."></textarea></div>
    <div class="form-group"><label>Komentar untuk Rekan Kerja</label><textarea class="form-control" id="drKomentarRekan" rows="2" placeholder="Apresiasi/pesan untuk rekan tim (opsional)..."></textarea></div>
    <button class="btn btn-primary" onclick="simpanDailyReport()">📤 Kirim Daily Report</button>`,
    true
  );
}

async function simpanDailyReport() {
  const tanggal = document.getElementById('drTanggal').value;
  const aktivitas = document.getElementById('drAktivitas').value.trim();
  const kategori = document.getElementById('drKategori').value;
  if (!tanggal || !aktivitas) return toast('Tanggal dan aktivitas wajib diisi', 'warning');
  if (!kategori) return toast('Kategori wajib dipilih', 'warning');
  const data = {
    type: 'report',
    title: '📝 Daily Report — ' + formatDate(tanggal),
    tanggal,
    kategori,
    jamMasuk: document.getElementById('drJamMasuk').value || '',
    jamKeluar: document.getElementById('drJamKeluar').value || '',
    aktivitas,
    hasil: document.getElementById('drHasil').value.trim(),
    kendala: document.getElementById('drKendala').value.trim(),
    solusi: document.getElementById('drSolusi').value.trim(),
    rencana: document.getElementById('drRencana').value.trim(),
    durasi: parseFloat(document.getElementById('drDurasi').value) || 0,
    progress: parseInt(document.getElementById('drProgress').value) || 0,
    mood: document.getElementById('drMood').value,
    komentarAtasan: document.getElementById('drKomentarAtasan').value.trim(),
    komentarRekan: document.getElementById('drKomentarRekan').value.trim(),
    description: aktivitas,
    done: true,
    doneAt: new Date().toISOString(),
    priority: 'medium',
    userId: currentUser.id,
    targetUserName: currentUser.nama,
    departemen: currentUser.departemen || '',
    ownerLevel: ROLES[currentUser.role] || 0,
    ownerRole: currentUser.role || '',
    createdAt: new Date().toISOString(),
  };
  try {
    await db.collection('hrd_daily_tasks').add(data);
    toast('Daily Report berhasil dikirim', 'success');
  } catch (e) {
    toast('Gagal: ' + e.message, 'error');
  }
  closeModalDirect();
  await loadDailyTasks('report');
}

function viewDailyReport(id) {
  const task = _dailyTaskData.find((t) => t.id === id);
  if (!task) return;
  const moodMap = {
    sangat_baik: '🤩 Sangat Baik',
    baik: '😊 Baik',
    cukup: '😐 Cukup',
    kurang: '😟 Kurang',
    buruk: '😞 Buruk',
    sangat_buruk: '😫 Sangat Buruk',
  };
  const moodLabel = moodMap[task.mood] || '😐 ' + (task.mood || '-');
  const progressColor =
    task.progress >= 80 ? '#2e7d32' : task.progress >= 50 ? '#f57f17' : '#c62828';
  openModal(
    `<div class="modal-title">📝 Daily Report</div>
    <div style="background:#f8f9ff;padding:16px;border-radius:8px;margin-bottom:16px;border-left:4px solid var(--primary)">
      <div class="fw-700">${escHtml(task.targetUserName || currentUser.nama)}</div>
      <div class="text-sm" style="color:#666">📅 ${formatDate(task.tanggal)} | ⏰ ${task.jamMasuk || '-'} - ${task.jamKeluar || '-'}</div>
      <div class="text-sm mt-4">🏢 ${escHtml(task.departemen || '-')} | 📂 ${escHtml(task.kategori || '-')}</div>
      <div class="text-sm mt-4">Progress: <span style="color:${progressColor};font-weight:700">${task.progress || 0}%</span> | Durasi: <b>${task.durasi || '-'} hari</b> | Mood: ${moodLabel}</div>
    </div>
    <div class="mb-16"><div class="fw-700 mb-4" style="color:var(--primary)">📋 Aktivitas</div><div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:12px;font-size:.85rem;white-space:pre-wrap;line-height:1.7">${escHtml(task.aktivitas || task.description || '-')}</div></div>
    ${task.hasil ? `<div class="mb-16"><div class="fw-700 mb-4" style="color:#2e7d32">✅ Hasil / Output</div><div style="background:#f1f8e9;border-radius:8px;padding:12px;font-size:.85rem;white-space:pre-wrap">${escHtml(task.hasil)}</div></div>` : ''}
    ${task.kendala ? `<div class="mb-16"><div class="fw-700 mb-4" style="color:#c62828">⚠️ Kendala</div><div style="background:#fff8f8;border-radius:8px;padding:12px;font-size:.85rem;white-space:pre-wrap">${escHtml(task.kendala)}</div></div>` : ''}
    ${task.solusi ? `<div class="mb-16"><div class="fw-700 mb-4" style="color:#ff6f00">💡 Solusi / Tindakan</div><div style="background:#fff8e1;border-radius:8px;padding:12px;font-size:.85rem;white-space:pre-wrap">${escHtml(task.solusi)}</div></div>` : ''}
    ${task.rencana ? `<div class="mb-16"><div class="fw-700 mb-4" style="color:#1565c0">📌 Rencana Besok</div><div style="background:#e3f2fd;border-radius:8px;padding:12px;font-size:.85rem;white-space:pre-wrap">${escHtml(task.rencana)}</div></div>` : ''}
    ${task.komentarAtasan ? `<div class="mb-16"><div class="fw-700 mb-4" style="color:#6a1b9a">💬 Komentar untuk Atasan</div><div style="background:#f3e5f5;border-radius:8px;padding:12px;font-size:.85rem;white-space:pre-wrap">${escHtml(task.komentarAtasan)}</div></div>` : ''}
    ${task.komentarRekan ? `<div class="mb-16"><div class="fw-700 mb-4" style="color:#00695c">🤝 Komentar untuk Rekan Kerja</div><div style="background:#e0f2f1;border-radius:8px;padding:12px;font-size:.85rem;white-space:pre-wrap">${escHtml(task.komentarRekan)}</div></div>` : ''}
    <div class="text-xs" style="color:#999">Dikirim: ${formatDateTime(task.createdAt)}</div>`,
    true
  );
}
