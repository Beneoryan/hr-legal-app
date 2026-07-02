'use strict';
// ── LAPORAN KEUANGAN ──────────────────────────────────────────
function renderLaporanKeuangan() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>📊 Laporan Keuangan</span></div>
    <div class="card" style="border-left:4px solid #2e7d32">
      <div class="card-title mb-12">💰 Portal Laporan Keuangan IJEF</div>
      <p class="text-sm mb-16" style="color:#666;line-height:1.6">Akses portal laporan keuangan perusahaan. Data keuangan terintegrasi langsung dengan akun Anda.</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <a href="https://laporankeuanganijef.netlify.app/" target="_blank" class="btn btn-sm" style="background:#2e7d32;color:#fff;text-decoration:none;display:inline-flex;align-items:center;gap:6px;padding:10px 20px;font-size:.9rem">📊 Buka Laporan Keuangan</a>
      </div>
      <div style="margin-top:20px;padding:14px;background:#f0f7f0;border-radius:8px">
        <div class="fw-700 mb-8" style="font-size:.85rem">ℹ️ Informasi</div>
        <div class="text-xs" style="line-height:1.8;color:#555">
          • Portal ini menampilkan data laporan keuangan perusahaan secara real-time<br>
          • Akses menggunakan kredensial yang sama dengan akun IMS Anda<br>
          • Data bersifat rahasia — hanya bisa diakses oleh user yang berwenang
        </div>
      </div>
    </div>`;
}

// ── KPI ───────────────────────────────────────────────────────
function clampScore(v) {
  return Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
}
function normalizePeriodeKPI(periode) {
  return (periode || monthStr()).slice(0, 7);
}
function pickLatestByDate(items, periodKey) {
  if (!items.length) return null;
  const filtered = periodKey
    ? items.filter((x) => (x.evaluasiPeriode || x.periode || x.tanggalTes || '').startsWith(periodKey))
    : items;
  const src = filtered.length ? filtered : items;
  src.sort((a, b) =>
    (b.createdAt || b.updatedAt || b.tanggalTes || '').localeCompare(
      a.createdAt || a.updatedAt || a.tanggalTes || ''
    )
  );
  return src[0] || null;
}
async function hitungKPIIntegrasi(nama, periode) {
  const namaLower = (nama || '').toLowerCase().trim();
  const periodKey = normalizePeriodeKPI(periode);
  const [karySnap, jobdeskSnap, absenSnap, penSnap, discSnap] = await Promise.all([
    db.collection('hrd_karyawan').where('status', '==', 'aktif').get(),
    db.collection('hrd_jobdesk').get(),
    db.collection('hrd_absensi').get(),
    db.collection('hrd_penalty').get(),
    db.collection('hrd_disc_results').get(),
  ]);
  let karyawanId = '';
  karySnap.forEach((d) => {
    const k = d.data() || {};
    if ((k.nama || '').toLowerCase().trim() === namaLower && !karyawanId) karyawanId = d.id;
  });
  let jobdeskData = null;
  jobdeskSnap.forEach((d) => {
    const jd = d.data() || {};
    const idMatch = karyawanId && (jd.karyawanId === karyawanId || jd.userId === karyawanId);
    if (idMatch && !jobdeskData) jobdeskData = jd;
  });
  const bidangJobdesk = ['deskripsi', 'tanggungJawab', 'kualifikasi', 'kpi'];
  const filledJobdesk = jobdeskData
    ? bidangJobdesk.filter((key) => (jobdeskData[key] || '').toString().trim()).length
    : 0;
  const jobdeskScore = clampScore(jobdeskData ? 50 + (filledJobdesk / bidangJobdesk.length) * 50 : 50);
  const masukPeriode = [];
  const hariMasuk = new Set();
  let countTerlambat = 0;
  let countTepat = 0;
  absenSnap.forEach((d) => {
    const a = d.data() || {};
    const isNama = (a.nama || '').toLowerCase().trim() === namaLower;
    const isId = karyawanId && a.userId === karyawanId;
    if (!(isNama || isId)) return;
    if (a.tipe !== 'masuk') return;
    if (!(a.tanggal || '').startsWith(periodKey)) return;
    masukPeriode.push(a);
    hariMasuk.add(a.tanggal);
    if ((a.status || '').toLowerCase() === 'terlambat') countTerlambat++;
    else countTepat++;
  });
  const totalHariMasuk = hariMasuk.size;
  const totalEventMasuk = masukPeriode.length;
  const ketepatanMasuk = totalEventMasuk ? (countTepat / totalEventMasuk) * 100 : 0;
  const kehadiranBulanan = Math.min(100, (totalHariMasuk / 22) * 100);
  const absensiScore = clampScore(
    totalEventMasuk ? ketepatanMasuk * 0.6 + kehadiranBulanan * 0.4 : 75
  );
  let totalPenaltyPoin = 0;
  penSnap.forEach((d) => {
    const pe = d.data() || {};
    if ((pe.nama || '').toLowerCase().trim() === namaLower) totalPenaltyPoin += parseInt(pe.poin) || 0;
  });
  const discItems = [];
  discSnap.forEach((d) => {
    const r = d.data() || {};
    if ((r.nama || '').toLowerCase().trim() === namaLower) discItems.push(r);
  });
  const latestDisc = pickLatestByDate(discItems, periodKey);
  const userScore = clampScore(latestDisc?.kpiScore != null ? latestDisc.kpiScore : 80);
  const produktivitas = clampScore(jobdeskScore * 0.6 + userScore * 0.4);
  const kualitas = clampScore(jobdeskScore * 0.5 + userScore * 0.5);
  const kedisiplinan = clampScore(absensiScore);
  const kerjasama = clampScore(userScore);
  const skorMurni = clampScore((produktivitas + kualitas + kedisiplinan + kerjasama) / 4);
  const penaltyDeduction = totalPenaltyPoin * 2;
  const skorAkhir = Math.max(0, skorMurni - penaltyDeduction);
  return {
    periodKey,
    karyawanId,
    jobdeskData,
    jobdeskScore,
    absensiScore,
    absensiSummary: { totalHariMasuk, totalEventMasuk, countTerlambat, countTepat },
    userScore,
    discSource: latestDisc
      ? latestDisc.evaluasiPeriode || latestDisc.tanggalTes || latestDisc.createdAt || '-'
      : '-',
    produktivitas,
    kualitas,
    kedisiplinan,
    kerjasama,
    skorMurni,
    totalPenaltyPoin,
    penaltyDeduction,
    skorAkhir,
  };
}
async function renderKPI() {
  const main = document.getElementById('mainContent');
  const isBOD = currentUser.role === 'bod';
  main.innerHTML = `<div class="page-title"><span>📈 KPI & Penilaian</span>${!isBOD ? '<button class="btn btn-primary btn-sm" onclick="modalKPI()">+ Tambah</button>' : '<button class="btn btn-primary btn-sm" onclick="modalKPI()">+ Nilai HEAD</button>'}</div><div style="margin-bottom:12px">${!isBOD ? '<button type="button" class="btn btn-sm btn-info" onclick="document.getElementById(\'kpiInfoPanelAdmin\').style.display=document.getElementById(\'kpiInfoPanelAdmin\').style.display===\'none\'?\'block\':\'none\'">ℹ️ Info Formula KPI</button> <button type="button" class="btn btn-sm btn-warning" onclick="sinkronPenaltyKPI()">🔄 Sinkron Penalty</button>' : ''}<div id="kpiInfoPanelAdmin" style="display:none;margin-top:12px;padding:12px;background:#f0f4ff;border-radius:8px;font-size:.82rem;line-height:1.6"><strong>Metode Penilaian Terintegrasi:</strong><br>• Sumber data: Jobdesk, Absensi, Penalty, dan penilaian user (DISC)<br>• Nilai komponen dibentuk dari data terintegrasi lalu bisa disesuaikan penilai<br>• Skor Murni = Rata-rata Produktivitas, Kualitas, Kedisiplinan, Kerjasama<br>• Setiap 1 penalty point mengurangi skor akhir sebesar 2 poin<br>• <strong>Skor Akhir = Skor Murni - (Total Penalty x 2)</strong><br><br><strong>Grade:</strong> A (≥90) | B (≥80) | C (≥70) | D (≥60) | E (&lt;60)</div></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Periode</th><th>Skor Murni</th><th>Penalty</th><th>Skor Akhir</th><th>Grade</th><th>Penilai</th>${!isBOD ? '<th>Aksi</th>' : ''}</tr></thead><tbody id="tblKPI"></tbody></table></div></div>`;
  const [snap, penSnap, karySnap] = await Promise.all([
    db.collection('hrd_kpi').get(),
    db.collection('hrd_penalty').get(),
    db.collection('hrd_karyawan').where('status', '==', 'aktif').get(),
  ]);
  const penaltyMap = {};
  penSnap.forEach((d) => {
    const pe = d.data();
    const nm = (pe.nama || '').toLowerCase().trim();
    penaltyMap[nm] = (penaltyMap[nm] || 0) + (parseInt(pe.poin) || 0);
  }); // Build set of active karyawan names (exclude calon/kandidat)
  const karyawanNames = new Set();
  karySnap.forEach((d) => {
    const k = d.data();
    karyawanNames.add((k.nama || '').toLowerCase().trim());
  });
  let h = '';
  const kpiItems = [];
  snap.forEach((d) => {
    const p = d.data();
    const namaLower = (p.nama || '').toLowerCase().trim();
    if (karyawanNames.has(namaLower)) kpiItems.push({ id: d.id, ...p });
  });
  if (!kpiItems.length)
    h = `<tr><td colspan="${currentUser.role === 'admin' ? 8 : 7}" class="text-center">Belum ada</td></tr>`;
  else
    kpiItems.forEach((p) => {
      const skorMurni = p.skorMurni != null ? p.skorMurni : p.skor;
      const livePenaltyPoin = penaltyMap[(p.nama || '').toLowerCase().trim()] || 0;
      const liveDed = livePenaltyPoin * 2;
      const liveSkor = Math.max(0, skorMurni - liveDed);
      const grade =
        liveSkor >= 90
          ? 'A'
          : liveSkor >= 80
            ? 'B'
            : liveSkor >= 70
              ? 'C'
              : liveSkor >= 60
                ? 'D'
                : 'E';
      h += `<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.periode)}</td><td>${skorMurni}/100</td><td>${liveDed > 0 ? '<span class="badge badge-danger">-' + liveDed + '</span>' : '<span class="badge badge-success">0</span>'}</td><td><span class="badge badge-${liveSkor >= 80 ? 'success' : liveSkor >= 60 ? 'warning' : 'danger'}">${liveSkor}/100</span></td><td class="fw-700">${grade}</td><td>${escHtml(p.penilai || '-')}</td>${currentUser.role === 'admin' ? `<td><button class="btn btn-xs btn-primary" onclick="editKPI('${p.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusKPI('${p.id}')">🗑️</button></td>` : currentUser.role !== 'bod' ? `<td><button class="btn btn-xs btn-primary" onclick="editKPI('${p.id}')">✏️</button></td>` : ''}</tr>`;
    });
  document.getElementById('tblKPI').innerHTML = h;
}
function sinkronPenaltyKPI() {
  toast('Menyinkronkan data penalty...', 'info');
  renderKPI()
    .then(() => {
      toast('✅ Data penalty berhasil disinkronkan!', 'success');
    })
    .catch((e) => {
      toast('Gagal sinkron: ' + e.message, 'error');
    });
}
async function modalKPI() {
  const kSnap = await db.collection('hrd_karyawan').where('status', '==', 'aktif').get();
  let opts = '<option value="">-- Pilih Karyawan --</option>';
  kSnap.forEach((d) => {
    const k = d.data();
    opts += `<option value="${escHtml(k.nama)}">${escHtml(k.nama)} — ${escHtml(k.departemen || '-')}</option>`;
  });
  openModal(
    `<div class="modal-title">Tambah Penilaian KPI</div><div class="grid-2"><div class="form-group"><label>Karyawan</label><select class="form-control" id="kpiNama" onchange="kpiLoadIntegratedPreview()">${opts}</select></div><div class="form-group"><label>Periode</label><input class="form-control" id="kpiPeriode" value="${monthStr()}" onchange="kpiLoadIntegratedPreview()"></div></div><div id="kpiIntegratedPreview" style="margin-bottom:12px"></div><div class="grid-2"><div class="form-group"><label>Produktivitas (0-100)</label><input class="form-control" type="number" id="kpiProd" value="80"></div><div class="form-group"><label>Kualitas (0-100)</label><input class="form-control" type="number" id="kpiQual" value="80"></div></div><div class="grid-2"><div class="form-group"><label>Kedisiplinan (0-100)</label><input class="form-control" type="number" id="kpiDisc" value="80"></div><div class="form-group"><label>Kerjasama (0-100)</label><input class="form-control" type="number" id="kpiTeam" value="80"></div></div><div class="form-group"><label>Catatan</label><textarea class="form-control" id="kpiNote"></textarea></div><div class="flex gap-8 mb-12"><button type="button" class="btn btn-info btn-sm" onclick="kpiLoadIntegratedPreview()">🔄 Hitung Otomatis Terintegrasi</button></div><button class="btn btn-primary" onclick="simpanKPI()">Simpan</button><div style="margin-top:16px"><button type="button" class="btn btn-sm btn-info" onclick="document.getElementById('kpiInfoPanel').style.display=document.getElementById('kpiInfoPanel').style.display==='none'?'block':'none'">ℹ️ Info Faktor Penilaian</button><div id="kpiInfoPanel" style="display:none;margin-top:12px;padding:12px;background:#f0f4ff;border-radius:8px;font-size:.82rem;line-height:1.6"><strong>Formula Penilaian KPI:</strong><br>• Nilai diambil dari integrasi Jobdesk, Absensi, Penalty, dan penilaian user (DISC)<br>• Penilai dapat menyesuaikan nilai sebelum simpan<br>• Skor Murni = Rata-rata 4 komponen<br>• Setiap 1 penalty point mengurangi skor akhir sebesar 2 poin<br>• <strong>Skor Akhir = Skor Murni - (Total Penalty x 2)</strong><br><br><strong>Grade:</strong> A (≥90) | B (≥80) | C (≥70) | D (≥60) | E (&lt;60)</div></div>`
  );
}
async function kpiLoadIntegratedPreview() {
  const nama = document.getElementById('kpiNama').value;
  const periode = document.getElementById('kpiPeriode').value;
  const preview = document.getElementById('kpiIntegratedPreview');
  if (!nama) {
    preview.innerHTML = '';
    return;
  }
  const hasil = await hitungKPIIntegrasi(nama, periode);
  document.getElementById('kpiProd').value = hasil.produktivitas;
  document.getElementById('kpiQual').value = hasil.kualitas;
  document.getElementById('kpiDisc').value = hasil.kedisiplinan;
  document.getElementById('kpiTeam').value = hasil.kerjasama;
  preview.innerHTML = `<div style="padding:10px;background:#f0f7ff;border-radius:8px;font-size:.82rem;line-height:1.65">
    <div class="fw-700 mb-6">📊 Rekomendasi nilai terintegrasi — ${escHtml(nama)} (${escHtml(
      hasil.periodKey
    )})</div>
    <div>• Jobdesk: <b>${hasil.jobdeskScore}</b> (kelengkapan: ${hasil.jobdeskData ? 'tersedia' : 'belum ada'})</div>
    <div>• Absensi: <b>${hasil.absensiScore}</b> (hari masuk: ${hasil.absensiSummary.totalHariMasuk}, terlambat: ${hasil.absensiSummary.countTerlambat})</div>
    <div>• Penilaian user/DISC: <b>${hasil.userScore}</b> (sumber: ${escHtml(hasil.discSource)})</div>
    <div>• Penalty: <span class="badge badge-${hasil.totalPenaltyPoin > 0 ? 'danger' : 'success'}">${hasil.totalPenaltyPoin} poin</span> → Potongan <b>-${hasil.penaltyDeduction}</b></div>
    <hr style="margin:8px 0;border-color:#d7e3ff">
    <div>Rekomendasi komponen: Produktivitas <b>${hasil.produktivitas}</b>, Kualitas <b>${hasil.kualitas}</b>, Kedisiplinan <b>${hasil.kedisiplinan}</b>, Kerjasama <b>${hasil.kerjasama}</b></div>
    <div>Skor murni estimasi: <b>${hasil.skorMurni}</b> | Skor akhir estimasi: <b>${hasil.skorAkhir}</b></div>
  </div>`;
}
async function simpanKPI() {
  const nama = document.getElementById('kpiNama').value;
  if (!nama) return toast('Pilih karyawan', 'warning');
  const periode = document.getElementById('kpiPeriode').value;
  const prod = Number(document.getElementById('kpiProd').value) || 0,
    qual = Number(document.getElementById('kpiQual').value) || 0,
    disc = Number(document.getElementById('kpiDisc').value) || 0,
    team = Number(document.getElementById('kpiTeam').value) || 0;
  const skorMurni = clampScore((prod + qual + disc + team) / 4);
  const hasilIntegrasi = await hitungKPIIntegrasi(nama, periode);
  const totalPenaltyPoin = hasilIntegrasi.totalPenaltyPoin;
  const penaltyDeduction = hasilIntegrasi.penaltyDeduction;
  const skor = Math.max(0, skorMurni - penaltyDeduction);
  await db.collection('hrd_kpi').add({
    nama,
    periode,
    karyawanId: hasilIntegrasi.karyawanId || '',
    produktivitas: prod,
    kualitas: qual,
    kedisiplinan: disc,
    kerjasama: team,
    skorMurni,
    totalPenaltyPoin,
    penaltyDeduction,
    skor,
    catatan: document.getElementById('kpiNote').value,
    penilai: currentUser.nama,
    metodePenilaian: 'integrated_v1',
    sumberPenilaian: {
      periodeReferensi: hasilIntegrasi.periodKey,
      jobdeskScore: hasilIntegrasi.jobdeskScore,
      absensiScore: hasilIntegrasi.absensiScore,
      userScore: hasilIntegrasi.userScore,
      penaltyPoin: hasilIntegrasi.totalPenaltyPoin,
      discSource: hasilIntegrasi.discSource,
    },
    createdAt: new Date().toISOString(),
  });
  closeModalDirect();
  toast('KPI disimpan', 'success');
  renderKPI();
}

async function editKPI(id) {
  const doc = await db.collection('hrd_kpi').doc(id).get();
  if (!doc.exists) return toast('Data tidak ditemukan', 'warning');
  const p = doc.data();
  openModal(`<div class="modal-title">✏️ Edit KPI - ${escHtml(p.nama || '')}</div>
    <div class="grid-2">
      <div class="form-group"><label>Karyawan</label><input class="form-control" id="editKpiNama" value="${escHtml(p.nama || '')}" readonly style="background:#f0f0f0"></div>
      <div class="form-group"><label>Periode</label><input class="form-control" id="editKpiPeriode" value="${escHtml(p.periode || '')}"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Produktivitas (0-100)</label><input class="form-control" type="number" id="editKpiProd" value="${p.produktivitas || 80}"></div>
      <div class="form-group"><label>Kualitas (0-100)</label><input class="form-control" type="number" id="editKpiQual" value="${p.kualitas || 80}"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Kedisiplinan (0-100)</label><input class="form-control" type="number" id="editKpiDisc" value="${p.kedisiplinan || 80}"></div>
      <div class="form-group"><label>Kerjasama (0-100)</label><input class="form-control" type="number" id="editKpiTeam" value="${p.kerjasama || 80}"></div>
    </div>
    <div class="form-group"><label>Catatan</label><textarea class="form-control" id="editKpiNote">${escHtml(p.catatan || '')}</textarea></div>
    <button class="btn btn-primary" onclick="updateKPI('${id}')">💾 Simpan Perubahan</button>`);
}

async function updateKPI(id) {
  const doc = await db.collection('hrd_kpi').doc(id).get();
  const existing = doc.data() || {};
  const nama = existing.nama || '';
  const periode = document.getElementById('editKpiPeriode').value;
  const prod = Number(document.getElementById('editKpiProd').value) || 0;
  const qual = Number(document.getElementById('editKpiQual').value) || 0;
  const disc = Number(document.getElementById('editKpiDisc').value) || 0;
  const team = Number(document.getElementById('editKpiTeam').value) || 0;
  const skorMurni = clampScore((prod + qual + disc + team) / 4);
  const hasilIntegrasi = await hitungKPIIntegrasi(nama, periode);
  const totalPenaltyPoin = hasilIntegrasi.totalPenaltyPoin;
  const penaltyDeduction = hasilIntegrasi.penaltyDeduction;
  const skor = Math.max(0, skorMurni - penaltyDeduction);
  await db
    .collection('hrd_kpi')
    .doc(id)
    .update({
      periode,
      produktivitas: prod,
      kualitas: qual,
      kedisiplinan: disc,
      kerjasama: team,
      skorMurni,
      totalPenaltyPoin,
      penaltyDeduction,
      skor,
      catatan: document.getElementById('editKpiNote').value,
      metodePenilaian: 'integrated_v1',
      sumberPenilaian: {
        periodeReferensi: hasilIntegrasi.periodKey,
        jobdeskScore: hasilIntegrasi.jobdeskScore,
        absensiScore: hasilIntegrasi.absensiScore,
        userScore: hasilIntegrasi.userScore,
        penaltyPoin: hasilIntegrasi.totalPenaltyPoin,
        discSource: hasilIntegrasi.discSource,
      },
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.nama,
    });
  closeModalDirect();
  toast('KPI diperbarui', 'success');
  renderKPI();
}

async function hapusKPI(id) {
  if (!confirm('Hapus data KPI ini? Tindakan ini tidak bisa dibatalkan.')) return;
  await db.collection('hrd_kpi').doc(id).delete();
  toast('Data KPI dihapus', 'success');
  renderKPI();
}

// ── PELATIHAN ─────────────────────────────────────────────────
async function renderPelatihan() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>🎓 Pelatihan & Sertifikasi</span><button class="btn btn-primary btn-sm" onclick="modalPelatihan()">+ Tambah</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Judul</th><th>Jenis</th><th>Tanggal</th><th>Peserta</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblPelatihan"></tbody></table></div></div>`;
  const snap = await db.collection('hrd_pelatihan').get();
  let h = '';
  if (snap.empty) h = '<tr><td colspan="6" class="text-center">Belum ada</td></tr>';
  else
    snap.forEach((d) => {
      const p = d.data();
      h += `<tr><td class="fw-700">${escHtml(p.judul)}</td><td>${escHtml(p.jenis)}</td><td>${formatDate(p.tanggal)}</td><td>${(p.peserta || []).length}</td><td><span class="badge badge-${p.status === 'selesai' ? 'success' : 'info'}">${p.status || 'terjadwal'}</span></td><td><button class="btn btn-xs btn-info" onclick="viewPelatihan('${d.id}')" title="Lihat Detail">👁️</button> <button class="btn btn-xs btn-warning" onclick="modalPelatihan('${d.id}')" title="Edit">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusPelatihan('${d.id}')" title="Hapus">🗑️</button></td></tr>`;
    });
  document.getElementById('tblPelatihan').innerHTML = h;
}
function viewPelatihan(id) {
  db.collection('hrd_pelatihan')
    .doc(id)
    .get()
    .then(function (d) {
      if (!d.exists) return toast('Data tidak ditemukan', 'warning');
      const p = d.data();
      const pesertaList = (p.peserta || []).length
        ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">' +
          (p.peserta || [])
            .map(function (nama) {
              return '<span style="padding:4px 10px;background:#e3f2fd;border-radius:6px;font-size:.78rem">' + escHtml(nama) + '</span>';
            })
            .join('') +
          '</div>'
        : '<span style="color:#999">Belum ada peserta</span>';
      openModal(
        '<div class="modal-title">🎓 Detail Pelatihan</div>' +
          '<table style="width:100%;border-collapse:collapse">' +
          '<tr><td class="fw-700" style="padding:8px;width:120px;vertical-align:top">Judul</td><td style="padding:8px">' + escHtml(p.judul || '-') + '</td></tr>' +
          '<tr><td class="fw-700" style="padding:8px;vertical-align:top">Jenis</td><td style="padding:8px"><span class="badge badge-info">' + escHtml(p.jenis || '-') + '</span></td></tr>' +
          '<tr><td class="fw-700" style="padding:8px;vertical-align:top">Tanggal</td><td style="padding:8px">' + formatDate(p.tanggal) + '</td></tr>' +
          '<tr><td class="fw-700" style="padding:8px;vertical-align:top">Status</td><td style="padding:8px"><span class="badge badge-' + (p.status === 'selesai' ? 'success' : 'warning') + '">' + escHtml(p.status || 'terjadwal') + '</span></td></tr>' +
          '<tr><td class="fw-700" style="padding:8px;vertical-align:top">Peserta (' + (p.peserta || []).length + ')</td><td style="padding:8px">' + pesertaList + '</td></tr>' +
          (p.createdAt ? '<tr><td class="fw-700" style="padding:8px;vertical-align:top">Dibuat</td><td style="padding:8px">' + formatDateTime(p.createdAt) + '</td></tr>' : '') +
          (p.updatedAt ? '<tr><td class="fw-700" style="padding:8px;vertical-align:top">Diupdate</td><td style="padding:8px">' + formatDateTime(p.updatedAt) + '</td></tr>' : '') +
          '</table>' +
          '<div style="margin-top:16px;display:flex;gap:8px">' +
          '<button class="btn btn-warning btn-sm" onclick="closeModalDirect();modalPelatihan(\'' + id + '\')">✏️ Edit</button>' +
          '<button class="btn btn-danger btn-sm" onclick="closeModalDirect();hapusPelatihan(\'' + id + '\')">🗑️ Hapus</button>' +
          '<button class="btn btn-outline btn-sm" onclick="closeModalDirect()">Tutup</button>' +
          '</div>',
        true
      );
    });
}
async function hapusPelatihan(id) {
  if (!confirm('Yakin hapus pelatihan ini?')) return;
  await db.collection('hrd_pelatihan').doc(id).delete();
  toast('Pelatihan dihapus', 'success');
  renderPelatihan();
}
function modalPelatihan(id) {
  if (id)
    db.collection('hrd_pelatihan')
      .doc(id)
      .get()
      .then((d) => showPelForm(id, d.data() || {}));
  else showPelForm(null, {});
}
function showPelForm(id, p) {
  openModal(
    `<div class="modal-title">${id ? 'Edit' : 'Tambah'} Pelatihan</div><div class="form-group"><label>Judul</label><input class="form-control" id="pelJudul" value="${escHtml(p.judul || '')}"></div><div class="grid-2"><div class="form-group"><label>Jenis</label><select class="form-control" id="pelJenis"><option value="internal" ${p.jenis === 'internal' ? 'selected' : ''}>Internal</option><option value="eksternal" ${p.jenis === 'eksternal' ? 'selected' : ''}>Eksternal</option><option value="sertifikasi" ${p.jenis === 'sertifikasi' ? 'selected' : ''}>Sertifikasi</option></select></div><div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="pelTgl" value="${p.tanggal || ''}"></div></div><div class="form-group"><label>Peserta (koma)</label><input class="form-control" id="pelPeserta" value="${(p.peserta || []).join(', ')}"></div><div class="form-group"><label>Status</label><select class="form-control" id="pelStatus"><option value="terjadwal" ${p.status === 'terjadwal' ? 'selected' : ''}>Terjadwal</option><option value="selesai" ${p.status === 'selesai' ? 'selected' : ''}>Selesai</option></select></div><button class="btn btn-primary" onclick="simpanPelatihan('${id || ''}')">Simpan</button>`
  );
}
async function simpanPelatihan(id) {
  const data = {
    judul: document.getElementById('pelJudul').value,
    jenis: document.getElementById('pelJenis').value,
    tanggal: document.getElementById('pelTgl').value,
    peserta: document
      .getElementById('pelPeserta')
      .value.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    status: document.getElementById('pelStatus').value,
    updatedAt: new Date().toISOString(),
  };
  if (!data.judul) return toast('Judul wajib', 'warning');
  if (id) await db.collection('hrd_pelatihan').doc(id).update(data);
  else await db.collection('hrd_pelatihan').add({ ...data, createdAt: new Date().toISOString() });
  closeModalDirect();
  toast('Disimpan', 'success');
  renderPelatihan();
}

