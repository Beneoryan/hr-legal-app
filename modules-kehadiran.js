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
  // Index by both userId AND nama (lowercased) so admin table can match by name
  const cutiUsed = {}; // key -> total hari cuti tahunan approved
  cutiSnap.forEach((d) => {
    const p = d.data();
    if (p.status === 'approved' && p.jenis === 'Cuti Tahunan') {
      const durasi = p.durasi || 1;
      if (p.userId) {
        cutiUsed[p.userId] = (cutiUsed[p.userId] || 0) + durasi;
      }
      if (p.nama) {
        const namaKey = p.nama.trim().toLowerCase();
        cutiUsed[namaKey] = (cutiUsed[namaKey] || 0) + durasi;
      }
    }
  });
  // Build quota table
  let quotaHtml =
    '<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Dept</th><th>Masa Kerja</th><th>Jatah/Tahun</th><th>Terpakai</th><th>Sisa</th></tr></thead><tbody>';
  const karyList = [];
  karySnap.forEach((d) => karyList.push({ id: d.id, ...d.data() }));
  karyList.forEach((k) => {
    const quota = hitungJatahCuti(k);
    const used = cutiUsed[k.id] || cutiUsed[(k.nama || '').trim().toLowerCase()] || 0;
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
    // BOD filter: only show head-level submissions
    const isBOD = currentUser.role === 'bod';
    let gradeMapCuti = {};
    if (isBOD) {
      karyList.forEach((k) => {
        gradeMapCuti[(k.nama || '').toLowerCase()] = (
          k.gradeJabatan ||
          k.posisi ||
          ''
        ).toLowerCase();
      });
    }
    items.forEach((p) => {
      // BOD: skip non-head submissions
      if (isBOD) {
        const grade = gradeMapCuti[(p.nama || '').toLowerCase()] || '';
        if (!grade.includes('head')) return;
      }
      const badge =
        p.status === 'approved'
          ? 'badge-success'
          : p.status === 'rejected'
            ? 'badge-danger'
            : 'badge-warning';
      const uid = p.userId || p.nama;
      const kary = karyList.find(
        (k) =>
          k.id === uid ||
          k.nama === p.nama ||
          (k.nama && p.nama && k.nama.trim().toLowerCase() === p.nama.trim().toLowerCase())
      );
      const quota = kary ? hitungJatahCuti(kary) : 12;
      const used = cutiUsed[uid] || cutiUsed[(p.nama || '').trim().toLowerCase()] || 0;
      const sisa = Math.max(0, quota - used);
      const canApprove = p.status === 'pending' && hasAccess(3) && !isBOD;
      h += `<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.jenis)}</td><td>${formatDate(p.mulai)}-${formatDate(p.selesai)}</td><td>${p.durasi || 1}h</td><td><span class="badge badge-${sisa <= 2 ? 'danger' : sisa <= 5 ? 'warning' : 'success'}">${sisa}/${quota}</span></td><td><span class="badge ${badge}">${p.status}</span></td><td><button class="btn btn-xs btn-info" onclick="viewCutiDetail('${p.id}')" title="Lihat Detail">👁️</button> ${canApprove ? `<button class="btn btn-xs btn-success" onclick="approveCuti('${p.id}','approved')">✅</button> <button class="btn btn-xs btn-danger" onclick="approveCuti('${p.id}','rejected')">❌</button>` : ''} ${hasAccess(6) || (p.userId === currentUser.id && p.status === 'pending') ? `<button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_cuti','${p.id}','cuti')">🗑️</button>` : ''}</td></tr>`;
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
    `<div class="modal-title">Pengajuan Cuti/Izin/WFH</div><div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="ctNama" value="${currentUser.nama}"></div><div class="form-group"><label>Jenis</label><select class="form-control" id="ctJenis"><option>Cuti Tahunan</option><option>Cuti Sakit</option><option>Izin Pribadi</option><option>WFH</option><option>Cuti Melahirkan</option></select></div></div><div class="grid-2"><div class="form-group"><label>Mulai</label><input class="form-control" type="date" id="ctMulai" value="${todayStr()}"></div><div class="form-group"><label>Selesai</label><input class="form-control" type="date" id="ctSelesai" value="${todayStr()}"></div></div><div class="form-group"><label>Keterangan</label><textarea class="form-control" id="ctKet"></textarea></div><div class="form-group"><label>📎 Lampiran (Surat Dokter/Dokumen)</label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><button type="button" class="btn btn-sm btn-outline" onclick="document.getElementById('ctFiles').click()">📁 Pilih File</button><button type="button" class="btn btn-sm btn-info" onclick="openCamera('ctFilePreview','ctCameraData')">📷 Kamera</button></div><input type="file" id="ctFiles" multiple accept="image/*,.pdf,.doc,.docx" onchange="previewTaskFiles(this,'ctFilePreview')" style="display:none"><input type="hidden" id="ctCameraData"><div id="ctFilePreview" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"></div><div class="text-xs" style="color:#999;margin-top:4px">Maks 5 file. Format: Gambar, PDF, DOC</div></div><button class="btn btn-primary" onclick="simpanCuti()">Ajukan</button>`
  );
}
async function simpanCuti() {
  const mulai = document.getElementById('ctMulai').value,
    selesai = document.getElementById('ctSelesai').value;
  const durasi = Math.max(1, Math.ceil((new Date(selesai) - new Date(mulai)) / 86400000) + 1);
  const attachments = await getFilesAsBase64('ctFiles');
  const data = {
    nama: document.getElementById('ctNama').value,
    jenis: document.getElementById('ctJenis').value,
    mulai,
    selesai,
    durasi,
    keterangan: document.getElementById('ctKet').value,
    attachments,
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
  var komentar = '';
  if (status === 'rejected') {
    komentar = prompt('Alasan penolakan:');
    if (!komentar) return;
  } else {
    komentar = prompt('Komentar approval (opsional):') || '';
  }
  var updateData = {
    status: status,
    approvedBy: currentUser.nama,
    approvedAt: new Date().toISOString(),
  };
  if (komentar) updateData.approvalComment = komentar;
  if (status === 'rejected') {
    updateData.rejectedBy = currentUser.nama;
    updateData.rejectedAt = new Date().toISOString();
    updateData.alasanTolak = komentar;
  }
  await db.collection('hrd_cuti').doc(id).update(updateData);
  const cutiDoc = await db.collection('hrd_cuti').doc(id).get();
  const cutiData = cutiDoc.data();
  if (cutiData.userId) {
    await sendNotification(
      cutiData.userId,
      status === 'approved' ? '✅ Cuti Disetujui' : '❌ Cuti Ditolak',
      `Pengajuan ${cutiData.jenis || 'Cuti'} Anda telah ${status === 'approved' ? 'disetujui' : 'ditolak'}${komentar ? ': ' + komentar : ''}`,
      'portal-cuti'
    );
  }
  toast(status === 'approved' ? '✅ Cuti disetujui' : '❌ Cuti ditolak', 'success');
  renderCuti();
}

async function viewCutiDetail(id) {
  const doc = await db.collection('hrd_cuti').doc(id).get();
  if (!doc.exists) return toast('Data tidak ditemukan', 'warning');
  const p = doc.data();
  let attachHtml = '';
  if (p.attachments && p.attachments.length) {
    attachHtml =
      '<tr><td class="fw-700" style="padding:6px 8px">Lampiran</td><td style="padding:6px 8px"><div style="display:flex;gap:8px;flex-wrap:wrap">';
    p.attachments.forEach(function (a) {
      if (a.data && a.data.startsWith('data:image')) {
        attachHtml +=
          '<img src="' +
          a.data +
          '" style="max-width:100px;max-height:100px;border-radius:6px;border:1px solid #ddd;cursor:pointer" onclick="window.open(this.src)">';
      } else if (a.name) {
        attachHtml +=
          '<div style="padding:6px 10px;background:#f0f4ff;border-radius:6px;font-size:.8rem">📄 ' +
          escHtml(a.name) +
          '</div>';
      }
    });
    attachHtml += '</div></td></tr>';
  }
  openModal(`<div class="modal-title">Detail Cuti/Izin</div>
    <table style="width:100%;border-collapse:collapse">
      <tr><td class="fw-700" style="padding:6px 8px;width:120px">Nama</td><td style="padding:6px 8px">${escHtml(p.nama || '-')}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Jenis</td><td style="padding:6px 8px">${escHtml(p.jenis || '-')}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Mulai</td><td style="padding:6px 8px">${formatDate(p.mulai)}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Selesai</td><td style="padding:6px 8px">${formatDate(p.selesai)}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Durasi</td><td style="padding:6px 8px">${p.durasi || 1} hari</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Keterangan</td><td style="padding:6px 8px">${escHtml(p.keterangan || '-')}</td></tr>
      ${attachHtml}
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
  const isBOD = currentUser.role === 'bod';
  let gradeMapOT = {};
  if (isBOD) {
    const kSnap = await db.collection('hrd_karyawan').get();
    kSnap.forEach((d) => {
      const k = d.data();
      gradeMapOT[(k.nama || '').toLowerCase()] = (k.gradeJabatan || k.posisi || '').toLowerCase();
    });
  }
  let h = '';
  if (snap.empty) h = '<tr><td colspan="6" class="text-center">Belum ada</td></tr>';
  else
    snap.forEach((d) => {
      const p = d.data();
      if (isBOD) {
        const grade = gradeMapOT[(p.nama || '').toLowerCase()] || '';
        if (!grade.includes('head')) return;
      }
      const badge =
        p.status === 'approved'
          ? 'badge-success'
          : p.status === 'rejected'
            ? 'badge-danger'
            : 'badge-warning';
      const canApprove = p.status === 'pending' && hasAccess(3) && !isBOD;
      h += `<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${formatDate(p.tanggal)}</td><td>${p.jamMulai || '-'}-${p.jamSelesai || '-'}</td><td>${p.durasi || 0}j</td><td><span class="badge ${badge}">${p.status}</span></td><td><button class="btn btn-xs btn-info" onclick="viewOvertimeDetail('${d.id}')">👁️</button> ${canApprove ? `<button class="btn btn-xs btn-success" onclick="approveOT('${d.id}','approved')">✅</button> <button class="btn btn-xs btn-danger" onclick="approveOT('${d.id}','rejected')">❌</button>` : ''} ${hasAccess(6) ? `<button class="btn btn-xs btn-warning" onclick="editOTDoc('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_overtime','${d.id}','overtime')">🗑️</button>` : ''}</td></tr>`;
    });
  document.getElementById('tblOT').innerHTML = h;
}
function modalOvertime() {
  openModal(
    `<div class="modal-title">Pengajuan Overtime</div><div class="form-group"><label>Nama</label><input class="form-control" id="otNama" value="${currentUser.nama}"></div><div class="grid-3"><div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="otTgl" value="${todayStr()}"></div><div class="form-group"><label>Mulai</label><input class="form-control" type="time" id="otStart"></div><div class="form-group"><label>Selesai</label><input class="form-control" type="time" id="otEnd"></div></div><div class="form-group"><label>Alasan</label><textarea class="form-control" id="otAlasan"></textarea></div><div class="form-group"><label>📎 Lampiran (Foto/Dokumen)</label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><button type="button" class="btn btn-sm btn-outline" onclick="document.getElementById('otFiles').click()">📁 Pilih File</button><button type="button" class="btn btn-sm btn-info" onclick="openCamera('otFilePreview','otCameraData')">📷 Kamera</button></div><input type="file" id="otFiles" multiple accept="image/*,.pdf,.doc,.docx" onchange="previewTaskFiles(this,'otFilePreview')" style="display:none"><input type="hidden" id="otCameraData"><div id="otFilePreview" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"></div><div class="text-xs" style="color:#999;margin-top:4px">Maks 5 file. Format: Gambar, PDF, DOC</div></div><button class="btn btn-primary" onclick="simpanOvertime()">Ajukan</button>`
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
  const attachments = await getFilesAsBase64('otFiles');
  await db.collection('hrd_overtime').add({
    nama: document.getElementById('otNama').value,
    tanggal: document.getElementById('otTgl').value,
    jamMulai: s,
    jamSelesai: e,
    durasi: parseFloat(durasi),
    alasan: document.getElementById('otAlasan').value,
    attachments,
    status: 'pending',
    userId: currentUser.id,
    createdAt: new Date().toISOString(),
  });
  await sendNotification(
    'hr',
    '📋 Pengajuan Overtime',
    `${currentUser.nama} mengajukan overtime ${document.getElementById('otTgl').value} (${durasi} jam)`,
    'approval-center'
  );
  closeModalDirect();
  toast('Diajukan', 'success');
  renderOvertime();
}
async function approveOT(id, status) {
  var komentar = '';
  if (status === 'rejected') {
    komentar = prompt('Alasan penolakan:');
    if (!komentar) return;
  } else {
    komentar = prompt('Komentar approval (opsional):') || '';
  }
  var updateData = {
    status: status,
    approvedBy: currentUser.nama,
    approvedAt: new Date().toISOString(),
  };
  if (komentar) updateData.approvalComment = komentar;
  if (status === 'rejected') {
    updateData.rejectedBy = currentUser.nama;
    updateData.rejectedAt = new Date().toISOString();
    updateData.alasanTolak = komentar;
  }
  await db.collection('hrd_overtime').doc(id).update(updateData);
  const otDoc = await db.collection('hrd_overtime').doc(id).get();
  const otData = otDoc.data();
  if (otData.userId) {
    await sendNotification(
      otData.userId,
      status === 'approved' ? '✅ Overtime Disetujui' : '❌ Overtime Ditolak',
      `Pengajuan overtime Anda telah ${status === 'approved' ? 'disetujui' : 'ditolak'}${komentar ? ': ' + komentar : ''}`,
      'portal-overtime'
    );
  }
  toast(status === 'approved' ? '✅ Overtime disetujui' : '❌ Overtime ditolak', 'success');
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
    '<div style="margin-bottom:12px"><span style="font-size:.75rem;color:var(--text-light)">🔴 Libur &nbsp; 🔵 Task &nbsp; 🟢 Selesai &nbsp; 🟠 Terlambat &nbsp; 🟣 Report &nbsp; ⚫ Ditugaskan</span></div>';
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
      if (t.type === 'report') {
        bgTask = '#7b1fa2'; // Purple for reports
      } else if (t._isAssigned) {
        bgTask = '#6a1b9a';
      } else if (t.done) {
        bgTask = '#4caf50';
      } else if (t.tanggal < today) {
        bgTask = '#c62828';
      } else {
        bgTask = '#1565c0';
      }
      const icon = t.type === 'report' ? '📝 ' : '';
      const priorityMark = t.priority === 'high' && t.type !== 'report' ? '! ' : '';
      const rawLabel = icon + priorityMark + (t.title || '');
      const taskLabel = rawLabel.length > 14 ? rawLabel.substring(0, 14) + '...' : rawLabel;
      const clickFn =
        t.type === 'report' ? `viewDailyReport('${t.id}')` : `viewDailyTask('${t.id}')`;
      calHtml += `<div style="font-size:.6rem;background:${bgTask};color:#fff;padding:1px 4px;border-radius:3px;margin-top:2px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escHtml(t.title || '')}${t._isAssigned ? ' (ditugaskan ke ' + escHtml(t.targetUserName || '') + ')' : ''}" onclick="${clickFn}">${escHtml(taskLabel)}</div>`;
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
  const isBOD = currentUser.role === 'bod';
  main.innerHTML = `<div class="page-title"><span>⚠️ Penalty Point</span><div class="flex gap-8">${hasAccess(4) && !isBOD ? '<button class="btn btn-info btn-sm" onclick="syncPenaltyToKPI()">🔄 Sinkronisasi ke KPI</button>' : ''}${!isBOD ? '<button class="btn btn-primary btn-sm" onclick="modalPenalty()">+ Tambah</button>' : ''}</div></div>
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
      sumH += `<tr><td class="fw-700">${escHtml(s.nama)}</td><td>${escHtml(s.departemen)}</td><td><span class="badge ${badgeClass}">${s.poin}</span></td><td>${statusLabel}</td><td><button class="btn btn-xs btn-info" onclick="viewPenaltyDetail('${jsName}')">👁️</button>${hasAccess(2) && !isBOD ? ` <button class="btn btn-xs btn-primary" onclick="modalPenalty('${jsName}')">+ Tambah</button>` : ''}</td></tr>`;
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
      h += `<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${formatDate(p.tanggal)}</td><td>${escHtml(p.jenis)}</td><td><span class="badge badge-danger">${p.poin}</span></td><td>${statusBadge}</td><td><button class="btn btn-xs btn-info" onclick="viewPenaltyItem('${p.id}')">👁️</button>${hasAccess(2) && !isBOD ? ` <button class="btn btn-xs btn-primary" onclick="editPenalty('${p.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_penalty','${p.id}','penalty')">🗑️</button>` : ''}</td></tr>`;
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
  if (hasAccess(2) && !hasAccess(5)) {
    // Leader/Manager/Head can monitor assigned task history (not BOD)
    tabs +=
      '<div class="tab" onclick="filterDailyTasks(\'history-assigned\')">📊 History Tugas</div>';
  }
  if (hasAccess(3) && !hasAccess(5)) {
    // Manager/Head only can view weekly reports (not BOD, not staff/leader)
    tabs += '<div class="tab" onclick="loadWeeklyReports()">📈 Laporan Mingguan</div>';
  }

  // Button: Staff only sees report, Leader+ sees both
  let addBtn = '';
  if (hasAccess(6)) {
    // Admin: full access + import
    addBtn =
      '<button class="btn btn-primary btn-sm" onclick="modalAddTaskChoice()">+ Tambah</button> <button class="btn btn-success btn-sm" onclick="modalImportWeeklyReport()">⬆️ Import Laporan</button>';
  } else if (hasAccess(5)) {
    // BOD: view only, no actions
    addBtn = '';
  } else if (hasAccess(2)) {
    // Leader/Manager/Head: can add task + report
    addBtn =
      '<button class="btn btn-primary btn-sm" onclick="modalAddTaskChoice()">+ Tambah</button> <button class="btn btn-success btn-sm" onclick="modalImportWeeklyReport()">⬆️ Import Laporan</button>';
  } else {
    // Staff: can only add report
    addBtn =
      '<button class="btn btn-primary btn-sm" onclick="modalAddDailyReport()">+ Daily Report</button>';
  }

  main.innerHTML = `
    <div class="page-title"><span>📋 Daily Task & Report</span>${addBtn}</div>
    <div class="stats-grid mb-16" id="taskStats"></div>
    <div class="card">
      <div class="tabs mb-16" id="taskTabs" style="flex-wrap:wrap">${tabs}</div>
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
      'history-assigned': '📊 History Tugas',
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
        // Head: own data + all divisions reports + own dept tasks + all assigned tasks in dept
        if (t.userId === myId || t.assignedBy === myId) {
          _dailyTaskData.push({ id: d.id, ...t });
        } else if (t.type === 'report') {
          _dailyTaskData.push({ id: d.id, ...t }); // All divisions reports
        } else if (taskDept === myDept) {
          _dailyTaskData.push({ id: d.id, ...t }); // Own dept tasks
        } else if (t.assignedBy && t.assignedBy !== t.userId) {
          // Include all assigned tasks (from managers below) regardless of dept field
          _dailyTaskData.push({ id: d.id, ...t });
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
  if (filter === 'today') filtered = _dailyTaskData.filter((t) => t.tanggal === today && !t.done);
  else if (filter === 'upcoming')
    filtered = _dailyTaskData.filter((t) => t.tanggal > today && !t.done);
  else if (filter === 'done') filtered = _dailyTaskData.filter((t) => t.done);
  else if (filter === 'overdue')
    filtered = _dailyTaskData.filter((t) => t.tanggal < today && !t.done);
  else if (filter === 'assigned')
    filtered = _dailyTaskData.filter(
      (t) =>
        (t.assignedBy === currentUser.id ||
          (hasAccess(4) && t.assignedBy && t.assignedBy !== t.userId)) &&
        t.userId !== currentUser.id
    );
  else if (filter === 'history-assigned') {
    // HEAD+ sees all assigned tasks (from manager/leader below them)
    // Manager/Leader sees only their own assigned tasks
    if (hasAccess(4)) {
      filtered = _dailyTaskData.filter(function (t) {
        if (!t.assignedBy || t.assignedBy === t.userId) return false;
        return true; // HEAD sees all assigned tasks
      });
    } else {
      filtered = _dailyTaskData.filter(
        (t) => t.assignedBy === currentUser.id && t.userId !== currentUser.id
      );
    }
    // Apply date range filter if present
    const haFrom = document.getElementById('historyAssignedFrom')?.value || '';
    const haTo = document.getElementById('historyAssignedTo')?.value || '';
    if (haFrom) filtered = filtered.filter((t) => (t.tanggal || '') >= haFrom);
    if (haTo) filtered = filtered.filter((t) => (t.tanggal || '') <= haTo);
    // Sort by date descending (newest first)
    filtered.sort(
      (a, b) =>
        (b.tanggal || '').localeCompare(a.tanggal || '') ||
        (b.createdAt || '').localeCompare(a.createdAt || '')
    );
  } else if (filter === 'report')
    filtered = _dailyTaskData.filter(
      (t) =>
        (t.type === 'report' || (t.title && t.title.includes('Daily Report'))) &&
        (t.userId === currentUser.id ||
          (t.targetUserName || '').toLowerCase().trim() ===
            (currentUser.nama || '').toLowerCase().trim())
    );
  else if (filter === 'team-report') {
    const myDept2 = (currentUser.departemen || '').toLowerCase().trim();
    filtered = _dailyTaskData.filter(
      (t) =>
        (t.type === 'report' || (t.title && t.title.includes('Daily Report'))) &&
        ((t.departemen || '').toLowerCase().trim() === myDept2 || !t.departemen)
    );
    // Apply date range filter
    const drFrom = document.getElementById('reportDateFrom')?.value || '';
    const drTo = document.getElementById('reportDateTo')?.value || '';
    if (drFrom) filtered = filtered.filter((t) => (t.tanggal || '') >= drFrom);
    if (drTo) filtered = filtered.filter((t) => (t.tanggal || '') <= drTo);
    // Apply division filter (Head/BOD only)
    if (hasAccess(4) && window._teamReportDivFilter) {
      filtered = filtered.filter((t) =>
        (t.departemen || '').toUpperCase().includes(window._teamReportDivFilter)
      );
    }
    // Apply category filter
    if (window._teamReportCatFilter) {
      filtered = filtered.filter((t) => {
        const kat = (t.kategori || '').toLowerCase();
        const fv = (window._teamReportCatFilter || '').toLowerCase();
        if (fv === 'tanpa kategori') return !t.kategori || t.kategori.trim() === '';
        return kat.includes(fv);
      });
    }
    // Sort by kategori then date
    filtered.sort(
      (a, b) =>
        (a.kategori || '').localeCompare(b.kategori || '') ||
        (b.tanggal || '').localeCompare(a.tanggal || '')
    );
  } else if (filter === 'all-report') {
    filtered = _dailyTaskData.filter(
      (t) => t.type === 'report' || (t.title && t.title.includes('Daily Report'))
    );
    // Apply date range filter
    const drFrom = document.getElementById('reportDateFrom')?.value || '';
    const drTo = document.getElementById('reportDateTo')?.value || '';
    if (drFrom) filtered = filtered.filter((t) => (t.tanggal || '') >= drFrom);
    if (drTo) filtered = filtered.filter((t) => (t.tanggal || '') <= drTo);
    // Apply division filter
    if (window._allReportDivFilter) {
      filtered = filtered.filter(function (t) {
        var dept = (t.departemen || '').toUpperCase();
        return dept.includes(window._allReportDivFilter);
      });
    }
    // Apply category sub-filter
    if (window._allReportCatFilter) {
      filtered = filtered.filter(function (t) {
        var kat = (t.kategori || '').toLowerCase();
        var filterVal = (window._allReportCatFilter || '').toLowerCase();
        if (filterVal === 'tanpa kategori') return !t.kategori || t.kategori.trim() === '';
        return kat.includes(filterVal);
      });
    }
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
  // Show date range filter for team-report and all-report tabs
  let dateFilterHtml = '';
  if (filter === 'team-report' || filter === 'all-report') {
    const curFrom = document.getElementById('reportDateFrom')?.value || '';
    const curTo = document.getElementById('reportDateTo')?.value || '';
    dateFilterHtml = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;padding:10px;background:#f8f9ff;border-radius:8px">
      <span class="text-sm fw-700">📅 Periode:</span>
      <input type="date" class="form-control" id="reportDateFrom" value="${curFrom}" style="max-width:160px;padding:6px 10px" onchange="loadDailyTasks('${filter}')">
      <span class="text-sm">s/d</span>
      <input type="date" class="form-control" id="reportDateTo" value="${curTo}" style="max-width:160px;padding:6px 10px" onchange="loadDailyTasks('${filter}')">
      <button class="btn btn-xs btn-outline" onclick="document.getElementById('reportDateFrom').value='';document.getElementById('reportDateTo').value='';loadDailyTasks('${filter}')">Reset</button>
    </div>`;
    if (filter === 'team-report') {
      // Team report: Head/BOD get division+category, Manager gets category only
      dateFilterHtml += `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">`;
      if (hasAccess(4)) {
        dateFilterHtml += `<button class="btn btn-xs ${!window._teamReportDivFilter ? 'btn-primary' : 'btn-outline'}" onclick="window._teamReportDivFilter='';window._teamReportCatFilter='';loadDailyTasks('team-report')">Semua</button>
        <button class="btn btn-xs ${window._teamReportDivFilter === 'ACADEMIC' ? 'btn-primary' : 'btn-outline'}" onclick="window._teamReportDivFilter='ACADEMIC';window._teamReportCatFilter='';loadDailyTasks('team-report')">📚 ACADEMIC</button>
        <button class="btn btn-xs ${window._teamReportDivFilter === 'OFFICE' ? 'btn-primary' : 'btn-outline'}" onclick="window._teamReportDivFilter='OFFICE';window._teamReportCatFilter='';loadDailyTasks('team-report')">🏢 OFFICE</button>`;
      }
      let trCatOpts = '<option value="">Semua Kategori</option>';
      if (hasAccess(4) && window._teamReportDivFilter === 'ACADEMIC') {
        ['Siswa', 'Sensei', 'Curriculum', 'TSK-Job', 'Tanpa Kategori'].forEach((c) => {
          trCatOpts += `<option value="${c}" ${window._teamReportCatFilter === c ? 'selected' : ''}>${c}</option>`;
        });
      } else if (hasAccess(4) && window._teamReportDivFilter === 'OFFICE') {
        ['HR & Legal', 'Document', "Facility's", 'Finance', 'Marketing & Sales', 'Promosi'].forEach(
          (c) => {
            trCatOpts += `<option value="${c}" ${window._teamReportCatFilter === c ? 'selected' : ''}>${c}</option>`;
          }
        );
      } else if (hasAccess(4)) {
        // Head/BOD with no division filter: show all
        [
          'Siswa',
          'Sensei',
          'Curriculum',
          'TSK-Job',
          'HR & Legal',
          'Document',
          "Facility's",
          'Finance',
          'Marketing & Sales',
          'Promosi',
          'Tanpa Kategori',
        ].forEach((c) => {
          trCatOpts += `<option value="${c}" ${window._teamReportCatFilter === c ? 'selected' : ''}>${c}</option>`;
        });
      } else {
        // Manager: only own division categories (no cross-division)
        const myDeptUp = (currentUser.departemen || '').toUpperCase();
        if (myDeptUp.includes('ACADEMIC')) {
          ['Siswa', 'Sensei', 'Curriculum', 'TSK-Job', 'Tanpa Kategori'].forEach((c) => {
            trCatOpts += `<option value="${c}" ${window._teamReportCatFilter === c ? 'selected' : ''}>${c}</option>`;
          });
        } else {
          [
            'HR & Legal',
            'Document',
            "Facility's",
            'Finance',
            'Marketing & Sales',
            'Promosi',
            'Tanpa Kategori',
          ].forEach((c) => {
            trCatOpts += `<option value="${c}" ${window._teamReportCatFilter === c ? 'selected' : ''}>${c}</option>`;
          });
        }
      }
      dateFilterHtml += `<select class="form-control" style="max-width:180px;padding:4px 8px;font-size:.8rem" onchange="window._teamReportCatFilter=this.value;loadDailyTasks('team-report')">${trCatOpts}</select></div>`;
    }
    if (filter === 'all-report') {
      dateFilterHtml += `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-xs ${!window._allReportDivFilter ? 'btn-primary' : 'btn-outline'}" onclick="window._allReportDivFilter='';window._allReportCatFilter='';loadDailyTasks('all-report')">Semua</button>
        <button class="btn btn-xs ${window._allReportDivFilter === 'ACADEMIC' ? 'btn-primary' : 'btn-outline'}" onclick="window._allReportDivFilter='ACADEMIC';window._allReportCatFilter='';loadDailyTasks('all-report')">📚 ACADEMIC</button>
        <button class="btn btn-xs ${window._allReportDivFilter === 'OFFICE' ? 'btn-primary' : 'btn-outline'}" onclick="window._allReportDivFilter='OFFICE';window._allReportCatFilter='';loadDailyTasks('all-report')">🏢 OFFICE</button>`;
      // Category sub-filter for manager+ (level 3+)
      if (hasAccess(3)) {
        let catOptions = '<option value="">Semua Kategori</option>';
        if (window._allReportDivFilter === 'ACADEMIC') {
          ['Siswa', 'Sensei', 'Curriculum', 'TSK-Job', 'Tanpa Kategori'].forEach((c) => {
            catOptions += `<option value="${c}" ${window._allReportCatFilter === c ? 'selected' : ''}>${c}</option>`;
          });
        } else if (window._allReportDivFilter === 'OFFICE') {
          [
            'HR & Legal',
            'Document',
            "Facility's",
            'Finance',
            'Marketing & Sales',
            'Promosi',
          ].forEach((c) => {
            catOptions += `<option value="${c}" ${window._allReportCatFilter === c ? 'selected' : ''}>${c}</option>`;
          });
        } else {
          // Show all categories when no division selected
          [
            'Siswa',
            'Sensei',
            'Curriculum',
            'TSK-Job',
            'HR & Legal',
            'Document',
            "Facility's",
            'Finance',
            'Marketing & Sales',
            'Promosi',
            'Tanpa Kategori',
          ].forEach((c) => {
            catOptions += `<option value="${c}" ${window._allReportCatFilter === c ? 'selected' : ''}>${c}</option>`;
          });
        }
        dateFilterHtml += `<select class="form-control" style="max-width:180px;padding:4px 8px;font-size:.8rem" onchange="window._allReportCatFilter=this.value;loadDailyTasks('all-report')">${catOptions}</select>`;
      }
      dateFilterHtml += `</div>`;
    }
  }
  // ── LIST FILTER BAR — Periode + Division + Category for main tabs ──
  // Head/BOD: periode + division + category; Manager: category only
  const listFilterTabs = ['all', 'today', 'upcoming', 'done', 'overdue', 'assigned'];
  if (listFilterTabs.includes(filter) && hasAccess(3)) {
    const lfFrom = document.getElementById('listFilterFrom')?.value || '';
    const lfTo = document.getElementById('listFilterTo')?.value || '';
    // Head+ and BOD get full filter (periode + division + category)
    if (hasAccess(4)) {
      dateFilterHtml += `<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;padding:10px;background:#f8f9ff;border-radius:8px">
        <span class="text-sm fw-700">📅 Periode:</span>
        <input type="date" class="form-control" id="listFilterFrom" value="${lfFrom}" style="max-width:150px;padding:5px 8px;font-size:.82rem" onchange="loadDailyTasks('${filter}')">
        <span class="text-sm">s/d</span>
        <input type="date" class="form-control" id="listFilterTo" value="${lfTo}" style="max-width:150px;padding:5px 8px;font-size:.82rem" onchange="loadDailyTasks('${filter}')">
        <button class="btn btn-xs btn-outline" onclick="document.getElementById('listFilterFrom').value='';document.getElementById('listFilterTo').value='';window._listDivFilter='';window._listCatFilter='';loadDailyTasks('${filter}')">Reset</button>
      </div>`;
      dateFilterHtml += `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-xs ${!window._listDivFilter ? 'btn-primary' : 'btn-outline'}" onclick="window._listDivFilter='';window._listCatFilter='';loadDailyTasks('${filter}')">Semua</button>
        <button class="btn btn-xs ${window._listDivFilter === 'ACADEMIC' ? 'btn-primary' : 'btn-outline'}" onclick="window._listDivFilter='ACADEMIC';window._listCatFilter='';loadDailyTasks('${filter}')">📚 ACADEMIC</button>
        <button class="btn btn-xs ${window._listDivFilter === 'OFFICE' ? 'btn-primary' : 'btn-outline'}" onclick="window._listDivFilter='OFFICE';window._listCatFilter='';loadDailyTasks('${filter}')">🏢 OFFICE</button>`;
    } else {
      // Manager: periode + category (scoped to own division only)
      dateFilterHtml += `<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;padding:10px;background:#f8f9ff;border-radius:8px">
        <span class="text-sm fw-700">📅 Periode:</span>
        <input type="date" class="form-control" id="listFilterFrom" value="${lfFrom}" style="max-width:150px;padding:5px 8px;font-size:.82rem" onchange="loadDailyTasks('${filter}')">
        <span class="text-sm">s/d</span>
        <input type="date" class="form-control" id="listFilterTo" value="${lfTo}" style="max-width:150px;padding:5px 8px;font-size:.82rem" onchange="loadDailyTasks('${filter}')">
        <button class="btn btn-xs btn-outline" onclick="document.getElementById('listFilterFrom').value='';document.getElementById('listFilterTo').value='';window._listCatFilter='';loadDailyTasks('${filter}')">Reset</button>
      </div>`;
      dateFilterHtml += `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">`;
    }
    // Category dropdown
    let listCatOptions = '<option value="">Semua Kategori</option>';
    if (hasAccess(4) && window._listDivFilter === 'ACADEMIC') {
      ['Siswa', 'Sensei', 'Curriculum', 'TSK-Job', 'Tanpa Kategori'].forEach((c) => {
        listCatOptions += `<option value="${c}" ${window._listCatFilter === c ? 'selected' : ''}>${c}</option>`;
      });
    } else if (hasAccess(4) && window._listDivFilter === 'OFFICE') {
      ['HR & Legal', 'Document', "Facility's", 'Finance', 'Marketing & Sales', 'Promosi'].forEach(
        (c) => {
          listCatOptions += `<option value="${c}" ${window._listCatFilter === c ? 'selected' : ''}>${c}</option>`;
        }
      );
    } else if (!hasAccess(4)) {
      // Manager: only own division categories
      const myDeptUpper = (currentUser.departemen || '').toUpperCase();
      if (myDeptUpper.includes('ACADEMIC')) {
        ['Siswa', 'Sensei', 'Curriculum', 'TSK-Job', 'Tanpa Kategori'].forEach((c) => {
          listCatOptions += `<option value="${c}" ${window._listCatFilter === c ? 'selected' : ''}>${c}</option>`;
        });
      } else {
        [
          'HR & Legal',
          'Document',
          "Facility's",
          'Finance',
          'Marketing & Sales',
          'Promosi',
          'Tanpa Kategori',
        ].forEach((c) => {
          listCatOptions += `<option value="${c}" ${window._listCatFilter === c ? 'selected' : ''}>${c}</option>`;
        });
      }
    } else {
      [
        'Siswa',
        'Sensei',
        'Curriculum',
        'TSK-Job',
        'HR & Legal',
        'Document',
        "Facility's",
        'Finance',
        'Marketing & Sales',
        'Promosi',
        'Tanpa Kategori',
      ].forEach((c) => {
        listCatOptions += `<option value="${c}" ${window._listCatFilter === c ? 'selected' : ''}>${c}</option>`;
      });
    }
    dateFilterHtml += `<select class="form-control" style="max-width:180px;padding:4px 8px;font-size:.8rem" onchange="window._listCatFilter=this.value;loadDailyTasks('${filter}')">${listCatOptions}</select>`;
    dateFilterHtml += `</div>`;
    // Apply list filters to data
    if (lfFrom) filtered = filtered.filter((t) => (t.tanggal || '') >= lfFrom);
    if (lfTo) filtered = filtered.filter((t) => (t.tanggal || '') <= lfTo);
    if (window._listDivFilter) {
      filtered = filtered.filter((t) =>
        (t.departemen || '').toUpperCase().includes(window._listDivFilter)
      );
    }
    if (window._listCatFilter) {
      filtered = filtered.filter((t) => {
        const kat = (t.kategori || '').toLowerCase();
        const fv = (window._listCatFilter || '').toLowerCase();
        if (fv === 'tanpa kategori') return !t.kategori || t.kategori.trim() === '';
        return kat.includes(fv);
      });
    }
  }
  if (filter === 'history-assigned') {
    const curFrom = document.getElementById('historyAssignedFrom')?.value || '';
    const curTo = document.getElementById('historyAssignedTo')?.value || '';
    const totalAssigned = filtered.length;
    const doneCount = filtered.filter(function (t) {
      return t.done;
    }).length;
    const pendingCount = filtered.filter(function (t) {
      return !t.done && t.tanggal >= today;
    }).length;
    const overdueCount = filtered.filter(function (t) {
      return !t.done && t.tanggal < today;
    }).length;
    // Stats
    var historyHtml =
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:16px">';
    historyHtml +=
      '<div style="padding:10px;background:#e3f2fd;border-radius:8px;text-align:center;border-left:3px solid #1565c0"><div class="fw-700" style="font-size:1.1rem;color:#1565c0">' +
      totalAssigned +
      '</div><div class="text-xs">Total Tugas</div></div>';
    historyHtml +=
      '<div style="padding:10px;background:#e8f5e9;border-radius:8px;text-align:center;border-left:3px solid #2e7d32"><div class="fw-700" style="font-size:1.1rem;color:#2e7d32">' +
      doneCount +
      '</div><div class="text-xs">Selesai</div></div>';
    historyHtml +=
      '<div style="padding:10px;background:#fff3e0;border-radius:8px;text-align:center;border-left:3px solid #f57f17"><div class="fw-700" style="font-size:1.1rem;color:#f57f17">' +
      pendingCount +
      '</div><div class="text-xs">Proses</div></div>';
    historyHtml +=
      '<div style="padding:10px;background:#fce4ec;border-radius:8px;text-align:center;border-left:3px solid #c62828"><div class="fw-700" style="font-size:1.1rem;color:#c62828">' +
      overdueCount +
      '</div><div class="text-xs">Terlambat</div></div>';
    historyHtml += '</div>';
    // Collapsible filter - only shows when user clicks
    var filterActive = curFrom || curTo;
    historyHtml += '<div style="margin-bottom:14px">';
    if (!filterActive) {
      historyHtml +=
        '<button class="btn btn-xs btn-outline" onclick="document.getElementById(\'historyFilterWrap\').style.display=\'flex\'">📅 Filter Periode</button>';
    }
    historyHtml +=
      '<div id="historyFilterWrap" style="display:' +
      (filterActive ? 'flex' : 'none') +
      ';gap:8px;align-items:center;flex-wrap:wrap;padding:10px;background:#f8f9ff;border-radius:8px;margin-top:8px">';
    historyHtml += '<span class="text-sm fw-700">Dari:</span>';
    historyHtml +=
      '<input type="date" class="form-control" id="historyAssignedFrom" value="' +
      curFrom +
      '" style="max-width:150px;padding:5px 8px;font-size:.82rem" onchange="loadDailyTasks(\'history-assigned\')">';
    historyHtml += '<span class="text-sm fw-700">Sampai:</span>';
    historyHtml +=
      '<input type="date" class="form-control" id="historyAssignedTo" value="' +
      curTo +
      '" style="max-width:150px;padding:5px 8px;font-size:.82rem" onchange="loadDailyTasks(\'history-assigned\')">';
    historyHtml +=
      "<button class=\"btn btn-xs btn-outline\" onclick=\"document.getElementById('historyAssignedFrom').value='';document.getElementById('historyAssignedTo').value='';loadDailyTasks('history-assigned')\">✕ Reset</button>";
    historyHtml += '</div></div>';
    // Group by departemen
    var deptGroups = {};
    filtered.forEach(function (t) {
      var dept = t.departemen || 'Tanpa Departemen';
      if (!deptGroups[dept]) deptGroups[dept] = [];
      deptGroups[dept].push(t);
    });
    var deptKeys = Object.keys(deptGroups).sort();
    if (!filtered.length) {
      historyHtml +=
        '<div style="text-align:center;padding:32px;color:#999"><div style="font-size:2rem;margin-bottom:8px">📋</div><p>Belum ada tugas yang ditugaskan</p></div>';
    } else {
      deptKeys.forEach(function (dept) {
        var tasks = deptGroups[dept];
        historyHtml += '<div style="margin-bottom:20px">';
        historyHtml +=
          '<div style="padding:8px 14px;background:#e8eaf6;border-radius:8px;font-weight:700;font-size:.88rem;color:#283593;border-left:4px solid #3f51b5;margin-bottom:8px">🏢 ' +
          escHtml(dept) +
          ' <span style="font-weight:400;color:#666;font-size:.75rem">(' +
          tasks.length +
          ' tugas)</span></div>';
        historyHtml +=
          '<div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Judul Task</th><th>Tanggal</th><th>Prioritas</th><th>Status</th><th>Ditugaskan oleh</th><th>Selesai</th><th>Aksi</th></tr></thead><tbody>';
        tasks.forEach(function (t) {
          var statusBadge = '';
          if (t.done) statusBadge = '<span class="badge badge-success">Selesai</span>';
          else if (t.tanggal < today)
            statusBadge = '<span class="badge badge-danger">Terlambat</span>';
          else if (t.tanggal === today)
            statusBadge = '<span class="badge badge-warning">Hari Ini</span>';
          else statusBadge = '<span class="badge badge-info">Mendatang</span>';
          var prioColor =
            t.priority === 'high' ? '#c62828' : t.priority === 'low' ? '#666' : '#f57f17';
          var prioLabel =
            t.priority === 'high' ? 'Tinggi' : t.priority === 'low' ? 'Rendah' : 'Sedang';
          var doneAt = t.doneAt ? formatDate(t.doneAt) : '-';
          historyHtml += '<tr>';
          historyHtml +=
            '<td class="fw-700">' + escHtml(t.targetUserName || t.userId || '-') + '</td>';
          historyHtml += '<td>' + escHtml(t.title) + '</td>';
          historyHtml += '<td>' + formatDate(t.tanggal) + '</td>';
          historyHtml +=
            '<td><span style="padding:2px 8px;border-radius:4px;font-size:.75rem;background:' +
            prioColor +
            '20;color:' +
            prioColor +
            '">' +
            prioLabel +
            '</span></td>';
          historyHtml += '<td>' + statusBadge + '</td>';
          historyHtml += '<td class="text-sm">' + escHtml(t.assignedByName || '-') + '</td>';
          historyHtml += '<td>' + doneAt + '</td>';
          historyHtml +=
            '<td><button class="btn btn-xs btn-info" onclick="viewDailyTask(\'' +
            t.id +
            '\')">👁️</button></td>';
          historyHtml += '</tr>';
        });
        historyHtml += '</tbody></table></div></div>';
      });
    }
    listEl.innerHTML = historyHtml;
    return;
  }
  if (!filtered.length) {
    listEl.innerHTML =
      dateFilterHtml +
      '<div style="text-align:center;padding:32px;color:var(--text-light)"><div style="font-size:2rem;margin-bottom:8px">✅</div><p>Tidak ada data</p></div>';
    return;
  }
  const isAdmin = hasAccess(3);
  let html = dateFilterHtml;
  // Add group headers for report views
  let lastGroup = '';
  let lastSubGroup = '';
  filtered.forEach((t) => {
    if (_dailyTaskFilter === 'report' && t.type === 'report') {
      const group = t.kategori || 'Tanpa Kategori';
      if (group !== lastGroup) {
        lastGroup = group;
        html += `<div style="padding:10px 12px;margin:12px 0 8px;background:#e3f2fd;border-radius:8px;font-weight:700;font-size:.88rem;color:#1565c0;border-left:4px solid #1565c0">📂 ${escHtml(group)}</div>`;
      }
    } else if (_dailyTaskFilter === 'team-report' && t.type === 'report') {
      const group = t.kategori || 'Tanpa Kategori';
      if (group !== lastGroup) {
        lastGroup = group;
        lastSubGroup = '';
        html += `<div style="padding:10px 12px;margin:16px 0 8px;background:#e8f5e9;border-radius:8px;font-weight:700;font-size:.92rem;color:#2e7d32;border-left:4px solid #2e7d32">📂 ${escHtml(group)}</div>`;
      }
      const sub = t.targetUserName || '-';
      if (sub !== lastSubGroup) {
        lastSubGroup = sub;
        html += `<div style="padding:6px 12px;margin:4px 0;font-size:.8rem;color:#555;font-weight:600">👤 ${escHtml(sub)}</div>`;
      }
    } else if (_dailyTaskFilter === 'all-report' && t.type === 'report') {
      const group = t.departemen || 'Tanpa Departemen';
      const sub = t.kategori || 'Tanpa Kategori';
      if (group !== lastGroup) {
        lastGroup = group;
        lastSubGroup = '';
        html += `<div style="padding:12px 14px;margin:16px 0 8px;background:#1a1a1a;border-radius:8px;font-weight:700;font-size:.95rem;color:#fff">🏢 ${escHtml(group)}</div>`;
      }
      if (sub !== lastSubGroup) {
        lastSubGroup = sub;
        html += `<div style="padding:8px 12px;margin:4px 0 6px;background:#f3e5f5;border-radius:6px;font-size:.83rem;color:#7b1fa2;font-weight:700">📂 ${escHtml(sub)}</div>`;
      }
    }
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
      html += `<div style="display:flex;gap:4px"><button class="btn btn-xs btn-info" onclick="event.stopPropagation();viewDailyReport('${t.id}')">👁️</button>${t.userId === currentUser.id || hasAccess(3) || t.source === 'spreadsheet-import' ? `<button class="btn btn-xs btn-warning" onclick="event.stopPropagation();editDailyReport('${t.id}')">✏️</button>` : ''}${t.userId === currentUser.id || hasAccess(3) || t.source === 'spreadsheet-import' ? `<button class="btn btn-xs btn-danger" onclick="event.stopPropagation();hapusDailyTask('${t.id}')">🗑️</button>` : ''}</div></div>`;
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
    html += `<div style="display:flex;align-items:flex-start;gap:12px;padding:12px;border-left:4px solid ${borderColor};margin-bottom:8px;background:${t.done ? '#f1f8e9' : isOverdue ? '#fff8f8' : '#fff'};border-radius:0 8px 8px 0;cursor:pointer" onclick="viewDailyTask('${t.id}')">`;
    html += `<input type="checkbox" ${t.done ? 'checked' : ''} onchange="event.stopPropagation();toggleDailyTask('${t.id}')" style="margin-top:4px;width:18px;height:18px;accent-color:#2e7d32;cursor:pointer">`;
    html += `<div style="flex:1"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-weight:700;font-size:.9rem;${t.done ? 'text-decoration:line-through;color:#999' : ''}">${escHtml(t.title)}</span><span style="font-size:.65rem;padding:2px 6px;border-radius:4px;background:${priorityColor}20;color:${priorityColor};font-weight:600">${priorityLabel}</span>`;
    if (isOverdue)
      html += `<span class="badge badge-danger" style="font-size:.6rem">Terlambat</span>`;
    if (isToday2 && !t.done)
      html += `<span class="badge badge-info" style="font-size:.6rem">Hari Ini</span>`;
    html += `</div>`;
    if (t.description)
      html += `<div style="font-size:.8rem;color:var(--text-light);margin-top:4px;white-space:pre-line;${t.done ? 'text-decoration:line-through' : ''}">${escHtml(t.description)}</div>`;
    html += `<div style="font-size:.7rem;color:#999;margin-top:4px">`;
    if (isAdmin && t.targetUserName)
      html += `👤 Untuk: <strong>${escHtml(t.targetUserName)}</strong> | `;
    html += `📅 ${formatDate(t.tanggal)}${t.waktu ? ' ⏰ ' + t.waktu : ''}${t.reminder ? ' 🔔 ' + t.reminder : ''}${t.assignedByName ? ' | 👤 Ditugaskan oleh: ' + escHtml(t.assignedByName) : ''}`;
    html += `</div></div>`;
    // Determine action buttons
    const isOwn = t.userId === currentUser.id;
    const isAssignedByOther =
      t.assignedBy && t.assignedBy !== currentUser.id && t.userId === currentUser.id;
    const isAssigner = t.assignedBy === currentUser.id && t.userId !== currentUser.id;
    const isFullAdmin = hasAccess(6);
    const canEdit = isFullAdmin || (isOwn && !isAssignedByOther) || isAssigner;
    const canDelete = isFullAdmin || (isOwn && !isAssignedByOther) || isAssigner;
    if (canEdit) {
      html += `<div style="display:flex;gap:4px;flex-wrap:wrap"><a href="${buildGCalUrl(t)}" target="_blank" class="btn btn-xs btn-info" title="Tambah ke Google Calendar" style="text-decoration:none">📅</a><button class="btn btn-xs btn-info" onclick="viewDailyTask('${t.id}')" title="Lihat">👁️</button><button class="btn btn-xs btn-warning" onclick="editDailyTask('${t.id}')">✏️</button>${canDelete ? `<button class="btn btn-xs btn-danger" onclick="hapusDailyTask('${t.id}')">🗑️</button>` : ''}</div></div>`;
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
  var task = _dailyTaskData.find((t) => t.id === id);
  if (!task) {
    // Fallback: fetch from Firestore if not in local cache
    db.collection('hrd_daily_tasks')
      .doc(id)
      .get()
      .then(function (doc) {
        if (!doc.exists) return toast('Data tidak ditemukan', 'warning');
        var t = { id: doc.id, ...doc.data() };
        _showDailyTaskDetail(t);
      });
    return;
  }
  _showDailyTaskDetail(task);
}

function _showDailyTaskDetail(task) {
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
      <tr><td style="padding:8px;font-weight:700">Deskripsi</td><td style="padding:8px;white-space:pre-line">${escHtml(task.description || '-')}</td></tr>
      <tr><td style="padding:8px;font-weight:700">Tanggal</td><td style="padding:8px">${formatDate(task.tanggal)}</td></tr>
      <tr><td style="padding:8px;font-weight:700">Waktu</td><td style="padding:8px">${task.waktu || '-'}</td></tr>
      <tr><td style="padding:8px;font-weight:700">Prioritas</td><td style="padding:8px"><span style="color:${priorityColor};font-weight:600">${priorityLabel}</span></td></tr>
      <tr><td style="padding:8px;font-weight:700">Pengingat</td><td style="padding:8px">${task.reminder || 'Tidak ada'}</td></tr>
      <tr><td style="padding:8px;font-weight:700">Status</td><td style="padding:8px">${statusLabel}</td></tr>
      ${task.assignedByName ? `<tr><td style="padding:8px;font-weight:700">Ditugaskan oleh</td><td style="padding:8px">${escHtml(task.assignedByName)}</td></tr>` : ''}
      ${task.targetUserName ? `<tr><td style="padding:8px;font-weight:700">Untuk</td><td style="padding:8px">${escHtml(task.targetUserName)}</td></tr>` : ''}
      ${task.doneAt ? `<tr><td style="padding:8px;font-weight:700">Selesai pada</td><td style="padding:8px">${formatDate(task.doneAt.split('T')[0])} ${task.doneAt.split('T')[1] ? task.doneAt.split('T')[1].substring(0, 5) : ''}</td></tr>` : ''}
    </table>
    ${task.attachments && task.attachments.length ? `<div style="margin-top:16px;padding:16px;background:#f8f9ff;border-radius:10px;border:1px solid var(--border)"><div class="fw-700 mb-12" style="color:var(--primary)">📎 Lampiran Eviden (${task.attachments.length} file)</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px">${task.attachments.map((a, i) => (a.type && a.type.startsWith('image/') ? `<div style="text-align:center;cursor:pointer" onclick="viewEviden('${encodeURIComponent(JSON.stringify({ name: a.name, type: a.type, data: a.data }))}')"><img src="${a.data}" style="width:100%;height:90px;object-fit:cover;border-radius:8px;border:2px solid var(--border)"><div style="font-size:.6rem;color:#666;margin-top:4px">${escHtml(a.name || 'Foto ' + (i + 1))}</div></div>` : `<div style="cursor:pointer;display:flex;flex-direction:column;align-items:center;padding:12px;background:#fff;border-radius:8px;border:1px solid var(--border)" onclick="viewEviden('${encodeURIComponent(JSON.stringify({ name: a.name, type: a.type, data: a.data }))}')"><div style="font-size:2rem">${a.name && a.name.endsWith('.pdf') ? '📕' : a.name && a.name.match(/\\.docx?$/) ? '📘' : a.name && a.name.match(/\\.xlsx?$/) ? '📗' : '📄'}</div><div style="font-size:.6rem;color:#333;margin-top:4px;text-align:center;word-break:break-all">${escHtml(a.name)}</div><div style="font-size:.6rem;color:#1565c0;margin-top:4px">👁️ Lihat</div></div>`)).join('')}</div></div>` : ''}
    <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end"><a href="${buildGCalUrl(task)}" target="_blank" class="btn btn-sm btn-info" style="text-decoration:none">📅 Tambah ke Google Calendar</a><button class="btn btn-sm btn-outline" onclick="closeModalDirect()">Tutup</button></div>`);
}

async function modalAddTask() {
  // Leader/Manager/Head can assign tasks to subordinates
  let assignHtml = '';
  if (hasAccess(2) && !hasAccess(5)) {
    try {
      const usersSnap = await db.collection('hrd_users').get();
      const myDept = (currentUser.departemen || '').toLowerCase().trim();
      let checkboxes = '';
      usersSnap.forEach(function (d) {
        var u = d.data();
        if (u.status !== 'nonaktif' && d.id !== currentUser.id) {
          // Only show same division members
          if (myDept && (u.departemen || '').toLowerCase().trim() !== myDept) return;
          checkboxes +=
            '<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;transition:background .15s" onmouseover="this.style.background=\'#f0f4ff\'" onmouseout="this.style.background=\'\'">';
          checkboxes +=
            '<input type="checkbox" class="dt-assign-cb" value="' +
            d.id +
            '" data-nama="' +
            escHtml(u.nama) +
            '"> ';
          checkboxes +=
            '<span>' +
            escHtml(u.nama) +
            ' <span style="color:#999;font-size:.75rem">(' +
            escHtml(u.departemen || '-') +
            ')</span></span></label>';
        }
      });
      assignHtml = '<div class="form-group"><label>Tugaskan Ke</label>';
      assignHtml +=
        '<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;margin-bottom:4px;background:#f8f9ff;border-radius:6px;cursor:pointer"><input type="checkbox" id="dtAssignSelf" checked> <span class="fw-700">📝 Untuk Diri Sendiri</span></label>';
      assignHtml +=
        '<div style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px">';
      assignHtml +=
        '<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid #eee;cursor:pointer"><input type="checkbox" id="dtAssignAll" onchange="document.querySelectorAll(\'.dt-assign-cb\').forEach(function(c){c.checked=this.checked}.bind(this))"> <span class="fw-700 text-sm">Pilih Semua</span></label>';
      assignHtml += checkboxes;
      assignHtml +=
        '</div><div class="text-xs" style="color:#999;margin-top:4px">Centang satu atau lebih anggota tim</div></div>';
    } catch (_e) {
      assignHtml = '';
    }
  } else if (hasAccess(6)) {
    try {
      const usersSnap = await db.collection('hrd_users').get();
      let checkboxes = '';
      usersSnap.forEach(function (d) {
        var u = d.data();
        if (u.status !== 'nonaktif' && d.id !== currentUser.id) {
          checkboxes +=
            '<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;transition:background .15s" onmouseover="this.style.background=\'#f0f4ff\'" onmouseout="this.style.background=\'\'">';
          checkboxes +=
            '<input type="checkbox" class="dt-assign-cb" value="' +
            d.id +
            '" data-nama="' +
            escHtml(u.nama) +
            '"> ';
          checkboxes +=
            '<span>' +
            escHtml(u.nama) +
            ' <span style="color:#999;font-size:.75rem">(' +
            escHtml(u.departemen || '-') +
            ')</span></span></label>';
        }
      });
      assignHtml = '<div class="form-group"><label>Tugaskan Ke</label>';
      assignHtml +=
        '<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;margin-bottom:4px;background:#f8f9ff;border-radius:6px;cursor:pointer"><input type="checkbox" id="dtAssignSelf" checked> <span class="fw-700">📝 Untuk Diri Sendiri</span></label>';
      assignHtml +=
        '<div style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px">';
      assignHtml +=
        '<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid #eee;cursor:pointer"><input type="checkbox" id="dtAssignAll" onchange="document.querySelectorAll(\'.dt-assign-cb\').forEach(function(c){c.checked=this.checked}.bind(this))"> <span class="fw-700 text-sm">Pilih Semua</span></label>';
      assignHtml += checkboxes;
      assignHtml +=
        '</div><div class="text-xs" style="color:#999;margin-top:4px">Centang satu atau lebih karyawan</div></div>';
    } catch (_e) {
      assignHtml = '';
    }
  }
  const catHtml =
    hasAccess(2) && !hasAccess(3)
      ? `<div class="form-group"><label>Kategori</label><select class="form-control" id="dtKategori">${getReportCategoryOptions()}</select></div>`
      : '';
  openModal(`<div class="modal-title">+ Tambah Task</div>
    ${assignHtml}
    ${catHtml}
    <div class="form-group"><label>Judul Task *</label><input class="form-control" id="dtTitle" placeholder="Contoh: Meeting dengan klien"></div>
    <div class="form-group"><label>Deskripsi</label><textarea class="form-control" id="dtDesc" rows="4" placeholder="Detail task...\n(Tekan Enter untuk baris baru)" style="white-space:pre-wrap"></textarea></div>
    <div class="grid-2"><div class="form-group"><label>Tanggal *</label><input class="form-control" type="date" id="dtDate" value="${todayStr()}"></div><div class="form-group"><label>Waktu</label><input class="form-control" type="time" id="dtTime"></div></div>
    <div class="grid-2"><div class="form-group"><label>Prioritas</label><select class="form-control" id="dtPriority"><option value="medium">Sedang</option><option value="high">Tinggi</option><option value="low">Rendah</option></select></div><div class="form-group"><label>Pengingat</label><select class="form-control" id="dtReminder"><option value="">Tidak ada</option><option value="15 menit">15 menit</option><option value="30 menit">30 menit</option><option value="1 jam">1 jam</option><option value="1 hari">1 hari</option></select></div></div>
    <div class="form-group"><label>Ulangi</label><select class="form-control" id="dtRepeat"><option value="">Tidak</option><option value="daily">Setiap Hari</option><option value="weekly">Setiap Minggu</option><option value="monthly">Setiap Bulan</option></select></div>
    <div class="form-group"><label>📎 Lampiran (Eviden)</label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><button type="button" class="btn btn-sm btn-outline" onclick="document.getElementById('dtFiles').click()">📁 Pilih File</button><button type="button" class="btn btn-sm btn-info" onclick="openCamera('dtFilePreview','dtCameraData')">📷 Kamera</button></div><input type="file" id="dtFiles" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip" onchange="previewTaskFiles(this,'dtFilePreview')" style="display:none"><input type="hidden" id="dtCameraData"><div id="dtFilePreview" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"></div><div class="text-xs" style="color:#999;margin-top:4px">Maks 5 file, 10MB per file. Format: Gambar, PDF, DOC, XLS, PPT, ZIP</div></div>
    <button class="btn btn-primary" onclick="simpanDailyTask()">💾 Simpan</button>`);
}

async function simpanDailyTask() {
  const title = document.getElementById('dtTitle').value.trim();
  const tanggal = document.getElementById('dtDate').value;
  if (!title || !tanggal) return toast('Judul dan tanggal wajib', 'warning');
  // Collect selected users from checkboxes
  var targets = [];
  var selfCb = document.getElementById('dtAssignSelf');
  if (selfCb && selfCb.checked) {
    targets.push({ id: currentUser.id, nama: currentUser.nama });
  }
  var assignCbs = document.querySelectorAll('.dt-assign-cb:checked');
  assignCbs.forEach(function (cb) {
    targets.push({ id: cb.value, nama: cb.getAttribute('data-nama') || '' });
  });
  // Fallback: if nothing selected, assign to self (old dropdown compatibility)
  var oldSelect = document.getElementById('dtAssignUser');
  if (!targets.length && oldSelect) {
    if (oldSelect.value === 'self') {
      targets.push({ id: currentUser.id, nama: currentUser.nama });
    } else {
      var opt = oldSelect.options[oldSelect.selectedIndex];
      targets.push({ id: oldSelect.value, nama: opt.getAttribute('data-nama') || opt.text });
    }
  }
  if (!targets.length) targets.push({ id: currentUser.id, nama: currentUser.nama });
  try {
    const kategoriEl = document.getElementById('dtKategori');
    const attachments = await getFilesAsBase64('dtFiles');
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      var assignedBy = t.id !== currentUser.id ? currentUser.id : '';
      var assignedByName = t.id !== currentUser.id ? currentUser.nama : '';
      await db.collection('hrd_daily_tasks').add({
        title: title,
        description: document.getElementById('dtDesc').value.trim(),
        tanggal: tanggal,
        waktu: document.getElementById('dtTime').value || '',
        priority: document.getElementById('dtPriority').value,
        reminder: document.getElementById('dtReminder').value,
        repeat: document.getElementById('dtRepeat').value || '',
        kategori: kategoriEl ? kategoriEl.value : '',
        attachments: attachments,
        done: false,
        type: 'task',
        userId: t.id,
        targetUserName: t.nama,
        departemen: currentUser.departemen || '',
        ownerLevel: ROLES[currentUser.role] || 0,
        assignedBy: assignedBy,
        assignedByName: assignedByName,
        createdAt: new Date().toISOString(),
      });
      // Notify target user if assigned to someone else
      if (t.id !== currentUser.id) {
        await db.collection('hrd_notifikasi').add({
          targetUser: t.id,
          title: '📋 Task Baru Ditugaskan',
          message: currentUser.nama + ' menugaskan: ' + title,
          read: false,
          type: 'daily-task',
          createdAt: new Date().toISOString(),
        });
      }
    }
    toast('Task ditambahkan untuk ' + targets.length + ' orang', 'success');
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
    <div class="form-group"><label>Deskripsi</label><textarea class="form-control" id="dtEditDesc" rows="4" style="white-space:pre-wrap">${escHtml(task.description || '')}</textarea></div>
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

async function editDailyReport(id) {
  const doc = await db.collection('hrd_daily_tasks').doc(id).get();
  if (!doc.exists) return toast('Data tidak ditemukan', 'warning');
  const t = doc.data();
  const showKategori = !hasAccess(3);
  let catHtml = '';
  if (showKategori) {
    const cats = REPORT_CATEGORIES[(currentUser.departemen || '').toUpperCase().trim()] || [];
    let opts = '<option value="">-- Pilih --</option>';
    cats.forEach((c) => {
      opts += `<option value="${c}" ${t.kategori === c ? 'selected' : ''}>${c}</option>`;
    });
    catHtml = `<div class="form-group"><label>Kategori</label><select class="form-control" id="erKategori">${opts}</select></div>`;
  }
  openModal(
    `<div class="modal-title">✏️ Edit Daily Report</div>
    <div class="grid-2">
      <div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="erTanggal" value="${t.tanggal || ''}"></div>
      ${catHtml}
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Jam Masuk</label><input class="form-control" type="time" id="erJamMasuk" value="${t.jamMasuk || ''}"></div>
      <div class="form-group"><label>Jam Keluar</label><input class="form-control" type="time" id="erJamKeluar" value="${t.jamKeluar || ''}"></div>
    </div>
    <div class="form-group"><label>Aktivitas *</label><textarea class="form-control" id="erAktivitas" rows="3">${escHtml(t.aktivitas || '')}</textarea></div>
    <div class="form-group"><label>Hasil / Output</label><textarea class="form-control" id="erHasil" rows="2">${escHtml(t.hasil || '')}</textarea></div>
    <div class="form-group"><label>Kendala</label><textarea class="form-control" id="erKendala" rows="2">${escHtml(t.kendala || '')}</textarea></div>
    <div class="form-group"><label>Solusi</label><textarea class="form-control" id="erSolusi" rows="2">${escHtml(t.solusi || '')}</textarea></div>
    <div class="form-group"><label>Rencana Besok</label><textarea class="form-control" id="erRencana" rows="2">${escHtml(t.rencana || '')}</textarea></div>
    <div class="grid-2">
      <div class="form-group"><label>Durasi (hari)</label><input class="form-control" type="number" id="erDurasi" value="${t.durasi || 1}" step="0.5"></div>
      <div class="form-group"><label>Progress (%)</label><input class="form-control" type="number" id="erProgress" value="${t.progress || 0}" min="0" max="100"></div>
    </div>
    <button class="btn btn-primary" onclick="updateDailyReport('${id}')">💾 Simpan</button>`,
    true
  );
}

async function updateDailyReport(id) {
  const aktivitas = document.getElementById('erAktivitas').value.trim();
  if (!aktivitas) return toast('Aktivitas wajib', 'warning');
  const updateData = {
    tanggal: document.getElementById('erTanggal').value,
    jamMasuk: document.getElementById('erJamMasuk').value,
    jamKeluar: document.getElementById('erJamKeluar').value,
    aktivitas,
    hasil: document.getElementById('erHasil').value.trim(),
    kendala: document.getElementById('erKendala').value.trim(),
    solusi: document.getElementById('erSolusi').value.trim(),
    rencana: document.getElementById('erRencana').value.trim(),
    durasi: parseFloat(document.getElementById('erDurasi').value) || 0,
    progress: parseInt(document.getElementById('erProgress').value) || 0,
    description: aktivitas,
    title: '📝 Daily Report — ' + formatDate(document.getElementById('erTanggal').value),
    updatedAt: new Date().toISOString(),
  };
  const katEl = document.getElementById('erKategori');
  if (katEl) updateData.kategori = katEl.value;
  await db.collection('hrd_daily_tasks').doc(id).update(updateData);
  closeModalDirect();
  toast('Report diperbarui', 'success');
  await loadDailyTasks(_dailyTaskFilter);
}

// ── FILE UPLOAD HELPERS ───────────────────────────────────────
function previewTaskFiles(input, previewId) {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  const files = Array.from(input.files).slice(0, 5);
  files.forEach((file) => {
    if (file.size > 10 * 1024 * 1024) {
      toast(`File "${file.name}" terlalu besar (maks 10MB)`, 'warning');
      return;
    }
    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = (e) => {
      if (isImage) {
        preview.innerHTML += `<div style="position:relative;display:inline-block" class="file-preview-item"><img src="${e.target.result}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:2px solid var(--border);cursor:pointer" onclick="window.open(this.src,'_blank')"><div style="position:absolute;top:-6px;right:-6px;background:#c62828;color:#fff;border-radius:50%;width:18px;height:18px;font-size:.65rem;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.3)" onclick="this.parentElement.remove()">✕</div><div style="font-size:.55rem;text-align:center;color:#666;margin-top:2px;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(file.name.substring(0, 12))}</div></div>`;
      } else {
        const ext = file.name.split('.').pop().toUpperCase();
        const icon =
          ext === 'PDF'
            ? '📕'
            : ext.includes('DOC')
              ? '📘'
              : ext.includes('XLS')
                ? '📗'
                : ext.includes('PPT')
                  ? '📙'
                  : '📄';
        preview.innerHTML += `<div style="position:relative;display:inline-flex;flex-direction:column;align-items:center;padding:8px 12px;background:#f5f5f5;border-radius:8px;border:1px solid var(--border);min-width:70px" class="file-preview-item"><div style="font-size:1.5rem">${icon}</div><div style="font-size:.55rem;color:#666;margin-top:4px;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(file.name.substring(0, 12))}</div><div style="font-size:.5rem;color:#999">${(file.size / 1024 / 1024).toFixed(1)}MB</div><div style="position:absolute;top:-6px;right:-6px;background:#c62828;color:#fff;border-radius:50%;width:18px;height:18px;font-size:.65rem;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.3)" onclick="this.parentElement.remove()">✕</div></div>`;
      }
    };
    reader.readAsDataURL(file);
  });
}

async function getFilesAsBase64(inputId) {
  const input = document.getElementById(inputId);
  const results = [];
  if (input && input.files && input.files.length) {
    const files = Array.from(input.files).slice(0, 5);
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) continue;
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
      results.push({ name: file.name, type: file.type, size: file.size, data: base64 });
    }
  }
  // Also get camera captures
  const cameraId = inputId.replace('Files', 'CameraData');
  const cameraEl = document.getElementById(cameraId);
  if (cameraEl && cameraEl.value) {
    try {
      const cam = JSON.parse(cameraEl.value);
      cam.forEach((p) => results.push(p));
    } catch (e) {}
  }
  return results.slice(0, 5);
}

function openCamera(previewId, cameraDataId) {
  // Detect mobile (Android/iOS)
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // Mobile: use native camera via file input (most reliable on Android & iOS)
    let camInput = document.getElementById('_mobileCamInput');
    if (!camInput) {
      camInput = document.createElement('input');
      camInput.id = '_mobileCamInput';
      camInput.type = 'file';
      camInput.accept = 'image/*';
      camInput.capture = 'environment';
      camInput.style.display = 'none';
      document.body.appendChild(camInput);
    }
    camInput.onchange = function () {
      const file = camInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        const dataUrl = e.target.result;
        const fileName =
          'foto_' + new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19) + '.jpg';
        // Add to preview
        const preview = document.getElementById(previewId);
        if (preview) {
          preview.innerHTML += `<div style="position:relative;display:inline-block" class="file-preview-item"><img src="${dataUrl}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:2px solid #4caf50;cursor:pointer" onclick="window.open(this.src,'_blank')"><div style="position:absolute;top:-6px;right:-6px;background:#c62828;color:#fff;border-radius:50%;width:18px;height:18px;font-size:.65rem;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.3)" onclick="this.parentElement.remove()">✕</div><div style="font-size:.55rem;text-align:center;color:#4caf50;margin-top:2px">📷 Kamera</div></div>`;
        }
        // Save to hidden camera data
        const cameraEl = document.getElementById(cameraDataId);
        if (cameraEl) {
          let existing = [];
          try {
            existing = JSON.parse(cameraEl.value || '[]');
          } catch (ex) {}
          existing.push({
            name: fileName,
            type: 'image/jpeg',
            size: dataUrl.length,
            data: dataUrl,
          });
          cameraEl.value = JSON.stringify(existing);
        }
        toast('📷 Foto berhasil diambil!', 'success');
      };
      reader.readAsDataURL(file);
      camInput.value = ''; // reset for next use
    };
    camInput.click();
    return;
  }

  // Desktop: use overlay with getUserMedia
  const overlay = document.createElement('div');
  overlay.id = 'cameraOverlay';
  overlay.style.cssText =
    'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.9);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `<div style="width:100%;max-width:500px;text-align:center">
    <video id="cameraVideo" autoplay playsinline muted style="width:100%;border-radius:12px;border:3px solid #fff;background:#000"></video>
    <div style="margin-top:16px;display:flex;gap:12px;justify-content:center">
      <button class="btn btn-primary" onclick="capturePhoto('${previewId}','${cameraDataId}')" style="padding:14px 28px;font-size:1.1rem;border-radius:50px">📸 Ambil Foto</button>
      <button class="btn btn-outline" onclick="stopCamera();document.getElementById('cameraOverlay')?.remove()" style="border-radius:50px;color:#fff;border-color:#fff">✕ Batal</button>
    </div>
    <p class="text-xs mt-8" style="color:#ccc">Izinkan akses kamera.</p>
  </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => {
    const video = document.getElementById('cameraVideo');
    if (!video) return;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      .then((stream) => {
        video.srcObject = stream;
        window._cameraStream = stream;
      })
      .catch(() => {
        navigator.mediaDevices
          .getUserMedia({ video: true })
          .then((stream) => {
            video.srcObject = stream;
            window._cameraStream = stream;
          })
          .catch((err) => {
            toast('Gagal akses kamera: ' + err.message, 'error');
            document.getElementById('cameraOverlay')?.remove();
          });
      });
  }, 300);
}

function capturePhoto(previewId, cameraDataId) {
  const video = document.getElementById('cameraVideo');
  const canvas = document.createElement('canvas');
  if (!video) return;
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  const fileName =
    'foto_' + new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19) + '.jpg';
  stopCamera();
  document.getElementById('cameraOverlay')?.remove();
  // Add to preview
  setTimeout(() => {
    const preview = document.getElementById(previewId);
    if (preview) {
      preview.innerHTML += `<div style="position:relative;display:inline-block" class="file-preview-item"><img src="${dataUrl}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:2px solid #4caf50;cursor:pointer" onclick="window.open(this.src,'_blank')"><div style="position:absolute;top:-6px;right:-6px;background:#c62828;color:#fff;border-radius:50%;width:18px;height:18px;font-size:.65rem;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.3)" onclick="this.parentElement.remove()">✕</div><div style="font-size:.55rem;text-align:center;color:#4caf50;margin-top:2px">📷 Kamera</div></div>`;
    }
    const cameraEl = document.getElementById(cameraDataId);
    if (cameraEl) {
      let existing = [];
      try {
        existing = JSON.parse(cameraEl.value || '[]');
      } catch (e) {}
      existing.push({ name: fileName, type: 'image/jpeg', size: dataUrl.length, data: dataUrl });
      cameraEl.value = JSON.stringify(existing);
    }
    toast('📷 Foto berhasil diambil!', 'success');
  }, 200);
}

function stopCamera() {
  if (window._cameraStream) {
    window._cameraStream.getTracks().forEach((t) => t.stop());
    window._cameraStream = null;
  }
}

function viewEviden(encodedData) {
  try {
    const file = JSON.parse(decodeURIComponent(encodedData));
    const isImage = file.type && file.type.startsWith('image/');
    const isPdf =
      (file.type && file.type === 'application/pdf') ||
      (file.name && file.name.toLowerCase().endsWith('.pdf'));
    let content = '';
    if (isImage) {
      content = `<img src="${file.data}" style="width:100%;max-height:70vh;object-fit:contain;border-radius:8px">`;
    } else if (isPdf) {
      content = `<iframe src="${file.data}" style="width:100%;height:70vh;border:none;border-radius:8px"></iframe>`;
    } else {
      const ext = (file.name || '').split('.').pop().toUpperCase();
      const icon =
        ext === 'PDF'
          ? '📕'
          : ext.match(/DOCX?/)
            ? '📘'
            : ext.match(/XLSX?/)
              ? '📗'
              : ext.match(/PPTX?/)
                ? '📙'
                : '📄';
      content = `<div style="text-align:center;padding:40px"><div style="font-size:4rem;margin-bottom:16px">${icon}</div><div class="fw-700 mb-8" style="font-size:1.1rem">${escHtml(file.name)}</div><p class="text-sm mb-16" style="color:#666">Preview langsung tidak tersedia untuk format ${ext}.</p><div style="display:flex;gap:12px;justify-content:center"><a href="${file.data}" target="_blank" class="btn btn-primary">📂 Buka di Tab Baru</a><a href="${file.data}" download="${escHtml(file.name)}" class="btn btn-outline">⬇️ Download</a></div></div>`;
    }
    openModal(
      `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div class="fw-700" style="font-size:1rem">📎 ${escHtml(file.name || 'Lampiran')}</div><button class="btn btn-xs btn-outline" onclick="closeModalDirect()">✕</button></div>${content}`,
      true
    );
  } catch (e) {
    toast('Gagal membuka file', 'error');
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
  // Kategori only for staff and leader (level 1-2), not manager+
  const showKategori = !hasAccess(3);
  const catHtml = showKategori
    ? `<div class="form-group"><label>Kategori *</label><select class="form-control" id="drKategori">${getReportCategoryOptions()}</select></div>`
    : '<input type="hidden" id="drKategori" value="">';
  openModal(
    `<div class="modal-title">📝 Daily Report</div>
    <p class="text-sm mb-16" style="color:#666">Isi laporan aktivitas harian Anda.</p>
    <div class="grid-2">
      <div class="form-group"><label>Tanggal Laporan *</label><input class="form-control" type="date" id="drTanggal" value="${todayStr()}"></div>
      ${catHtml}
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
    <div class="form-group"><label>📎 Lampiran Eviden</label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><button type="button" class="btn btn-sm btn-outline" onclick="document.getElementById('drFiles').click()">📁 Pilih File</button><button type="button" class="btn btn-sm btn-info" onclick="openCamera('drFilePreview','drCameraData')">📷 Kamera</button></div><input type="file" id="drFiles" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip" onchange="previewTaskFiles(this,'drFilePreview')" style="display:none"><input type="hidden" id="drCameraData"><div id="drFilePreview" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"></div><div class="text-xs" style="color:#999;margin-top:4px">Maks 5 file, 10MB per file. Format: Gambar, PDF, DOC, XLS, PPT, ZIP. Bisa juga foto langsung via kamera.</div></div>
    <button class="btn btn-primary" onclick="simpanDailyReport()">📤 Kirim Daily Report</button>`,
    true
  );
}

async function simpanDailyReport() {
  const tanggal = document.getElementById('drTanggal').value;
  const aktivitas = document.getElementById('drAktivitas').value.trim();
  const kategori = document.getElementById('drKategori').value;
  if (!tanggal || !aktivitas) return toast('Tanggal dan aktivitas wajib diisi', 'warning');
  if (!hasAccess(3) && !kategori) return toast('Kategori wajib dipilih', 'warning');
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
    attachments: [],
    createdAt: new Date().toISOString(),
  };
  // Get file attachments
  data.attachments = await getFilesAsBase64('drFiles');
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
    <div style="background:#f8f9ff;padding:16px;border-radius:8px;margin-bottom:16px;border-left:4px solid var(--primary);cursor:pointer" onclick="viewUserProfile('${escHtml(task.targetUserName || task.nama || currentUser.nama)}')">
      <div class="fw-700" style="color:var(--primary)">${escHtml(task.targetUserName || currentUser.nama)} <span style="font-size:.7rem;color:#999;font-weight:400">👤 klik untuk lihat profil</span></div>
      <div class="text-sm" style="color:#666">📅 ${formatDate(task.tanggal)} | ⏰ ${task.jamMasuk || '-'} - ${task.jamKeluar || '-'}</div>
      <div class="text-sm mt-4">🏢 ${escHtml(task.departemen || '-')} | 📂 ${escHtml(task.kategori || '-')}</div>
      <div class="text-sm mt-4">Progress: <span style="color:${progressColor};font-weight:700">${task.progress || 0}%</span> | Durasi: <b>${task.durasi || '-'} hari</b> | Mood: ${moodLabel}</div>
    </div>
    <div class="mb-16"><div class="fw-700 mb-4" style="color:var(--primary)">📋 Aktivitas</div><div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:12px;font-size:.85rem;white-space:pre-wrap;line-height:1.7">${escHtml(task.aktivitas || task.description || '-')}</div></div>
    ${task.hasil ? `<div class="mb-16"><div class="fw-700 mb-4" style="color:#2e7d32">✅ Hasil / Output</div><div style="background:#f1f8e9;border-radius:8px;padding:12px;font-size:.85rem;white-space:pre-wrap">${escHtml(task.hasil)}</div></div>` : ''}
    ${task.kendala || task.case_desc ? `<div class="mb-16"><div class="fw-700 mb-4" style="color:#c62828">⚠️ Kendala / Case</div><div style="background:#fff8f8;border-radius:8px;padding:12px;font-size:.85rem;white-space:pre-wrap">${escHtml(task.kendala || task.case_desc)}</div></div>` : ''}
    ${task.solusi || task.solution ? `<div class="mb-16"><div class="fw-700 mb-4" style="color:#ff6f00">💡 Solusi / Tindakan</div><div style="background:#fff8e1;border-radius:8px;padding:12px;font-size:.85rem;white-space:pre-wrap">${escHtml(task.solusi || task.solution)}</div></div>` : ''}
    ${task.rencanaBesok || task.rencana || task.planning ? `<div class="mb-16"><div class="fw-700 mb-4" style="color:#1565c0">🌟 Planning & Target / Rencana</div><div style="background:#e3f2fd;border-radius:8px;padding:12px;font-size:.85rem;white-space:pre-wrap">${escHtml(task.rencanaBesok || task.rencana || task.planning)}</div></div>` : ''}
    ${task.komentar || task.komentarAtasan ? `<div class="mb-16"><div class="fw-700 mb-4" style="color:#6a1b9a">💬 Komentar</div><div style="background:#f3e5f5;border-radius:8px;padding:12px;font-size:.85rem;white-space:pre-wrap">${escHtml(task.komentar || task.komentarAtasan)}</div></div>` : ''}
    ${task.komentarRekan ? `<div class="mb-16"><div class="fw-700 mb-4" style="color:#00695c">🤝 Komentar untuk Rekan Kerja</div><div style="background:#e0f2f1;border-radius:8px;padding:12px;font-size:.85rem;white-space:pre-wrap">${escHtml(task.komentarRekan)}</div></div>` : ''}
    ${task.attachments && task.attachments.length ? `<div class="mb-16" style="padding:16px;background:#f8f9ff;border-radius:10px;border:1px solid var(--border)"><div class="fw-700 mb-12" style="color:#37474f">📎 Lampiran Eviden (${task.attachments.length} file)</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px">${task.attachments.map((a, i) => (a.type && a.type.startsWith('image/') ? `<div style="text-align:center;cursor:pointer" onclick="viewEviden('${encodeURIComponent(JSON.stringify({ name: a.name, type: a.type, data: a.data }))}')"><img src="${a.data}" style="width:100%;height:100px;object-fit:cover;border-radius:8px;border:2px solid var(--border)"><div style="font-size:.6rem;color:#666;margin-top:4px">${escHtml(a.name || 'Foto ' + (i + 1))}</div></div>` : `<div style="cursor:pointer;display:flex;flex-direction:column;align-items:center;padding:14px;background:#fff;border-radius:8px;border:1px solid var(--border)" onclick="viewEviden('${encodeURIComponent(JSON.stringify({ name: a.name, type: a.type, data: a.data }))}')"><div style="font-size:2.5rem">${a.name && a.name.endsWith('.pdf') ? '📕' : a.name && a.name.match(/\\.docx?$/) ? '📘' : a.name && a.name.match(/\\.xlsx?$/) ? '📗' : '📄'}</div><div style="font-size:.65rem;color:#333;margin-top:6px;text-align:center;word-break:break-all">${escHtml(a.name)}</div><div style="font-size:.6rem;color:#1565c0;margin-top:4px;font-weight:600">👁️ Lihat</div></div>`)).join('')}</div></div>` : ''}
    <div class="text-xs" style="color:#999">Dikirim: ${formatDateTime(task.createdAt)}</div>`,
    true
  );
}

// ── IMPORT LAPORAN MINGGUAN (dari Spreadsheet) ────────────────────────
function modalImportWeeklyReport() {
  openModal(
    '<div class="modal-title">⬆️ Import Laporan Mingguan</div>' +
      '<p class="text-sm mb-16" style="color:#666">Pilih metode import laporan mingguan:</p>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">' +
      '<div style="flex:1;min-width:200px;padding:16px;border:2px solid var(--border);border-radius:12px;cursor:pointer;text-align:center" onclick="importFromGoogleSheets()" onmouseover="this.style.borderColor=\'#1565c0\';this.style.background=\'#f8f9ff\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.background=\'\'">' +
      '<div style="font-size:2rem;margin-bottom:8px">🌐</div>' +
      '<div class="fw-700">Tarik dari Google Sheets</div>' +
      '<div class="text-xs" style="color:#666;margin-top:4px">Langsung tarik data dari spreadsheet online</div></div>' +
      '<div style="flex:1;min-width:200px;padding:16px;border:2px solid var(--border);border-radius:12px;cursor:pointer;text-align:center" onclick="closeModalDirect();modalImportFromFile()" onmouseover="this.style.borderColor=\'#2e7d32\';this.style.background=\'#f0fff0\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.background=\'\'">' +
      '<div style="font-size:2rem;margin-bottom:8px">📁</div>' +
      '<div class="fw-700">Upload File Excel/CSV</div>' +
      '<div class="text-xs" style="color:#666;margin-top:4px">Upload file .xlsx atau .csv dari komputer</div></div>' +
      '</div>'
  );
}

// Google Sheets config
var GSHEET_ID = '1K_EiWBpjukWXhiEzJAUXgpT6pmZUb3akRmq298T4g3c';
var GSHEET_GID = '329845829';

function importFromGoogleSheets() {
  closeModalDirect();
  openModal(
    '<div class="modal-title">🌐 Import dari Google Sheets</div>' +
      '<div style="margin-bottom:16px">' +
      '<div class="form-group"><label>Spreadsheet ID</label><input class="form-control" id="gsSheetId" value="' +
      GSHEET_ID +
      '" onchange="loadSheetList()"></div>' +
      '<div class="form-group"><label>Pilih Sheet</label><div style="display:flex;gap:8px"><select class="form-control" id="gsSheetSelect"><option value="' +
      GSHEET_GID +
      '">GABUNGAN REPORT (default)</option></select><button class="btn btn-xs btn-info" onclick="loadSheetList()">🔄 Muat Sheet</button></div></div>' +
      '<div class="grid-2">' +
      '<div class="form-group"><label>Filter Divisi</label><select class="form-control" id="gsFilterDivisi"><option value="">Semua Divisi</option>' +
      '<optgroup label="DIVISI AKADEMIK"><option value="SISWA">SISWA</option><option value="TSK-JOB">TSK-JOB</option><option value="SENSEI">SENSEI</option><option value="CURRICULUM">CURRICULUM</option></optgroup>' +
      '<optgroup label="DIVISI MANAJEMEN"><option value="FACILITY\'S">FACILITY\'S</option><option value="FINANCE">FINANCE</option><option value="HR & LEGAL">HR & LEGAL</option><option value="PROMOSI">PROMOSI</option><option value="DOCUMENT">DOCUMENT</option><option value="MARKETING & SALES">MARKETING & SALES</option></optgroup>' +
      '</select></div>' +
      '<div class="form-group"><label>Filter Waktu</label>' +
      '<select class="form-control mb-8" id="gsFilterMode" onchange="toggleGsFilterMode()" style="margin-bottom:8px"><option value="">Tanpa Filter</option><option value="bulan">Bulan Tertentu</option><option value="periode">Periode (Dari - Sampai)</option></select>' +
      '<div id="gsFilterBulanWrap" style="display:none"><input class="form-control" type="month" id="gsFilterBulan"></div>' +
      '<div id="gsFilterPeriodeWrap" style="display:none"><div style="display:flex;gap:6px;align-items:center"><input class="form-control" type="month" id="gsFilterDari" style="flex:1"> <span class="text-sm">s/d</span> <input class="form-control" type="month" id="gsFilterSampai" style="flex:1"></div></div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div id="gsPreview" style="margin-bottom:16px"></div>' +
      '<div style="display:flex;gap:8px">' +
      '<button class="btn btn-info" onclick="pullFromGoogleSheets()">🔄 Tarik Data</button>' +
      '<button class="btn btn-primary" id="gsImportBtn" style="display:none" onclick="submitGSheetImport()">💾 Import ke Sistem</button>' +
      '</div>' +
      '<div class="text-xs mt-8" style="color:#999">⚠️ Spreadsheet harus di-set "Anyone with the link can view"</div>'
  );
  // Auto-load sheet list
  setTimeout(loadSheetList, 500);
}

async function loadSheetList() {
  var sheetId = document.getElementById('gsSheetId').value.trim();
  var selectEl = document.getElementById('gsSheetSelect');
  if (!selectEl || !sheetId) return;
  selectEl.innerHTML = '<option value="">⏳ Memuat daftar sheet...</option>';
  try {
    // Fetch spreadsheet HTML page to extract sheet names and gids
    var resp = await fetch('https://docs.google.com/spreadsheets/d/' + sheetId + '/edit');
    if (!resp.ok) throw new Error('Gagal akses');
    var html = await resp.text();
    // Parse sheet tabs from HTML - look for sheet names in the page
    var sheets = [];
    // Method 1: Extract from gid parameter in page content
    var regex = /gid=(\d+)[^"]*"[^>]*>([^<]+)</g;
    var match;
    while ((match = regex.exec(html)) !== null) {
      sheets.push({ gid: match[1], name: match[2].trim() });
    }
    // Method 2: Try alternate pattern
    if (!sheets.length) {
      var regex2 = /"name":"([^"]+)"[^}]*"sheetId":(\d+)/g;
      while ((match = regex2.exec(html)) !== null) {
        sheets.push({ gid: match[2], name: match[1] });
      }
    }
    // Method 3: Simple fallback - extract from sheet-tab elements
    if (!sheets.length) {
      var regex3 = /sheet-button-text[^>]*>([^<]+)/g;
      var gidRegex = /gid=(\d+)/g;
      var names = [];
      var gids = [];
      while ((match = regex3.exec(html)) !== null) names.push(match[1].trim());
      while ((match = gidRegex.exec(html)) !== null) gids.push(match[1]);
      // Remove duplicate gids
      var uniqueGids = [...new Set(gids)];
      for (var i = 0; i < Math.min(names.length, uniqueGids.length); i++) {
        sheets.push({ gid: uniqueGids[i], name: names[i] });
      }
    }
    if (sheets.length) {
      var opts = '';
      sheets.forEach(function (s) {
        var selected = s.name.toUpperCase().includes('GABUNGAN') ? ' selected' : '';
        opts += '<option value="' + s.gid + '"' + selected + '>' + escHtml(s.name) + '</option>';
      });
      selectEl.innerHTML = opts;
    } else {
      // Fallback: use default
      selectEl.innerHTML =
        '<option value="' +
        GSHEET_GID +
        '">GABUNGAN REPORT (default)</option><option value="0">Sheet1 (gid=0)</option>';
    }
  } catch (e) {
    selectEl.innerHTML = '<option value="' + GSHEET_GID + '">GABUNGAN REPORT (default)</option>';
  }
}

var _gsImportData = [];

function toggleGsFilterMode() {
  var mode = document.getElementById('gsFilterMode').value;
  var bulanWrap = document.getElementById('gsFilterBulanWrap');
  var periodeWrap = document.getElementById('gsFilterPeriodeWrap');
  if (bulanWrap) bulanWrap.style.display = mode === 'bulan' ? 'block' : 'none';
  if (periodeWrap) periodeWrap.style.display = mode === 'periode' ? 'flex' : 'none';
}

// Parse month/year from various formats in spreadsheet data
function _parseMonthFromReport(bulan, tanggal) {
  var src = (bulan || tanggal || '').toString().trim();
  if (!src) return null;
  var monthNames = {
    jan: 1,
    januari: 1,
    january: 1,
    feb: 2,
    februari: 2,
    february: 2,
    mar: 3,
    maret: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    mei: 5,
    jun: 6,
    juni: 6,
    june: 6,
    jul: 7,
    juli: 7,
    july: 7,
    aug: 8,
    agustus: 8,
    august: 8,
    agu: 8,
    sep: 9,
    september: 9,
    okt: 10,
    oktober: 10,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    nop: 11,
    des: 12,
    desember: 12,
    dec: 12,
    december: 12,
  };
  // Try yyyy-MM or yyyy-MM-dd
  var m1 = src.match(/^(\d{4})-(\d{1,2})/);
  if (m1) return { year: parseInt(m1[1]), month: parseInt(m1[2]) };
  // Try dd/MM/yyyy or MM/dd/yyyy
  var m2 = src.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m2) return { year: parseInt(m2[3]), month: parseInt(m2[2]) };
  // Try "Okt 2025", "Oktober 2025", "Oct-25"
  var m3 = src.match(/([a-zA-Z]+)\s*[\/\-]?\s*(\d{2,4})/i);
  if (m3) {
    var mn = monthNames[m3[1].toLowerCase().substring(0, 3)];
    var yr = parseInt(m3[2]);
    if (yr < 100) yr += 2000;
    if (mn && yr) return { year: yr, month: mn };
  }
  // Try "2025 Oktober" or "2025-Okt"
  var m4 = src.match(/(\d{4})\s*[\/\-]?\s*([a-zA-Z]+)/i);
  if (m4) {
    var mn2 = monthNames[m4[2].toLowerCase().substring(0, 3)];
    if (mn2) return { year: parseInt(m4[1]), month: mn2 };
  }
  // Try Excel serial date number
  var num = parseFloat(src);
  if (num > 40000 && num < 60000) {
    var d = new Date((num - 25569) * 86400000);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  // Try just a number as month (1-12)
  if (num >= 1 && num <= 12) return { year: new Date().getFullYear(), month: parseInt(num) };
  return null;
}

async function pullFromGoogleSheets() {
  var sheetId = document.getElementById('gsSheetId').value.trim();
  var gid = document.getElementById('gsSheetSelect').value || GSHEET_GID;
  var filterDivisi = document.getElementById('gsFilterDivisi').value;
  var filterMode = document.getElementById('gsFilterMode').value;
  var filterBulan = document.getElementById('gsFilterBulan')?.value || '';
  var filterDari = document.getElementById('gsFilterDari')?.value || '';
  var filterSampai = document.getElementById('gsFilterSampai')?.value || '';
  var preview = document.getElementById('gsPreview');
  preview.innerHTML =
    '<p class="text-sm" style="color:#999">⏳ Mengambil data dari Google Sheets...</p>';
  try {
    // Use gviz endpoint (no CORS issues) with fallback to export
    var url =
      'https://docs.google.com/spreadsheets/d/' + sheetId + '/gviz/tq?tqx=out:csv&gid=' + gid;
    var response;
    try {
      response = await fetch(url);
      if (!response.ok) throw new Error('gviz failed');
    } catch (e1) {
      url = 'https://docs.google.com/spreadsheets/d/' + sheetId + '/export?format=csv&gid=' + gid;
      response = await fetch(url);
    }
    if (!response.ok)
      throw new Error(
        'Gagal akses spreadsheet (HTTP ' +
          response.status +
          '). Pastikan sharing = Anyone with link.'
      );
    var csvText = await response.text();
    if (!csvText || csvText.includes('<!DOCTYPE html>'))
      throw new Error(
        'Spreadsheet tidak bisa diakses. Pastikan sharing = Anyone with the link can view.'
      );
    var workbook = XLSX.read(csvText, { type: 'string' });
    var sheet = workbook.Sheets[workbook.SheetNames[0]];
    var jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!jsonData.length) {
      preview.innerHTML = '<p class="text-sm" style="color:#c62828">Data kosong.</p>';
      return;
    }
    // Map columns
    _gsImportData = [];
    jsonData.forEach(function (row) {
      var mapped = {
        bulan: String(row['BULAN'] || row['bulan'] || ''),
        tanggal: String(row['TANGGAL'] || row['tanggal'] || ''),
        divisi: String(row['DIVISI'] || row['divisi'] || ''),
        kategori: String(row['KATEGORI'] || row['kategori'] || ''),
        progress: String(row['PROGRESS'] || row['progress'] || ''),
        case_desc: String(row['CASE'] || row['case'] || ''),
        solution: String(row['SOLUTION'] || row['solution'] || ''),
        planning: String(row['PLANNING & TARGET'] || row['PLANNING'] || ''),
        pic: String(row['PIC'] || row['pic'] || ''),
        keterangan: String(row['KETERANGAN'] || row['keterangan'] || ''),
      };
      if (mapped.progress || mapped.case_desc || mapped.planning || mapped.pic) {
        _gsImportData.push(mapped);
      }
    });
    // Apply filters
    if (filterDivisi) {
      _gsImportData = _gsImportData.filter(function (r) {
        var kat = (r.kategori || '').toUpperCase().trim();
        var div = (r.divisi || '').toUpperCase().trim();
        var filt = filterDivisi.toUpperCase().trim();
        return kat === filt || div === filt || kat.includes(filt) || div.includes(filt);
      });
    }
    if (filterMode === 'bulan' && filterBulan) {
      var fYear = filterBulan.split('-')[0];
      var fMonth = parseInt(filterBulan.split('-')[1]);
      _gsImportData = _gsImportData.filter(function (r) {
        var parsed = _parseMonthFromReport(r.bulan, r.tanggal);
        if (!parsed) return false;
        return parsed.year === parseInt(fYear) && parsed.month === fMonth;
      });
    } else if (filterMode === 'periode' && (filterDari || filterSampai)) {
      var dariY = filterDari ? parseInt(filterDari.split('-')[0]) : 0;
      var dariM = filterDari ? parseInt(filterDari.split('-')[1]) : 0;
      var sampaiY = filterSampai ? parseInt(filterSampai.split('-')[0]) : 9999;
      var sampaiM = filterSampai ? parseInt(filterSampai.split('-')[1]) : 12;
      var dariVal = dariY * 100 + dariM;
      var sampaiVal = sampaiY * 100 + sampaiM;
      _gsImportData = _gsImportData.filter(function (r) {
        var parsed = _parseMonthFromReport(r.bulan, r.tanggal);
        if (!parsed) return true; // include if can't parse
        var val = parsed.year * 100 + parsed.month;
        return val >= dariVal && val <= sampaiVal;
      });
    }
    if (!_gsImportData.length) {
      preview.innerHTML =
        '<p class="text-sm" style="color:#f57f17">Tidak ada data yang cocok dengan filter. (Total baris dari spreadsheet: ' +
        jsonData.length +
        ')</p>';
      return;
    }
    // Show preview
    var h =
      '<div class="text-sm fw-700 mb-8">📋 ' + _gsImportData.length + ' baris data ditemukan</div>';
    h +=
      '<div class="table-wrap" style="max-height:220px;overflow-y:auto"><table style="font-size:.75rem"><thead><tr><th>Bulan</th><th>Tgl</th><th>Divisi</th><th>Kategori</th><th>Progress</th><th>PIC</th></tr></thead><tbody>';
    _gsImportData.slice(0, 15).forEach(function (r) {
      h +=
        '<tr><td>' +
        escHtml(r.bulan) +
        '</td><td>' +
        escHtml(r.tanggal) +
        '</td><td>' +
        escHtml(r.divisi) +
        '</td><td>' +
        escHtml(r.kategori) +
        '</td><td>' +
        escHtml((r.progress || '').substring(0, 40)) +
        '</td><td>' +
        escHtml(r.pic) +
        '</td></tr>';
    });
    if (_gsImportData.length > 15)
      h +=
        '<tr><td colspan="6" class="text-center">... ' +
        (_gsImportData.length - 15) +
        ' baris lagi</td></tr>';
    h += '</tbody></table></div>';
    preview.innerHTML = h;
    document.getElementById('gsImportBtn').style.display = 'inline-block';
  } catch (e) {
    preview.innerHTML =
      '<p class="text-sm" style="color:#c62828">❌ ' + escHtml(e.message) + '</p>';
  }
}

async function submitGSheetImport() {
  if (!_gsImportData.length) return toast('Tidak ada data', 'warning');
  if (!confirm('Import ' + _gsImportData.length + ' baris sebagai Daily Report ke sistem?')) return;
  var btn = document.getElementById('gsImportBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Cek duplikat & mengimport...';
  }
  // Load existing imported reports to check duplicates
  var existingKeys = new Set();
  try {
    var existingSnap = await db
      .collection('hrd_daily_tasks')
      .where('source', '==', 'spreadsheet-import')
      .get();
    existingSnap.forEach(function (d) {
      var e = d.data();
      var key =
        (e.tanggal || '') +
        '|' +
        (e.kategori || '') +
        '|' +
        (e.aktivitas || '').substring(0, 50) +
        '|' +
        (e.targetUserName || '');
      existingKeys.add(key.toLowerCase().trim());
    });
  } catch (ex) {}
  var success = 0,
    skipped = 0;
  for (var i = 0; i < _gsImportData.length; i++) {
    var r = _gsImportData[i];
    var tgl = _parseDateToISO(r.tanggal || r.bulan || '') || r.tanggal || '';
    var key =
      tgl +
      '|' +
      (r.kategori || '') +
      '|' +
      (r.progress || '').substring(0, 50) +
      '|' +
      (r.pic || '');
    if (existingKeys.has(key.toLowerCase().trim())) {
      skipped++;
      continue;
    }
    existingKeys.add(key.toLowerCase().trim());
    try {
      await db.collection('hrd_daily_tasks').add({
        title: 'Laporan ' + (r.kategori || r.divisi || 'Mingguan') + ' - ' + (r.pic || ''),
        type: 'report',
        tanggal: tgl,
        aktivitas: r.progress || '',
        kendala: r.case_desc || '',
        solusi: r.solution || '',
        rencanaBesok: r.planning || '',
        komentar: r.keterangan || '',
        kategori: r.kategori || '',
        departemen: _convertDivisi(r.divisi || ''),
        targetUserName: r.pic || '',
        nama: r.pic || '',
        userId: '',
        done: true,
        progress: 100,
        ownerLevel: 0,
        source: 'spreadsheet-import',
        importedBy: currentUser.nama,
        createdAt: new Date().toISOString(),
      });
      success++;
    } catch (e) {}
  }
  toast(
    '✅ ' + success + ' laporan diimport' + (skipped ? ', ' + skipped + ' duplikat dilewati' : ''),
    'success'
  );
  closeModalDirect();
  loadDailyTasks('report');
}

function modalImportFromFile() {
  openModal(
    '<div class="modal-title">⬆️ Import Laporan Mingguan</div>' +
      '<p class="text-sm mb-16" style="color:#666">Upload file Excel (.xlsx) atau CSV dari spreadsheet laporan mingguan. Format kolom: <b>BULAN, TANGGAL, DIVISI, KATEGORI, PROGRESS, CASE, SOLUTION, PLANNING & TARGET, PIC, KETERANGAN</b></p>' +
      '<div class="form-group"><label>Pilih File Spreadsheet</label>' +
      '<input type="file" id="weeklyReportFile" class="form-control" accept=".xlsx,.xls,.csv" onchange="previewWeeklyImport(this)">' +
      '</div>' +
      '<div id="weeklyImportPreview" style="margin-bottom:16px"></div>' +
      '<div id="weeklyImportActions" style="display:none">' +
      '<button class="btn btn-primary" onclick="submitWeeklyImport()">💾 Import ke Sistem</button>' +
      '</div>'
  );
}

var _weeklyImportData = [];

function previewWeeklyImport(input) {
  var file = input.files[0];
  if (!file) return;
  var preview = document.getElementById('weeklyImportPreview');
  var actions = document.getElementById('weeklyImportActions');
  preview.innerHTML = '<p class="text-sm" style="color:#999">Membaca file...</p>';
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var workbook = XLSX.read(e.target.result, { type: 'array' });
      // Try to find sheet "GABUNGAN REPORT" or use first sheet
      var sheetName =
        workbook.SheetNames.find(function (n) {
          return n.toUpperCase().includes('GABUNGAN');
        }) || workbook.SheetNames[0];
      var sheet = workbook.Sheets[sheetName];
      var jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!jsonData.length) {
        preview.innerHTML =
          '<p class="text-sm" style="color:#c62828">File kosong atau format tidak sesuai.</p>';
        return;
      }
      // Map columns (flexible matching)
      _weeklyImportData = [];
      jsonData.forEach(function (row) {
        var mapped = {
          bulan: row['BULAN'] || row['bulan'] || row['Bulan'] || '',
          tanggal: row['TANGGAL'] || row['tanggal'] || row['Tanggal'] || '',
          divisi: row['DIVISI'] || row['divisi'] || row['Divisi'] || '',
          kategori: row['KATEGORI'] || row['kategori'] || row['Kategori'] || '',
          progress: row['PROGRESS'] || row['progress'] || row['Progress'] || '',
          case_desc: row['CASE'] || row['case'] || row['Case'] || '',
          solution: row['SOLUTION'] || row['solution'] || row['Solution'] || '',
          planning:
            row['PLANNING & TARGET'] ||
            row['PLANNING'] ||
            row['planning'] ||
            row['Planning & Target'] ||
            '',
          pic: row['PIC'] || row['pic'] || row['Pic'] || '',
          keterangan: row['KETERANGAN'] || row['keterangan'] || row['Keterangan'] || '',
        };
        // Skip empty rows
        if (mapped.progress || mapped.case_desc || mapped.planning || mapped.pic) {
          _weeklyImportData.push(mapped);
        }
      });
      if (!_weeklyImportData.length) {
        preview.innerHTML =
          '<p class="text-sm" style="color:#c62828">Tidak ada data valid ditemukan.</p>';
        return;
      }
      // Show preview table
      var h =
        '<div class="text-sm fw-700 mb-8">📋 Preview: ' +
        _weeklyImportData.length +
        ' baris dari sheet "' +
        escHtml(sheetName) +
        '"</div>';
      h +=
        '<div class="table-wrap" style="max-height:250px;overflow-y:auto"><table style="font-size:.75rem"><thead><tr><th>Bulan</th><th>Tanggal</th><th>Divisi</th><th>Kategori</th><th>Progress</th><th>PIC</th></tr></thead><tbody>';
      _weeklyImportData.slice(0, 20).forEach(function (r) {
        h +=
          '<tr><td>' +
          escHtml(r.bulan) +
          '</td><td>' +
          escHtml(String(r.tanggal)) +
          '</td><td>' +
          escHtml(r.divisi) +
          '</td><td>' +
          escHtml(r.kategori) +
          '</td><td>' +
          escHtml((r.progress || '').substring(0, 50)) +
          '</td><td>' +
          escHtml(r.pic) +
          '</td></tr>';
      });
      if (_weeklyImportData.length > 20)
        h +=
          '<tr><td colspan="6" class="text-center">... dan ' +
          (_weeklyImportData.length - 20) +
          ' baris lagi</td></tr>';
      h += '</tbody></table></div>';
      preview.innerHTML = h;
      actions.style.display = 'block';
    } catch (err) {
      preview.innerHTML =
        '<p class="text-sm" style="color:#c62828">Gagal membaca file: ' +
        escHtml(err.message) +
        '</p>';
    }
  };
  reader.readAsArrayBuffer(file);
}

async function submitWeeklyImport() {
  if (!_weeklyImportData.length) return toast('Tidak ada data untuk diimport', 'warning');
  if (!confirm('Import ' + _weeklyImportData.length + ' baris laporan mingguan ke sistem?')) return;
  var btn = document.querySelector('#weeklyImportActions button');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Mengimport...';
  }
  var success = 0;
  var failed = 0;
  try {
    for (var i = 0; i < _weeklyImportData.length; i++) {
      var r = _weeklyImportData[i];
      try {
        await db.collection('hrd_weekly_reports').add({
          bulan: r.bulan,
          tanggal: String(r.tanggal),
          divisi: r.divisi,
          kategori: r.kategori,
          progress: r.progress,
          case_desc: r.case_desc,
          solution: r.solution,
          planning: r.planning,
          pic: r.pic,
          keterangan: r.keterangan,
          importedBy: currentUser.nama,
          importedAt: new Date().toISOString(),
          type: 'weekly-report',
        });
        success++;
      } catch (e) {
        failed++;
      }
    }
    toast(
      '✅ Import selesai: ' + success + ' berhasil' + (failed ? ', ' + failed + ' gagal' : ''),
      'success'
    );
    closeModalDirect();
    // Refresh view if on report tab
    if (_dailyTaskFilter === 'team-report' || _dailyTaskFilter === 'all-report') {
      loadDailyTasks(_dailyTaskFilter);
    }
  } catch (e) {
    toast('Gagal import: ' + e.message, 'error');
  }
  if (btn) {
    btn.disabled = false;
    btn.textContent = '💾 Import ke Sistem';
  }
}

// ── DISPLAY LAPORAN MINGGUAN ──────────────────────────────────
var _weeklyReportFilter = 'all';
var _wrDateFrom = '';
var _wrDateTo = '';
async function loadWeeklyReports(divFilter) {
  if (divFilter !== undefined) _weeklyReportFilter = divFilter;
  document.querySelectorAll('#taskTabs .tab').forEach(function (t) {
    t.classList.remove('active');
  });
  document.querySelectorAll('#taskTabs .tab').forEach(function (t) {
    if (t.textContent.trim() === '📈 Laporan Mingguan') t.classList.add('active');
  });
  var listEl = document.getElementById('taskList');
  if (!listEl) return;
  listEl.innerHTML = '<p class="text-sm" style="color:#999">Memuat laporan mingguan...</p>';
  try {
    var items = [];
    var snap = await db
      .collection('hrd_daily_tasks')
      .where('source', '==', 'spreadsheet-import')
      .get();
    snap.forEach(function (d) {
      items.push({ id: d.id, col: 'hrd_daily_tasks', ...d.data() });
    });
    try {
      var snap2 = await db.collection('hrd_weekly_reports').get();
      snap2.forEach(function (d) {
        items.push({ id: d.id, col: 'hrd_weekly_reports', ...d.data() });
      });
    } catch (e2) {}
    items.sort(function (a, b) {
      return (b.tanggal || b.bulan || '').localeCompare(a.tanggal || a.bulan || '');
    });
    if (!items.length) {
      listEl.innerHTML =
        '<div style="text-align:center;padding:32px;color:#999"><div style="font-size:2rem;margin-bottom:8px">📈</div><p>Belum ada laporan mingguan.</p></div>';
      return;
    }
    // Manager/Leader: only see own division. HEAD/Admin see all.
    if (!hasAccess(4)) {
      var myDept = (currentUser.departemen || '').toUpperCase().trim();
      if (myDept) {
        items = items.filter(function (r) {
          var d = (r.departemen || r.divisi || '').toUpperCase().trim();
          return d === myDept || d.includes(myDept) || myDept.includes(d) || !d;
        });
      }
    }
    var filtered = items;
    if (_weeklyReportFilter === 'akademik')
      filtered = items.filter(function (r) {
        var d = (r.departemen || r.divisi || '').toUpperCase();
        return d.includes('ACADEMIC') || d.includes('AKADEMIK');
      });
    else if (_weeklyReportFilter === 'manajemen')
      filtered = items.filter(function (r) {
        var d = (r.departemen || r.divisi || '').toUpperCase();
        return d.includes('OFFICE') || d.includes('MANAJEMEN');
      });
    var filterFrom = document.getElementById('wrDateFrom')?.value || _wrDateFrom;
    var filterTo = document.getElementById('wrDateTo')?.value || _wrDateTo;
    _wrDateFrom = filterFrom;
    _wrDateTo = filterTo;
    if (filterFrom)
      filtered = filtered.filter(function (r) {
        return (r.tanggal || '') >= filterFrom;
      });
    if (filterTo)
      filtered = filtered.filter(function (r) {
        return (r.tanggal || '') <= filterTo;
      });
    // Apply category filter
    if (window._wrCatFilter) {
      filtered = filtered.filter(function (r) {
        var kat = (r.kategori || '').toLowerCase();
        var fv = (window._wrCatFilter || '').toLowerCase();
        if (fv === 'tanpa kategori') return !r.kategori || r.kategori.trim() === '';
        return kat.includes(fv);
      });
    }
    var html = '';
    html +=
      '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">';
    html +=
      '<button class="btn btn-xs ' +
      (_weeklyReportFilter === 'all' ? 'btn-primary' : 'btn-outline') +
      '" onclick="loadWeeklyReports(\'all\')">Semua</button>';
    html +=
      '<button class="btn btn-xs ' +
      (_weeklyReportFilter === 'akademik' ? 'btn-primary' : 'btn-outline') +
      '" onclick="loadWeeklyReports(\'akademik\')">📚 ACADEMIC</button>';
    html +=
      '<button class="btn btn-xs ' +
      (_weeklyReportFilter === 'manajemen' ? 'btn-primary' : 'btn-outline') +
      '" onclick="loadWeeklyReports(\'manajemen\')">🏢 OFFICE</button>';
    // Category filter for weekly reports
    let wrCatOpts = '<option value="">Semua Kategori</option>';
    const wrDiv = _weeklyReportFilter;
    if (wrDiv === 'akademik') {
      ['Siswa', 'Sensei', 'Curriculum', 'TSK-Job', 'Tanpa Kategori'].forEach(function (c) {
        wrCatOpts +=
          '<option value="' +
          c +
          '" ' +
          (window._wrCatFilter === c ? 'selected' : '') +
          '>' +
          c +
          '</option>';
      });
    } else if (wrDiv === 'manajemen') {
      ['HR & Legal', 'Document', "Facility's", 'Finance', 'Marketing & Sales', 'Promosi'].forEach(
        function (c) {
          wrCatOpts +=
            '<option value="' +
            c +
            '" ' +
            (window._wrCatFilter === c ? 'selected' : '') +
            '>' +
            c +
            '</option>';
        }
      );
    } else {
      [
        'Siswa',
        'Sensei',
        'Curriculum',
        'TSK-Job',
        'HR & Legal',
        'Document',
        "Facility's",
        'Finance',
        'Marketing & Sales',
        'Promosi',
        'Tanpa Kategori',
      ].forEach(function (c) {
        wrCatOpts +=
          '<option value="' +
          c +
          '" ' +
          (window._wrCatFilter === c ? 'selected' : '') +
          '>' +
          c +
          '</option>';
      });
    }
    html +=
      '<select class="form-control" style="max-width:180px;padding:4px 8px;font-size:.8rem" onchange="window._wrCatFilter=this.value;loadWeeklyReports()">' +
      wrCatOpts +
      '</select>';
    html += '<span style="margin-left:auto"></span>';
    html +=
      '<button class="btn btn-xs btn-danger" onclick="deleteSelectedWeeklyReports()">🗑️ Hapus Terpilih</button> ';
    html +=
      '<button class="btn btn-xs btn-warning" onclick="resetAllWeeklyReports()">⚠️ Reset Semua</button>';
    html += '</div>';
    html +=
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;padding:8px 12px;background:#f8f9ff;border-radius:8px">';
    html += '<span class="text-sm fw-700">📅 Periode:</span>';
    html +=
      '<input type="date" class="form-control" id="wrDateFrom" value="' +
      filterFrom +
      '" style="max-width:140px;padding:4px 8px;font-size:.82rem" onchange="_wrDateFrom=this.value;loadWeeklyReports()">';
    html += '<span class="text-sm">—</span>';
    html +=
      '<input type="date" class="form-control" id="wrDateTo" value="' +
      filterTo +
      '" style="max-width:140px;padding:4px 8px;font-size:.82rem" onchange="_wrDateTo=this.value;loadWeeklyReports()">';
    if (filterFrom || filterTo)
      html +=
        '<button class="btn btn-xs btn-outline" onclick="_wrDateFrom=\'\';_wrDateTo=\'\';loadWeeklyReports()">✕</button>';
    html += '</div>';
    html +=
      '<div style="margin-bottom:8px"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="wrSelectAll" onchange="document.querySelectorAll(\'.wr-check\').forEach(function(c){c.checked=this.checked}.bind(this))"> <span class="text-sm fw-700">Pilih Semua (' +
      filtered.length +
      ' data)</span></label></div>';
    if (!filtered.length) {
      html +=
        '<div style="text-align:center;padding:24px;color:#999">Tidak ada data untuk filter ini.</div>';
      listEl.innerHTML = html;
      return;
    }
    var groups = {};
    filtered.forEach(function (r) {
      var div = r.departemen || r.divisi || 'Tanpa Divisi';
      if (!groups[div]) groups[div] = [];
      groups[div].push(r);
    });
    Object.keys(groups)
      .sort()
      .forEach(function (div) {
        var rows = groups[div];
        html += '<div style="margin-bottom:20px">';
        html +=
          '<div style="padding:8px 14px;background:#e8eaf6;border-radius:8px;font-weight:700;font-size:.88rem;color:#283593;border-left:4px solid #3f51b5;margin-bottom:8px">🏢 ' +
          escHtml(div) +
          ' (' +
          rows.length +
          ' data)</div>';
        rows.forEach(function (r) {
          var tgl = r.tanggal || r.bulan || '-';
          var kat = r.kategori || '-';
          var aktivitas = r.aktivitas || r.progress || '';
          var kendala = r.kendala || r.case_desc || '';
          var solusi = r.solusi || r.solution || '';
          var rencana = r.rencanaBesok || r.planning || '';
          var pic = r.targetUserName || r.pic || r.nama || '-';
          var komentar = r.komentar || r.keterangan || '';
          html +=
            '<div style="border:1px solid #e0e0e0;border-radius:10px;padding:14px;margin-bottom:10px;background:#fff">';
          html += '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">';
          html +=
            '<input type="checkbox" class="wr-check" value="' +
            r.id +
            '" data-col="' +
            (r.col || 'hrd_daily_tasks') +
            '">';
          html += '<div style="flex:1"><div class="fw-700">' + escHtml(pic) + '</div>';
          html +=
            '<div class="text-xs" style="color:#666">📅 ' +
            escHtml(tgl) +
            ' | 🏢 ' +
            escHtml(div) +
            ' | 🏷️ ' +
            escHtml(kat) +
            '</div></div></div>';
          if (aktivitas)
            html +=
              '<div style="margin-bottom:8px"><div class="text-xs fw-700" style="color:#1565c0">📋 Aktivitas / Progress</div><div style="padding:8px;background:#f8f9ff;border-radius:6px;font-size:.82rem;white-space:pre-wrap;margin-top:4px">' +
              escHtml(aktivitas) +
              '</div></div>';
          if (kendala)
            html +=
              '<div style="margin-bottom:8px"><div class="text-xs fw-700" style="color:#e65100">⚠️ Kendala / Case</div><div style="padding:8px;background:#fff8e1;border-radius:6px;font-size:.82rem;white-space:pre-wrap;margin-top:4px">' +
              escHtml(kendala) +
              '</div></div>';
          if (solusi)
            html +=
              '<div style="margin-bottom:8px"><div class="text-xs fw-700" style="color:#2e7d32">💡 Solusi / Tindakan</div><div style="padding:8px;background:#e8f5e9;border-radius:6px;font-size:.82rem;white-space:pre-wrap;margin-top:4px">' +
              escHtml(solusi) +
              '</div></div>';
          if (rencana)
            html +=
              '<div style="margin-bottom:8px"><div class="text-xs fw-700" style="color:#6a1b9a">🌟 Planning & Target</div><div style="padding:8px;background:#f3e5f5;border-radius:6px;font-size:.82rem;white-space:pre-wrap;margin-top:4px">' +
              escHtml(rencana) +
              '</div></div>';
          if (komentar)
            html +=
              '<div><div class="text-xs fw-700" style="color:#555">💬 Keterangan</div><div style="padding:8px;background:#f5f5f5;border-radius:6px;font-size:.82rem;margin-top:4px">' +
              escHtml(komentar) +
              '</div></div>';
          html += '</div>';
        });
        html += '</div>';
      });
    listEl.innerHTML = html;
  } catch (e) {
    listEl.innerHTML =
      '<p class="text-sm" style="color:#c62828">Gagal memuat: ' + escHtml(e.message) + '</p>';
  }
}
async function deleteSelectedWeeklyReports() {
  var checked = document.querySelectorAll('.wr-check:checked');
  if (!checked.length) return toast('Pilih data yang mau dihapus', 'warning');
  if (!confirm('Hapus ' + checked.length + ' data yang dipilih?')) return;
  for (var i = 0; i < checked.length; i++) {
    try {
      await db
        .collection(checked[i].dataset.col || 'hrd_daily_tasks')
        .doc(checked[i].value)
        .delete();
    } catch (e) {}
  }
  toast('🗑️ ' + checked.length + ' data dihapus', 'success');
  loadWeeklyReports();
}
async function resetAllWeeklyReports() {
  if (!confirm('RESET SEMUA laporan mingguan? Data import dari spreadsheet akan dihapus permanen.'))
    return;
  if (!confirm('Yakin? Tindakan ini TIDAK BISA dibatalkan.')) return;
  var count = 0;
  try {
    var s1 = await db
      .collection('hrd_daily_tasks')
      .where('source', '==', 'spreadsheet-import')
      .get();
    for (var i = 0; i < s1.docs.length; i++) {
      await s1.docs[i].ref.delete();
      count++;
    }
  } catch (e) {}
  try {
    var s2 = await db.collection('hrd_weekly_reports').get();
    for (var j = 0; j < s2.docs.length; j++) {
      await s2.docs[j].ref.delete();
      count++;
    }
  } catch (e) {}
  toast('⚠️ ' + count + ' data dihapus', 'success');
  loadWeeklyReports();
}

// Parse date string to yyyy-MM-dd format
function _parseDateToISO(dateStr) {
  if (!dateStr) return '';
  var s = String(dateStr).trim();
  // Already yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try dd-Mon-yy (e.g. "31-Oct-25")
  var monthNames = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    mei: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    agu: '08',
    sep: '09',
    oct: '10',
    okt: '10',
    nov: '11',
    dec: '12',
    des: '12',
  };
  var m1 = s.match(/^(\d{1,2})[\-\/]([a-zA-Z]+)[\-\/](\d{2,4})$/);
  if (m1) {
    var day = m1[1].padStart(2, '0');
    var mon = monthNames[m1[2].toLowerCase().substring(0, 3)] || '01';
    var yr = m1[3].length === 2 ? '20' + m1[3] : m1[3];
    return yr + '-' + mon + '-' + day;
  }
  // Try dd/MM/yyyy
  var m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m2) return m2[3] + '-' + m2[2].padStart(2, '0') + '-' + m2[1].padStart(2, '0');
  // Try Mon-yy or "Oct 25"
  var m3 = s.match(/^([a-zA-Z]+)\s*[\-\/]?\s*(\d{2,4})$/);
  if (m3) {
    var mon2 = monthNames[m3[1].toLowerCase().substring(0, 3)] || '01';
    var yr2 = m3[2].length === 2 ? '20' + m3[2] : m3[2];
    return yr2 + '-' + mon2 + '-01';
  }
  // Try Excel serial number
  var num = parseFloat(s);
  if (num > 40000 && num < 60000) {
    var d = new Date((num - 25569) * 86400000);
    return d.toISOString().split('T')[0];
  }
  return s;
}

// Convert divisi names from spreadsheet to system format
function _convertDivisi(divisi) {
  var upper = (divisi || '').toUpperCase().trim();
  if (upper.includes('AKADEMIK') || upper.includes('ACADEMIC')) return 'ACADEMIC';
  if (upper.includes('MANAJEMEN') || upper.includes('MANAGEMENT') || upper.includes('OFFICE'))
    return 'OFFICE';
  return divisi || '';
}

// View user profile by name
async function viewUserProfile(nama) {
  if (!nama) return;
  try {
    // Search in hrd_karyawan first
    var kSnap = await db.collection('hrd_karyawan').where('nama', '==', nama).limit(1).get();
    var profile = null;
    if (!kSnap.empty) {
      profile = kSnap.docs[0].data();
    } else {
      // Try hrd_users
      var uSnap = await db.collection('hrd_users').where('nama', '==', nama).limit(1).get();
      if (!uSnap.empty) profile = uSnap.docs[0].data();
    }
    if (!profile) {
      toast('Profil tidak ditemukan untuk: ' + nama, 'warning');
      return;
    }
    var foto = profile.foto || profile.profilePic || '';
    var fotoHtml = foto
      ? '<img src="' +
        foto +
        '" style="width:150px;height:150px;border-radius:50%;object-fit:cover;border:4px solid var(--primary);cursor:pointer;transition:transform .2s" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'" onclick="viewProfilePhoto(this.src)">'
      : '<div style="width:150px;height:150px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:3.5rem;font-weight:700">' +
        escHtml((profile.nama || '?').charAt(0)) +
        '</div>';
    openModal(
      '<div class="modal-title">👤 Profil Karyawan</div>' +
        '<div style="text-align:center;margin-bottom:20px">' +
        fotoHtml +
        '<div class="fw-700" style="font-size:1.2rem;margin-top:12px">' +
        escHtml(profile.nama || nama) +
        '</div>' +
        '<div class="text-sm" style="color:#666">' +
        escHtml(profile.posisi || profile.role || '-') +
        '</div></div>' +
        '<div style="background:#f8f9ff;border-radius:10px;padding:16px;border:1px solid #e0e0e0">' +
        '<table style="width:100%;border-collapse:collapse;font-size:.88rem">' +
        '<tr><td style="padding:8px;font-weight:700;width:140px;color:#555">NIP</td><td style="padding:8px">' +
        escHtml(profile.nip || '-') +
        '</td></tr>' +
        '<tr><td style="padding:8px;font-weight:700;color:#555">Departemen</td><td style="padding:8px">' +
        escHtml(profile.departemen || '-') +
        '</td></tr>' +
        '<tr><td style="padding:8px;font-weight:700;color:#555">Posisi/Jabatan</td><td style="padding:8px">' +
        escHtml(profile.posisi || profile.role || '-') +
        '</td></tr>' +
        '<tr><td style="padding:8px;font-weight:700;color:#555">Status</td><td style="padding:8px"><span class="badge badge-' +
        (profile.status === 'aktif' || profile.status === 'active' ? 'success' : 'warning') +
        '">' +
        escHtml(profile.status || 'aktif') +
        '</span></td></tr>' +
        '<tr><td style="padding:8px;font-weight:700;color:#555">Email</td><td style="padding:8px">' +
        escHtml(profile.email || '-') +
        '</td></tr>' +
        '<tr><td style="padding:8px;font-weight:700;color:#555">No. HP</td><td style="padding:8px">' +
        escHtml(profile.noHp || profile.telepon || '-') +
        '</td></tr>' +
        '<tr><td style="padding:8px;font-weight:700;color:#555">Alamat</td><td style="padding:8px">' +
        escHtml(profile.alamat || '-') +
        '</td></tr>' +
        '<tr><td style="padding:8px;font-weight:700;color:#555">Tanggal Masuk</td><td style="padding:8px">' +
        escHtml(profile.tanggalMasuk || profile.joinDate || '-') +
        '</td></tr>' +
        '<tr><td style="padding:8px;font-weight:700;color:#555">Atasan</td><td style="padding:8px">' +
        escHtml(profile.atasan || '-') +
        '</td></tr>' +
        '<tr><td style="padding:8px;font-weight:700;color:#555">Grade</td><td style="padding:8px">' +
        escHtml(profile.gradeJabatan || '-') +
        '</td></tr>' +
        '</table></div>' +
        '<div style="margin-top:16px;text-align:right"><button class="btn btn-outline" onclick="closeModalDirect()">Tutup</button></div>'
    );
  } catch (e) {
    toast('Gagal memuat profil: ' + e.message, 'error');
  }
}

// Full-screen photo viewer (WhatsApp style)
function viewProfilePhoto(src) {
  if (!src) return;
  var overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.95);z-index:999999;display:flex;align-items:center;justify-content:center;flex-direction:column';
  overlay.onclick = function (e) {
    if (e.target === overlay || e.target.tagName === 'DIV') overlay.remove();
  };
  overlay.innerHTML =
    '<div style="position:absolute;top:16px;right:20px;color:#fff;font-size:2rem;cursor:pointer" onclick="this.parentElement.remove()">✕</div>' +
    '<img src="' +
    src +
    '" style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:4px;image-rendering:auto">' +
    '<div style="color:rgba(255,255,255,.5);margin-top:12px;font-size:.8rem">Klik ✕ atau area gelap untuk menutup</div>';
  document.body.appendChild(overlay);
}