// ── KONTRAK ───────────────────────────────────────────────────
async function renderKontrak() {
  const main = document.getElementById('mainContent');
  const isBOD = currentUser.role === 'bod';
  main.innerHTML = `<div class="page-title"><span>📄 Kontrak Karyawan</span>${!isBOD ? '<button class="btn btn-primary btn-sm" onclick="modalKontrak()">+ Upload Kontrak</button>' : ''}</div>
    <div class="tabs mb-16" id="kontrakTabs">
      <div class="tab active" onclick="showKontrakTab('list')">📋 Daftar Kontrak</div>
      <div class="tab" onclick="showKontrakTab('dokumen')">📁 Dokumen Karyawan</div>
    </div>
    <div id="kontrakContent"></div>`;
  showKontrakTab('list');
}

async function showKontrakTab(tab) {
  const tabs = document.getElementById('kontrakTabs');
  if (tabs) {
    tabs.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tabs.querySelectorAll('.tab').forEach((t) => {
      if (tab === 'list' && t.textContent.includes('Daftar')) t.classList.add('active');
      else if (tab === 'dokumen' && t.textContent.includes('Dokumen')) t.classList.add('active');
    });
  }
  const c = document.getElementById('kontrakContent');
  if (tab === 'list') await renderKontrakList(c);
  else if (tab === 'dokumen') await renderDokumenKaryawan(c);
}

async function renderKontrakList(container) {
  container.innerHTML =
    '<div class="card"><div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Kontrak Ke-</th><th>Jenis</th><th>Mulai</th><th>Berakhir</th><th>Status</th><th>File</th><th>Aksi</th></tr></thead><tbody id="tblKontrak"></tbody></table></div></div>';
  const snap = await db.collection('hrd_kontrak').get();
  const today = todayStr();
  let h = '';
  if (snap.empty)
    h =
      '<tr><td colspan="8" class="text-center">Belum ada kontrak. Klik "+ Upload Kontrak" untuk menambahkan.</td></tr>';
  else {
    const docs = [];
    snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    docs.forEach((p) => {
      const expired = p.berakhir && p.berakhir < today;
      const hasFile =
        p.fileURL || p.fileData
          ? '<span class="badge badge-success">Ada</span>'
          : '<span class="badge badge-warning">-</span>';
      const isBOD = currentUser.role === 'bod';
      let aksiHtml = '';
      if (isBOD) {
        aksiHtml = `<button class="btn btn-xs btn-info" onclick="lihatFileKontrak('${p.id}')" title="Lihat">👁️</button>`;
      } else {
        aksiHtml = `<button class="btn btn-xs btn-info" onclick="modalKontrak('${p.id}')">✏️</button>${p.fileURL || p.fileData ? ` <button class="btn btn-xs btn-success" onclick="lihatFileKontrak('${p.id}')">👁️</button>` : ''} <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_kontrak','${p.id}','kontrak')">🗑️</button>`;
      }
      h += `<tr><td class="fw-700">${escHtml(p.namaKaryawan || p.pihak || '-')}</td><td>${p.kontrakKe || '-'}</td><td>${escHtml(p.jenis === 'kerja' ? 'PKWT' : p.jenis === 'tetap' ? 'PKWTT' : p.jenis || '-')}</td><td>${formatDate(p.mulai)}</td><td>${formatDate(p.berakhir)}</td><td><span class="badge badge-${expired ? 'danger' : 'success'}">${expired ? 'Expired' : 'Aktif'}</span></td><td>${hasFile}</td><td>${aksiHtml}</td></tr>`;
    });
  }
  document.getElementById('tblKontrak').innerHTML = h;
}
function modalKontrak(id) {
  if (id)
    db.collection('hrd_kontrak')
      .doc(id)
      .get()
      .then((d) => showKontrakForm(id, d.data() || {}));
  else showKontrakForm(null, {});
}

async function showKontrakForm(id, p) {
  // Load karyawan list
  const karySnap = await db.collection('hrd_karyawan').get();
  let karyOptions = '<option value="">-- Pilih Karyawan --</option>';
  karySnap.forEach((d) => {
    const k = d.data();
    if (k.status === 'aktif' || !k.status) {
      const selected = p.karyawanId === d.id || p.namaKaryawan === k.nama ? 'selected' : '';
      karyOptions += `<option value="${d.id}" data-nama="${escHtml(k.nama)}" data-dept="${escHtml(k.departemen || '')}" ${selected}>${escHtml(k.nama)} — ${escHtml(k.departemen || '-')}</option>`;
    }
  });
  openModal(
    `<div class="modal-title">${id ? 'Edit' : 'Upload'} Kontrak Karyawan</div>
    <div class="form-group"><label>Karyawan <span style="color:var(--danger)">*</span></label><select class="form-control" id="ktKaryawan">${karyOptions}</select></div>
    <div class="grid-2">
      <div class="form-group"><label>Kontrak Ke-</label><input class="form-control" type="number" id="ktKontrakKe" value="${p.kontrakKe || 1}" min="1"></div>
      <div class="form-group"><label>Jenis Kontrak</label><select class="form-control" id="ktJenis"><option value="kerja" ${p.jenis === 'kerja' ? 'selected' : ''}>PKWT (Kontrak)</option><option value="tetap" ${p.jenis === 'tetap' ? 'selected' : ''}>PKWTT (Tetap)</option><option value="magang" ${p.jenis === 'magang' ? 'selected' : ''}>Magang</option><option value="freelance" ${p.jenis === 'freelance' ? 'selected' : ''}>Freelance</option></select></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Durasi</label><input class="form-control" id="ktDurasi" value="${escHtml(p.durasi || '')}" placeholder="12 bulan"></div>
      <div class="form-group"><label>Judul/Keterangan</label><input class="form-control" id="ktJudul" value="${escHtml(p.judul || '')}" placeholder="Perjanjian Kerja Ke-1"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Tanggal Mulai</label><input class="form-control" type="date" id="ktMulai" value="${p.mulai || ''}"></div>
      <div class="form-group"><label>Tanggal Berakhir</label><input class="form-control" type="date" id="ktAkhir" value="${p.berakhir || ''}"></div>
    </div>
    <div class="form-group"><label>Catatan</label><textarea class="form-control" id="ktCatatan" style="min-height:50px">${escHtml(p.catatan || '')}</textarea></div>
    <div class="form-group">
      <label>Upload Softcopy Kontrak (PDF/Image, max 500MB)</label>
      <input class="form-control" type="file" id="ktFile" accept=".pdf,image/png,image/jpeg,image/jpg" onchange="previewKontrakFile(this)">
      <div id="ktFilePreview" class="mt-8">${p.fileURL ? '<span class="badge badge-success">File sudah ada</span>' : p.fileData ? '<span class="badge badge-success">File sudah ada (legacy)</span>' : ''}</div>
    </div>
    <button class="btn btn-primary" onclick="simpanKontrak('${id || ''}')">💾 Simpan Kontrak</button>`,
    true
  );
  window._kontrakFile = null;
  window._kontrakFileName = p.fileName || null;
}

function previewKontrakFile(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 500 * 1024 * 1024) return toast('File terlalu besar (max 500MB)', 'warning');
  window._kontrakFile = file;
  window._kontrakFileName = file.name;
  const ext = file.name.split('.').pop().toLowerCase();
  const icon = ext === 'pdf' ? '📄' : '🖼️';
  const sizeLabel =
    file.size > 1024 * 1024
      ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
      : (file.size / 1024).toFixed(0) + ' KB';
  document.getElementById('ktFilePreview').innerHTML =
    `<span class="badge badge-success">${icon} ${escHtml(file.name)} (${sizeLabel}) ✅</span>`;
}

async function simpanKontrak(id) {
  const selKary = document.getElementById('ktKaryawan');
  const karyawanId = selKary.value;
  const opt = selKary.options[selKary.selectedIndex];
  const namaKaryawan = opt ? opt.dataset.nama || opt.textContent : '';
  const data = {
    karyawanId,
    namaKaryawan,
    kontrakKe: parseInt(document.getElementById('ktKontrakKe').value) || 1,
    jenis: document.getElementById('ktJenis').value,
    durasi: document.getElementById('ktDurasi').value,
    judul: document.getElementById('ktJudul').value,
    mulai: document.getElementById('ktMulai').value,
    berakhir: document.getElementById('ktAkhir').value,
    catatan: document.getElementById('ktCatatan').value,
    updatedAt: new Date().toISOString(),
  };
  if (!karyawanId) return toast('Pilih karyawan dulu', 'warning');
  if (!data.mulai || !data.berakhir) return toast('Tanggal mulai & berakhir wajib', 'warning');
  // Upload file to Firebase Storage
  if (window._kontrakFile) {
    try {
      toast('⏳ Mengupload file...', 'info');
      let storageUid = '';
      try {
        await ensureStorageAuth();
        storageUid = getStorageAuthUid();
      } catch (authErr) {
        console.warn('[StorageAuth] Upload fallback to legacy path:', authErr.code || authErr.message);
      }
      const path = storageUid
        ? `kontrak/${storageUid}/${karyawanId}/${Date.now()}_${window._kontrakFileName}`
        : `kontrak/${karyawanId}/${Date.now()}_${window._kontrakFileName}`;
      const fileURL = await uploadFileToStorage(window._kontrakFile, path);
      data.fileURL = fileURL;
      data.fileName = window._kontrakFileName;
      data.fileSize = window._kontrakFile.size;
      if (storageUid) data.storageUid = storageUid;
    } catch (e) {
      return toast('Gagal upload file: ' + getStorageErrorMessage(e), 'error');
    }
  }
  if (id) await db.collection('hrd_kontrak').doc(id).update(data);
  else await db.collection('hrd_kontrak').add({ ...data, createdAt: new Date().toISOString() });
  window._kontrakFile = null;
  window._kontrakFileName = null;
  closeModalDirect();
  toast('Kontrak disimpan', 'success');
  showKontrakTab('list');
}

function lihatFileKontrak(id) {
  db.collection('hrd_kontrak')
    .doc(id)
    .get()
    .then((d) => {
      const p = d.data();
      const url = p.fileURL || p.fileData;
      if (!p || !url) return toast('File tidak ditemukan', 'warning');
      const ext = (p.fileName || '').split('.').pop().toLowerCase();
      const sizeLabel = p.fileSize
        ? p.fileSize > 1024 * 1024
          ? (p.fileSize / (1024 * 1024)).toFixed(1) + ' MB'
          : (p.fileSize / 1024).toFixed(0) + ' KB'
        : '';
      let content = '';
      if (ext === 'pdf') {
        content = `<div class="modal-title">📄 ${escHtml(p.fileName || 'Kontrak')}</div><p class="text-sm mb-8">${escHtml(p.namaKaryawan || '')} — Kontrak Ke-${p.kontrakKe || 1} ${sizeLabel ? '(' + sizeLabel + ')' : ''}</p><iframe src="${url}" style="width:100%;height:500px;border:1px solid var(--border);border-radius:8px"></iframe><div class="mt-8"><a href="${url}" target="_blank" class="btn btn-primary btn-sm">⬇️ Download</a></div>`;
      } else {
        content = `<div class="modal-title">🖼️ ${escHtml(p.fileName || 'Kontrak')}</div><p class="text-sm mb-8">${escHtml(p.namaKaryawan || '')} — Kontrak Ke-${p.kontrakKe || 1} ${sizeLabel ? '(' + sizeLabel + ')' : ''}</p><img src="${url}" style="max-width:100%;border-radius:8px;border:1px solid var(--border)"><div class="mt-8"><a href="${url}" target="_blank" class="btn btn-primary btn-sm">⬇️ Download</a></div>`;
      }
      openModal(content, true);
    });
}

// ══════════════════════════════════════════════════════════════
// ── DOKUMEN KARYAWAN — Upload kelengkapan dokumen per karyawan ─
// ══════════════════════════════════════════════════════════════

async function renderDokumenKaryawan(container) {
  const isBOD = currentUser.role === 'bod';
  container.innerHTML = `<div class="card">
    <div class="card-header"><div class="card-title">📁 Dokumen Kelengkapan Karyawan</div>${!isBOD ? '<button class="btn btn-primary btn-sm" onclick="modalUploadDokumen()">+ Upload Dokumen</button>' : ''}</div>
    <p class="text-sm mb-16" style="color:#666">Dokumen dikelompokkan per karyawan. Klik nama untuk melihat berkas.</p>
    <div class="flex gap-8 mb-16">
      <input class="form-control" placeholder="🔍 Cari nama karyawan..." id="searchDokKary" oninput="renderDokFolders()" style="max-width:300px">
    </div>
    <div id="dokFolderContainer">Loading...</div>
  </div>`;
  // Load all documents grouped by karyawan
  const snap = await db.collection('hrd_dokumen_karyawan').get();
  window._allDokumen = [];
  snap.forEach((d) => window._allDokumen.push({ id: d.id, ...d.data() }));
  // Also load karyawan list for names/photos
  const karySnap = await db.collection('hrd_karyawan').get();
  window._karyawanMap = {};
  karySnap.forEach((d) => {
    window._karyawanMap[d.id] = { id: d.id, ...d.data() };
  });
  renderDokFolders();
}

function renderDokFolders() {
  const searchQ = (document.getElementById('searchDokKary')?.value || '').toLowerCase();
  const docs = window._allDokumen || [];
  // Group by karyawanId
  const grouped = {};
  docs.forEach((d) => {
    const key = d.karyawanId || 'unknown';
    if (!grouped[key]) grouped[key] = { nama: d.namaKaryawan || '-', docs: [] };
    grouped[key].docs.push(d);
  });
  // Sort by name
  const entries = Object.entries(grouped).sort((a, b) => a[1].nama.localeCompare(b[1].nama));
  let html = '';
  let visibleCount = 0;
  entries.forEach(([karyId, group]) => {
    if (searchQ && !group.nama.toLowerCase().includes(searchQ)) return;
    visibleCount++;
    const kary = window._karyawanMap[karyId] || {};
    const avatar = kary.foto
      ? `<img src="${kary.foto}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">`
      : `<div style="width:36px;height:36px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.9rem">${(group.nama || '?').charAt(0)}</div>`;
    const docCount = group.docs.length;
    const tipes = [...new Set(group.docs.map((d) => d.tipeDokumen))].filter(Boolean);
    html += `<div class="card mb-8" style="border-left:4px solid var(--primary);cursor:pointer" onclick="toggleDokFolder('${karyId}')">
      <div style="display:flex;align-items:center;gap:12px">
        ${avatar}
        <div style="flex:1"><div class="fw-700">${escHtml(group.nama)}</div><div class="text-xs" style="color:#999">${escHtml(kary.departemen || '-')} • ${escHtml(kary.posisi || '-')}</div></div>
        <div style="text-align:right"><span class="badge badge-info">${docCount} file</span><div class="text-xs mt-4" style="color:#999">${tipes.join(', ')}</div></div>
        <span id="dokArrow_${karyId}" style="font-size:1.2rem;transition:.2s">▶</span>
      </div>
    </div>
    <div id="dokFolder_${karyId}" style="display:none;margin-left:20px;margin-bottom:16px;border-left:2px solid var(--border);padding-left:12px">
      <div class="table-wrap"><table><thead><tr><th>Tipe</th><th>Nama File</th><th>Keterangan</th><th>Tanggal</th><th>Aksi</th></tr></thead><tbody>`;
    group.docs.sort((a, b) => (a.tipeDokumen || '').localeCompare(b.tipeDokumen || ''));
    group.docs.forEach((p) => {
      const isBOD = currentUser.role === 'bod';
      html += `<tr><td><span class="badge badge-info">${escHtml(p.tipeDokumen || '-')}</span></td><td class="text-xs">${escHtml(p.fileName || '-')}</td><td class="text-xs">${escHtml(p.keterangan || '-')}</td><td class="text-xs">${p.createdAt ? new Date(p.createdAt).toLocaleDateString('id-ID') : '-'}</td><td><button class="btn btn-xs btn-success" onclick="event.stopPropagation();lihatDokumen('${p.id}')">👁️</button>${!isBOD ? ` <button class="btn btn-xs btn-danger" onclick="event.stopPropagation();hapusDokumen('${p.id}')">🗑️</button>` : ''}</td></tr>`;
    });
    html += `</tbody></table></div>
      ${currentUser.role !== 'bod' ? `<button class="btn btn-xs btn-primary mt-8" onclick="event.stopPropagation();modalUploadDokumen('${karyId}')">+ Upload untuk ${escHtml(group.nama)}</button>` : ''}
    </div>`;
  });
  if (!visibleCount)
    html = '<p class="text-sm" style="color:#999;text-align:center">Tidak ada data dokumen.</p>';
  document.getElementById('dokFolderContainer').innerHTML = html;
}

function toggleDokFolder(karyId) {
  const folder = document.getElementById('dokFolder_' + karyId);
  const arrow = document.getElementById('dokArrow_' + karyId);
  if (!folder) return;
  const open = folder.style.display !== 'none';
  folder.style.display = open ? 'none' : 'block';
  if (arrow) arrow.textContent = open ? '▶' : '▼';
}

async function modalUploadDokumen(preKaryId) {
  const karySnap = await db.collection('hrd_karyawan').get();
  let karyOptions = '<option value="">-- Pilih Karyawan --</option>';
  karySnap.forEach((d) => {
    const k = d.data();
    if (k.status === 'aktif' || !k.status)
      karyOptions += `<option value="${d.id}" data-nama="${escHtml(k.nama)}" ${preKaryId === d.id ? 'selected' : ''}>${escHtml(k.nama)} — ${escHtml(k.departemen || '-')}</option>`;
  });
  openModal(
    `<div class="modal-title">📁 Upload Dokumen Karyawan</div>
    <div class="form-group"><label>Karyawan <span style="color:var(--danger)">*</span></label><select class="form-control" id="dokKaryawan">${karyOptions}</select></div>
    <div class="grid-2">
      <div class="form-group"><label>Tipe Dokumen <span style="color:var(--danger)">*</span></label><select class="form-control" id="dokTipe"><option value="">-- Pilih --</option><option value="KTP">KTP</option><option value="KK">Kartu Keluarga</option><option value="SIM">SIM</option><option value="Ijazah">Ijazah</option><option value="SKCK">SKCK</option><option value="Sertifikat">Sertifikat</option><option value="BPJS">BPJS</option><option value="Passport">Passport</option><option value="CV">CV / Lamaran</option><option value="Kontrak">Surat Kontrak</option><option value="Lainnya">Lainnya</option></select></div>
      <div class="form-group"><label>Keterangan</label><input class="form-control" id="dokKeterangan" placeholder="No. dokumen, catatan, dll"></div>
    </div>
    <div class="form-group">
      <label>Upload File (PDF/Image, max 500MB) <span style="color:var(--danger)">*</span></label>
      <input class="form-control" type="file" id="dokFile" accept=".pdf,image/png,image/jpeg,image/jpg" onchange="previewDokumenFile(this)">
      <div id="dokFilePreview" class="mt-8"></div>
    </div>
    <button class="btn btn-primary" onclick="simpanDokumen()">💾 Upload & Simpan</button>`,
    true
  );
  window._dokFile = null;
  window._dokFileName = null;
}

function previewDokumenFile(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 500 * 1024 * 1024) return toast('File terlalu besar (max 500MB)', 'warning');
  window._dokFile = file;
  window._dokFileName = file.name;
  const ext = file.name.split('.').pop().toLowerCase();
  const icon = ext === 'pdf' ? '📄' : '🖼️';
  const sizeLabel =
    file.size > 1024 * 1024
      ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
      : (file.size / 1024).toFixed(0) + ' KB';
  document.getElementById('dokFilePreview').innerHTML =
    `<span class="badge badge-success">${icon} ${escHtml(file.name)} (${sizeLabel}) ✅</span>`;
}

async function simpanDokumen() {
  const selKary = document.getElementById('dokKaryawan');
  const karyawanId = selKary.value;
  const opt = selKary.options[selKary.selectedIndex];
  const namaKaryawan = opt ? opt.dataset.nama || '' : '';
  const tipeDokumen = document.getElementById('dokTipe').value;
  const keterangan = document.getElementById('dokKeterangan').value;
  if (!karyawanId) return toast('Pilih karyawan dulu', 'warning');
  if (!tipeDokumen) return toast('Pilih tipe dokumen', 'warning');
  if (!window._dokFile) return toast('Upload file dulu', 'warning');
  // Upload to Firebase Storage
  try {
    toast('⏳ Mengupload file...', 'info');
    let storageUid = '';
    try {
      await ensureStorageAuth();
      storageUid = getStorageAuthUid();
    } catch (authErr) {
      console.warn('[StorageAuth] Upload fallback to legacy path:', authErr.code || authErr.message);
    }
    const path = storageUid
      ? `dokumen/${storageUid}/${karyawanId}/${tipeDokumen}_${Date.now()}_${window._dokFileName}`
      : `dokumen/${karyawanId}/${tipeDokumen}_${Date.now()}_${window._dokFileName}`;
    const fileURL = await uploadFileToStorage(window._dokFile, path);
    const data = {
      karyawanId,
      namaKaryawan,
      tipeDokumen,
      keterangan,
      fileURL,
      fileName: window._dokFileName,
      fileSize: window._dokFile.size,
      createdAt: new Date().toISOString(),
    };
    if (storageUid) data.storageUid = storageUid;
    await db.collection('hrd_dokumen_karyawan').add(data);
    window._dokFile = null;
    window._dokFileName = null;
    closeModalDirect();
    toast(`Dokumen ${tipeDokumen} untuk ${namaKaryawan} berhasil diupload`, 'success');
    showKontrakTab('dokumen');
  } catch (e) {
    toast('Gagal upload: ' + getStorageErrorMessage(e), 'error');
  }
}

function lihatDokumen(id) {
  db.collection('hrd_dokumen_karyawan')
    .doc(id)
    .get()
    .then((d) => {
      const p = d.data();
      const url = p.fileURL || p.fileData;
      if (!p || !url) return toast('File tidak ditemukan', 'warning');
      const ext = (p.fileName || '').split('.').pop().toLowerCase();
      const sizeLabel = p.fileSize
        ? p.fileSize > 1024 * 1024
          ? (p.fileSize / (1024 * 1024)).toFixed(1) + ' MB'
          : (p.fileSize / 1024).toFixed(0) + ' KB'
        : '';
      let content = `<div class="modal-title">📁 ${escHtml(p.tipeDokumen || 'Dokumen')} — ${escHtml(p.namaKaryawan || '')}</div>`;
      if (p.keterangan)
        content += `<p class="text-sm mb-8" style="color:#666">${escHtml(p.keterangan)} ${sizeLabel ? '(' + sizeLabel + ')' : ''}</p>`;
      if (ext === 'pdf') {
        content += `<iframe src="${url}" style="width:100%;height:500px;border:1px solid var(--border);border-radius:8px"></iframe>`;
      } else {
        content += `<img src="${url}" style="max-width:100%;border-radius:8px;border:1px solid var(--border)">`;
      }
      content += `<div class="mt-8"><a href="${url}" target="_blank" class="btn btn-primary btn-sm">⬇️ Download</a></div>`;
      openModal(content, true);
    });
}

async function hapusDokumen(id) {
  if (!confirm('Hapus dokumen ini?')) return;
  // Delete file from storage too
  try {
    const doc = await db.collection('hrd_dokumen_karyawan').doc(id).get();
    const data = doc.data();
    if (data && data.fileURL) await deleteFileFromStorage(data.fileURL);
  } catch (e) {
    console.warn('Delete storage file failed:', e);
  }
  await db.collection('hrd_dokumen_karyawan').doc(id).delete();
  toast('Dokumen dihapus', 'success');
  filterDokumenList();
}

// ── ASSET ─────────────────────────────────────────────────────
async function renderAsset() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>💻 Asset Management</span><button class="btn btn-primary btn-sm" onclick="modalAsset()">+ Tambah</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Kode</th><th>Nama</th><th>Kategori</th><th>Pengguna</th><th>Kondisi</th><th>Aksi</th></tr></thead><tbody id="tblAsset"></tbody></table></div></div>`;
  const snap = await db.collection('hrd_asset').get();
  let h = '';
  if (snap.empty) h = '<tr><td colspan="6" class="text-center">Belum ada</td></tr>';
  else
    snap.forEach((d) => {
      const p = d.data();
      h += `<tr><td>${escHtml(p.kode || '-')}</td><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.kategori || '-')}</td><td>${escHtml(p.pengguna || '-')}</td><td><span class="badge badge-${p.kondisi === 'baik' ? 'success' : p.kondisi === 'rusak' ? 'danger' : 'warning'}">${p.kondisi || 'baik'}</span></td><td><button class="btn btn-xs btn-info" onclick="modalAsset('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_asset','${d.id}','asset')">🗑️</button></td></tr>`;
    });
  document.getElementById('tblAsset').innerHTML = h;
}
function modalAsset(id) {
  if (id)
    db.collection('hrd_asset')
      .doc(id)
      .get()
      .then((d) => showAssetForm(id, d.data() || {}));
  else showAssetForm(null, {});
}
function showAssetForm(id, p) {
  openModal(
    `<div class="modal-title">${id ? 'Edit' : 'Tambah'} Asset</div><div class="grid-2"><div class="form-group"><label>Kode</label><input class="form-control" id="asKode" value="${escHtml(p.kode || 'AST-' + Date.now().toString().slice(-6))}"></div><div class="form-group"><label>Nama</label><input class="form-control" id="asNama" value="${escHtml(p.nama || '')}"></div></div><div class="grid-2"><div class="form-group"><label>Kategori</label><select class="form-control" id="asKat"><option value="elektronik" ${p.kategori === 'elektronik' ? 'selected' : ''}>Elektronik</option><option value="furniture" ${p.kategori === 'furniture' ? 'selected' : ''}>Furniture</option><option value="kendaraan" ${p.kategori === 'kendaraan' ? 'selected' : ''}>Kendaraan</option></select></div><div class="form-group"><label>Kondisi</label><select class="form-control" id="asKondisi"><option value="baik" ${p.kondisi === 'baik' ? 'selected' : ''}>Baik</option><option value="perlu_perbaikan" ${p.kondisi === 'perlu_perbaikan' ? 'selected' : ''}>Perlu Perbaikan</option><option value="rusak" ${p.kondisi === 'rusak' ? 'selected' : ''}>Rusak</option></select></div></div><div class="form-group"><label>Pengguna</label><input class="form-control" id="asPengguna" value="${escHtml(p.pengguna || '')}"></div><button class="btn btn-primary" onclick="simpanAsset('${id || ''}')">Simpan</button>`
  );
}
async function simpanAsset(id) {
  const data = {
    kode: document.getElementById('asKode').value,
    nama: document.getElementById('asNama').value,
    kategori: document.getElementById('asKat').value,
    kondisi: document.getElementById('asKondisi').value,
    pengguna: document.getElementById('asPengguna').value,
    updatedAt: new Date().toISOString(),
  };
  if (!data.nama) return toast('Nama wajib', 'warning');
  if (id) await db.collection('hrd_asset').doc(id).update(data);
  else await db.collection('hrd_asset').add({ ...data, createdAt: new Date().toISOString() });
  closeModalDirect();
  toast('Disimpan', 'success');
  renderAsset();
}

// ══════════════════════════════════════════════════════════════

// ── MANAJEMEN AKUN ────────────────────────────────────────────
async function renderAkun() {
  if (!hasAccess(6))
    return (document.getElementById('mainContent').innerHTML =
      '<div class="card"><p>Akses ditolak.</p></div>');
  const main = document.getElementById('mainContent');
  const baseUrl = window.location.origin + window.location.pathname;
  main.innerHTML = `<div class="page-title"><span>👤 Manajemen Akun</span><button class="btn btn-primary btn-sm" onclick="modalAkun()">+ Tambah</button></div>
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
  <div class="card mb-16"><div class="card-title">📲 Bagikan Aplikasi</div><p class="text-sm mb-16" style="color:#666">Bagikan link download aplikasi ke karyawan agar mereka dapat mengakses portal lewat browser atau PWA di Android, iOS, Windows, dan Mac.</p><div class="form-group"><label>Link Aplikasi</label><input class="form-control" readonly id="adminAppLink" value="${baseUrl}"></div><div class="flex gap-8"><button class="btn btn-primary btn-sm" onclick="copyDownloadLink()">📋 Salin Link</button><button class="btn btn-success btn-sm" onclick="shareDownloadWhatsApp()">💬 Share WA</button><button class="btn btn-info btn-sm" onclick="shareDownloadEmail()">✉️ Email</button></div></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Username</th><th>Nama</th><th>Role</th><th>Dept</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblAkun"></tbody></table></div></div>`;
  loadCompanyData();
  const snap = await db.collection('hrd_users').get();
  let h = '';
  snap.forEach((d) => {
    const p = d.data();
    h += `<tr><td class="fw-700">${escHtml(d.id)}</td><td>${escHtml(p.nama)}</td><td><span class="badge badge-primary">${p.role}</span></td><td>${escHtml(p.departemen || '-')}</td><td><span class="badge badge-${p.status === 'aktif' ? 'success' : 'danger'}">${p.status || 'aktif'}</span></td><td><button class="btn btn-xs btn-info" onclick="modalAkun('${d.id}')">✏️</button></td></tr>`;
  });
  document.getElementById('tblAkun').innerHTML = h;
}

// ── DATA PERUSAHAAN ───────────────────────────────────────────
async function loadCompanyData() {
  const doc = await db.collection('hrd_settings').doc('perusahaan').get();
  if (!doc.exists) return;
  const d = doc.data();
  if (d.nama) document.getElementById('cpNama').value = d.nama;
  if (d.npwp) document.getElementById('cpNpwp').value = d.npwp;
  if (d.alamat) document.getElementById('cpAlamat').value = d.alamat;
  if (d.kota) document.getElementById('cpKota').value = d.kota;
  if (d.telepon) document.getElementById('cpTelp').value = d.telepon;
  if (d.email) document.getElementById('cpEmail').value = d.email;
  if (d.jumlahKaryawan) document.getElementById('cpJmlKaryawan').value = d.jumlahKaryawan;
  if (d.tahunBerdiri) document.getElementById('cpTahunBerdiri').value = d.tahunBerdiri;
  if (d.nib) document.getElementById('cpNIB').value = d.nib;
  if (d.kemenkumham) document.getElementById('cpKemenkumham').value = d.kemenkumham;
  if (d.logo) {
    document.getElementById('cpLogoPreview').innerHTML =
      `<img src="${d.logo}" style="width:100%;height:100%;object-fit:contain">`;
    window._companyLogo = d.logo;
  }
}

function previewCompanyLogo(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    // Show crop modal
    openModal(
      `<div class="modal-title">✂️ Crop Logo (Bulat)</div>
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
      </div>`,
      true
    );
    // Setup crop
    const img = new Image();
    img.onload = () => {
      window._cropImg = img;
      window._cropOffsetX = 0;
      window._cropOffsetY = 0;
      window._cropZoom = 100;
      updateCropPreview();
      // Drag to move
      const canvas = document.getElementById('cropCanvas');
      let dragging = false,
        startX = 0,
        startY = 0;
      canvas.onmousedown = canvas.ontouchstart = (ev) => {
        dragging = true;
        const e = ev.touches ? ev.touches[0] : ev;
        startX = e.clientX - window._cropOffsetX;
        startY = e.clientY - window._cropOffsetY;
        ev.preventDefault();
      };
      document.onmousemove = document.ontouchmove = (ev) => {
        if (!dragging) return;
        const e = ev.touches ? ev.touches[0] : ev;
        window._cropOffsetX = e.clientX - startX;
        window._cropOffsetY = e.clientY - startY;
        updateCropPreview();
      };
      document.onmouseup = document.ontouchend = () => {
        dragging = false;
      };
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function updateCropPreview() {
  const canvas = document.getElementById('cropCanvas');
  if (!canvas || !window._cropImg) return;
  const ctx = canvas.getContext('2d');
  const img = window._cropImg;
  const zoom = (document.getElementById('cropZoom')?.value || 100) / 100;
  window._cropZoom = zoom;
  ctx.clearRect(0, 0, 280, 280);
  // Draw image centered with offset and zoom
  const scale = Math.max(280 / img.width, 280 / img.height) * zoom;
  const w = img.width * scale,
    h = img.height * scale;
  const x = (280 - w) / 2 + window._cropOffsetX;
  const y = (280 - h) / 2 + window._cropOffsetY;
  // Clip to circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(140, 140, 140, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
  // Draw circle border
  ctx.beginPath();
  ctx.arc(140, 140, 139, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(198,40,40,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function applyCrop() {
  const canvas = document.getElementById('cropCanvas');
  if (!canvas) return;
  // Export as circular PNG
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = 128;
  exportCanvas.height = 128;
  const ctx = exportCanvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(64, 64, 64, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(canvas, 0, 0, 280, 280, 0, 0, 128, 128);
  window._companyLogo = exportCanvas.toDataURL('image/png', 0.9);
  document.getElementById('cpLogoPreview').innerHTML =
    `<img src="${window._companyLogo}" style="width:100%;height:100%;object-fit:contain;border-radius:50%">`;
  closeModalDirect();
  toast('Logo di-crop berhasil!', 'success');
}

async function simpanDataPerusahaan() {
  const data = {
    nama: document.getElementById('cpNama').value,
    npwp: document.getElementById('cpNpwp').value,
    alamat: document.getElementById('cpAlamat').value,
    kota: document.getElementById('cpKota').value,
    telepon: document.getElementById('cpTelp').value,
    email: document.getElementById('cpEmail').value,
    jumlahKaryawan: Number(document.getElementById('cpJmlKaryawan').value) || 0,
    tahunBerdiri: Number(document.getElementById('cpTahunBerdiri').value) || 0,
    nib: document.getElementById('cpNIB').value,
    kemenkumham: document.getElementById('cpKemenkumham').value,
    logo: window._companyLogo || '',
    updatedAt: new Date().toISOString(),
  };
  await db.collection('hrd_settings').doc('perusahaan').set(data, { merge: true });
  // Update PWA manifest icon if logo exists
  if (data.logo) updateAppIcon(data.logo);
  toast('Data perusahaan disimpan', 'success');
}

function updateAppIcon(logoDataUrl) {
  // Update favicon
  let link = document.querySelector("link[rel*='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = logoDataUrl;
  // Store for PWA usage
  localStorage.setItem('ims_company_logo', logoDataUrl);
}

// Load company logo on app start for branding
function loadCompanyBranding() {
  // First try localStorage (fast)
  const logo = localStorage.getItem('ims_company_logo');
  if (logo) {
    updateAppIcon(logo);
    const logoEl = document.querySelector('.logo');
    if (logoEl)
      logoEl.innerHTML = `<img src="${logo}" style="width:28px;height:28px;border-radius:50%;object-fit:contain;margin-right:8px"><span>IMS</span>`;
  }
  // Then sync from Firestore (for all users including karyawan)
  db.collection('hrd_settings')
    .doc('perusahaan')
    .get()
    .then((doc) => {
      if (!doc.exists) return;
      const d = doc.data();
      if (d.logo) {
        localStorage.setItem('ims_company_logo', d.logo);
        updateAppIcon(d.logo);
        const logoEl = document.querySelector('.logo');
        if (logoEl)
          logoEl.innerHTML = `<img src="${d.logo}" style="width:28px;height:28px;border-radius:50%;object-fit:contain;margin-right:8px"><span>IMS</span>`;
      }
    })
    .catch(() => {});
}
function modalAkun(id) {
  if (id)
    db.collection('hrd_users')
      .doc(id)
      .get()
      .then((d) => showAkunForm(id, d.data() || {}));
  else showAkunForm(null, {});
}
async function showAkunForm(id, p) {
  // Load karyawan list for linking (only active)
  const karySnap = await db.collection('hrd_karyawan').where('status', '==', 'aktif').get();
  let karyData = [];
  karySnap.forEach((d) => {
    const k = d.data();
    karyData.push({
      id: d.id,
      nama: k.nama,
      nip: k.nip || '',
      departemen: k.departemen || '',
      posisi: k.posisi || '',
    });
  });
  karyData.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
  let karyOpts = '<option value="">-- Tidak disambungkan --</option>';
  karyData.forEach((k) => {
    karyOpts += `<option value="${k.id}" ${p.linkedKaryawan === k.id ? 'selected' : ''}>${escHtml(k.nama)} (${escHtml(k.nip)} — ${escHtml(k.departemen)})</option>`;
  });
  openModal(
    `<div class="modal-title">${id ? 'Edit' : 'Tambah'} Akun</div>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
      <div id="akAvatarPreview" style="width:64px;height:64px;border-radius:50%;border:2px solid var(--accent);overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f5f5f5;font-size:1.5rem;cursor:pointer" onclick="document.getElementById('akAvatarFile').click()">${p.profilePic ? `<img src="${p.profilePic}" style="width:100%;height:100%;object-fit:cover">` : (p.nama || '?').charAt(0)}</div>
      <div><input type="file" id="akAvatarFile" accept="image/png,image/jpeg" style="display:none" onchange="previewAkunAvatar(this)"><button class="btn btn-sm btn-primary" onclick="document.getElementById('akAvatarFile').click()">📷 Foto Profil</button><div class="text-xs mt-4" style="color:#999">Upload foto untuk identifikasi user</div></div>
    </div>
    <div class="grid-2"><div class="form-group"><label>Username</label><input class="form-control" id="akUser" value="${escHtml(id || '')}" data-old-id="${escHtml(id || '')}"></div><div class="form-group"><label>Password</label><input class="form-control" id="akPass" value="${escHtml(p.password || '')}"></div></div>
    <div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="akNama" value="${escHtml(p.nama || '')}"></div><div class="form-group"><label>Role</label><select class="form-control" id="akRole"><option value="staff" ${p.role === 'staff' || p.role === 'karyawan' ? 'selected' : ''}>Staff</option><option value="leader" ${p.role === 'leader' ? 'selected' : ''}>Leader</option><option value="manager" ${p.role === 'manager' ? 'selected' : ''}>Manager</option><option value="head" ${p.role === 'head' ? 'selected' : ''}>Head</option><option value="bod" ${p.role === 'bod' ? 'selected' : ''}>BOD / Founder</option><option value="admin" ${p.role === 'admin' || p.role === 'superadmin' ? 'selected' : ''}>Admin (Full Access)</option></select></div></div>
    <div class="grid-2"><div class="form-group"><label>Departemen</label><input class="form-control" id="akDept" value="${escHtml(p.departemen || '')}"></div><div class="form-group"><label>Status</label><select class="form-control" id="akStatus"><option value="aktif" ${p.status === 'aktif' ? 'selected' : ''}>Aktif</option><option value="nonaktif" ${p.status === 'nonaktif' ? 'selected' : ''}>Nonaktif</option></select></div></div>
    <div class="form-group" style="background:#f0f4ff;padding:12px;border-radius:8px;border-left:4px solid var(--primary)"><label style="color:var(--primary)">🔗 Sambungkan ke Data Karyawan</label><input class="form-control mb-8" id="akLinkedSearch" placeholder="🔍 Ketik nama untuk mencari..." oninput="filterLinkedKary()"><select class="form-control" id="akLinkedKary" size="10" style="height:auto;max-height:250px">${karyOpts}</select><div class="text-xs mt-8" style="color:#666">Hanya karyawan aktif. Ketik nama untuk filter, lalu pilih dari daftar.</div></div>
    <div class="flex gap-8 mt-16"><button class="btn btn-primary" onclick="simpanAkun('${id || ''}')">💾 Simpan</button>${id ? `<button class="btn btn-danger" onclick="hapusDoc('hrd_users','${id}','akun')">🗑️ Hapus</button>` : ''}</div>`,
    true
  );
}

function previewAkunAvatar(input) {
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
      window._akunProfilePic = canvas.toDataURL('image/jpeg', 0.8);
      document.getElementById('akAvatarPreview').innerHTML =
        `<img src="${window._akunProfilePic}" style="width:100%;height:100%;object-fit:cover">`;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function filterLinkedKary() {
  const q = (document.getElementById('akLinkedSearch')?.value || '').toLowerCase();
  const sel = document.getElementById('akLinkedKary');
  if (!sel) return;
  Array.from(sel.options).forEach((opt) => {
    if (!opt.value) {
      opt.style.display = '';
      return;
    } // Always show "tidak disambungkan"
    const text = opt.textContent.toLowerCase();
    opt.style.display = text.includes(q) ? '' : 'none';
  });
}
async function simpanAkun(id) {
  const oldId = id;
  const newUsername = document.getElementById('akUser').value.trim();
  if (!newUsername) return toast('Username wajib', 'warning');
  const linkedKary = document.getElementById('akLinkedKary')?.value || '';
  const data = {
    password: document.getElementById('akPass').value,
    nama: document.getElementById('akNama').value,
    role: document.getElementById('akRole').value,
    departemen: document.getElementById('akDept').value,
    status: document.getElementById('akStatus').value,
    linkedKaryawan: linkedKary,
    username: newUsername,
    updatedAt: new Date().toISOString(),
  };
  if (window._akunProfilePic) data.profilePic = window._akunProfilePic;
  if (!data.nama || !data.password) return toast('Nama & password wajib', 'warning');
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
      await db
        .collection('hrd_users')
        .doc(newUsername)
        .set({ ...oldData, ...data, username: newUsername });
      await db.collection('hrd_users').doc(oldId).delete();
      // Update session if editing own account
      if (currentUser.id === oldId) {
        currentUser.id = newUsername;
        localStorage.setItem('hrd_session', JSON.stringify(currentUser));
      }
    } else if (oldId) {
      await db.collection('hrd_users').doc(oldId).update(data);
    } else {
      await db
        .collection('hrd_users')
        .doc(newUsername)
        .set({ ...data, nip: data.nip || newUsername, createdAt: new Date().toISOString() });
    }
    closeModalDirect();
    toast('Akun disimpan & disinkronkan', 'success');
    renderAkun();
  } catch (e) {
    console.error(e);
    toast('Gagal: ' + (e.message || e), 'error');
  }
}

// ── APPROVAL CENTER — Multi-step flow with department filtering ──
async function renderApprovalCenter() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>✅ Approval Center</span></div><div class="card" id="approvalList">Loading...</div>`;
  const myName = currentUser.nama?.toLowerCase() || '';
  const myDept = (currentUser.departemen || '').toLowerCase();
  const isAdmin = hasAccess(5);
  const isGM = (currentUser.posisi || '').toLowerCase().includes('general manager');
  // Load approval flows
  const flowSnap = await db.collection('hrd_approval_flow').get();
  const flows = [];
  flowSnap.forEach((d) => flows.push({ id: d.id, ...d.data() }));
  // Load karyawan for dept mapping
  const karySnap = await db.collection('hrd_karyawan').get();
  const deptMap = {};
  const gradeMap = {};
  karySnap.forEach((d) => {
    const k = d.data();
    const namaLower = (k.nama || '').toLowerCase();
    deptMap[namaLower] = k.departemen || '';
    gradeMap[namaLower] = (k.gradeJabatan || k.posisi || '').toLowerCase();
  });
  const collections = [
    'hrd_cuti',
    'hrd_overtime',
    'hrd_reimbursement',
    'hrd_kasbon',
    'hrd_dinas_luar',
    'hrd_perjalanan_dinas',
    'hrd_reimburse_dinas',
  ];
  let items = [];
  for (const col of collections) {
    try {
      const snap = await db
        .collection(col)
        .where('status', 'in', ['pending', 'step1', 'step2'])
        .get();
      snap.forEach((d) => {
        const data = { id: d.id, collection: col, ...d.data() };
        data._dept = (
          data.departemen ||
          deptMap[(data.nama || '').toLowerCase()] ||
          ''
        ).toLowerCase();
        items.push(data);
      });
    } catch (e) {
      const snap = await db.collection(col).where('status', '==', 'pending').get();
      snap.forEach((d) => {
        const data = { id: d.id, collection: col, ...d.data() };
        data._dept = (
          data.departemen ||
          deptMap[(data.nama || '').toLowerCase()] ||
          ''
        ).toLowerCase();
        items.push(data);
      });
    }
  }
  items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  let h = '';
  let visibleCount = 0;
  items.forEach((item) => {
    const flow = flows.find((f) => f.pengaju?.toLowerCase() === item.nama?.toLowerCase());
    const steps = flow?.steps || [];
    const currentStep = item.approvalStep || 0;
    const currentApprover = steps[currentStep]?.nama?.toLowerCase() || '';
    const canSee = isAdmin || isGM || hasAccess(4) || item._dept === myDept;
    if (!canSee) return;
    // BOD filter: only show submissions from 'head' level
    const isBOD = currentUser.role === 'bod';
    if (isBOD) {
      const pengajuGrade = gradeMap[(item.nama || '').toLowerCase()] || '';
      const isHead = pengajuGrade.includes('head');
      if (!isHead) return;
    }
    const isMyTurn = isAdmin || currentApprover === myName;
    const typeLabel = item.collection.replace('hrd_', '').toUpperCase();
    const detail = item.jenis || item.kategori || '';
    const jumlah = item.jumlah ? ` — ${formatCurrency(item.jumlah)}` : '';
    const durasi = item.durasi ? ` (${item.durasi} hari)` : '';
    let progressHtml = '';
    if (steps.length) {
      progressHtml = '<div class="flex gap-4 mt-8" style="flex-wrap:wrap">';
      steps.forEach((s, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        const color = done ? '#2e7d32' : active ? 'var(--accent)' : '#ccc';
        progressHtml += `<span style="font-size:.6rem;padding:2px 6px;border-radius:4px;background:${done ? '#e8f5e9' : active ? '#fce4ec' : '#f5f5f5'};color:${color};border:1px solid ${color}">${done ? '✓ ' : ''}${escHtml(s.nama || '')}</span>`;
        if (i < steps.length - 1)
          progressHtml += `<span style="color:#ccc;font-size:.6rem">→</span>`;
      });
      progressHtml += '</div>';
    }
    visibleCount++;
    h += `<div style="padding:14px;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px"><div style="flex:1"><div><span class="badge badge-info">${typeLabel}</span> <span class="fw-700">${escHtml(item.nama)}</span> <span class="badge" style="background:#eee;color:#555;font-size:.6rem">${escHtml(item._dept?.toUpperCase() || '')}</span></div><div class="text-sm" style="color:#555;margin-top:4px">${escHtml(detail)}${durasi}${jumlah}</div><div class="text-xs" style="color:#999;margin-top:2px">${formatDateTime(item.createdAt)}</div></div><div class="flex gap-8"><button class="btn btn-xs btn-primary" onclick="viewApprovalDetail('${item.collection}','${item.id}')">👁️</button>${isMyTurn ? `<button class="btn btn-xs btn-success" onclick="approveItem('${item.collection}','${item.id}','approved')">✅</button><button class="btn btn-xs btn-danger" onclick="approveItem('${item.collection}','${item.id}','rejected')">❌</button>` : `<span class="badge badge-warning" style="font-size:.6rem">Menunggu ${escHtml(steps[currentStep]?.nama || '')}</span>`}</div></div>${progressHtml}</div>`;
  });
  if (!visibleCount)
    h =
      '<div class="empty-state"><div class="icon">✅</div><p>Tidak ada pengajuan pending</p></div>';
  document.getElementById('approvalList').innerHTML = h;
}

// ── APPROVAL DETAIL HELPERS ────────────────────────────────────
function _buildEmployeeProfile(karyawan, p) {
  let h =
    '<div style="border-left:4px solid var(--accent);background:#f8f9ff;padding:14px 16px;border-radius:0 8px 8px 0;margin-bottom:16px">';
  h += '<div class="fw-700 mb-8" style="font-size:.9rem">👤 Profil Karyawan</div>';
  h += '<div class="grid-2" style="gap:8px;font-size:.85rem">';
  h += `<div><b>Nama:</b> ${escHtml(p.nama || '-')}</div>`;
  if (karyawan) {
    h += `<div><b>Departemen:</b> ${escHtml(karyawan.departemen || '-')}</div>`;
    h += `<div><b>Posisi:</b> ${escHtml(karyawan.posisi || '-')}</div>`;
    h += `<div><b>Grade:</b> ${escHtml(karyawan.gradeJabatan || karyawan.grade || '-')}</div>`;
    h += `<div><b>Masa Kerja:</b> ${hitungMasaKerja(karyawan.tanggalMasuk)}</div>`;
    h += `<div><b>NIP:</b> ${escHtml(karyawan.nip || karyawan.id || '-')}</div>`;
  } else {
    if (p.departemen) h += `<div><b>Departemen:</b> ${escHtml(p.departemen)}</div>`;
    h += `<div><b>Data karyawan:</b> <span style="color:#999">Tidak ditemukan</span></div>`;
  }
  h += '</div></div>';
  return h;
}

async function _buildCutiDetail(p, karyawan) {
  let h =
    '<div style="background:#fff;padding:14px;border-radius:8px;border:1px solid var(--border);margin-bottom:16px">';
  h += '<div class="fw-700 mb-8" style="font-size:.88rem">🏖️ Detail Cuti/Izin</div>';
  h += '<div class="grid-2" style="gap:8px;font-size:.85rem">';
  h += `<div><b>Jenis:</b> ${escHtml(p.jenis || '-')}</div>`;
  h += `<div><b>Durasi:</b> ${p.durasi || '-'} hari</div>`;
  h += `<div><b>Mulai:</b> ${formatDate(p.mulai)}</div>`;
  h += `<div><b>Selesai:</b> ${formatDate(p.selesai)}</div>`;
  if (p.keterangan)
    h += `<div style="grid-column:1/-1"><b>Keterangan:</b> ${escHtml(p.keterangan)}</div>`;
  h += '</div>';
  // Leave quota calculation
  if (karyawan && (p.jenis || '').toLowerCase().includes('cuti tahunan')) {
    try {
      const jatah = hitungJatahCuti(karyawan);
      const cutiSnap = await db.collection('hrd_cuti').where('nama', '==', p.nama).get();
      let terpakai = 0;
      cutiSnap.forEach((d) => {
        const cd = d.data();
        if (cd.jenis === 'Cuti Tahunan' && cd.status === 'approved') terpakai += cd.durasi || 0;
      });
      const sisa = Math.max(0, jatah - terpakai);
      h +=
        '<div style="margin-top:12px;padding:10px;background:#f0f7ff;border-radius:6px;font-size:.83rem">';
      h += `<div class="fw-700 mb-4">📊 Sisa Jatah Cuti Tahunan</div>`;
      h += `<div>Jatah: <b>${jatah}</b> hari | Terpakai: <b>${terpakai}</b> hari | Sisa: <b style="color:${sisa <= 2 ? '#d32f2f' : '#2e7d32'}">${sisa}</b> hari</div>`;
      if (sisa < (p.durasi || 0))
        h += `<div style="color:#d32f2f;margin-top:4px;font-weight:700">⚠️ Pengajuan melebihi sisa cuti!</div>`;
      h += '</div>';
    } catch (e) {
      console.warn('Error loading cuti quota:', e);
    }
  }
  // Holiday overlap check
  try {
    if (p.mulai && p.selesai) {
      const hSnap = await db.collection('hrd_hari_libur').get();
      const holidays = [];
      hSnap.forEach((d) => {
        const hd = d.data();
        if (hd.tanggal) holidays.push(hd);
      });
      const start = new Date(p.mulai),
        end = new Date(p.selesai);
      const overlaps = holidays.filter((hl) => {
        const ht = new Date(hl.tanggal);
        return ht >= start && ht <= end;
      });
      if (overlaps.length) {
        h +=
          '<div style="margin-top:8px;padding:8px;background:#fff3e0;border-radius:6px;font-size:.82rem">';
        h += `<div class="fw-700">📅 Tanggal bertepatan hari libur (${overlaps.length}):</div>`;
        overlaps.forEach((ol) => {
          h += `<div>• ${formatDate(ol.tanggal)} - ${escHtml(ol.nama || ol.keterangan || '')}</div>`;
        });
        h += '</div>';
      }
    }
  } catch (e) {
    console.warn('Error checking holidays:', e);
  }
  h += '</div>';
  return h;
}

async function _buildOvertimeDetail(p, karyawan) {
  let h =
    '<div style="background:#fff;padding:14px;border-radius:8px;border:1px solid var(--border);margin-bottom:16px">';
  h += '<div class="fw-700 mb-8" style="font-size:.88rem">⏰ Detail Lembur</div>';
  h += '<div class="grid-2" style="gap:8px;font-size:.85rem">';
  h += `<div><b>Tanggal:</b> ${formatDate(p.tanggal)}</div>`;
  h += `<div><b>Durasi:</b> ${p.durasi || '-'} jam</div>`;
  h += `<div><b>Jam Mulai:</b> ${p.jamMulai || '-'}</div>`;
  h += `<div><b>Jam Selesai:</b> ${p.jamSelesai || '-'}</div>`;
  if (p.alasan) h += `<div style="grid-column:1/-1"><b>Alasan:</b> ${escHtml(p.alasan)}</div>`;
  h += '</div>';
  // Monthly overtime total
  try {
    const tgl = p.tanggal || '';
    const monthPrefix = tgl.substring(0, 7); // YYYY-MM
    if (monthPrefix && p.nama) {
      const otSnap = await db.collection('hrd_overtime').where('nama', '==', p.nama).get();
      let totalJam = 0;
      otSnap.forEach((d) => {
        const od = d.data();
        if (od.status === 'approved' && (od.tanggal || '').startsWith(monthPrefix))
          totalJam += parseFloat(od.durasi) || 0;
      });
      h +=
        '<div style="margin-top:12px;padding:10px;background:#f0f7ff;border-radius:6px;font-size:.83rem">';
      h += `<div class="fw-700 mb-4">📊 Total Lembur Bulan Ini (Approved)</div>`;
      h += `<div>Total: <b>${totalJam}</b> jam</div>`;
      h += '</div>';
    }
  } catch (e) {
    console.warn('Error loading monthly OT:', e);
  }
  // Estimated overtime pay
  if (karyawan && karyawan.gajiPokok) {
    const gaji = parseFloat(karyawan.gajiPokok) || 0;
    const hariKerja = 22;
    const gajiPerJam = gaji / (hariKerja * 8);
    const durasi = parseFloat(p.durasi) || 0;
    let lemburNominal = 0;
    if (durasi > 0) {
      lemburNominal += gajiPerJam * 1.5;
      if (durasi > 1) lemburNominal += gajiPerJam * 2 * (durasi - 1);
    }
    h +=
      '<div style="margin-top:8px;padding:10px;background:#e8f5e9;border-radius:6px;font-size:.83rem">';
    h += `<div class="fw-700 mb-4">💰 Estimasi Upah Lembur</div>`;
    h += `<div>Gaji/jam: ${formatCurrency(Math.round(gajiPerJam))} | 1 jam pertama: 1.5x | Jam berikutnya: 2x</div>`;
    h += `<div class="fw-700" style="margin-top:4px">Estimasi: ${formatCurrency(Math.round(lemburNominal))}</div>`;
    h += '</div>';
  }
  h += '</div>';
  return h;
}

async function _buildDinasDetail(p, karyawan) {
  let h =
    '<div style="background:#fff;padding:14px;border-radius:8px;border:1px solid var(--border);margin-bottom:16px">';
  h += '<div class="fw-700 mb-8" style="font-size:.88rem">✈️ Detail Perjalanan Dinas</div>';
  h += '<div class="grid-2" style="gap:8px;font-size:.85rem">';
  const tglMulai = p.tanggalMulai || p.tanggal || '';
  const tglSelesai = p.tanggalSelesai || p.tanggal || '';
  h += `<div><b>Tanggal:</b> ${formatDate(tglMulai)}${tglSelesai && tglSelesai !== tglMulai ? ' s/d ' + formatDate(tglSelesai) : ''}</div>`;
  h += `<div><b>Tujuan:</b> ${escHtml(p.tujuan || '-')}</div>`;
  if (p.keperluan)
    h += `<div style="grid-column:1/-1"><b>Keperluan:</b> ${escHtml(p.keperluan)}</div>`;
  const grade = p.gradeJabatan || (karyawan && (karyawan.gradeJabatan || karyawan.grade)) || '';
  h += `<div><b>Grade:</b> ${escHtml(grade || '-')}</div>`;
  // Duration
  if (tglMulai && tglSelesai) {
    const dur = Math.max(1, Math.ceil((new Date(tglSelesai) - new Date(tglMulai)) / 86400000) + 1);
    h += `<div><b>Durasi:</b> ${dur} hari</div>`;
  }
  h += '</div>';
  // Grade-based benefit entitlement
  try {
    const gradeConfig = await getGradeConfig(grade);
    if (gradeConfig) {
      h +=
        '<div style="margin-top:12px;padding:10px;background:#f0f7ff;border-radius:6px;font-size:.83rem">';
      h += `<div class="fw-700 mb-4">📋 Hak Benefit (${escHtml(gradeConfig.label || resolveGradeKey(grade))})</div>`;
      h += '<div class="grid-2" style="gap:6px">';
      h += `<div>Uang Harian: ${formatCurrency(gradeConfig.uangHarian || 0)}</div>`;
      h += `<div>Max Transport: ${formatCurrency(gradeConfig.maxTransport || 0)}</div>`;
      h += `<div>Max Hotel: ${formatCurrency(gradeConfig.maxHotel || 0)}</div>`;
      h += `<div>Max Makan: ${formatCurrency(gradeConfig.maxMakan || 0)}</div>`;
      h += '</div></div>';
      // Cost comparison
      const costs = [
        {
          label: 'Biaya Harian',
          submitted: parseFloat(p.biayaHarian) || 0,
          max: gradeConfig.uangHarian || 0,
        },
        {
          label: 'Transport PP',
          submitted: parseFloat(p.biayaTransportPP) || 0,
          max: gradeConfig.maxTransport || 0,
        },
        {
          label: 'Penginapan',
          submitted: parseFloat(p.biayaPenginapan) || 0,
          max: gradeConfig.maxHotel || 0,
        },
        {
          label: 'Makan',
          submitted: parseFloat(p.biayaMakan) || 0,
          max: gradeConfig.maxMakan || 0,
        },
      ];
      const hasAnyCost = costs.some((c) => c.submitted > 0);
      if (hasAnyCost) {
        h +=
          '<div style="margin-top:8px;padding:10px;background:#fff;border-radius:6px;border:1px solid var(--border);font-size:.83rem">';
        h += '<div class="fw-700 mb-4">💰 Perbandingan Biaya vs Limit</div>';
        costs.forEach((c) => {
          if (c.submitted > 0 || c.max > 0) {
            const exceed = c.submitted > c.max;
            h += `<div style="margin-bottom:4px;${exceed ? 'color:#d32f2f;font-weight:700' : ''}">`;
            h += `${exceed ? '⚠️ ' : ''}${c.label}: ${formatCurrency(c.submitted)} / ${formatCurrency(c.max)}`;
            if (exceed) h += ' (MELEBIHI LIMIT)';
            h += '</div>';
          }
        });
        if (p.totalEstimasi)
          h += `<div style="margin-top:6px;font-weight:700">Total Estimasi: ${formatCurrency(parseFloat(p.totalEstimasi) || 0)}</div>`;
        h += '</div>';
      }
    }
  } catch (e) {
    console.warn('Error loading grade config:', e);
  }
  h += '</div>';
  return h;
}

async function _buildReimbDetail(p) {
  let h =
    '<div style="background:#fff;padding:14px;border-radius:8px;border:1px solid var(--border);margin-bottom:16px">';
  h += '<div class="fw-700 mb-8" style="font-size:.88rem">🧾 Detail Reimbursement</div>';
  h += '<div class="grid-2" style="gap:8px;font-size:.85rem">';
  h += `<div><b>Kategori:</b> ${escHtml(p.kategori || '-')}</div>`;
  h += `<div><b>Jumlah:</b> ${formatCurrency(parseFloat(p.jumlah) || 0)}</div>`;
  if (p.keterangan)
    h += `<div style="grid-column:1/-1"><b>Keterangan:</b> ${escHtml(p.keterangan)}</div>`;
  h += '</div>';
  // Claim history
  try {
    if (p.nama) {
      const rSnap = await db.collection('hrd_reimbursement').where('nama', '==', p.nama).get();
      let totalBulan = 0,
        totalTahun = 0;
      const now = new Date();
      const bulanIni = now.toISOString().substring(0, 7);
      const tahunIni = now.getFullYear().toString();
      const byCategory = {};
      rSnap.forEach((d) => {
        const rd = d.data();
        if (rd.status !== 'approved') return;
        const amt = parseFloat(rd.jumlah) || 0;
        const cr = rd.createdAt || '';
        if (cr.startsWith(bulanIni)) totalBulan += amt;
        if (cr.startsWith(tahunIni)) totalTahun += amt;
        const cat = rd.kategori || 'Lainnya';
        byCategory[cat] = (byCategory[cat] || 0) + amt;
      });
      h +=
        '<div style="margin-top:12px;padding:10px;background:#f0f7ff;border-radius:6px;font-size:.83rem">';
      h += `<div class="fw-700 mb-4">📊 Riwayat Klaim (Approved)</div>`;
      h += `<div>Bulan ini: <b>${formatCurrency(totalBulan)}</b> | Tahun ini: <b>${formatCurrency(totalTahun)}</b></div>`;
      const cats = Object.keys(byCategory);
      if (cats.length) {
        h += '<div style="margin-top:6px"><b>Per Kategori (tahun ini):</b></div>';
        cats.forEach((cat) => {
          h += `<div>• ${escHtml(cat)}: ${formatCurrency(byCategory[cat])}</div>`;
        });
      }
      h += '</div>';
    }
  } catch (e) {
    console.warn('Error loading reimb history:', e);
  }
  h += '</div>';
  return h;
}

async function _buildKasbonDetail(p, karyawan) {
  let h =
    '<div style="background:#fff;padding:14px;border-radius:8px;border:1px solid var(--border);margin-bottom:16px">';
  h += '<div class="fw-700 mb-8" style="font-size:.88rem">💳 Detail Kasbon/Pinjaman</div>';
  h += '<div class="grid-2" style="gap:8px;font-size:.85rem">';
  h += `<div><b>Jenis:</b> ${escHtml(p.jenis || '-')}</div>`;
  h += `<div><b>Jumlah:</b> ${formatCurrency(parseFloat(p.jumlah) || 0)}</div>`;
  h += `<div><b>Cicilan:</b> ${p.cicilan || '-'}x</div>`;
  if (p.angsuran)
    h += `<div><b>Angsuran/bulan:</b> ${formatCurrency(parseFloat(p.angsuran) || 0)}</div>`;
  h += '</div>';
  // Existing active loans
  try {
    if (p.nama) {
      const kSnap = await db.collection('hrd_kasbon').where('nama', '==', p.nama).get();
      let totalOutstanding = 0;
      let activeCount = 0;
      kSnap.forEach((d) => {
        const kd = d.data();
        if (kd.status !== 'approved') return;
        const jumlah = parseFloat(kd.jumlah) || 0;
        const sudahBayar = parseFloat(kd.sudahBayar) || 0;
        const sisa = jumlah - sudahBayar;
        if (sisa > 0) {
          totalOutstanding += sisa;
          activeCount++;
        }
      });
      h +=
        '<div style="margin-top:12px;padding:10px;background:#f0f7ff;border-radius:6px;font-size:.83rem">';
      h += `<div class="fw-700 mb-4">📊 Pinjaman Aktif</div>`;
      h += `<div>Jumlah pinjaman aktif: <b>${activeCount}</b> | Total sisa: <b>${formatCurrency(totalOutstanding)}</b></div>`;
      // Loan-to-salary ratio
      if (karyawan && karyawan.gajiPokok) {
        const gaji = parseFloat(karyawan.gajiPokok) || 0;
        const pinjBaru = parseFloat(p.jumlah) || 0;
        const ratio = gaji > 0 ? Math.round((pinjBaru / gaji) * 100) : 0;
        h += `<div style="margin-top:6px">Rasio pinjaman/gaji: <b style="color:${ratio > 50 ? '#d32f2f' : '#2e7d32'}">${ratio}%</b>${ratio > 50 ? ' ⚠️ Melebihi 50%' : ''}</div>`;
      }
      h += '</div>';
    }
  } catch (e) {
    console.warn('Error loading kasbon history:', e);
  }
  h += '</div>';
  return h;
}

function _buildGenericDetail(p) {
  let h =
    '<div style="background:#fff;padding:14px;border-radius:8px;border:1px solid var(--border);margin-bottom:16px">';
  h += '<div class="fw-700 mb-8" style="font-size:.88rem">📄 Detail Pengajuan</div>';
  h += '<div class="grid-2" style="gap:8px;font-size:.85rem">';
  if (p.jenis) h += `<div><b>Jenis:</b> ${escHtml(p.jenis)}</div>`;
  if (p.kategori) h += `<div><b>Kategori:</b> ${escHtml(p.kategori)}</div>`;
  if (p.tanggal) h += `<div><b>Tanggal:</b> ${formatDate(p.tanggal)}</div>`;
  if (p.mulai) h += `<div><b>Mulai:</b> ${formatDate(p.mulai)}</div>`;
  if (p.selesai) h += `<div><b>Selesai:</b> ${formatDate(p.selesai)}</div>`;
  if (p.durasi) h += `<div><b>Durasi:</b> ${p.durasi}</div>`;
  if (p.jumlah) h += `<div><b>Jumlah:</b> ${formatCurrency(parseFloat(p.jumlah) || 0)}</div>`;
  if (p.tujuan) h += `<div><b>Tujuan:</b> ${escHtml(p.tujuan)}</div>`;
  if (p.keterangan)
    h += `<div style="grid-column:1/-1"><b>Keterangan:</b> ${escHtml(p.keterangan)}</div>`;
  if (p.alasan) h += `<div style="grid-column:1/-1"><b>Alasan:</b> ${escHtml(p.alasan)}</div>`;
  if (p.keperluan)
    h += `<div style="grid-column:1/-1"><b>Keperluan:</b> ${escHtml(p.keperluan)}</div>`;
  h += '</div></div>';
  return h;
}

function _buildApprovalTimeline(p) {
  if (!p.approvalHistory || !p.approvalHistory.length) return '';
  let h =
    '<div style="margin-bottom:16px"><div class="fw-700 mb-8" style="font-size:.88rem">📋 Riwayat Approval</div>';
  h += '<div style="padding-left:16px;border-left:2px solid #e0e0e0">';
  p.approvalHistory.forEach(function (entry, i) {
    const isLast = i === p.approvalHistory.length - 1;
    const color =
      entry.action === 'approved' ? '#2e7d32' : entry.action === 'rejected' ? '#d32f2f' : '#ff9800';
    h += `<div style="position:relative;padding:8px 0 12px 16px;${isLast ? '' : 'border-bottom:none'}">`;
    h += `<div style="position:absolute;left:-9px;top:12px;width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 2px ${color}"></div>`;
    h += `<div style="font-size:.83rem"><span class="fw-700" style="color:${color}">${entry.action === 'approved' ? '✅ Disetujui' : '❌ Ditolak'}</span> oleh <b>${escHtml(entry.nama || '')}</b> <span style="color:#666">(${escHtml(entry.role || '')})</span></div>`;
    h += `<div style="font-size:.75rem;color:#999;margin-top:2px">${formatDateTime(entry.at)}</div>`;
    if (entry.catatan)
      h += `<div style="font-size:.8rem;color:#555;margin-top:4px;padding:4px 8px;background:#f5f5f5;border-radius:4px">💬 ${escHtml(entry.catatan)}</div>`;
    h += '</div>';
  });
  h += '</div></div>';
  return h;
}

function _buildApprovalActions(col, id) {
  if (!hasAccess(3))
    return '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)"><p style="color:var(--text-secondary);font-size:.85rem">⏳ Menunggu approval</p></div>';
  let h = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">';
  h +=
    '<div class="form-group"><label class="fw-700" style="font-size:.85rem">💬 Catatan (opsional)</label>';
  h +=
    '<textarea class="form-control" id="approvalCatatan" rows="2" placeholder="Tambahkan catatan untuk pemohon..." style="font-size:.85rem"></textarea></div>';
  h += '<div class="flex gap-8 mt-8">';
  h += `<button class="btn btn-success" onclick="_doApprovalAction('${col}','${id}','approved')">✅ Approve</button>`;
  h += `<button class="btn btn-danger" onclick="_doApprovalAction('${col}','${id}','rejected')">❌ Reject</button>`;
  h += '</div></div>';
  return h;
}

function _doApprovalAction(col, id, status) {
  const el = document.getElementById('approvalCatatan');
  const catatan = el ? el.value.trim() : '';
  approveItem(col, id, status, catatan);
}

async function viewApprovalDetail(col, id) {
  try {
    const d = await db.collection(col).doc(id).get();
    const p = d.data();
    const type = col.replace('hrd_', '').replace('_', ' ').toUpperCase();
    // Fetch employee data
    let karyawan = null;
    try {
      const kSnap = await db.collection('hrd_karyawan').where('nama', '==', p.nama).limit(1).get();
      if (!kSnap.empty) {
        const kDoc = kSnap.docs[0];
        karyawan = { id: kDoc.id, ...kDoc.data() };
      }
    } catch (e) {
      console.warn('Error fetching karyawan:', e);
    }
    let html = `<div class="modal-title">📋 Detail Pengajuan - ${type}</div>`;
    html += `<div style="max-height:70vh;overflow-y:auto;padding-right:4px">`;
    // Employee profile
    html += _buildEmployeeProfile(karyawan, p);
    // Status badge
    html += `<div style="margin-bottom:12px"><b>Status:</b> <span class="badge badge-${p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'danger' : 'warning'}">${escHtml(p.status || 'pending')}</span> | <b>Diajukan:</b> ${formatDateTime(p.createdAt)}</div>`;
    // Type-specific details
    if (col === 'hrd_cuti') html += await _buildCutiDetail(p, karyawan);
    else if (col === 'hrd_overtime') html += await _buildOvertimeDetail(p, karyawan);
    else if (col === 'hrd_dinas_luar') html += await _buildDinasDetail(p, karyawan);
    else if (col === 'hrd_reimbursement') html += await _buildReimbDetail(p);
    else if (col === 'hrd_kasbon') html += await _buildKasbonDetail(p, karyawan);
    else html += _buildGenericDetail(p);
    // Approval timeline
    html += _buildApprovalTimeline(p);
    html += '</div>';
    // Action buttons with catatan
    html += _buildApprovalActions(col, id);
    openModal(html, true);
  } catch (e) {
    console.error('viewApprovalDetail error:', e);
    toast('Gagal memuat detail', 'error');
  }
}

async function approveItem(col, id, status, catatan) {
  const doc = await db.collection(col).doc(id).get();
  const data = doc.data();
  const currentStep = data.approvalStep || 0;
  const history = data.approvalHistory || [];
  const entry = {
    nama: currentUser.nama,
    role: currentUser.role,
    action: status,
    at: new Date().toISOString(),
  };
  if (catatan) entry.catatan = catatan;
  history.push(entry);
  if (status === 'rejected') {
    await db.collection(col).doc(id).update({
      status: 'rejected',
      approvedBy: currentUser.nama,
      approvedAt: new Date().toISOString(),
      approvalHistory: history,
    });
    if (data.userId)
      await sendNotification(
        data.userId,
        '❌ Ditolak',
        `Pengajuan ${data.jenis || col.replace('hrd_', '')} ditolak oleh ${currentUser.nama}`
      );
  } else {
    const flowSnap = await db
      .collection('hrd_approval_flow')
      .where('pengaju', '==', data.nama)
      .get();
    let steps = [];
    flowSnap.forEach((d) => {
      const f = d.data();
      if (!steps.length) steps = f.steps || [];
    });
    const nextStep = currentStep + 1;
    if (nextStep < steps.length) {
      await db
        .collection(col)
        .doc(id)
        .update({
          status: `step${nextStep}`,
          approvalStep: nextStep,
          approvalHistory: history,
          lastApprovedBy: currentUser.nama,
        });
      const nextApprover = steps[nextStep];
      if (nextApprover?.nama) {
        const uSnap = await db
          .collection('hrd_users')
          .where('nama', '==', nextApprover.nama)
          .limit(1)
          .get();
        if (!uSnap.empty)
          await sendNotification(
            uSnap.docs[0].id,
            '📋 Perlu Approval',
            `${data.nama}: ${data.jenis || col.replace('hrd_', '')} — disetujui ${currentUser.nama}, menunggu Anda`
          );
      }
      if (data.userId)
        await sendNotification(
          data.userId,
          '⏳ Proses',
          `Disetujui ${currentUser.nama}, menunggu ${nextApprover?.nama || 'selanjutnya'}`
        );
    } else {
      await db.collection(col).doc(id).update({
        status: 'approved',
        approvedBy: currentUser.nama,
        approvedAt: new Date().toISOString(),
        approvalStep: nextStep,
        approvalHistory: history,
      });
      if (data.userId)
        await sendNotification(
          data.userId,
          '✅ Disetujui (Final)',
          `Pengajuan ${data.jenis || col.replace('hrd_', '')} DISETUJUI oleh ${currentUser.nama}`
        );
    }
  }
  closeModalDirect();
  toast(status === 'approved' ? 'Disetujui' : 'Ditolak', 'success');
  invalidateApprovalFlowCache();
  renderApprovalCenter();
}

// ── APPROVAL MANAGEMENT ───────────────────────────────────────
async function renderApprovalMgmt() {
  if (!hasAccess(6))
    return (document.getElementById('mainContent').innerHTML =
      '<div class="card"><p>Akses ditolak.</p></div>');
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>⚙️ Approval Management</span><div class="flex gap-8"><button class="btn btn-success btn-sm" onclick="generateAllApprovalFlows()">⚡ Generate Semua</button><button class="btn btn-primary btn-sm" onclick="modalApprovalFlow()">+ Tambah Flow</button></div></div><div class="card"><p class="text-sm mb-16" style="color:#666">Konfigurasi alur approval multi-step berdasarkan struktur organisasi. Klik "Generate Semua" untuk otomatis membuat flow berdasarkan data karyawan.</p><div class="table-wrap"><table><thead><tr><th>Jenis</th><th>Pengaju</th><th>Dept</th><th>Approver Steps</th><th>Aksi</th></tr></thead><tbody id="tblApprFlow"></tbody></table></div></div>`;
  const snap = await db.collection('hrd_approval_flow').get();
  let h = '';
  if (snap.empty)
    h =
      '<tr><td colspan="5" class="text-center">Belum ada flow. Klik "Generate Semua" untuk membuat otomatis.</td></tr>';
  else {
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    items.sort(
      (a, b) =>
        (a.jenis || '').localeCompare(b.jenis || '') ||
        (a.pengaju || '').localeCompare(b.pengaju || '')
    );
    items.forEach((p) => {
      h += `<tr><td class="fw-700">${escHtml(p.jenis)}</td><td>${escHtml(p.pengaju || 'Semua')}</td><td>${escHtml(p.departemen || 'Semua')}</td><td>${(p.steps || []).map((s) => `<span class="badge badge-primary">${escHtml(s.nama || s.role)}</span>`).join(' → ')}</td><td><button class="btn btn-xs btn-info" onclick="viewApprovalFlow('${p.id}')">👁️</button> <button class="btn btn-xs btn-primary" onclick="editApprovalFlow('${p.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_approval_flow','${p.id}','approval-mgmt')">🗑️</button></td></tr>`;
    });
  }
  document.getElementById('tblApprFlow').innerHTML = h;
}

async function generateAllApprovalFlows() {
  if (
    !confirm(
      'Generate approval flow untuk SEMUA karyawan berdasarkan struktur organisasi?\n\nFlow yang sudah ada akan dihapus dan dibuat ulang.'
    )
  )
    return;
  // Delete existing flows
  const existSnap = await db.collection('hrd_approval_flow').get();
  if (!existSnap.empty) {
    const batch = db.batch();
    existSnap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  // Load karyawan
  const kSnap = await db.collection('hrd_karyawan').where('status', '!=', 'nonaktif').get();
  const karyawan = [];
  kSnap.forEach((d) => karyawan.push({ id: d.id, ...d.data() }));
  // Jenis pengajuan
  const jenisArr = [
    'Cuti/Izin',
    'WFH',
    'Dinas Luar',
    'Overtime',
    'SPPD',
    'Reimbursement',
    'Kasbon',
    'Insentif',
    'Penggajian',
    'Onboarding',
    'Offboarding',
    'Perpanjangan Kontrak',
    'Pelatihan',
  ];
  // For each staff/leader, create approval flow based on atasan hierarchy
  const staffAndLeaders = karyawan.filter((k) => {
    const pos = (k.posisi || '').toLowerCase();
    return !pos.includes('founder');
  });
  let count = 0;
  for (const k of staffAndLeaders) {
    // Build approval chain: atasan → atasan's atasan → admin
    const steps = [];
    // Step 1: Direct atasan
    if (k.atasan && k.atasan.toLowerCase() !== 'founder') {
      const atasan = karyawan.find((a) => a.nama?.toLowerCase() === k.atasan?.toLowerCase());
      if (atasan) steps.push({ nama: atasan.nama, role: atasan.posisi || '', userId: atasan.id });
    }
    // Step 2: Head (if atasan is not head)
    if (steps.length && steps[0].role) {
      const step1Pos = (steps[0].role || '').toLowerCase();
      if (!step1Pos.includes('head') && !step1Pos.includes('general')) {
        // Find head of department
        const head = karyawan.find(
          (a) =>
            (a.posisi || '').toLowerCase().includes('head') &&
            (a.departemen || '').toLowerCase() === (k.departemen || '').toLowerCase()
        );
        if (head && head.nama !== steps[0].nama)
          steps.push({ nama: head.nama, role: head.posisi || '', userId: head.id });
      }
    }
    // Step 3: GM (for important items) — skip if the person IS the GM
    const gm = karyawan.find((a) => (a.posisi || '').toLowerCase().includes('general manager'));
    if (gm && gm.nama !== k.nama && !steps.find((s) => s.nama === gm.nama))
      steps.push({ nama: gm.nama, role: 'General Manager', userId: gm.id });
    // For GM: approver is Founder/BOD
    if ((k.posisi || '').toLowerCase().includes('general manager')) {
      const founder = karyawan.find((a) => (a.posisi || '').toLowerCase().includes('founder'));
      if (founder) steps.push({ nama: founder.nama, role: 'Founder/BOD', userId: founder.id });
    }
    // If no steps found, default to admin
    if (!steps.length) steps.push({ nama: 'Admin', role: 'admin' });
    // Create flow for each jenis
    for (const jenis of jenisArr) {
      await db.collection('hrd_approval_flow').add({
        jenis,
        pengaju: k.nama,
        departemen: k.departemen || '',
        steps,
        createdAt: new Date().toISOString(),
      });
      count++;
    }
  }
  toast(`${count} approval flow di-generate untuk ${staffAndLeaders.length} karyawan`, 'success');
  renderApprovalMgmt();
}

function viewApprovalFlow(id) {
  db.collection('hrd_approval_flow')
    .doc(id)
    .get()
    .then((d) => {
      const p = d.data();
      let stepsHtml = '';
      (p.steps || []).forEach((s, i) => {
        stepsHtml += `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)"><span class="badge badge-primary" style="font-size:.8rem">Step ${i + 1}</span><span class="fw-700">${escHtml(s.nama || s.role)}</span><span class="text-xs" style="color:#999">${escHtml(s.role || '')}</span></div>`;
      });
      openModal(`<div class="modal-title">📋 Detail Approval Flow</div>
      <div class="grid-2 mb-16"><div><b>Jenis:</b> ${escHtml(p.jenis)}</div><div><b>Pengaju:</b> ${escHtml(p.pengaju || 'Semua')}</div><div><b>Departemen:</b> ${escHtml(p.departemen || 'Semua')}</div></div>
      <div class="fw-700 text-sm mb-8 color-primary">Alur Approval:</div>
      <div style="background:#f8f9ff;padding:12px;border-radius:8px">${stepsHtml || '<p class="text-sm" style="color:#999">Tidak ada step</p>'}</div>`);
    });
}

async function editApprovalFlow(id) {
  const d = await db.collection('hrd_approval_flow').doc(id).get();
  const p = d.data();
  const kSnap = await db.collection('hrd_karyawan').where('status', '!=', 'nonaktif').get();
  let approverOpts = '<option value="">-- Tidak ada --</option>';
  kSnap.forEach((doc) => {
    const k = doc.data();
    approverOpts += `<option value="${escHtml(k.nama)}">${escHtml(k.nama)} — ${escHtml(k.posisi || '')} (${escHtml(k.departemen || '')})</option>`;
  });
  const steps = p.steps || [];
  openModal(
    `<div class="modal-title">✏️ Edit Approval Flow</div>
    <div class="grid-2 mb-16"><div><b>Jenis:</b> ${escHtml(p.jenis)}</div><div><b>Pengaju:</b> ${escHtml(p.pengaju)}</div></div>
    <div class="form-group"><label>Approver Step 1</label><select class="form-control" id="eafStep1">${approverOpts.replace(`value="${escHtml(steps[0]?.nama || '')}"`, `value="${escHtml(steps[0]?.nama || '')}" selected`)}</select></div>
    <div class="form-group"><label>Approver Step 2</label><select class="form-control" id="eafStep2">${approverOpts.replace(`value="${escHtml(steps[1]?.nama || '')}"`, `value="${escHtml(steps[1]?.nama || '')}" selected`)}</select></div>
    <div class="form-group"><label>Approver Step 3</label><select class="form-control" id="eafStep3">${approverOpts.replace(`value="${escHtml(steps[2]?.nama || '')}"`, `value="${escHtml(steps[2]?.nama || '')}" selected`)}</select></div>
    <button class="btn btn-primary" onclick="simpanEditApprovalFlow('${id}')">💾 Simpan</button>`,
    true
  );
  // Set selected values properly
  setTimeout(() => {
    if (steps[0]) document.getElementById('eafStep1').value = steps[0].nama || '';
    if (steps[1]) document.getElementById('eafStep2').value = steps[1].nama || '';
    if (steps[2]) document.getElementById('eafStep3').value = steps[2].nama || '';
  }, 100);
}

async function simpanEditApprovalFlow(id) {
  const steps = [];
  const s1 = document.getElementById('eafStep1').value;
  const s2 = document.getElementById('eafStep2').value;
  const s3 = document.getElementById('eafStep3').value;
  if (s1) steps.push({ nama: s1, role: s1 });
  if (s2) steps.push({ nama: s2, role: s2 });
  if (s3) steps.push({ nama: s3, role: s3 });
  if (!steps.length) return toast('Minimal 1 approver', 'warning');
  await db
    .collection('hrd_approval_flow')
    .doc(id)
    .update({ steps, updatedAt: new Date().toISOString() });
  closeModalDirect();
  toast('Flow diupdate', 'success');
  renderApprovalMgmt();
}
async function modalApprovalFlow() {
  const kSnap = await db.collection('hrd_karyawan').where('status', '==', 'aktif').get();
  let karyOpts = '<option value="Semua">Semua Karyawan</option>';
  let approverOpts = '';
  const depts = new Set();
  kSnap.forEach((d) => {
    const k = d.data();
    karyOpts += `<option value="${escHtml(k.nama)}">${escHtml(k.nama)} — ${escHtml(k.departemen || '')} (${escHtml(k.posisi || '')})</option>`;
    depts.add(k.departemen || '');
    const pos = (k.posisi || '').toUpperCase();
    if (
      pos.includes('HEAD') ||
      pos.includes('MANAGER') ||
      pos.includes('GENERAL') ||
      pos.includes('FOUNDER')
    )
      approverOpts += `<option value="${escHtml(k.nama)}">${escHtml(k.nama)} — ${escHtml(k.posisi || '')} (${escHtml(k.departemen || '')})</option>`;
  });
  let deptOpts = '';
  depts.forEach((d) => {
    if (d) deptOpts += `<option>${escHtml(d)}</option>`;
  });
  openModal(
    `<div class="modal-title">Tambah Approval Flow</div>
    <div class="form-group"><label>Jenis Pengajuan</label><select class="form-control" id="afJenis"><option value="Cuti/Izin">Cuti / Izin</option><option value="WFH">WFH (Work From Home)</option><option value="Dinas Luar">Dinas Luar</option><option value="Overtime">Overtime / Lembur</option><option value="Reimbursement">Reimbursement</option><option value="Kasbon">Kasbon & Loan</option><option value="Insentif">Insentif</option><option value="Penggajian">Penggajian</option><option value="Onboarding">Onboarding</option><option value="Offboarding">Offboarding</option><option value="Perpanjangan Kontrak">Perpanjangan Kontrak</option><option value="Pelatihan">Pelatihan</option></select></div>
    <div class="form-group"><label>Departemen</label><select class="form-control" id="afDept" onchange="filterApprovalByDept()"><option value="">Semua Departemen</option>${deptOpts}</select></div>
    <div class="form-group"><label>Siapa yang Mengajukan</label><select class="form-control" id="afPengaju">${karyOpts}</select></div>
    <div class="form-group"><label>Approver Step 1</label><select class="form-control" id="afStep1"><option value="">-- Pilih --</option>${approverOpts}<option value="hr">HR (Role)</option><option value="admin">Admin (Role)</option><option value="superadmin">Super Admin (Role)</option></select></div>
    <div class="form-group"><label>Approver Step 2 (opsional)</label><select class="form-control" id="afStep2"><option value="">-- Tidak ada --</option>${approverOpts}<option value="hr">HR (Role)</option><option value="admin">Admin (Role)</option><option value="superadmin">Super Admin (Role)</option></select></div>
    <div class="form-group"><label>Approver Step 3 (opsional)</label><select class="form-control" id="afStep3"><option value="">-- Tidak ada --</option>${approverOpts}<option value="hr">HR (Role)</option><option value="admin">Admin (Role)</option><option value="superadmin">Super Admin (Role)</option></select></div>
    <button class="btn btn-primary" onclick="simpanApprovalFlow()">Simpan</button>`,
    true
  );
  window._afAllKary = [];
  kSnap.forEach((d) => window._afAllKary.push(d.data()));
}
function filterApprovalByDept() {
  const dept = document.getElementById('afDept').value;
  const sel = document.getElementById('afPengaju');
  let opts = '<option value="Semua">Semua Karyawan</option>';
  (window._afAllKary || []).forEach((k) => {
    if (!dept || (k.departemen || '') === dept)
      opts += `<option value="${escHtml(k.nama)}">${escHtml(k.nama)} — ${escHtml(k.posisi || '')}</option>`;
  });
  sel.innerHTML = opts;
}
async function simpanApprovalFlow() {
  const steps = [];
  const s1 = document.getElementById('afStep1').value;
  const s2 = document.getElementById('afStep2').value;
  const s3 = document.getElementById('afStep3').value;
  if (s1) steps.push({ role: s1, nama: s1 });
  if (s2) steps.push({ role: s2, nama: s2 });
  if (s3) steps.push({ role: s3, nama: s3 });
  if (!steps.length) return toast('Minimal 1 approver', 'warning');
  await db.collection('hrd_approval_flow').add({
    jenis: document.getElementById('afJenis').value,
    departemen: document.getElementById('afDept').value,
    pengaju: document.getElementById('afPengaju').value,
    steps,
    createdAt: new Date().toISOString(),
  });
  closeModalDirect();
  toast('Flow disimpan', 'success');
  renderApprovalMgmt();
}

// ── QR & PWA & DOWNLOAD APP ───────────────────────────────────
function renderQRShare() {
  const url = 'https://hrlegal.netlify.app';
  document.getElementById('mainContent').innerHTML =
    `<div class="page-title"><span>📱 QR, PWA & Download Aplikasi</span></div>
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

function renderDownloadAppSection() {
  const url = 'https://hrlegal.netlify.app';
  const showBtn =
    typeof deferredInstallPrompt !== 'undefined' && deferredInstallPrompt ? 'inline-flex' : 'none';
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

function shareAppWA() {
  const url = 'https://hrlegal.netlify.app';
  const text = encodeURIComponent(
    `📱 *HRD & Legal IJEF Corp*\n\nInstall aplikasi HRD di perangkat Anda:\n${url}\n\n📲 Cara Install:\n• Android: Chrome → Menu → "Add to Home Screen"\n• iPhone: Safari → Share → "Add to Home Screen"\n• PC/Laptop: Chrome → Klik ikon install di address bar\n\nLogin dengan akun karyawan Anda.\n\n— HRD IJEF Corp`
  );
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

async function shareAppBroadcast() {
  const url = 'https://hrlegal.netlify.app';
  const users = await getAllUsers();
  const pesan = `📱 Install Aplikasi HRD IJEF Corp di perangkat Anda: ${url}\n\nCara: Buka link di browser → Install/Add to Home Screen. Login dengan akun karyawan.`;
  await db.collection('hrd_broadcast').add({
    pesan,
    targetLabel: 'Semua',
    pengirim: currentUser.nama,
    createdAt: new Date().toISOString(),
  });
  await sendNotificationBulk(
    users.map((u) => u.id),
    '📱 Install Aplikasi',
    `Buka ${url} dan install di perangkat Anda`
  );
  toast(`Broadcast terkirim ke ${users.length} karyawan`, 'success');
}

// ── EDIT FUNCTIONS — untuk semua modul ────────────────────────
// ══════════════════════════════════════════════════════════════

function editCutiDoc(id) {
  db.collection('hrd_cuti')
    .doc(id)
    .get()
    .then((d) => {
      const p = d.data();
      openModal(
        `<div class="modal-title">✏️ Edit Cuti/Izin</div><div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="ecNama" value="${escHtml(p.nama || '')}"></div><div class="form-group"><label>Jenis</label><select class="form-control" id="ecJenis"><option ${p.jenis === 'Cuti Tahunan' ? 'selected' : ''}>Cuti Tahunan</option><option ${p.jenis === 'Cuti Sakit' ? 'selected' : ''}>Cuti Sakit</option><option ${p.jenis === 'Izin Pribadi' ? 'selected' : ''}>Izin Pribadi</option><option ${p.jenis === 'WFH' ? 'selected' : ''}>WFH</option><option ${p.jenis === 'Cuti Melahirkan' ? 'selected' : ''}>Cuti Melahirkan</option></select></div></div><div class="grid-2"><div class="form-group"><label>Mulai</label><input class="form-control" type="date" id="ecMulai" value="${p.mulai || ''}"></div><div class="form-group"><label>Selesai</label><input class="form-control" type="date" id="ecSelesai" value="${p.selesai || ''}"></div></div><div class="form-group"><label>Status</label><select class="form-control" id="ecStatus"><option value="pending" ${p.status === 'pending' ? 'selected' : ''}>Pending</option><option value="approved" ${p.status === 'approved' ? 'selected' : ''}>Approved</option><option value="rejected" ${p.status === 'rejected' ? 'selected' : ''}>Rejected</option></select></div><div class="form-group"><label>Keterangan</label><textarea class="form-control" id="ecKet">${escHtml(p.keterangan || '')}</textarea></div><button class="btn btn-primary" onclick="updateCutiDoc('${id}')">💾 Simpan</button><button class="btn btn-danger" style="margin-left:8px" onclick="hapusDoc('hrd_cuti','${id}','cuti')">🗑️ Hapus</button>`
      );
    });
}
async function updateCutiDoc(id) {
  const mulai = document.getElementById('ecMulai').value,
    selesai = document.getElementById('ecSelesai').value;
  const durasi = Math.max(1, Math.ceil((new Date(selesai) - new Date(mulai)) / 86400000) + 1);
  await db
    .collection('hrd_cuti')
    .doc(id)
    .update({
      nama: document.getElementById('ecNama').value,
      jenis: document.getElementById('ecJenis').value,
      mulai,
      selesai,
      durasi,
      status: document.getElementById('ecStatus').value,
      keterangan: document.getElementById('ecKet').value,
      updatedAt: new Date().toISOString(),
    });
  closeModalDirect();
  toast('Cuti diupdate', 'success');
  renderCuti();
}

function editOTDoc(id) {
  db.collection('hrd_overtime')
    .doc(id)
    .get()
    .then((d) => {
      const p = d.data();
      openModal(
        `<div class="modal-title">✏️ Edit Overtime</div><div class="form-group"><label>Nama</label><input class="form-control" id="eoNama" value="${escHtml(p.nama || '')}"></div><div class="grid-3"><div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="eoTgl" value="${p.tanggal || ''}"></div><div class="form-group"><label>Mulai</label><input class="form-control" type="time" id="eoStart" value="${p.jamMulai || ''}"></div><div class="form-group"><label>Selesai</label><input class="form-control" type="time" id="eoEnd" value="${p.jamSelesai || ''}"></div></div><div class="form-group"><label>Status</label><select class="form-control" id="eoStatus"><option value="pending" ${p.status === 'pending' ? 'selected' : ''}>Pending</option><option value="approved" ${p.status === 'approved' ? 'selected' : ''}>Approved</option><option value="rejected" ${p.status === 'rejected' ? 'selected' : ''}>Rejected</option></select></div><div class="form-group"><label>Alasan</label><textarea class="form-control" id="eoAlasan">${escHtml(p.alasan || '')}</textarea></div><button class="btn btn-primary" onclick="updateOTDoc('${id}')">💾 Simpan</button><button class="btn btn-danger" style="margin-left:8px" onclick="hapusDoc('hrd_overtime','${id}','overtime')">🗑️ Hapus</button>`
      );
    });
}
async function updateOTDoc(id) {
  const s = document.getElementById('eoStart').value,
    e = document.getElementById('eoEnd').value;
  const durasi =
    s && e
      ? Math.max(0, (new Date('2000-01-01T' + e) - new Date('2000-01-01T' + s)) / 3600000).toFixed(
          1
        )
      : 0;
  await db
    .collection('hrd_overtime')
    .doc(id)
    .update({
      nama: document.getElementById('eoNama').value,
      tanggal: document.getElementById('eoTgl').value,
      jamMulai: s,
      jamSelesai: e,
      durasi: parseFloat(durasi),
      status: document.getElementById('eoStatus').value,
      alasan: document.getElementById('eoAlasan').value,
      updatedAt: new Date().toISOString(),
    });
  closeModalDirect();
  toast('Overtime diupdate', 'success');
  renderOvertime();
}

function editReimb(id) {
  db.collection('hrd_reimbursement')
    .doc(id)
    .get()
    .then((d) => {
      const p = d.data();
      openModal(
        `<div class="modal-title">✏️ Edit Reimbursement</div><div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="erNama" value="${escHtml(p.nama || '')}"></div><div class="form-group"><label>Kategori</label><select class="form-control" id="erKat"><option ${p.kategori === 'Transport' ? 'selected' : ''}>Transport</option><option ${p.kategori === 'Makan' ? 'selected' : ''}>Makan</option><option ${p.kategori === 'Kesehatan' ? 'selected' : ''}>Kesehatan</option><option ${p.kategori === 'Operasional' ? 'selected' : ''}>Operasional</option></select></div></div><div class="form-group"><label>Jumlah (Rp)</label><input class="form-control" type="number" id="erJumlah" value="${p.jumlah || 0}"></div><div class="form-group"><label>Status</label><select class="form-control" id="erStatus"><option value="pending" ${p.status === 'pending' ? 'selected' : ''}>Pending</option><option value="approved" ${p.status === 'approved' ? 'selected' : ''}>Approved</option><option value="rejected" ${p.status === 'rejected' ? 'selected' : ''}>Rejected</option></select></div><div class="form-group"><label>Keterangan</label><textarea class="form-control" id="erKet">${escHtml(p.keterangan || '')}</textarea></div><button class="btn btn-primary" onclick="updateReimb('${id}')">💾 Simpan</button><button class="btn btn-danger" style="margin-left:8px" onclick="hapusDoc('hrd_reimbursement','${id}','reimbursement')">🗑️ Hapus</button>`
      );
    });
}
async function updateReimb(id) {
  await db
    .collection('hrd_reimbursement')
    .doc(id)
    .update({
      nama: document.getElementById('erNama').value,
      kategori: document.getElementById('erKat').value,
      jumlah: Number(document.getElementById('erJumlah').value) || 0,
      status: document.getElementById('erStatus').value,
      keterangan: document.getElementById('erKet').value,
      updatedAt: new Date().toISOString(),
    });
  closeModalDirect();
  toast('Reimbursement diupdate', 'success');
  renderReimbursement();
}

function editKasbonDoc(id) {
  db.collection('hrd_kasbon')
    .doc(id)
    .get()
    .then((d) => {
      const p = d.data();
      openModal(
        `<div class="modal-title">✏️ Edit Kasbon/Loan</div><div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="ekNama" value="${escHtml(p.nama || '')}"></div><div class="form-group"><label>Jenis</label><select class="form-control" id="ekJenis"><option ${p.jenis === 'Kasbon' ? 'selected' : ''}>Kasbon</option><option ${p.jenis === 'Pinjaman Karyawan' ? 'selected' : ''}>Pinjaman Karyawan</option></select></div></div><div class="grid-2"><div class="form-group"><label>Jumlah</label><input class="form-control" type="number" id="ekJumlah" value="${p.jumlah || 0}"></div><div class="form-group"><label>Cicilan (bln)</label><input class="form-control" type="number" id="ekCicilan" value="${p.cicilan || 1}"></div></div><div class="form-group"><label>Status</label><select class="form-control" id="ekStatus"><option value="pending" ${p.status === 'pending' ? 'selected' : ''}>Pending</option><option value="approved" ${p.status === 'approved' ? 'selected' : ''}>Approved</option><option value="rejected" ${p.status === 'rejected' ? 'selected' : ''}>Rejected</option><option value="lunas" ${p.status === 'lunas' ? 'selected' : ''}>Lunas</option></select></div><button class="btn btn-primary" onclick="updateKasbonDoc('${id}')">💾 Simpan</button><button class="btn btn-danger" style="margin-left:8px" onclick="hapusDoc('hrd_kasbon','${id}','kasbon')">🗑️ Hapus</button>`
      );
    });
}
async function updateKasbonDoc(id) {
  await db
    .collection('hrd_kasbon')
    .doc(id)
    .update({
      nama: document.getElementById('ekNama').value,
      jenis: document.getElementById('ekJenis').value,
      jumlah: Number(document.getElementById('ekJumlah').value) || 0,
      cicilan: Number(document.getElementById('ekCicilan').value) || 1,
      status: document.getElementById('ekStatus').value,
      updatedAt: new Date().toISOString(),
    });
  closeModalDirect();
  toast('Kasbon diupdate', 'success');
  renderKasbon();
}

// ── HELPER HAPUS ──────────────────────────────────────────────
async function hapusDoc(col, id, page) {
  if (!confirm('Yakin hapus?')) return;
  await db.collection(col).doc(id).delete();
  toast('Dihapus', 'success');
  navigateTo(page);
}

// ── ABSENSI ADMIN (delegate to absensi-ijef.js) ───────────────
function renderAbsensiAdmin() {
  if (typeof renderAbsensiIJEF === 'function') renderAbsensiIJEF();
  else
    document.getElementById('mainContent').innerHTML = '<div class="card">Loading absensi...</div>';
}

// ══════════════════════════════════════════════════════════════

// ── DISC TEST PAGE (Admin/HR view with View, Edit, Delete, Sync KPI) ──────────
function renderDiscTestPage() {
  const main = document.getElementById('mainContent');
  const isBOD = currentUser.role === 'bod';
  main.innerHTML = `
  <div class="page-title"><span>🧠 DISC Personality Test</span></div>
  <div class="card">
    <div class="card-header"><div class="card-title">Tes Kepribadian DISC</div>
      ${
        !isBOD
          ? `<div class="flex gap-8">
        <a href="disc-test.html" target="_blank" class="btn btn-primary btn-sm">🔗 Link Tes (Calon Karyawan)</a>
        <button class="btn btn-warning btn-sm" onclick="modalDiscEvalKaryawan()">📊 Evaluasi Karyawan (Pilih)</button>
      </div>`
          : ''
      }
    </div>
    <div style="background:#e3f2fd;border-radius:8px;padding:14px;margin-bottom:16px;border-left:4px solid var(--info)">
      <p class="text-sm" style="line-height:1.6"><strong>DISC</strong> = Dominance, Influence, Steadiness, Compliance.<br>
      • <strong>Calon Karyawan:</strong> Bagikan link tes kepada kandidat saat rekrutmen<br>
      • <strong>Evaluasi Periodik:</strong> Pilih karyawan dari database, data otomatis terisi<br>
      • <strong>Portal Karyawan:</strong> Karyawan aktif bisa tes langsung dari portal masing-masing<br>
      • <strong>Sinkron KPI:</strong> Hasil DISC bisa disinkronkan ke data KPI karyawan</p>
    </div>
  </div>
  <div class="card"><div class="card-header"><div class="card-title">📋 Riwayat Hasil Tes</div>${!isBOD ? '<div class="flex gap-8"><button class="btn btn-success btn-sm" onclick="syncAllDiscToKPI()">🔄 Sinkron Semua ke KPI</button><button class="btn btn-danger btn-sm" onclick="hapusSemuaDiscResults()">🗑️ Hapus Semua Riwayat</button></div>' : ''}</div>
    <div class="flex gap-8 mb-16"><input class="form-control" placeholder="Cari nama..." id="dSrc" oninput="fltDisc()" style="max-width:250px"><select class="form-control" id="dFlt" onchange="fltDisc()" style="max-width:180px"><option value="">Semua</option><option value="calon">Calon</option><option value="evaluasi">Evaluasi</option></select></div>
    <div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Nama</th><th>Mode</th><th>Posisi</th><th>Tipe</th><th>Profil</th><th>Aksi</th></tr></thead><tbody id="dTbl"><tr><td colspan="7" class="text-center">Memuat...</td></tr></tbody></table></div>
  </div>`;
  loadDiscHist();
}

async function modalDiscEvalKaryawan() {
  const snap = await db.collection('hrd_karyawan').where('status', '==', 'aktif').get();
  let opts = '<option value="">-- Pilih Karyawan --</option>';
  snap.forEach((d) => {
    const p = d.data();
    opts += `<option value="${d.id}" data-nama="${escHtml(p.nama)}" data-nip="${escHtml(p.nip || '')}" data-dept="${escHtml(p.departemen || '')}" data-pos="${escHtml(p.posisi || '')}">${escHtml(p.nama)} — ${escHtml(p.departemen || '')} (${escHtml(p.nip || '')})</option>`;
  });
  openModal(
    `<div class="modal-title">📊 Evaluasi DISC — Pilih Karyawan</div>
    <div class="form-group"><label>Karyawan</label><select class="form-control" id="discEvalSelect" onchange="onDiscEvalSelect()">${opts}</select></div>
    <div id="discEvalInfo" style="display:none;background:#f8f9ff;border-radius:8px;padding:12px;margin-bottom:16px">
      <div class="grid-2" style="font-size:.82rem"><div><strong>Nama:</strong> <span id="deNama">-</span></div><div><strong>NIP:</strong> <span id="deNip">-</span></div><div><strong>Departemen:</strong> <span id="deDept">-</span></div><div><strong>Posisi:</strong> <span id="dePos">-</span></div></div>
    </div>
    <div class="form-group"><label>Periode Evaluasi</label><input class="form-control" id="discEvalPeriode" placeholder="Contoh: Q1 2026, Semester 1 2026"></div>
    <button class="btn btn-primary" onclick="startDiscEvalForKaryawan()">Mulai Tes DISC →</button>`,
    true
  );
}

function onDiscEvalSelect() {
  const sel = document.getElementById('discEvalSelect');
  const opt = sel.options[sel.selectedIndex];
  if (!sel.value) {
    document.getElementById('discEvalInfo').style.display = 'none';
    return;
  }
  document.getElementById('discEvalInfo').style.display = 'block';
  document.getElementById('deNama').textContent = opt.dataset.nama;
  document.getElementById('deNip').textContent = opt.dataset.nip;
  document.getElementById('deDept').textContent = opt.dataset.dept;
  document.getElementById('dePos').textContent = opt.dataset.pos;
}

function startDiscEvalForKaryawan() {
  const sel = document.getElementById('discEvalSelect');
  const opt = sel.options[sel.selectedIndex];
  if (!sel.value) return toast('Pilih karyawan dulu', 'warning');
  const periode = document.getElementById('discEvalPeriode').value || '';
  const params = new URLSearchParams({
    nama: opt.dataset.nama,
    nip: opt.dataset.nip,
    dept: opt.dataset.dept,
    pos: opt.dataset.pos,
    periode,
    mode: 'evaluasi',
  });
  closeModalDirect();
  window.open('disc-test.html#evaluasi?' + params.toString(), '_blank');
}

async function loadDiscHist() {
  const snap = await db.collection('hrd_disc_results').get();
  window._dData = [];
  snap.forEach((d) => window._dData.push({ id: d.id, ...d.data() }));
  fltDisc();
}
function fltDisc() {
  const q = (document.getElementById('dSrc')?.value || '').toLowerCase(),
    m = document.getElementById('dFlt')?.value || '';
  const data = (window._dData || []).filter((r) => {
    if (q && !r.nama?.toLowerCase().includes(q)) return false;
    if (m && r.mode !== m) return false;
    return true;
  });
  let h = '';
  if (!data.length)
    h =
      '<tr><td colspan="7" class="text-center" style="color:var(--text-light)">Belum ada data</td></tr>';
  else
    data.forEach((r) => {
      const dt = r.createdAt
        ? new Date(r.createdAt).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : '-';
      const badge =
        r.mode === 'evaluasi'
          ? '<span class="badge badge-warning">Evaluasi</span>'
          : '<span class="badge badge-info">Calon</span>';
      const isBOD = currentUser.role === 'bod';
      h += `<tr><td>${dt}</td><td class="fw-700">${escHtml(r.nama)}</td><td>${badge}</td><td>${escHtml(r.posisi || '-')}</td><td class="fw-700" style="color:var(--primary)">${escHtml(r.pattern || '-')}</td><td>${escHtml(r.profileName || '-')}</td><td><button class="btn btn-xs btn-info" onclick="viewDiscResult('${r.id}')">👁️</button>${!isBOD ? ` <button class="btn btn-xs btn-warning" onclick="editDiscResult('${r.id}')">✏️</button> <button class="btn btn-xs btn-success" onclick="syncDiscToKPI('${r.id}')">📈</button> <button class="btn btn-xs btn-danger" onclick="deleteDiscResult('${r.id}')">🗑️</button>` : ''}</td></tr>`;
    });
  document.getElementById('dTbl').innerHTML = h;
}

async function viewDiscResult(id) {
  const doc = await db.collection('hrd_disc_results').doc(id).get();
  if (!doc.exists) return toast('Data tidak ditemukan', 'error');
  const r = doc.data();
  const s1 = r.seg1 || { D: 0, I: 0, S: 0, C: 0 };
  const s2 = r.seg2 || { D: 0, I: 0, S: 0, C: 0 };
  const s3 = r.seg3 || { D: 0, I: 0, S: 0, C: 0 };
  function bG(data, title, sub) {
    const vals = ['D', 'I', 'S', 'C'].map((t) => data[t] || 0);
    const h = 120;
    const toY = (v) => h / 2 - (v / 8) * (h / 2);
    let dots = '';
    vals.forEach((v, i) => {
      dots += `<circle cx="${15 + i * 40}" cy="${toY(v)}" r="3" fill="#1a237e"/><text x="${15 + i * 40}" y="${toY(v) - 8}" text-anchor="middle" font-size="7" font-weight="700" fill="${v >= 0 ? '#2e7d32' : '#c62828'}">${v > 0 ? '+' : ''}${typeof v === 'number' ? v.toFixed(1) : v}</text>`;
    });
    const pts = vals.map((v, i) => `${15 + i * 40},${toY(v)}`).join(' ');
    return `<div style="text-align:center;flex:1;min-width:150px"><div style="font-size:.63rem;font-weight:700;color:var(--primary)">${title}</div><div style="font-size:.55rem;color:#999">${sub}</div><svg width="155" height="${h + 18}" viewBox="0 0 155 ${h + 18}" style="border:1px solid #ddd;border-radius:4px;background:#fafafa"><line x1="5" y1="${h / 2}" x2="150" y2="${h / 2}" stroke="#999" stroke-width="0.5" stroke-dasharray="2"/><polyline points="${pts}" fill="none" stroke="#1a237e" stroke-width="1.5"/>${dots}<text x="15" y="${h + 12}" text-anchor="middle" font-size="8" font-weight="700">D</text><text x="55" y="${h + 12}" text-anchor="middle" font-size="8" font-weight="700">I</text><text x="95" y="${h + 12}" text-anchor="middle" font-size="8" font-weight="700">S</text><text x="135" y="${h + 12}" text-anchor="middle" font-size="8" font-weight="700">C</text></svg></div>`;
  }
  const graphs =
    bG(s1, 'GRAPH 1 MOST', 'Mask Public Self') +
    bG(s2, 'GRAPH 2 LEAST', 'Core Private Self') +
    bG(s3, 'GRAPH 3 CHANGE', 'Mirror Perceived Self');
  const dt = r.createdAt
    ? new Date(r.createdAt).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '-';
  const dProf = {
    D: {
      pos: ['Individualis', 'High Motivation', 'Efektif', 'Percaya Diri', 'Kreatif', 'Leader'],
      neg: ['Ego Tinggi', 'Kurang Sensitif', 'Agresif', 'Terlalu Dominan'],
      career:
        'Attorney, Sales Representative, Production Director, Strategic Planning, Self-Employment.',
    },
    I: {
      pos: ['Antusias', 'Optimis', 'Persuasif', 'Ramah', 'Inspirasional'],
      neg: ['Emosional', 'Impulsif', 'Kurang fokus', 'Tidak terorganisir'],
      career: 'Public Relations, Lecturing, Advertising, Hospitality, Human Resources.',
    },
    S: {
      pos: ['Stabil', 'Sabar', 'Loyal', 'Pendengar baik', 'Dapat diandalkan'],
      neg: ['Anti Perubahan', 'Sulit Adaptasi', 'Menghindari Konflik', 'Lambat Memutuskan'],
      career: 'Administrative Work, Accounting, Research, Retail, Service.',
    },
    C: {
      pos: ['Detail', 'Analitis', 'Rapi', 'Organized', 'Sistematis'],
      neg: ['Pendiam', 'Anti Kritik', 'Kaku', 'Terlalu Detail'],
      career: 'Planner, Engineer, IT Management, Quality Controller, Accountant.',
    },
    'D-I': {
      pos: ['Pekerja Keras', 'Leader', 'Tegas', 'Logis'],
      neg: ['Cepat Bosan', 'Dingin', 'Anti Aturan'],
      career: 'General Management, Sales Management, Marketing, Consultancy.',
    },
    'D-S': {
      pos: ['Objektif', 'Analitis', 'Mandiri', 'Stabil', 'Ulet'],
      neg: ['Menghindari Konflik', 'Kurang fleksibel'],
      career: 'Project Management, Researcher, Systems Analyst, IT.',
    },
    'D-C': {
      pos: ['Tekun', 'Sensitif', 'Keputusan kuat', 'Kreatif'],
      neg: ['Perfeksionis', 'Lambat keputusan'],
      career: 'Engineering, Planning, Accountancy, Quality Control.',
    },
    'I-S': {
      pos: ['Hangat', 'Simpati', 'Tenang', 'Pendengar baik', 'Toleran', 'Penjaga damai'],
      neg: ['Kurang tegas', 'Terlalu toleran', 'Sulit membuat keputusan'],
      career: 'Personnel, Training, Psychologist, Nursing, Social Work.',
    },
    'S-I': {
      pos: ['Hangat', 'Simpati', 'Pendengar baik', 'Toleran', 'Penjaga damai', 'Moderat'],
      neg: ['Kurang tegas', 'Terlalu toleran', 'Sulit membuat keputusan'],
      career: 'Personnel, Training, Hotelier, Travel Agent, Psychologist, Nurse.',
    },
    'I-C': {
      pos: ['Ramah', 'Suka berteman', 'Dapat mengendalikan diri', 'Perfeksionis alamiah'],
      neg: ['Kadang salah menilai', 'Terlalu optimis'],
      career: 'Teaching, Training, Specialist Selling, Marketing.',
    },
    'S-C': {
      pos: ['Detail', 'Empati', 'Loyal', 'Teliti', 'Peduli'],
      neg: ['Anti Kritik', 'Sulit Adaptasi', 'Introvert'],
      career: 'Office Manager, Planner, Accountant, Health Care.',
    },
    'C-D': {
      pos: ['Sensitif', 'Berorientasi tugas', 'Kukuh', 'Efektif'],
      neg: ['Dingin', 'Menjaga jarak', 'Tidak mudah percaya'],
      career: 'Engineering, Research, Planning, Accountancy.',
    },
    'C-S': {
      pos: ['Detail', 'Sistematik', 'Bijaksana', 'Diplomatis'],
      neg: ['Menghindari Konflik', 'Lambat Memutuskan', 'Anti Perubahan'],
      career: 'Researcher, Engineer, IT Management, Planner.',
    },
  };
  function gPD(pat) {
    if (dProf[pat]) return dProf[pat];
    const p = pat ? pat.split('-') : [];
    if (p.length >= 2 && dProf[p[0] + '-' + p[1]]) return dProf[p[0] + '-' + p[1]];
    if (dProf[p[0]]) return dProf[p[0]];
    return { pos: [], neg: [], career: '' };
  }
  const pD = gPD(r.pattern || '');
  const posT = r.positiveTraits && r.positiveTraits.length ? r.positiveTraits : pD.pos;
  const negT = r.negativeTraits && r.negativeTraits.length ? r.negativeTraits : pD.neg;
  const career = r.career || pD.career;
  let posH = '',
    negH = '',
    maskT = '',
    coreT = '',
    mirrorT = '';
  posT.forEach((t) => {
    posH += `<div style="padding:2px 0;font-size:.73rem;color:#2e7d32">✅ ${escHtml(t)}</div>`;
    maskT += `<div style="font-size:.7rem">${escHtml(t)}</div>`;
  });
  negT.forEach((t) => {
    negH += `<div style="padding:2px 0;font-size:.73rem;color:#c62828">⚠️ ${escHtml(t)}</div>`;
    coreT += `<div style="font-size:.7rem">${escHtml(t)}</div>`;
  });
  [...posT, ...negT].forEach((t) => {
    mirrorT += `<div style="font-size:.7rem">${escHtml(t)}</div>`;
  });
  const dn = { D: 'Dominance', I: 'Influence', S: 'Steadiness', C: 'Compliance' };
  const dd = {
    D: 'berorientasi pada hasil, suka tantangan, tegas, dan mandiri',
    I: 'ramah, optimis, persuasif, dan suka bersosialisasi',
    S: 'sabar, loyal, konsisten, dan kooperatif',
    C: 'perfeksionis, detail, analitis, dan terorganisir',
  };
  const ddL = {
    D: 'pendiam, menghindari konfrontasi',
    I: 'dingin, menjaga jarak, kurang percaya orang lain',
    S: 'tidak sabar, suka perubahan',
    C: 'spontan, fleksibel, kurang mengikuti aturan',
  };
  const sorted = Object.entries(s3).sort((a, b) => b[1] - a[1]);
  const dom = sorted.filter(([_, v]) => v > 0);
  const weak = sorted.filter(([_, v]) => v < 0);
  let kes = `Berdasarkan hasil tes, <b>${escHtml(r.nama)}</b> memiliki profil kepribadian dominan <b>${escHtml(r.pattern || '-')}</b>. Ini berarti ia adalah seorang <b>${escHtml(r.profileName || '-')}</b>.<br><br>`;
  kes += `<b>1. Profil Konsisten</b><br>Ketiga grafik menunjukkan pola serupa. Ini menandakan bahwa ia adalah <b>pribadi yang otentik dan apa adanya</b>. Cara ia menampilkan diri ke publik sama dengan karakter aslinya.<br><br>`;
  kes += `<b>2. Karakter Utama: "${escHtml(r.profileName || '-')}"</b><br>Profilnya adalah gabungan dari tipe yang kuat:<br>`;
  dom.forEach(([t]) => {
    kes += `<b>Sisi ${t} (${dn[t]}) yang tinggi:</b> Ini membuatnya menjadi pribadi yang <b>${dd[t]}</b>.<br>`;
  });
  weak.forEach(([t]) => {
    kes += `<b>Sisi ${t} (${dn[t]}) yang rendah:</b> Ini menjelaskan mengapa ia cenderung <b>${ddL[t]}</b>.<br>`;
  });
  kes += `<br><b>Kesimpulan Karakter</b><br>Secara keseluruhan, ${escHtml(r.nama)} adalah seorang "<b>${escHtml(r.profileName || '-')}</b>".<br><b>Kekuatan:</b> ${posT.join(', ')}.<br><b>Potensi Tantangan:</b> ${negT.join(', ')}.`;
  const descMap = {
    D: 'Memiliki rasa ego yang tinggi dan cenderung individualis dengan standard yang sangat tinggi. Mampu memimpin situasi dan orang lain dalam rangka mencapai sasarannya. Ia menghindari sesuatu yang biasa-biasa dan cenderung mencari tantangan baru.',
    I: 'Merupakan seorang yang antusias dan optimistik, ia lebih suka mencapai sasarannya melalui orang lain. Sangat menonjol dalam keterampilan berkomunikasi. Memiliki kemampuan untuk memotivasi dan memberi semangat.',
    S: 'Merupakan individu konsisten yang berusaha menjaga lingkungan yang tidak berubah. Sabar, loyal dan suka menolong. Sangat baik bekerja dengan petunjuk dan peraturan yang jelas.',
    C: 'Seorang yang praktis, cakap dan unik. Menyukai hal yang detil dan logis; secara alamiah sangat analitis. Hati-hati dalam membuat keputusan berdasarkan logika, bukan emosi.',
    'D-I':
      'Tidak basa-basi dan tegas, berpandangan jauh ke depan, progresif dan mau berkompetisi. Mempunyai kemampuan memimpin yang baik dan minat dengan cakupan yang luas.',
    'D-S':
      'Seorang yang obyektif dan analitis. Ingin terlibat dalam situasi dan memberikan bantuan. Termotivasi oleh target pribadi, ulet dalam memulai pekerjaan.',
    'D-C':
      'Sensitif terhadap permasalahan, memiliki kreativitas baik dalam memecahkan masalah. Dapat menyelesaikan tugas penting dalam waktu singkat.',
    'I-S':
      'Mengesankan orang akan kehangatan, simpati dan pengertiannya. Memiliki ketenangan dalam situasi sosial. Merupakan pendengar yang baik dan penjaga damai.',
    'S-I':
      'Mengesankan orang akan kehangatan dan simpati. Penjaga damai yang sebenarnya dan akan bekerja untuk menjaga kedamaian dalam setiap keadaan.',
    'I-C':
      'Ramah dan suka berteman; merasa nyaman walaupun dengan orang asing. Perfeksionis secara alamiah.',
    'S-C':
      'Orang yang baik secara alamiah dan sangat berorientasi detil. Peduli dan teliti dalam penyelesaian tugas.',
    'C-D':
      'Sangat berorientasi pada tugas dan sensitif pada permasalahan. Kukuh dan mempunyai pendekatan efektif dalam pemecahan masalah. Membuat keputusan berdasar fakta.',
    'C-S':
      'Berpikir sistematis dan mengikuti prosedur. Teratur, teliti dan fokus pada detil. Sangat berhati-hati, mengharapkan akurasi dan standard tinggi.',
  };
  function gDesc(p) {
    if (descMap[p]) return descMap[p];
    const x = p ? p.split('-') : [];
    if (x.length >= 2 && descMap[x[0] + '-' + x[1]]) return descMap[x[0] + '-' + x[1]];
    return descMap[x[0]] || '';
  }
  const kpiScore = r.kpiScore || 70;
  const kpiGrade =
    kpiScore >= 90 ? 'A' : kpiScore >= 80 ? 'B' : kpiScore >= 70 ? 'C' : kpiScore >= 60 ? 'D' : 'E';
  openModal(
    `<div class="modal-title">📊 D.I.S.C. Personality System Graph Page</div>
    <div style="font-size:.78rem;margin-bottom:8px;background:#f8f9ff;padding:10px;border-radius:8px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:3px"><div><b>Name:</b> ${escHtml(r.nama)}</div><div><b>Tanggal:</b> ${dt}</div><div><b>Mode:</b> ${r.mode === 'evaluasi' ? 'Evaluasi' : 'Calon'}</div><div><b>Posisi:</b> ${escHtml(r.posisi || '-')}</div>${r.departemen ? `<div><b>Dept:</b> ${escHtml(r.departemen)}</div>` : ''}${r.evaluasiPeriode ? `<div><b>Periode:</b> ${escHtml(r.evaluasiPeriode)}</div>` : ''}<div><b>KPI:</b> <span class="badge badge-${kpiScore >= 80 ? 'success' : kpiScore >= 60 ? 'warning' : 'danger'}">${kpiScore} (${kpiGrade})</span></div></div></div>
    <div style="text-align:center;margin-bottom:8px"><span style="display:inline-block;padding:5px 14px;background:linear-gradient(135deg,var(--primary),#283593);color:#fff;border-radius:14px;font-weight:700;font-size:.85rem">${escHtml(r.profileName || '-')} (${escHtml(r.pattern || '-')})</span></div>
    <div style="overflow-x:auto;margin-bottom:8px"><table style="width:auto;margin:0 auto;border-collapse:collapse;font-size:.7rem"><thead><tr style="background:var(--primary);color:#fff"><th style="padding:3px 7px">Line</th><th style="padding:3px 7px">D</th><th style="padding:3px 7px">I</th><th style="padding:3px 7px">S</th><th style="padding:3px 7px">C</th><th style="padding:3px 7px">tot</th></tr></thead><tbody><tr><td style="padding:3px 7px;border:1px solid #ddd;font-weight:700">1(P)</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawP?.D || 0}</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawP?.I || 0}</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawP?.S || 0}</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawP?.C || 0}</td><td style="padding:3px 7px;border:1px solid #ddd;color:red">24</td></tr><tr><td style="padding:3px 7px;border:1px solid #ddd;font-weight:700">2(K)</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawK?.D || 0}</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawK?.I || 0}</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawK?.S || 0}</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawK?.C || 0}</td><td style="padding:3px 7px;border:1px solid #ddd;color:red">24</td></tr><tr><td style="padding:3px 7px;border:1px solid #ddd;font-weight:700">3</td><td style="padding:3px 7px;border:1px solid #ddd">${typeof s3.D === 'number' ? s3.D.toFixed(1) : s3.D}</td><td style="padding:3px 7px;border:1px solid #ddd">${typeof s3.I === 'number' ? s3.I.toFixed(1) : s3.I}</td><td style="padding:3px 7px;border:1px solid #ddd">${typeof s3.S === 'number' ? s3.S.toFixed(1) : s3.S}</td><td style="padding:3px 7px;border:1px solid #ddd">${typeof s3.C === 'number' ? s3.C.toFixed(1) : s3.C}</td><td style="padding:3px 7px;border:1px solid #ddd"></td></tr></tbody></table></div>
    <div style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap">${graphs}</div>
    <div style="margin-bottom:10px"><div style="font-size:.75rem;font-weight:700;color:var(--primary);text-align:center;margin-bottom:6px">Gambaran Karakter</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><div><div style="font-size:.65rem;font-weight:700;text-decoration:underline;margin-bottom:3px">Mask Public Self</div><div style="font-size:.68rem;font-weight:700;color:var(--primary)">${escHtml(r.profileName || '-')}</div>${maskT}</div><div><div style="font-size:.65rem;font-weight:700;text-decoration:underline;margin-bottom:3px">Core Private Self</div><div style="font-size:.68rem;font-weight:700;color:var(--primary)">${escHtml(r.profileName || '-')}</div>${coreT}</div><div><div style="font-size:.65rem;font-weight:700;text-decoration:underline;margin-bottom:3px">Mirror Perceived Self</div><div style="font-size:.68rem;font-weight:700;color:var(--primary)">${escHtml(r.profileName || '-')}</div>${mirrorT}</div></div></div>
    <div style="background:#f8f9ff;border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:10px;font-size:.76rem;line-height:1.6"><b>📝 Deskripsi Kepribadian:</b><br>${escHtml(gDesc(r.pattern || ''))}</div>
    <div style="border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:10px;font-size:.76rem;line-height:1.7"><b>🔍 Analisis & Kesimpulan Karakter:</b><br><br>${kes}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px"><div style="background:#e8f5e9;border-radius:6px;padding:8px"><div style="font-size:.7rem;font-weight:700;color:#2e7d32;margin-bottom:3px">✅ Sifat Positif</div>${posH || '-'}</div><div style="background:#ffebee;border-radius:6px;padding:8px"><div style="font-size:.7rem;font-weight:700;color:#c62828;margin-bottom:3px">⚠️ Sifat Negatif</div>${negH || '-'}</div></div>
    ${career ? `<div style="background:#e8f5e9;border-radius:6px;padding:10px;margin-bottom:10px"><div style="font-size:.72rem;font-weight:700;color:#1b5e20;margin-bottom:6px">💼 Rekomendasi Bidang Pekerjaan yang Cocok</div><div style="font-size:.75rem;color:#2e7d32;line-height:1.6">Melihat profilnya yang kuat dalam ${dom.map(([t]) => dn[t].toLowerCase()).join(' dan ')}, <b>${escHtml(r.nama)}</b> akan sangat unggul dalam pekerjaan yang membutuhkan keahlian mendalam${dom.some(([t]) => t === 'D') ? ', otonomi, dan kepemimpinan' : dom.some(([t]) => t === 'I') ? ', komunikasi, dan kerjasama' : dom.some(([t]) => t === 'S') ? ', kesabaran, dan konsistensi' : ', ketelitian, dan analisis'}.<br><br><b>Bidang pekerjaan yang sangat cocok antara lain:</b><br>${escHtml(career)}<br><br>Ia akan berkembang di lingkungan yang menghargai <b>${posT.slice(0, 3).join(', ')}</b>. Peran yang kurang cocok untuknya adalah yang membutuhkan ${weak.length > 0 ? ddL[weak[0][0]] : 'karakteristik yang berlawanan'}.</div></div>` : ''}
    <div style="background:#f8f9ff;border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:10px"><div style="display:flex;align-items:center;gap:12px"><div style="text-align:center;padding:10px 16px;border-radius:8px;border:2px solid ${kpiScore >= 80 ? 'var(--success)' : 'var(--warning)'}"><div style="font-size:1.5rem;font-weight:700;color:${kpiScore >= 80 ? 'var(--success)' : 'var(--warning)'}">${kpiScore}</div><div style="font-size:.65rem">Grade ${kpiGrade}</div></div><div style="font-size:.75rem;line-height:1.6"><b>📈 Dampak KPI</b><br>Kekuatan: ${posT.length} poin (+${Math.min(posT.length * 3, 20)})<br>Area Pengembangan: ${negT.length} poin (-${Math.min(negT.length * 2, 15)})</div></div></div>
    <div class="flex gap-8 flex-wrap"><button class="btn btn-success btn-sm" onclick="syncDiscToKPI('${id}');closeModalDirect()">📈 Sinkron ke KPI</button><button class="btn btn-warning btn-sm" onclick="closeModalDirect();editDiscResult('${id}')">✏️ Edit</button><button class="btn btn-primary btn-sm" onclick="printDiscResult()">🖨️ Cetak/Download</button></div>`,
    true
  );
}
function getDiscDesc(p) {
  return '';
}

function printDiscResult() {
  const modal = document.getElementById('modalContent');
  if (!modal) return;
  const printWin = window.open('', '_blank', 'width=800,height=900');
  printWin.document.write(
    `<!DOCTYPE html><html><head><title>Hasil DISC Test - IJEF Corp</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;padding:20px;font-size:12px;color:#333}h1,h2,h3{color:#1a237e}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#1a237e;color:#fff}.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #1a237e;padding-bottom:10px}svg{max-width:100%}.section{margin-bottom:16px;page-break-inside:avoid}.badge{display:inline-block;padding:4px 12px;background:#1a237e;color:#fff;border-radius:12px;font-weight:700}@media print{body{padding:10px}}</style></head><body><div class="header"><h1>D.I.S.C. Personality System</h1><p>LPK IJEF CORP — Human Resource Assessment</p></div>${modal.innerHTML}<script>setTimeout(()=>{window.print();},500)<\/script></body></html>`
  );
  printWin.document.close();
}

async function editDiscResult(id) {
  const doc = await db.collection('hrd_disc_results').doc(id).get();
  if (!doc.exists) return toast('Data tidak ditemukan', 'error');
  const r = doc.data();
  openModal(
    `<div class="modal-title">✏️ Edit Hasil DISC</div>
    <div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="edNama" value="${escHtml(r.nama || '')}"></div><div class="form-group"><label>NIP</label><input class="form-control" id="edNip" value="${escHtml(r.nip || '')}"></div><div class="form-group"><label>Departemen</label><input class="form-control" id="edDept" value="${escHtml(r.departemen || '')}"></div><div class="form-group"><label>Posisi</label><input class="form-control" id="edPos" value="${escHtml(r.posisi || '')}"></div><div class="form-group"><label>Periode</label><input class="form-control" id="edPeriode" value="${escHtml(r.evaluasiPeriode || '')}"></div><div class="form-group"><label>Mode</label><select class="form-control" id="edMode"><option value="calon" ${r.mode === 'calon' ? 'selected' : ''}>Calon</option><option value="evaluasi" ${r.mode === 'evaluasi' ? 'selected' : ''}>Evaluasi</option></select></div></div>
    <div class="form-group"><label>Catatan HR</label><textarea class="form-control" id="edNote" placeholder="Catatan tambahan dari HR...">${escHtml(r.catatanHR || '')}</textarea></div>
    <button class="btn btn-primary" onclick="saveEditDisc('${id}')">Simpan Perubahan</button>`,
    true
  );
}

async function saveEditDisc(id) {
  const data = {
    nama: document.getElementById('edNama').value,
    nip: document.getElementById('edNip').value,
    departemen: document.getElementById('edDept').value,
    posisi: document.getElementById('edPos').value,
    evaluasiPeriode: document.getElementById('edPeriode').value,
    mode: document.getElementById('edMode').value,
    catatanHR: document.getElementById('edNote').value,
    updatedAt: new Date().toISOString(),
  };
  await db.collection('hrd_disc_results').doc(id).update(data);
  closeModalDirect();
  toast('Data DISC diperbarui', 'success');
  loadDiscHist();
}

async function deleteDiscResult(id) {
  if (!confirm('Yakin hapus hasil tes DISC ini?')) return;
  await db.collection('hrd_disc_results').doc(id).delete();
  toast('Hasil tes dihapus', 'success');
  loadDiscHist();
}

async function hapusSemuaDiscResults() {
  if (!confirm('⚠️ HAPUS SEMUA riwayat hasil tes DISC? Tindakan ini tidak bisa dibatalkan!'))
    return;
  if (!confirm('Konfirmasi sekali lagi: Yakin hapus SEMUA data DISC?')) return;
  const snap = await db.collection('hrd_disc_results').get();
  const batch = db.batch();
  snap.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  toast(`${snap.size} hasil tes DISC dihapus`, 'success');
  loadDiscHist();
}

async function syncDiscToKPI(id) {
  const doc = await db.collection('hrd_disc_results').doc(id).get();
  if (!doc.exists) return toast('Data tidak ditemukan', 'error');
  const r = doc.data();
  const kpiScore = r.kpiScore || 70;
  const grade =
    kpiScore >= 90 ? 'A' : kpiScore >= 80 ? 'B' : kpiScore >= 70 ? 'C' : kpiScore >= 60 ? 'D' : 'E';
  await db.collection('hrd_kpi').add({
    nama: r.nama,
    periode: r.evaluasiPeriode || r.tanggalTes || todayStr(),
    produktivitas: kpiScore,
    kualitas: kpiScore,
    kedisiplinan: kpiScore,
    kerjasama: kpiScore,
    skor: kpiScore,
    catatan: `[DISC] Tipe: ${r.pattern || '-'} | Profil: ${r.profileName || '-'} | Grade: ${grade}\nPositif: ${(r.positiveTraits || []).join(', ')}\nNegatif: ${(r.negativeTraits || []).join(', ')}\nKarir: ${(r.career || '').substring(0, 100)}`,
    penilai: 'DISC Auto-Sync',
    discResultId: id,
    discPattern: r.pattern || '',
    discProfile: r.profileName || '',
    createdAt: new Date().toISOString(),
  });
  toast(`DISC ${r.nama} disinkronkan ke KPI (Skor: ${kpiScore}, Grade: ${grade})`, 'success');
}

async function syncAllDiscToKPI() {
  if (!confirm('Sinkronkan semua hasil DISC terbaru ke KPI?')) return;
  const snap = await db.collection('hrd_disc_results').get();
  let count = 0;
  for (const doc of snap.docs) {
    const r = doc.data();
    const existing = await db
      .collection('hrd_kpi')
      .where('discResultId', '==', doc.id)
      .limit(1)
      .get();
    if (existing.empty) {
      const kpiScore = r.kpiScore || 70;
      await db.collection('hrd_kpi').add({
        nama: r.nama,
        periode: r.evaluasiPeriode || r.tanggalTes || todayStr(),
        produktivitas: kpiScore,
        kualitas: kpiScore,
        kedisiplinan: kpiScore,
        kerjasama: kpiScore,
        skor: kpiScore,
        catatan: `[DISC] Tipe: ${r.pattern || '-'} | Profil: ${r.profileName || '-'}`,
        penilai: 'DISC Auto-Sync',
        discResultId: doc.id,
        discPattern: r.pattern || '',
        discProfile: r.profileName || '',
        createdAt: new Date().toISOString(),
      });
      count++;
    }
  }
  toast(`${count} hasil DISC disinkronkan ke KPI`, 'success');
}

// ── SYSTEM ADMIN — Reset & Backup ─────────────────────────────
function renderSystemAdmin() {
  if (!hasAccess(6))
    return (document.getElementById('mainContent').innerHTML =
      '<div class="card"><p>Akses ditolak.</p></div>');
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>🔧 Reset & Backup Sistem</span></div>
    <div class="card" style="border-left:4px solid var(--accent)">
      <div class="card-title mb-16">⚠️ Zona Berbahaya</div>
      <p class="text-sm mb-16" style="color:#666">Fitur ini hanya untuk Administrator. Semua aksi bersifat permanen dan berlaku untuk seluruh data sistem.</p>
      <div class="grid-2">
        <div class="card" style="background:#fff3e0;border:1px solid var(--warning)">
          <div class="fw-700 mb-8">📥 Backup Data</div>
          <p class="text-xs mb-12" style="color:#666">Export semua data ke file JSON untuk backup.</p>
          <button class="btn btn-info btn-sm" onclick="backupAllData()">📥 Download Backup</button>
        </div>
        <div class="card" style="background:#ffebee;border:1px solid var(--accent)">
          <div class="fw-700 mb-8">🗑️ Reset Data</div>
          <p class="text-xs mb-12" style="color:#666">Hapus data per koleksi atau reset seluruh sistem.</p>
          <div class="flex flex-wrap gap-8">
            <button class="btn btn-danger btn-sm" onclick="resetCollection('hrd_absensi','Absensi')">🗑️ Absensi</button>
            <button class="btn btn-danger btn-sm" onclick="resetCollection('hrd_cuti','Cuti')">🗑️ Cuti</button>
            <button class="btn btn-danger btn-sm" onclick="resetCollection('hrd_overtime','Overtime')">🗑️ Overtime</button>
            <button class="btn btn-danger btn-sm" onclick="resetCollection('hrd_penggajian','Penggajian')">🗑️ Penggajian</button>
            <button class="btn btn-danger btn-sm" onclick="resetCollection('hrd_reimbursement','Reimburse')">🗑️ Reimburse</button>
            <button class="btn btn-danger btn-sm" onclick="resetCollection('hrd_kasbon','Kasbon')">🗑️ Kasbon</button>
            <button class="btn btn-danger btn-sm" onclick="resetCollection('hrd_notifikasi','Notifikasi')">🗑️ Notifikasi</button>
            <button class="btn btn-danger btn-sm" onclick="resetCollection('hrd_chat_threads','Chat')">🗑️ Chat</button>
            <button class="btn btn-danger btn-sm" onclick="resetCollection('hrd_chat_messages','Pesan Chat')">🗑️ Pesan</button>
            <button class="btn btn-danger btn-sm" onclick="resetCollection('hrd_broadcast','Broadcast')">🗑️ Broadcast</button>
            <button class="btn btn-danger btn-sm" onclick="resetCollection('hrd_meeting','Meeting')">🗑️ Meeting</button>
            <button class="btn btn-danger btn-sm" onclick="resetCollection('hrd_online_meeting','Meeting Online')">🗑️ Meeting Online</button>
            <button class="btn btn-danger btn-sm" onclick="resetCollection('hrd_insentif','Insentif')">🗑️ Insentif</button>
            <button class="btn btn-danger btn-sm" onclick="resetCollection('hrd_approval_flow','Approval Flow')">🗑️ Approval Flow</button>
          </div>
        </div>
      </div>
      <div class="card mt-16" style="background:#f5f5f5;border:2px solid var(--accent)">
        <div class="fw-700 mb-8" style="color:var(--accent)">☢️ Reset Seluruh Sistem</div>
        <p class="text-xs mb-12" style="color:#666">Hapus SEMUA data (karyawan, absensi, penggajian, chat, dll). Hanya akun admin yang dipertahankan. TIDAK BISA DIBATALKAN.</p>
        <button class="btn btn-danger" onclick="resetEntireSystem()">☢️ RESET SELURUH SISTEM</button>
      </div>
    </div>`;
}

async function backupAllData() {
  toast('Memproses backup...', 'info');
  const collections = [
    'hrd_karyawan',
    'hrd_users',
    'hrd_absensi',
    'hrd_cuti',
    'hrd_overtime',
    'hrd_penggajian',
    'hrd_reimbursement',
    'hrd_kasbon',
    'hrd_insentif',
    'hrd_tunjangan',
    'hrd_notifikasi',
    'hrd_pengumuman',
    'hrd_broadcast',
    'hrd_meeting',
    'hrd_online_meeting',
    'hrd_chat_threads',
    'hrd_chat_messages',
    'hrd_approval_flow',
    'hrd_settings',
  ];
  const backup = { exportDate: new Date().toISOString(), exportBy: currentUser.nama, data: {} };
  for (const col of collections) {
    try {
      const snap = await db.collection(col).get();
      backup.data[col] = [];
      snap.forEach((d) => backup.data[col].push({ id: d.id, ...d.data() }));
    } catch (e) {}
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `IMS_backup_${todayStr()}.json`;
  a.click();
  toast('Backup berhasil didownload', 'success');
}

async function resetCollection(col, label) {
  if (!confirm(`Hapus SEMUA data ${label}? Ini tidak bisa dibatalkan.`)) return;
  if (!confirm(`KONFIRMASI: Yakin hapus semua ${label}?`)) return;
  const snap = await db.collection(col).get();
  if (snap.empty) return toast(`${label} sudah kosong`, 'info');
  const batchSize = 400;
  let count = 0;
  let batch = db.batch();
  snap.forEach((d) => {
    batch.delete(d.ref);
    count++;
    if (count % batchSize === 0) {
      batch.commit();
      batch = db.batch();
    }
  });
  await batch.commit();
  toast(`${count} data ${label} dihapus`, 'success');
}

async function resetEntireSystem() {
  if (
    !confirm(
      '⚠️ PERINGATAN: Ini akan menghapus SELURUH data sistem!\n\nHanya akun admin yang dipertahankan.\n\nApakah Anda yakin?'
    )
  )
    return;
  if (!confirm('KONFIRMASI TERAKHIR: Ketik "RESET" di prompt berikutnya untuk melanjutkan.'))
    return;
  const input = prompt('Ketik RESET untuk konfirmasi:');
  if (input !== 'RESET') return toast('Reset dibatalkan', 'info');
  toast('Mereset sistem...', 'warning');
  const collections = [
    'hrd_karyawan',
    'hrd_absensi',
    'hrd_cuti',
    'hrd_overtime',
    'hrd_penggajian',
    'hrd_reimbursement',
    'hrd_kasbon',
    'hrd_insentif',
    'hrd_tunjangan',
    'hrd_notifikasi',
    'hrd_pengumuman',
    'hrd_broadcast',
    'hrd_meeting',
    'hrd_online_meeting',
    'hrd_chat_threads',
    'hrd_chat_messages',
    'hrd_approval_flow',
    'hrd_meeting_invites',
    'hrd_kpi',
    'hrd_disc_results',
  ];
  for (const col of collections) {
    try {
      const snap = await db.collection(col).get();
      const batch = db.batch();
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (e) {}
  }
  // Delete non-admin users
  const usersSnap = await db.collection('hrd_users').get();
  const batch = db.batch();
  usersSnap.forEach((d) => {
    if (d.data().role !== 'admin') batch.delete(d.ref);
  });
  await batch.commit();
  toast('Sistem berhasil direset. Hanya akun admin yang tersisa.', 'success');
}

// ── PANDUAN SISTEM ────────────────────────────────────────────
function renderPanduan() {
  const main = document.getElementById('mainContent');
  const role = currentUser.role || 'staff';
  const level = ROLES[role] || 0;

  let content = '';

  // Common for all users
  content += `<div class="card mb-16" style="border-left:4px solid var(--primary)"><div class="fw-700 mb-8" style="font-size:1rem;color:var(--primary)">📱 Cara Menggunakan Aplikasi</div>
    <div class="text-sm" style="line-height:2">
      <div><b>1. Login:</b> Masukkan username & password yang diberikan admin.</div>
      <div><b>2. Navigasi:</b> Gunakan menu sidebar (kiri) untuk berpindah halaman.</div>
      <div><b>3. Mobile:</b> Klik ☰ di pojok kiri atas untuk buka menu.</div>
      <div><b>4. Install App:</b> Klik "Download Aplikasi" untuk install PWA di HP/Laptop.</div>
    </div></div>`;

  // Staff instructions
  if (level >= 1) {
    content += `<div class="card mb-16" style="border-left:4px solid #1565c0"><div class="fw-700 mb-8" style="color:#1565c0">📋 Daily Report (Wajib)</div>
      <div class="text-sm" style="line-height:2">
        <div><b>1.</b> Buka menu <b>Daily Task</b> → klik <b>+ Tambah</b> (atau + Daily Report untuk Staff).</div>
        <div><b>2.</b> Pilih <b>"Daily Report"</b> → isi tanggal, kategori, aktivitas, hasil, kendala, solusi.</div>
        <div><b>3.</b> Upload <b>eviden</b> (foto/dokumen) via tombol 📁 atau 📷 kamera.</div>
        <div><b>4.</b> Klik <b>"📤 Kirim Daily Report"</b>.</div>
        <div><b>5.</b> Laporan akan diteruskan otomatis ke atasan (Leader/Manager).</div>
      </div></div>`;

    content += `<div class="card mb-16" style="border-left:4px solid #2e7d32"><div class="fw-700 mb-8" style="color:#2e7d32">📍 Absensi</div>
      <div class="text-sm" style="line-height:2">
        <div><b>1.</b> Buka menu <b>Absensi</b> → klik <b>Clock In</b> saat mulai kerja.</div>
        <div><b>2.</b> Pastikan lokasi GPS aktif (untuk verifikasi lokasi kantor).</div>
        <div><b>3.</b> Klik <b>Clock Out</b> saat selesai kerja.</div>
      </div></div>`;

    content += `<div class="card mb-16" style="border-left:4px solid #ff6f00"><div class="fw-700 mb-8" style="color:#ff6f00">🏖️ Cuti & Izin</div>
      <div class="text-sm" style="line-height:2">
        <div><b>1.</b> Buka menu <b>Cuti/Izin</b> → klik <b>+ Pengajuan</b>.</div>
        <div><b>2.</b> Pilih jenis (Cuti Tahunan, Izin, WFH, dll), isi tanggal & keterangan.</div>
        <div><b>3.</b> Pengajuan masuk ke Approval atasan & HR.</div>
      </div></div>`;
  }

  // Leader instructions
  if (level >= 2) {
    content += `<div class="card mb-16" style="border-left:4px solid #7b1fa2"><div class="fw-700 mb-8" style="color:#7b1fa2">📋 Instruksi Task ke Bawahan (Leader)</div>
      <div class="text-sm" style="line-height:2">
        <div><b>1.</b> Buka <b>Daily Task</b> → klik <b>+ Tambah</b> → pilih <b>"Daily Task"</b>.</div>
        <div><b>2.</b> Di field "Tugaskan Ke", pilih anggota tim dari divisi Anda.</div>
        <div><b>3.</b> Isi judul, deskripsi, tanggal deadline, prioritas.</div>
        <div><b>4.</b> Bawahan akan menerima notifikasi & task muncul di portal mereka.</div>
        <div><b>5.</b> Monitor progress di tab <b>"📊 Report Tim"</b>.</div>
      </div></div>`;

    content += `<div class="card mb-16" style="border-left:4px solid #e65100"><div class="fw-700 mb-8" style="color:#e65100">⚠️ Penalty Point (Leader/Manager)</div>
      <div class="text-sm" style="line-height:2">
        <div><b>1.</b> Buka menu <b>Penalty Point</b> → klik <b>+ Tambah</b>.</div>
        <div><b>2.</b> Pilih karyawan (hanya divisi sendiri), jenis pelanggaran, poin.</div>
        <div><b>3.</b> Penalty otomatis mengurangi skor KPI karyawan.</div>
        <div><b>4.</b> Klik <b>"🔄 Sinkronisasi ke KPI"</b> untuk update skor.</div>
      </div></div>`;
  }

  // Manager instructions
  if (level >= 3) {
    content += `<div class="card mb-16" style="border-left:4px solid #00695c"><div class="fw-700 mb-8" style="color:#00695c">📊 Monitoring & Approval (Manager)</div>
      <div class="text-sm" style="line-height:2">
        <div><b>📊 Report Tim:</b> Lihat semua daily report anggota divisi Anda, dikelompokkan per kategori.</div>
        <div><b>📅 Filter Tanggal:</b> Gunakan filter tanggal di tab Report Tim untuk melihat laporan periode tertentu.</div>
        <div><b>✅ Approval Center:</b> Approve/reject pengajuan cuti, overtime, reimburse dari bawahan.</div>
        <div><b>📋 Penugasan:</b> Assign task ke karyawan divisi sendiri (tidak bisa lintas divisi).</div>
        <div><b>⚠️ Penalty:</b> Berikan penalty point ke karyawan divisi sendiri.</div>
        <div><b>📈 KPI:</b> Lihat skor KPI tim — penalty otomatis mengurangi skor.</div>
      </div></div>`;

    content += `<div class="card mb-16" style="border-left:4px solid #1565c0"><div class="fw-700 mb-8" style="color:#1565c0">📅 Meeting & Broadcast (Manager)</div>
      <div class="text-sm" style="line-height:2">
        <div><b>Buat Meeting:</b> Pilih tipe General (semua divisi) atau Divisi (hanya divisi sendiri).</div>
        <div><b>Meeting Online:</b> Video call via Jitsi. Link aktif 15 menit sebelum jadwal.</div>
        <div><b>Broadcast:</b> Kirim ke divisi sendiri atau General. Broadcast divisi lain tidak tampil ke Anda.</div>
        <div><b>Undangan:</b> Hanya menerima undangan yang ditujukan untuk divisi/perorangan Anda.</div>
      </div></div>`;

    content += `<div class="card mb-16" style="border-left:4px solid #37474f"><div class="fw-700 mb-8" style="color:#37474f">👥 Rekrutmen & Karyawan (Manager)</div>
      <div class="text-sm" style="line-height:2">
        <div><b>Lowongan:</b> Buat lowongan (pilih posisi & departemen dari dropdown).</div>
        <div><b>Pipeline:</b> Kelola kandidat dari Applied → DISC → Interview → Offering → Hired.</div>
        <div><b>Test Kesehatan:</b> Jadwalkan test kesehatan untuk calon/karyawan, lihat hasil divisi sendiri.</div>
        <div><b>Data Karyawan:</b> Lihat & edit data karyawan, onboarding, offboarding.</div>
      </div></div>`;
  }

  // Head instructions
  if (level >= 4) {
    content += `<div class="card mb-16" style="border-left:4px solid #c62828"><div class="fw-700 mb-8" style="color:#c62828">🏢 Akses Head (Lintas Divisi)</div>
      <div class="text-sm" style="line-height:2">
        <div><b>🏢 Semua Divisi:</b> Tab khusus untuk melihat gabungan report SEMUA departemen.</div>
        <div><b>📊 Grouping:</b> Report dikelompokkan per Departemen → Kategori → Nama.</div>
        <div><b>📡 Broadcast:</b> Bisa melihat semua broadcast dari semua divisi.</div>
        <div><b>📅 Meeting:</b> Bisa melihat semua meeting lintas divisi.</div>
        <div><b>⚠️ Penalty:</b> Bisa memberikan penalty ke karyawan dari semua divisi.</div>
        <div><b>🩺 Test Kesehatan:</b> Melihat semua hasil test kesehatan lintas divisi.</div>
        <div><b>📈 KPI:</b> Melihat seluruh data KPI karyawan.</div>
      </div></div>`;
  }

  // BOD instructions
  if (level >= 5) {
    content += `<div class="card mb-16" style="border-left:4px solid #4a148c"><div class="fw-700 mb-8" style="color:#4a148c">🎯 Board of Directors (BOD)</div>
      <div class="text-sm" style="line-height:2">
        <div><b>Dashboard:</b> Melihat ringkasan keseluruhan perusahaan (karyawan, absensi, pengajuan).</div>
        <div><b>📊 Report:</b> Melihat gabungan daily report dari semua divisi (tanpa perlu input task sendiri).</div>
        <div><b>📈 KPI:</b> Monitor performa semua karyawan.</div>
        <div><b>📡 Broadcast:</b> Lihat semua komunikasi broadcast.</div>
        <div><b>📋 Tidak perlu:</b> BOD tidak perlu mengisi daily task — hanya monitoring & decision making.</div>
      </div></div>`;
  }

  // Admin instructions
  if (level >= 6) {
    content += `<div class="card mb-16" style="border-left:4px solid #1a1a1a"><div class="fw-700 mb-8" style="color:#1a1a1a">🔧 Administrasi Sistem (Admin)</div>
      <div class="text-sm" style="line-height:2">
        <div><b>👤 Manajemen Akun:</b> Tambah/edit user, set role (staff/leader/manager/head/bod/admin) & departemen.</div>
        <div><b>📈 KPI & Penilaian:</b> Input nilai KPI, edit, hapus semua data. Sinkron penalty ke KPI.</div>
        <div><b>✏️ Full Edit:</b> Admin bisa edit & hapus semua data (task, report, penalty, dll) milik user manapun.</div>
        <div><b>🔧 System Admin:</b> Backup data / reset sistem. Hati-hati dengan reset!</div>
        <div><b>🔍 Rekrutmen:</b> Kelola lowongan, pipeline, kandidat, DISC test, test kesehatan.</div>
        <div><b>📄 Legal & Aset:</b> Kontrak, asset management, peraturan perusahaan, generator surat.</div>
        <div><b>💰 Penggajian:</b> Generate slip gaji, tax & BPJS, insentif, tunjangan.</div>
        <div><b>📱 QR & PWA:</b> Share aplikasi, generate QR code untuk akses karyawan.</div>
      </div></div>`;
  }

  main.innerHTML = `<div class="page-title"><span>📖 Panduan Penggunaan Sistem</span></div>
    <div class="card mb-16" style="background:#e3f2fd;border:none"><div style="display:flex;align-items:center;gap:12px"><div style="font-size:2rem">👋</div><div><div class="fw-700">Halo, ${escHtml(currentUser.nama)}!</div><div class="text-sm" style="color:#555">Role Anda: <b>${role.toUpperCase()}</b> | Departemen: <b>${escHtml(currentUser.departemen || '-')}</b></div><div class="text-xs" style="color:#999;margin-top:4px">Panduan di bawah disesuaikan dengan level akses Anda.</div></div></div></div>
    ${content}`;
}
