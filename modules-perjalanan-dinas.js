'use strict';

// ══════════════════════════════════════════════════════════════
// ── BENEFIT CONFIG BY GRADE (Perjalanan Dinas) ────────────────
// ══════════════════════════════════════════════════════════════

const BENEFIT_CONFIG_BY_GRADE = {
  BOD: {
    label: 'BOD (Board of Directors)',
    uangHarian: 500000,
    maxTransport: 5000000,
    maxHotel: 2000000,
    kelasHotel: 'Bintang 4-5',
    maxMakan: 300000,
    uangSaku: 200000,
    totalMaxPerDay: 3000000,
  },
  HEAD: {
    label: 'HEAD / MANAGER',
    uangHarian: 350000,
    maxTransport: 3000000,
    maxHotel: 1200000,
    kelasHotel: 'Bintang 3-4',
    maxMakan: 200000,
    uangSaku: 150000,
    totalMaxPerDay: 1900000,
  },
  SENIOR: {
    label: 'SENIOR STAFF / SUPERVISOR',
    uangHarian: 250000,
    maxTransport: 2000000,
    maxHotel: 800000,
    kelasHotel: 'Bintang 2-3',
    maxMakan: 150000,
    uangSaku: 100000,
    totalMaxPerDay: 1300000,
  },
  STAFF: {
    label: 'STAFF',
    uangHarian: 150000,
    maxTransport: 1500000,
    maxHotel: 500000,
    kelasHotel: 'Bintang 2 / Budget',
    maxMakan: 100000,
    uangSaku: 75000,
    totalMaxPerDay: 825000,
  },
};

function resolveGradeKey(grade) {
  if (!grade) return 'STAFF';
  const g = grade.toUpperCase().trim();
  if (g.includes('BOD') || g.includes('DIRECTOR') || g.includes('GENERAL MANAGER') || g === 'GM')
    return 'BOD';
  // Check HEAD/MANAGER before SENIOR to avoid "SENIOR MANAGER" matching SENIOR
  if (g.includes('HEAD') || g.includes('MANAGER')) return 'HEAD';
  if (g.includes('SENIOR') || g.includes('SUPERVISOR') || g.includes('LEADER')) return 'SENIOR';
  return 'STAFF';
}

// Cache for Firestore benefit config
let _benefitConfigCache = null;
let _benefitConfigCacheTime = 0;
const BENEFIT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function loadBenefitConfig() {
  const now = Date.now();
  if (_benefitConfigCache && now - _benefitConfigCacheTime < BENEFIT_CACHE_TTL) {
    return _benefitConfigCache;
  }
  try {
    const doc = await db.collection('hrd_config_benefit').doc('current').get();
    if (doc.exists) {
      _benefitConfigCache = doc.data();
      _benefitConfigCacheTime = now;
      return _benefitConfigCache;
    }
  } catch (e) {
    console.warn('loadBenefitConfig error:', e);
  }
  return null;
}

function invalidateBenefitCache() {
  _benefitConfigCache = null;
  _benefitConfigCacheTime = 0;
}

async function getGradeConfig(grade) {
  const key = resolveGradeKey(grade);
  const fsConfig = await loadBenefitConfig();
  if (fsConfig && fsConfig.benefit && fsConfig.benefit[key]) {
    return fsConfig.benefit[key];
  }
  return BENEFIT_CONFIG_BY_GRADE[key];
}

function getGradeConfigSync(grade) {
  const key = resolveGradeKey(grade);
  if (_benefitConfigCache && _benefitConfigCache.benefit && _benefitConfigCache.benefit[key]) {
    return _benefitConfigCache.benefit[key];
  }
  return BENEFIT_CONFIG_BY_GRADE[key];
}

async function getUserGrade() {
  // Always fetch fresh from Firestore (don't trust session cache for grade)
  // Use a simple flag to avoid repeated Firestore calls within same page load
  if (currentUser._gradeFetched) return currentUser.gradeJabatan || 'STAFF';

  try {
    let gradeFound = null;
    let posisiFound = null;

    if (currentUser.linkedKaryawan) {
      const doc = await db.collection('hrd_karyawan').doc(currentUser.linkedKaryawan).get();
      if (doc.exists) {
        gradeFound = doc.data().gradeJabatan || null;
        posisiFound = doc.data().posisi || null;
      }
    }
    if (!gradeFound && !posisiFound) {
      const snap = await db.collection('hrd_karyawan').where('nama', '==', currentUser.nama).get();
      if (!snap.empty) {
        const data = snap.docs[0].data();
        gradeFound = data.gradeJabatan || null;
        posisiFound = data.posisi || null;
      }
    }

    // Posisi-based override: General Manager & Direktur ALWAYS get BOD regardless of stored gradeJabatan
    const posisi = (posisiFound || currentUser.posisi || '').toUpperCase();
    if (posisi.includes('GENERAL MANAGER') || posisi === 'GM') {
      currentUser.gradeJabatan = 'GENERAL MANAGER';
      currentUser._gradeFetched = true;
      return currentUser.gradeJabatan;
    }
    if (posisi.includes('DIREKTUR') || posisi.includes('DIRECTOR')) {
      currentUser.gradeJabatan = 'BOD';
      currentUser._gradeFetched = true;
      return currentUser.gradeJabatan;
    }

    // Use Firestore gradeJabatan for non-override cases
    if (gradeFound) {
      currentUser.gradeJabatan = gradeFound;
      currentUser._gradeFetched = true;
      return currentUser.gradeJabatan;
    }

    // Additional posisi-based inference for other grades
    if (posisi.includes('HEAD') || posisi.includes('MANAGER')) {
      currentUser.gradeJabatan = 'MANAGER';
      currentUser._gradeFetched = true;
      return currentUser.gradeJabatan;
    }
    if (posisi.includes('SUPERVISOR') || posisi.includes('SENIOR') || posisi.includes('LEADER')) {
      currentUser.gradeJabatan = 'SENIOR';
      currentUser._gradeFetched = true;
      return currentUser.gradeJabatan;
    }
  } catch (e) {
    console.warn('getUserGrade error:', e);
  }

  // Fallback: infer from currentUser.posisi directly
  if (currentUser.posisi) {
    const posisi = currentUser.posisi.toUpperCase();
    if (posisi.includes('GENERAL MANAGER') || posisi.includes('GM')) {
      currentUser.gradeJabatan = 'GENERAL MANAGER';
      currentUser._gradeFetched = true;
      return currentUser.gradeJabatan;
    }
    if (posisi.includes('DIRECTOR') || posisi.includes('BOD')) {
      currentUser.gradeJabatan = 'BOD';
      currentUser._gradeFetched = true;
      return currentUser.gradeJabatan;
    }
    if (posisi.includes('HEAD') || posisi.includes('MANAGER')) {
      currentUser.gradeJabatan = 'MANAGER';
      currentUser._gradeFetched = true;
      return currentUser.gradeJabatan;
    }
    if (posisi.includes('SUPERVISOR') || posisi.includes('SENIOR') || posisi.includes('LEADER')) {
      currentUser.gradeJabatan = 'SENIOR';
      currentUser._gradeFetched = true;
      return currentUser.gradeJabatan;
    }
  }

  // Fallback from role
  const roleGradeMap = {
    bod: 'BOD',
    head: 'HEAD',
    manager: 'MANAGER',
    leader: 'LEADER',
    staff: 'STAFF',
    admin: 'BOD',
  };
  if (currentUser.role && roleGradeMap[currentUser.role]) {
    currentUser.gradeJabatan = roleGradeMap[currentUser.role];
    currentUser._gradeFetched = true;
    return currentUser.gradeJabatan;
  }

  currentUser.gradeJabatan = 'STAFF';
  currentUser._gradeFetched = true;
  return currentUser.gradeJabatan;
}

// ══════════════════════════════════════════════════════════════
// ── PERATURAN DINAS PER GRADE ─────────────────────────────────
// ══════════════════════════════════════════════════════════════

const PERATURAN_DINAS_BY_GRADE = {
  BOD: {
    alurApproval: 'Direktur Utama',
    maxDurasiTanpaApprovalKhusus: 14,
    transportasiDiizinkan: [
      'Pesawat (Business Class)',
      'Kereta (Eksekutif)',
      'Rental Mobil Pribadi',
    ],
    kelasHotelDiizinkan: 'Bintang 4-5 / Suite',
    persenUangMuka: 100,
    batasWaktuLaporan: 7,
    ketentuanKhusus: [
      'Dapat menggunakan lounge bandara',
      'Tidak ada batasan nominal entertainment untuk relasi bisnis',
      'Asuransi perjalanan premium otomatis',
      'Boleh membawa pendamping untuk perjalanan > 5 hari',
      'Fasilitas airport transfer (pick-up & drop-off)',
    ],
  },
  HEAD: {
    alurApproval: 'General Manager -> BOD',
    maxDurasiTanpaApprovalKhusus: 7,
    transportasiDiizinkan: [
      'Pesawat (Economy/Premium Economy)',
      'Kereta (Bisnis/Eksekutif)',
      'Rental Mobil',
    ],
    kelasHotelDiizinkan: 'Bintang 3-4',
    persenUangMuka: 80,
    batasWaktuLaporan: 5,
    ketentuanKhusus: [
      'Entertainment budget untuk meeting klien (dengan approval)',
      'Upgrade kelas penerbangan untuk durasi > 4 jam',
      'Asuransi perjalanan standar otomatis',
      'Boleh extend 1 hari untuk perjalanan > 5 hari',
    ],
  },
  SENIOR: {
    alurApproval: 'Head Dept -> General Manager -> HRD',
    maxDurasiTanpaApprovalKhusus: 5,
    transportasiDiizinkan: [
      'Pesawat (Economy)',
      'Kereta (Bisnis)',
      'Bus (Eksekutif)',
      'Rental Mobil (sharing)',
    ],
    kelasHotelDiizinkan: 'Bintang 2-3',
    persenUangMuka: 75,
    batasWaktuLaporan: 3,
    ketentuanKhusus: [
      'Asuransi perjalanan standar',
      'Sharing kamar tidak diwajibkan',
      'Dapat mengajukan upgrade transport dengan justifikasi',
    ],
  },
  STAFF: {
    alurApproval: 'Atasan Langsung -> Head Dept -> HRD',
    maxDurasiTanpaApprovalKhusus: 3,
    transportasiDiizinkan: [
      'Pesawat (Economy - rute tertentu)',
      'Kereta (Ekonomi/Bisnis)',
      'Bus (Eksekutif/Reguler)',
      'Travel Pool',
    ],
    kelasHotelDiizinkan: 'Bintang 2 / Budget / Guest House',
    persenUangMuka: 70,
    batasWaktuLaporan: 3,
    ketentuanKhusus: [
      'Sharing kamar diutamakan untuk efisiensi',
      'Transport darat diprioritaskan untuk jarak < 500km',
      'Wajib melampirkan boarding pass/tiket untuk reimbursement',
    ],
  },
};

async function getGradePeraturan(grade) {
  const key = resolveGradeKey(grade);
  const fsConfig = await loadBenefitConfig();
  if (fsConfig && fsConfig.peraturan && fsConfig.peraturan[key]) {
    return fsConfig.peraturan[key];
  }
  return PERATURAN_DINAS_BY_GRADE[key];
}

function getGradePeraturanSync(grade) {
  const key = resolveGradeKey(grade);
  if (_benefitConfigCache && _benefitConfigCache.peraturan && _benefitConfigCache.peraturan[key]) {
    return _benefitConfigCache.peraturan[key];
  }
  return PERATURAN_DINAS_BY_GRADE[key];
}

// ══════════════════════════════════════════════════════════════
// ── PROSEDUR PERJALANAN DINAS — Terintegrasi ──────────────────
// ══════════════════════════════════════════════════════════════

function renderPerjalananDinas() {
  window._portalDinasMode = false;
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>✈️ Prosedur Perjalanan Dinas</span><button class="btn btn-primary btn-sm" onclick="modalAjukanSPPD()">+ Ajukan SPPD</button></div>
    <div class="tabs" id="sppdTabs">
      <div class="tab active" onclick="showSPPDTab('daftar')">📋 Daftar SPPD</div>
      <div class="tab" onclick="showSPPDTab('prosedur')">📖 Prosedur</div>
      <div class="tab" onclick="showSPPDTab('uang-muka')">💰 Uang Muka</div>
      <div class="tab" onclick="showSPPDTab('laporan')">📝 Laporan Perjalanan</div>
      <div class="tab" onclick="showSPPDTab('reimbursement')">🧾 Reimburse Dinas</div>
    </div>
    <div id="sppdContent"></div>`;
  showSPPDTab('daftar');
}

function renderPortalPerjalananDinas() {
  window._portalDinasMode = true;
  renderPerjalananDinasWithBenefit();
}

async function renderPerjalananDinasWithBenefit() {
  const main = document.getElementById('mainContent');
  const grade = await getUserGrade();
  const cfg = await getGradeConfig(grade);
  const peraturan = await getGradePeraturan(grade);
  let infoBanner = `<div id="sppdGradeBanner" class="mb-16" style="position:relative;padding:14px 40px 14px 16px;background:linear-gradient(135deg,#e3f2fd,#f3e5f5);border-radius:10px;border:1px solid #bbdefb">
    <button onclick="document.getElementById('sppdGradeBanner').style.display='none'" style="position:absolute;top:8px;right:12px;background:none;border:none;font-size:1.2rem;cursor:pointer;color:#666;line-height:1" title="Tutup">&times;</button>
    <div class="text-sm" style="color:#333"><span class="fw-700">Sebagai grade ${escHtml(grade || 'STAFF')}</span>, Anda berhak atas: uang harian <b>${formatCurrency(cfg.uangHarian)}</b>, <b>${escHtml(peraturan.kelasHotelDiizinkan)}</b>, <b>${escHtml(peraturan.transportasiDiizinkan[0])}</b>. Ajukan SPPD minimal 3 hari sebelum keberangkatan.</div>
  </div>`;
  let benefitCard = `<div class="card mb-16" style="border-left:4px solid var(--accent)">
    <div class="card-header"><div class="card-title">🎯 Benefit Perjalanan Dinas Saya</div></div>
    <div style="padding:12px">
      <div class="mb-8"><span class="fw-700">Grade:</span> <span class="badge badge-info">${escHtml(grade || 'STAFF')}</span> <span class="text-sm" style="color:#666">(${escHtml(cfg.label)})</span></div>
      <div class="table-wrap"><table><thead><tr><th>Komponen</th><th>Hak / Malam</th></tr></thead><tbody>
        <tr><td>Uang Harian</td><td>${formatCurrency(cfg.uangHarian)}</td></tr>
        <tr><td>Max Transport</td><td>${formatCurrency(cfg.maxTransport)}</td></tr>
        <tr><td>Max Hotel (per malam)</td><td>${formatCurrency(cfg.maxHotel)}</td></tr>
        <tr><td>Kelas Hotel</td><td>${escHtml(cfg.kelasHotel)}</td></tr>
        <tr><td>Max Makan (per hari)</td><td>${formatCurrency(cfg.maxMakan)}</td></tr>
        <tr><td>Uang Saku (per hari)</td><td>${formatCurrency(cfg.uangSaku)}</td></tr>
        <tr style="font-weight:700;background:#f0f4ff"><td>Total Max / Hari</td><td>${formatCurrency(cfg.totalMaxPerDay)}</td></tr>
      </tbody></table></div>
    </div>
  </div>`;
  main.innerHTML =
    infoBanner +
    benefitCard +
    `<div class="page-title"><span>✈️ Prosedur Perjalanan Dinas</span><button class="btn btn-primary btn-sm" onclick="modalAjukanSPPD()">+ Ajukan SPPD</button></div>
    <div class="tabs" id="sppdTabs">
      <div class="tab active" onclick="showSPPDTab('daftar')">📋 Daftar SPPD</div>
      <div class="tab" onclick="showSPPDTab('prosedur')">📖 Prosedur</div>
      <div class="tab" onclick="showSPPDTab('uang-muka')">💰 Uang Muka</div>
      <div class="tab" onclick="showSPPDTab('laporan')">📝 Laporan Perjalanan</div>
      <div class="tab" onclick="showSPPDTab('reimbursement')">🧾 Reimburse Dinas</div>
    </div>
    <div id="sppdContent"></div>`;
  showSPPDTab('daftar');
}

async function showSPPDTab(tab) {
  document.querySelectorAll('#sppdTabs .tab').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('#sppdTabs .tab').forEach((t) => {
    if (tab === 'daftar' && t.textContent.includes('Daftar')) t.classList.add('active');
    else if (tab === 'prosedur' && t.textContent.includes('Prosedur')) t.classList.add('active');
    else if (tab === 'uang-muka' && t.textContent.includes('Uang Muka')) t.classList.add('active');
    else if (tab === 'laporan' && t.textContent.includes('Laporan')) t.classList.add('active');
    else if (tab === 'reimbursement' && t.textContent.includes('Reimburse'))
      t.classList.add('active');
  });
  const el = document.getElementById('sppdContent');
  if (tab === 'daftar') await loadSPPDDaftar(el);
  else if (tab === 'prosedur') await loadSPPDProsedur(el);
  else if (tab === 'uang-muka') await loadSPPDUangMuka(el);
  else if (tab === 'laporan') await loadSPPDLaporan(el);
  else if (tab === 'reimbursement') await loadSPPDReimbursement(el);
}

async function loadSPPDDaftar(el) {
  const isPortal = window._portalDinasMode || !hasAccess(3);
  const snap = await db
    .collection('hrd_perjalanan_dinas')
    .orderBy('createdAt', 'desc')
    .get()
    .catch(function () {
      return db.collection('hrd_perjalanan_dinas').get();
    });
  var approveBtn = '';
  if (hasAccess(3)) {
    approveBtn =
      '<button class="btn btn-xs btn-success" onclick="bulkApproveSPPD()">✅ Approve Semua</button>';
  }
  var h = '<div class="card">';
  h +=
    '<div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">';
  h += '<div class="card-title">📋 Daftar Surat Perintah Perjalanan Dinas (SPPD)</div>';
  h += '<div id="sppdBulkActions" style="display:none;gap:8px;align-items:center;flex-wrap:wrap">';
  h +=
    '<span id="sppdSelectedCount" class="text-sm fw-700" style="color:var(--primary)">0 dipilih</span>';
  h += approveBtn;
  h += '<button class="btn btn-xs btn-danger" onclick="bulkDeleteSPPD()">🗑️ Hapus Semua</button>';
  h += '</div></div>';
  h += '<div class="table-wrap"><table><thead><tr>';
  h +=
    '<th style="width:40px;text-align:center"><input type="checkbox" id="sppdCheckAll" onchange="toggleAllSPPDCheckbox(this)"></th>';
  h +=
    '<th>No. SPPD</th><th>Nama</th><th>Tujuan</th><th>Tanggal</th><th>Durasi</th><th>Status</th><th>Aksi</th>';
  h += '</tr></thead><tbody>';
  var hasData = false;
  var docs = [];
  snap.forEach(function (d) {
    docs.push({ id: d.id, ...d.data() });
  });
  docs.forEach(function (p) {
    if (
      isPortal &&
      p.userId !== currentUser.id &&
      (p.nama || '').toLowerCase() !== currentUser.nama.toLowerCase()
    )
      return;
    // Manager (level 3) only sees own department; Head/BOD/Admin (level 4+) sees all
    if (!isPortal && hasAccess(3) && !hasAccess(4)) {
      if (
        p.userId !== currentUser.id &&
        (p.departemen || '').toLowerCase() !== (currentUser.departemen || '').toLowerCase()
      )
        return;
    }
    hasData = true;
    var durasi =
      p.tanggalMulai && p.tanggalSelesai
        ? Math.ceil(
            (new Date(p.tanggalSelesai) - new Date(p.tanggalMulai)) / (1000 * 60 * 60 * 24) + 1
          ) + ' hari'
        : '-';
    var badge =
      p.status === 'approved'
        ? 'badge-success'
        : p.status === 'rejected'
          ? 'badge-danger'
          : p.status === 'selesai'
            ? 'badge-info'
            : 'badge-warning';
    h += '<tr>';
    h +=
      '<td style="text-align:center"><input type="checkbox" class="sppd-check-item" value="' +
      p.id +
      '" data-status="' +
      (p.status || 'pending') +
      '" onchange="updateSPPDBulkUI()"></td>';
    h += '<td class="fw-700">' + escHtml(p.noSPPD || '-') + '</td>';
    h += '<td>' + escHtml(p.nama) + '</td>';
    h += '<td>' + escHtml(p.tujuan || '-') + '</td>';
    h += '<td>' + formatDate(p.tanggalMulai) + '</td>';
    h += '<td>' + durasi + '</td>';
    h += '<td><span class="badge ' + badge + '">' + (p.status || 'pending') + '</span></td>';
    h += '<td>';
    h += '<button class="btn btn-xs btn-info" onclick="viewSPPD(\'' + p.id + '\')">👁️</button> ';
    if (hasAccess(3) && p.status === 'pending') {
      h +=
        '<button class="btn btn-xs btn-success" onclick="approveSPPD(\'' +
        p.id +
        '\')">✅</button> ';
      h +=
        '<button class="btn btn-xs btn-danger" onclick="rejectSPPD(\'' + p.id + '\')">❌</button> ';
    }
    if (p.status === 'approved') {
      h +=
        '<button class="btn btn-xs btn-primary" onclick="cetakSPPD(\'' + p.id + '\')">🖨️</button> ';
    }
    h += '</td></tr>';
  });
  if (!hasData) h += '<tr><td colspan="8" class="text-center">Belum ada data SPPD</td></tr>';
  h += '</tbody></table></div></div>';
  el.innerHTML = h;
}

// ── Bulk Selection & Actions for SPPD ──
function toggleAllSPPDCheckbox(masterCheckbox) {
  var items = document.querySelectorAll('.sppd-check-item');
  for (var i = 0; i < items.length; i++) {
    items[i].checked = masterCheckbox.checked;
  }
  updateSPPDBulkUI();
}

function updateSPPDBulkUI() {
  var items = document.querySelectorAll('.sppd-check-item');
  var checked = document.querySelectorAll('.sppd-check-item:checked');
  var bulkBar = document.getElementById('sppdBulkActions');
  var countEl = document.getElementById('sppdSelectedCount');
  var masterCb = document.getElementById('sppdCheckAll');
  if (checked.length > 0) {
    bulkBar.style.display = 'flex';
    countEl.textContent = checked.length + ' dipilih';
  } else {
    bulkBar.style.display = 'none';
  }
  if (masterCb) masterCb.checked = items.length > 0 && checked.length === items.length;
}

async function bulkApproveSPPD() {
  var checked = document.querySelectorAll('.sppd-check-item:checked');
  var pendingIds = [];
  checked.forEach(function (cb) {
    if (cb.dataset.status === 'pending') pendingIds.push(cb.value);
  });
  if (pendingIds.length === 0) {
    toast('Tidak ada SPPD berstatus pending yang dipilih', 'warning');
    return;
  }
  if (!confirm('Setujui ' + pendingIds.length + ' SPPD yang dipilih?')) return;
  for (var i = 0; i < pendingIds.length; i++) {
    var id = pendingIds[i];
    var doc = await db.collection('hrd_perjalanan_dinas').doc(id).get();
    var p = doc.data();
    await db.collection('hrd_perjalanan_dinas').doc(id).update({
      status: 'approved',
      approvedBy: currentUser.nama,
      approvedAt: new Date().toISOString(),
    });
    var linkSnap = await db.collection('hrd_dinas_luar').where('noSPPD', '==', p.noSPPD).get();
    linkSnap.forEach(function (d) {
      d.ref.update({
        status: 'approved',
        approvedBy: currentUser.nama,
        approvedAt: new Date().toISOString(),
      });
    });
    await sendNotification(
      p.userId || p.nama,
      'SPPD Disetujui',
      'SPPD ' + p.noSPPD + ' ke ' + p.tujuan + ' telah disetujui oleh ' + currentUser.nama
    );
  }
  toast('✅ ' + pendingIds.length + ' SPPD berhasil disetujui', 'success');
  showSPPDTab('daftar');
}

async function bulkDeleteSPPD() {
  var checked = document.querySelectorAll('.sppd-check-item:checked');
  var ids = [];
  checked.forEach(function (cb) {
    ids.push(cb.value);
  });
  if (ids.length === 0) {
    toast('Tidak ada SPPD yang dipilih', 'warning');
    return;
  }
  if (!confirm('Hapus ' + ids.length + ' SPPD yang dipilih? Tindakan ini tidak bisa dibatalkan.'))
    return;
  for (var i = 0; i < ids.length; i++) {
    await db.collection('hrd_perjalanan_dinas').doc(ids[i]).delete();
  }
  toast('🗑️ ' + ids.length + ' SPPD berhasil dihapus', 'success');
  showSPPDTab('daftar');
}

async function loadSPPDProsedur(el) {
  const grade = await getUserGrade();
  const cfg = await getGradeConfig(grade);
  const peraturan = await getGradePeraturan(grade);
  const gradeKey = grade ? grade.toUpperCase().trim() : 'STAFF';
  const fsConfig = await loadBenefitConfig();

  let html = `<div class="card">
    <div class="card-title mb-16">📖 Prosedur Perjalanan Dinas</div>
    <div style="background:#e3f2fd;padding:12px 16px;border-radius:8px;margin-bottom:16px;border-left:4px solid #1976d2">
      <div class="fw-700" style="color:#1976d2">👤 Prosedur untuk Grade: <span class="badge badge-info">${escHtml(grade || 'STAFF')}</span></div>
      <div class="text-sm" style="color:#555;margin-top:4px">Alur approval Anda: ${escHtml(peraturan.alurApproval)}</div>
    </div>
    <div style="background:#f8f9ff;border-radius:12px;padding:20px;border-left:4px solid var(--accent)">
      <h3 style="margin-bottom:12px;color:var(--primary)">Alur Prosedur Perjalanan Dinas</h3>
      <div style="display:grid;gap:12px">
        <div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.05)">
          <div style="min-width:32px;height:32px;background:var(--accent);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700">1</div>
          <div><div class="fw-700">Pengajuan SPPD</div><div class="text-sm" style="color:#666">Karyawan mengisi form pengajuan perjalanan dinas (tujuan, tanggal, keperluan, estimasi biaya). Sistem generate nomor SPPD otomatis.</div></div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.05)">
          <div style="min-width:32px;height:32px;background:var(--accent);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700">2</div>
          <div><div class="fw-700">Approval Atasan & HRD</div><div class="text-sm" style="color:#666">SPPD diproses oleh atasan langsung dan HRD. Notifikasi otomatis dikirim ke approver.</div></div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.05)">
          <div style="min-width:32px;height:32px;background:var(--accent);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700">3</div>
          <div><div class="fw-700">Pencairan Uang Muka</div><div class="text-sm" style="color:#666">Setelah SPPD disetujui, karyawan bisa mengajukan uang muka perjalanan (transport, akomodasi, dll).</div></div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.05)">
          <div style="min-width:32px;height:32px;background:var(--accent);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700">4</div>
          <div><div class="fw-700">Pelaksanaan Dinas</div><div class="text-sm" style="color:#666">Karyawan melaksanakan perjalanan dinas. Absen dinas luar via selfie+GPS (terintegrasi modul Absensi).</div></div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.05)">
          <div style="min-width:32px;height:32px;background:var(--accent);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700">5</div>
          <div><div class="fw-700">Laporan Perjalanan Dinas</div><div class="text-sm" style="color:#666">Setelah kembali, karyawan membuat laporan perjalanan dinas (hasil, pencapaian, catatan).</div></div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.05)">
          <div style="min-width:32px;height:32px;background:var(--accent);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700">6</div>
          <div><div class="fw-700">Reimbursement & Pertanggungjawaban</div><div class="text-sm" style="color:#666">Karyawan submit bukti pengeluaran. Selisih uang muka vs aktual akan dikembalikan/dibayarkan.</div></div>
        </div>
      </div>
    </div>
    <div class="mt-16" style="padding:12px;background:#e8f5e9;border-radius:8px;border-left:4px solid var(--success)">
      <div class="fw-700 text-sm mb-8">📌 Ketentuan Umum:</div>
      <ul class="text-sm" style="padding-left:16px;line-height:1.8;color:#333">
        <li>SPPD harus diajukan minimal <b>3 hari kerja</b> sebelum keberangkatan</li>
        <li>Uang muka maksimal <b>80%</b> dari estimasi biaya</li>
        <li>Laporan perjalanan dinas wajib diserahkan <b>3 hari</b> setelah kembali</li>
        <li>Bukti pengeluaran (kwitansi/invoice) wajib dilampirkan untuk reimbursement</li>
        <li>Perjalanan dinas yang dibatalkan harus dikonfirmasi ke HRD</li>
      </ul>
    </div>`;

  // Grade-specific section
  html += `<div class="mt-16" style="padding:16px;background:#fff3e0;border-radius:12px;border-left:4px solid #ff9800">
    <div class="fw-700 mb-12" style="color:#e65100;font-size:1.05rem">📋 Ketentuan Berdasarkan Grade Anda (${escHtml(grade || 'STAFF')})</div>
    <div style="display:grid;gap:10px">
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#fff;border-radius:8px">
        <span style="font-size:1.2rem">🔄</span>
        <div><div class="fw-700 text-sm">Alur Approval</div><div class="text-sm" style="color:#555">${escHtml(peraturan.alurApproval)}</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#fff;border-radius:8px">
        <span style="font-size:1.2rem">📅</span>
        <div><div class="fw-700 text-sm">Max Durasi Tanpa Approval Khusus</div><div class="text-sm" style="color:#555">${peraturan.maxDurasiTanpaApprovalKhusus} hari</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#fff;border-radius:8px">
        <span style="font-size:1.2rem">🚗</span>
        <div><div class="fw-700 text-sm">Transportasi Diizinkan</div><div class="text-sm" style="color:#555">${escHtml(peraturan.transportasiDiizinkan.join(', '))}</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#fff;border-radius:8px">
        <span style="font-size:1.2rem">🏨</span>
        <div><div class="fw-700 text-sm">Kelas Hotel</div><div class="text-sm" style="color:#555">${escHtml(peraturan.kelasHotelDiizinkan)}</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#fff;border-radius:8px">
        <span style="font-size:1.2rem">💰</span>
        <div><div class="fw-700 text-sm">Uang Muka</div><div class="text-sm" style="color:#555">${peraturan.persenUangMuka}% dari estimasi biaya</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#fff;border-radius:8px">
        <span style="font-size:1.2rem">⏰</span>
        <div><div class="fw-700 text-sm">Batas Waktu Laporan</div><div class="text-sm" style="color:#555">${peraturan.batasWaktuLaporan} hari setelah kembali</div></div>
      </div>
      <div style="padding:10px;background:#fff;border-radius:8px">
        <div class="fw-700 text-sm mb-4">⭐ Ketentuan Khusus:</div>
        <ul class="text-sm" style="padding-left:16px;line-height:1.8;color:#555;margin:0">${peraturan.ketentuanKhusus.map((k) => '<li>' + escHtml(k) + '</li>').join('')}</ul>
      </div>
    </div>
  </div>`;

  // Comparison table of all grades - only visible to admin
  if (hasAccess(6)) {
    const allGrades = ['BOD', 'HEAD', 'SENIOR', 'STAFF'];
    const userGradeKey = resolveGradeKey(grade);
    const getCmpBen = (g, field) => {
      if (fsConfig && fsConfig.benefit && fsConfig.benefit[g]) return fsConfig.benefit[g][field];
      return BENEFIT_CONFIG_BY_GRADE[g][field];
    };
    const getCmpPer = (g, field) => {
      if (fsConfig && fsConfig.peraturan && fsConfig.peraturan[g])
        return fsConfig.peraturan[g][field];
      return PERATURAN_DINAS_BY_GRADE[g][field];
    };

    html += `<div class="mt-16"><div class="fw-700 mb-12" style="font-size:1.05rem">📊 Perbandingan Hak per Grade</div>
      <div class="table-wrap"><table><thead><tr><th>Komponen</th>${allGrades.map((g) => '<th style="' + (g === userGradeKey ? 'background:#e3f2fd;color:#1565c0;font-weight:700' : '') + '">' + getCmpBen(g, 'label') + '</th>').join('')}</tr></thead><tbody>
        <tr><td class="fw-700">Uang Harian</td>${allGrades.map((g) => '<td style="' + (g === userGradeKey ? 'background:#e3f2fd' : '') + '">' + formatCurrency(getCmpBen(g, 'uangHarian')) + '</td>').join('')}</tr>
        <tr><td class="fw-700">Max Hotel/Malam</td>${allGrades.map((g) => '<td style="' + (g === userGradeKey ? 'background:#e3f2fd' : '') + '">' + formatCurrency(getCmpBen(g, 'maxHotel')) + '</td>').join('')}</tr>
        <tr><td class="fw-700">Kelas Hotel</td>${allGrades.map((g) => '<td style="' + (g === userGradeKey ? 'background:#e3f2fd' : '') + '">' + escHtml(getCmpPer(g, 'kelasHotelDiizinkan')) + '</td>').join('')}</tr>
        <tr><td class="fw-700">Transport</td>${allGrades.map((g) => '<td style="' + (g === userGradeKey ? 'background:#e3f2fd' : '') + ';font-size:.8rem">' + escHtml((getCmpPer(g, 'transportasiDiizinkan') || []).slice(0, 2).join(', ')) + '</td>').join('')}</tr>
        <tr><td class="fw-700">Uang Muka</td>${allGrades.map((g) => '<td style="' + (g === userGradeKey ? 'background:#e3f2fd' : '') + '">' + getCmpPer(g, 'persenUangMuka') + '%</td>').join('')}</tr>
        <tr><td class="fw-700">Max Durasi (tanpa approval khusus)</td>${allGrades.map((g) => '<td style="' + (g === userGradeKey ? 'background:#e3f2fd' : '') + '">' + getCmpPer(g, 'maxDurasiTanpaApprovalKhusus') + ' hari</td>').join('')}</tr>
        <tr><td class="fw-700">Batas Laporan</td>${allGrades.map((g) => '<td style="' + (g === userGradeKey ? 'background:#e3f2fd' : '') + '">' + getCmpPer(g, 'batasWaktuLaporan') + ' hari</td>').join('')}</tr>
        <tr><td class="fw-700">Alur Approval</td>${allGrades.map((g) => '<td style="' + (g === userGradeKey ? 'background:#e3f2fd' : '') + ';font-size:.8rem">' + escHtml(getCmpPer(g, 'alurApproval')) + '</td>').join('')}</tr>
      </tbody></table></div></div>`;
  }

  // Admin section - Konfigurasi Benefit per Grade (EDITABLE)
  if (hasAccess(6)) {
    const allGrades2 = ['BOD', 'HEAD', 'SENIOR', 'STAFF'];
    const getBenVal = (grade, field) => {
      if (fsConfig && fsConfig.benefit && fsConfig.benefit[grade])
        return fsConfig.benefit[grade][field];
      return BENEFIT_CONFIG_BY_GRADE[grade][field];
    };
    const getPerVal = (grade, field) => {
      if (fsConfig && fsConfig.peraturan && fsConfig.peraturan[grade])
        return fsConfig.peraturan[grade][field];
      return PERATURAN_DINAS_BY_GRADE[grade][field];
    };

    html += `<div class="mt-16" style="padding:16px;background:#f3e5f5;border-radius:12px;border-left:4px solid #9c27b0">
      <div class="fw-700 mb-12" style="color:#6a1b9a;font-size:1.05rem">⚙️ Konfigurasi Benefit per Grade (Admin - Editable)</div>
      <div class="table-wrap"><table><thead><tr><th>Komponen</th>${allGrades2.map((g) => '<th>' + BENEFIT_CONFIG_BY_GRADE[g].label + '</th>').join('')}</tr></thead><tbody>
        <tr><td class="fw-700">Uang Harian</td>${allGrades2.map((g) => '<td><input type="number" class="form-control" id="cfg_uangHarian_' + g + '" value="' + getBenVal(g, 'uangHarian') + '" style="width:120px"></td>').join('')}</tr>
        <tr><td class="fw-700">Max Transport</td>${allGrades2.map((g) => '<td><input type="number" class="form-control" id="cfg_maxTransport_' + g + '" value="' + getBenVal(g, 'maxTransport') + '" style="width:120px"></td>').join('')}</tr>
        <tr><td class="fw-700">Max Hotel</td>${allGrades2.map((g) => '<td><input type="number" class="form-control" id="cfg_maxHotel_' + g + '" value="' + getBenVal(g, 'maxHotel') + '" style="width:120px"></td>').join('')}</tr>
        <tr><td class="fw-700">Kelas Hotel</td>${allGrades2.map((g) => '<td><input type="text" class="form-control" id="cfg_kelasHotel_' + g + '" value="' + escHtml(getBenVal(g, 'kelasHotel')) + '" style="width:130px"></td>').join('')}</tr>
        <tr><td class="fw-700">Max Makan/Hari</td>${allGrades2.map((g) => '<td><input type="number" class="form-control" id="cfg_maxMakan_' + g + '" value="' + getBenVal(g, 'maxMakan') + '" style="width:120px"></td>').join('')}</tr>
        <tr><td class="fw-700">Uang Saku/Hari</td>${allGrades2.map((g) => '<td><input type="number" class="form-control" id="cfg_uangSaku_' + g + '" value="' + getBenVal(g, 'uangSaku') + '" style="width:120px"></td>').join('')}</tr>
        <tr><td class="fw-700">Uang Muka (%)</td>${allGrades2.map((g) => '<td><input type="number" class="form-control" id="cfg_persenUangMuka_' + g + '" value="' + getPerVal(g, 'persenUangMuka') + '" style="width:80px" min="0" max="100"></td>').join('')}</tr>
        <tr><td class="fw-700">Max Durasi (hari)</td>${allGrades2.map((g) => '<td><input type="number" class="form-control" id="cfg_maxDurasi_' + g + '" value="' + getPerVal(g, 'maxDurasiTanpaApprovalKhusus') + '" style="width:80px"></td>').join('')}</tr>
        <tr><td class="fw-700">Batas Laporan (hari)</td>${allGrades2.map((g) => '<td><input type="number" class="form-control" id="cfg_batasLaporan_' + g + '" value="' + getPerVal(g, 'batasWaktuLaporan') + '" style="width:80px"></td>').join('')}</tr>
        <tr><td class="fw-700">Alur Approval</td>${allGrades2.map((g) => '<td><input type="text" class="form-control" id="cfg_alurApproval_' + g + '" value="' + escHtml(getPerVal(g, 'alurApproval')) + '" style="width:150px"></td>').join('')}</tr>
      </tbody></table></div>
      <button class="btn btn-primary mt-16" onclick="saveBenefitConfig()" style="padding:10px 24px">💾 Simpan Konfigurasi</button>
      <span class="text-sm ml-8" style="color:#666">${fsConfig ? '(Terakhir diupdate: ' + formatDate(fsConfig.updatedAt) + ' oleh ' + escHtml(fsConfig.updatedBy || '-') + ')' : '(Menggunakan default - belum pernah disimpan)'}</span>
    </div>`;
  }

  html += `</div>`;
  el.innerHTML = html;
}

async function saveBenefitConfig() {
  if (
    !confirm(
      'Apakah Anda yakin ingin menyimpan konfigurasi benefit? Perubahan akan langsung berlaku untuk semua karyawan.'
    )
  )
    return;
  const allGrades = ['BOD', 'HEAD', 'SENIOR', 'STAFF'];
  const benefit = {};
  const peraturan = {};

  for (const g of allGrades) {
    const uangHarian = parseInt(document.getElementById('cfg_uangHarian_' + g)?.value) || 0;
    const maxTransport = parseInt(document.getElementById('cfg_maxTransport_' + g)?.value) || 0;
    const maxHotel = parseInt(document.getElementById('cfg_maxHotel_' + g)?.value) || 0;
    const kelasHotel = document.getElementById('cfg_kelasHotel_' + g)?.value || '';
    const maxMakan = parseInt(document.getElementById('cfg_maxMakan_' + g)?.value) || 0;
    const uangSaku = parseInt(document.getElementById('cfg_uangSaku_' + g)?.value) || 0;
    const persenUangMuka = parseInt(document.getElementById('cfg_persenUangMuka_' + g)?.value) || 0;
    const maxDurasi = parseInt(document.getElementById('cfg_maxDurasi_' + g)?.value) || 0;
    const batasLaporan = parseInt(document.getElementById('cfg_batasLaporan_' + g)?.value) || 0;
    const alurApproval = document.getElementById('cfg_alurApproval_' + g)?.value || '';

    if (uangHarian < 0 || maxTransport < 0 || maxHotel < 0 || maxMakan < 0 || uangSaku < 0) {
      toast('Nilai nominal tidak boleh negatif untuk grade ' + g, 'warning');
      return;
    }

    benefit[g] = {
      label: BENEFIT_CONFIG_BY_GRADE[g].label,
      uangHarian,
      maxTransport,
      maxHotel,
      kelasHotel,
      maxMakan,
      uangSaku,
      totalMaxPerDay: uangHarian + maxMakan + uangSaku,
    };

    const existingPeraturan = PERATURAN_DINAS_BY_GRADE[g];
    peraturan[g] = {
      alurApproval,
      maxDurasiTanpaApprovalKhusus: maxDurasi,
      persenUangMuka,
      batasWaktuLaporan: batasLaporan,
      transportasiDiizinkan: existingPeraturan.transportasiDiizinkan,
      kelasHotelDiizinkan: kelasHotel,
      ketentuanKhusus: existingPeraturan.ketentuanKhusus,
    };
  }

  try {
    await db.collection('hrd_config_benefit').doc('current').set({
      benefit,
      peraturan,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.nama,
    });
    invalidateBenefitCache();
    toast('Konfigurasi benefit berhasil disimpan!', 'success');
    showSPPDTab('prosedur');
  } catch (e) {
    toast('Gagal menyimpan: ' + e.message, 'error');
  }
}

async function modalAjukanSPPD() {
  const grade = await getUserGrade();
  const cfg = await getGradeConfig(grade);
  const noSPPD = 'SPPD/' + new Date().getFullYear() + '/' + String(Date.now()).slice(-6);
  openModal(
    `<div class="modal-title">✈️ Ajukan Surat Perintah Perjalanan Dinas</div>
    <div style="background:#f0f4ff;padding:10px;border-radius:8px;margin-bottom:16px"><span class="fw-700">No. SPPD:</span> ${noSPPD}</div>
    <div style="background:#e8f5e9;padding:12px;border-radius:8px;margin-bottom:16px;border-left:4px solid var(--success)">
      <div class="fw-700 text-sm mb-4">🎯 Grade Anda: <span class="badge badge-info">${escHtml(grade || 'STAFF')}</span> (${escHtml(cfg.label)})</div>
      <div class="text-sm" style="color:#555">Uang Harian: ${formatCurrency(cfg.uangHarian)} | Hotel: ${formatCurrency(cfg.maxHotel)}/mlm (${escHtml(cfg.kelasHotel)}) | Makan: ${formatCurrency(cfg.maxMakan)}/hr | Saku: ${formatCurrency(cfg.uangSaku)}/hr</div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Nama Karyawan</label><input class="form-control" id="sppdNama" value="${escHtml(currentUser.nama)}"></div>
      <div class="form-group"><label>Departemen</label><input class="form-control" id="sppdDept" value="${escHtml(currentUser.departemen || '')}"></div>
    </div>
    <div class="form-group"><label>Tujuan / Kota Tujuan</label><input class="form-control" id="sppdTujuan" placeholder="Jakarta, Surabaya, dll"></div>
    <div class="form-group"><label>Nama Klien / Instansi</label><input class="form-control" id="sppdKlien" placeholder="Nama klien atau instansi yang dikunjungi"></div>
    <div class="grid-2">
      <div class="form-group"><label>Tanggal Mulai</label><input class="form-control" type="date" id="sppdMulai" onchange="hitungEstimasiBenefit()"></div>
      <div class="form-group"><label>Tanggal Selesai</label><input class="form-control" type="date" id="sppdSelesai" onchange="hitungEstimasiBenefit()"></div>
    </div>
    <div class="form-group"><label>Keperluan / Tujuan Dinas</label><textarea class="form-control" id="sppdKeperluan" placeholder="Jelaskan tujuan dan keperluan perjalanan dinas"></textarea></div>
    <div class="grid-2">
      <div class="form-group"><label>Transportasi</label><select class="form-control" id="sppdTransport"><option value="Pesawat">Pesawat</option><option value="Kereta">Kereta</option><option value="Bus">Bus</option><option value="Mobil Dinas">Mobil Dinas</option><option value="Kendaraan Pribadi">Kendaraan Pribadi</option><option value="Lainnya">Lainnya</option></select></div>
      <div class="form-group"><label>Akomodasi</label><select class="form-control" id="sppdAkomodasi"><option value="Hotel">Hotel</option><option value="Guest House">Guest House</option><option value="Rumah Keluarga">Rumah Keluarga</option><option value="Tidak Perlu">Tidak Perlu</option><option value="Lainnya">Lainnya</option></select></div>
    </div>
    <div id="sppdEstimasiInfo" class="mb-8"></div>
    <div class="fw-700 text-sm mb-8 mt-8 color-primary">💰 Estimasi Biaya</div>
    <div class="grid-2">
      <div class="form-group"><label>Transport (Rp)</label><input class="form-control" type="number" id="sppdBiayaTransport" value="0" onchange="cekBatasGrade()"></div>
      <div class="form-group"><label>Akomodasi (Rp)</label><input class="form-control" type="number" id="sppdBiayaAkomodasi" value="0" onchange="cekBatasGrade()"></div>
      <div class="form-group"><label>Makan & Uang Saku (Rp)</label><input class="form-control" type="number" id="sppdBiayaMakan" value="0" onchange="cekBatasGrade()"></div>
      <div class="form-group"><label>Lain-lain (Rp)</label><input class="form-control" type="number" id="sppdBiayaLain" value="0"></div>
    </div>
    <div id="sppdWarningGrade" class="mb-8"></div>
    <div class="form-group"><label>Catatan Tambahan</label><textarea class="form-control" id="sppdCatatan" placeholder="Catatan khusus (opsional)"></textarea></div>
    <button class="btn btn-primary" style="width:100%;padding:12px" onclick="simpanSPPD('${noSPPD}')">📝 Ajukan SPPD</button>`,
    true
  );
}

function hitungEstimasiBenefit() {
  const mulai = document.getElementById('sppdMulai')?.value;
  const selesai = document.getElementById('sppdSelesai')?.value;
  if (!mulai || !selesai) return;
  const hari = Math.ceil((new Date(selesai) - new Date(mulai)) / (1000 * 60 * 60 * 24) + 1);
  if (hari <= 0) return;
  const grade = currentUser.gradeJabatan || 'STAFF';
  const cfg = getGradeConfigSync(grade);
  const malam = Math.max(hari - 1, 0);
  const estTransport = cfg.maxTransport;
  const estAkomodasi = cfg.maxHotel * malam;
  const estMakan = (cfg.maxMakan + cfg.uangSaku) * hari;
  document.getElementById('sppdBiayaTransport').value = estTransport;
  document.getElementById('sppdBiayaAkomodasi').value = estAkomodasi;
  document.getElementById('sppdBiayaMakan').value = estMakan;
  const infoEl = document.getElementById('sppdEstimasiInfo');
  if (infoEl)
    infoEl.innerHTML = `<div class="text-sm" style="background:#fff3cd;padding:8px;border-radius:6px;color:#856404">📊 Auto-kalkulasi: ${hari} hari, ${malam} malam | Estimasi grade ${escHtml(grade)}: Transport ${formatCurrency(estTransport)}, Hotel ${formatCurrency(estAkomodasi)}, Makan+Saku ${formatCurrency(estMakan)}</div>`;
  cekBatasGrade();
}

function cekBatasGrade() {
  const mulai = document.getElementById('sppdMulai')?.value;
  const selesai = document.getElementById('sppdSelesai')?.value;
  const warnEl = document.getElementById('sppdWarningGrade');
  if (!warnEl || !mulai || !selesai) return;
  const hari = Math.ceil((new Date(selesai) - new Date(mulai)) / (1000 * 60 * 60 * 24) + 1);
  if (hari <= 0) {
    warnEl.innerHTML = '';
    return;
  }
  const grade = currentUser.gradeJabatan || 'STAFF';
  const cfg = getGradeConfigSync(grade);
  const malam = Math.max(hari - 1, 0);
  const warnings = [];
  const transport = parseInt(document.getElementById('sppdBiayaTransport').value) || 0;
  const akomodasi = parseInt(document.getElementById('sppdBiayaAkomodasi').value) || 0;
  const makan = parseInt(document.getElementById('sppdBiayaMakan').value) || 0;
  if (transport > cfg.maxTransport)
    warnings.push('Transport melebihi batas grade (max ' + formatCurrency(cfg.maxTransport) + ')');
  if (malam > 0 && akomodasi > cfg.maxHotel * malam)
    warnings.push(
      'Akomodasi melebihi batas grade (max ' +
        formatCurrency(cfg.maxHotel * malam) +
        ' untuk ' +
        malam +
        ' malam)'
    );
  if (makan > (cfg.maxMakan + cfg.uangSaku) * hari)
    warnings.push(
      'Makan & Saku melebihi batas grade (max ' +
        formatCurrency((cfg.maxMakan + cfg.uangSaku) * hari) +
        ' untuk ' +
        hari +
        ' hari)'
    );
  if (warnings.length)
    warnEl.innerHTML =
      '<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:8px;color:#856404" class="text-sm">⚠️ ' +
      warnings.join('<br>⚠️ ') +
      '</div>';
  else warnEl.innerHTML = '';
}

async function simpanSPPD(noSPPD) {
  const grade = currentUser.gradeJabatan || 'STAFF';
  const gradeConfig = await getGradeConfig(grade);
  const data = {
    noSPPD,
    nama: document.getElementById('sppdNama').value,
    departemen: document.getElementById('sppdDept').value,
    tujuan: document.getElementById('sppdTujuan').value,
    klien: document.getElementById('sppdKlien').value,
    tanggalMulai: document.getElementById('sppdMulai').value,
    tanggalSelesai: document.getElementById('sppdSelesai').value,
    keperluan: document.getElementById('sppdKeperluan').value,
    transportasi: document.getElementById('sppdTransport').value,
    akomodasi: document.getElementById('sppdAkomodasi').value,
    biayaTransport: parseInt(document.getElementById('sppdBiayaTransport').value) || 0,
    biayaAkomodasi: parseInt(document.getElementById('sppdBiayaAkomodasi').value) || 0,
    biayaMakan: parseInt(document.getElementById('sppdBiayaMakan').value) || 0,
    biayaLain: parseInt(document.getElementById('sppdBiayaLain').value) || 0,
    catatan: document.getElementById('sppdCatatan').value,
    gradeJabatan: grade,
    gradeConfigUsed: gradeConfig.label,
    status: 'pending',
    userId: currentUser.id,
    createdAt: new Date().toISOString(),
  };
  data.totalEstimasi = data.biayaTransport + data.biayaAkomodasi + data.biayaMakan + data.biayaLain;
  if (!data.tujuan) return toast('Tujuan wajib diisi', 'warning');
  if (!data.tanggalMulai || !data.tanggalSelesai)
    return toast('Tanggal mulai dan selesai wajib', 'warning');
  if (!data.keperluan) return toast('Keperluan wajib diisi', 'warning');
  // Check if any amount exceeds grade limits
  const _hari = Math.ceil(
    (new Date(data.tanggalSelesai) - new Date(data.tanggalMulai)) / (1000 * 60 * 60 * 24) + 1
  );
  const _malam = Math.max(_hari - 1, 0);
  if (_hari > 0) {
    let _exceeded = false;
    if (data.biayaTransport > gradeConfig.maxTransport) _exceeded = true;
    if (_malam > 0 && data.biayaAkomodasi > gradeConfig.maxHotel * _malam) _exceeded = true;
    if (data.biayaMakan > (gradeConfig.maxMakan + gradeConfig.uangSaku) * _hari) _exceeded = true;
    if (_exceeded && !confirm('Estimasi melebihi batas grade Anda, tetap ajukan?')) return;
  }
  const sppdRef = await db.collection('hrd_perjalanan_dinas').add(data);
  // Juga tambahkan ke hrd_dinas_luar agar terintegrasi dengan modul absensi
  const dinasLuarRef = await db.collection('hrd_dinas_luar').add({
    nama: data.nama,
    tanggal: data.tanggalMulai,
    tanggalSelesai: data.tanggalSelesai,
    tujuan: data.tujuan,
    keperluan: data.keperluan,
    transportasi: data.transportasi,
    akomodasi: data.akomodasi,
    gradeJabatan: grade,
    totalEstimasi: data.totalEstimasi,
    jamBerangkat: '',
    jamKembali: '',
    status: 'pending',
    userId: currentUser.id,
    noSPPD,
    sppdId: sppdRef.id,
    createdAt: new Date().toISOString(),
  });
  // Update SPPD with linked dinas luar ID
  try {
    await db
      .collection('hrd_perjalanan_dinas')
      .doc(sppdRef.id)
      .update({ dinasLuarId: dinasLuarRef.id });
  } catch (e) {
    console.warn('Failed to update SPPD with dinasLuarId, cross-reference may be incomplete:', e);
  }
  await sendNotification(
    'admin',
    'SPPD Baru',
    `${data.nama} mengajukan perjalanan dinas ke ${data.tujuan}`
  );
  closeModalDirect();
  toast('✅ SPPD berhasil diajukan!', 'success');
  showSPPDTab('daftar');
}

async function approveSPPD(id) {
  var komentar = prompt('Komentar approval (opsional):') || '';
  if (!confirm('Setujui SPPD ini?')) return;
  const doc = await db.collection('hrd_perjalanan_dinas').doc(id).get();
  const p = doc.data();
  var updateData = {
    status: 'approved',
    approvedBy: currentUser.nama,
    approvedAt: new Date().toISOString(),
  };
  if (komentar) updateData.approvalComment = komentar;
  await db.collection('hrd_perjalanan_dinas').doc(id).update(updateData);
  // Update linked dinas_luar juga
  const linkSnap = await db.collection('hrd_dinas_luar').where('noSPPD', '==', p.noSPPD).get();
  linkSnap.forEach((d) =>
    d.ref.update({
      status: 'approved',
      approvedBy: currentUser.nama,
      approvedAt: new Date().toISOString(),
    })
  );
  await sendNotification(
    p.userId || p.nama,
    'SPPD Disetujui',
    `SPPD ${p.noSPPD} ke ${p.tujuan} telah disetujui oleh ${currentUser.nama}`
  );
  toast('✅ SPPD disetujui', 'success');
  showSPPDTab('daftar');
}

async function rejectSPPD(id) {
  const alasan = prompt('Alasan penolakan:');
  if (!alasan) return;
  const doc = await db.collection('hrd_perjalanan_dinas').doc(id).get();
  const p = doc.data();
  await db.collection('hrd_perjalanan_dinas').doc(id).update({
    status: 'rejected',
    rejectedBy: currentUser.nama,
    rejectedAt: new Date().toISOString(),
    alasanTolak: alasan,
  });
  const linkSnap = await db.collection('hrd_dinas_luar').where('noSPPD', '==', p.noSPPD).get();
  linkSnap.forEach((d) => d.ref.update({ status: 'rejected' }));
  await sendNotification(p.userId || p.nama, 'SPPD Ditolak', `SPPD ${p.noSPPD} ditolak: ${alasan}`);
  toast('SPPD ditolak', 'info');
  showSPPDTab('daftar');
}

async function viewSPPD(id) {
  const doc = await db.collection('hrd_perjalanan_dinas').doc(id).get();
  const p = doc.data();
  const durasi =
    p.tanggalMulai && p.tanggalSelesai
      ? Math.ceil(
          (new Date(p.tanggalSelesai) - new Date(p.tanggalMulai)) / (1000 * 60 * 60 * 24) + 1
        ) + ' hari'
      : '-';
  const durasiFull =
    p.tanggalMulai && p.tanggalSelesai
      ? Math.ceil(
          (new Date(p.tanggalSelesai) - new Date(p.tanggalMulai)) / (1000 * 60 * 60 * 24) + 1
        )
      : 0;
  const badge =
    p.status === 'approved'
      ? 'badge-success'
      : p.status === 'rejected'
        ? 'badge-danger'
        : p.status === 'selesai'
          ? 'badge-info'
          : 'badge-warning';
  const sppdGrade = p.gradeJabatan || 'STAFF';
  const cfg = getGradeConfig(sppdGrade);
  const malam = Math.max(durasiFull - 1, 0);
  let gradeBenefitHtml = '';
  if (durasiFull > 0) {
    const maxTransport = cfg.maxTransport;
    const maxAkomodasi = cfg.maxHotel * malam;
    const maxMakan = (cfg.maxMakan + cfg.uangSaku) * durasiFull;
    const transportStatus =
      p.biayaTransport <= maxTransport ? 'color:var(--success)' : 'color:var(--danger)';
    const akomodasiStatus =
      malam > 0 && p.biayaAkomodasi <= maxAkomodasi
        ? 'color:var(--success)'
        : malam === 0
          ? 'color:var(--success)'
          : 'color:var(--danger)';
    const makanStatus = p.biayaMakan <= maxMakan ? 'color:var(--success)' : 'color:var(--danger)';
    gradeBenefitHtml = `<div class="mb-16" style="background:#f0f4ff;padding:12px;border-radius:8px;border-left:4px solid var(--accent)">
      <div class="fw-700 text-sm mb-8">🎯 Benefit Grade: <span class="badge badge-info">${escHtml(sppdGrade)}</span> (${escHtml(cfg.label)})</div>
      <div class="text-sm" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">
        <div>Transport</div><div>Diajukan: ${formatCurrency(p.biayaTransport)}</div><div style="${transportStatus}">Max: ${formatCurrency(maxTransport)}</div>
        <div>Akomodasi</div><div>Diajukan: ${formatCurrency(p.biayaAkomodasi)}</div><div style="${akomodasiStatus}">Max: ${formatCurrency(maxAkomodasi)} (${malam} mlm)</div>
        <div>Makan+Saku</div><div>Diajukan: ${formatCurrency(p.biayaMakan)}</div><div style="${makanStatus}">Max: ${formatCurrency(maxMakan)} (${durasiFull} hr)</div>
      </div>
    </div>`;
  }
  openModal(
    `<div class="modal-title">📋 Detail SPPD — ${escHtml(p.noSPPD)}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><span class="badge ${badge}" style="font-size:.85rem;padding:6px 14px">${p.status?.toUpperCase()}</span><span class="text-sm" style="color:#999">${formatDate(p.createdAt)}</span></div>
    <div class="grid-2 mb-16">
      <div><b>Nama:</b> ${escHtml(p.nama)}</div>
      <div><b>Departemen:</b> ${escHtml(p.departemen || '-')}</div>
      <div><b>Tujuan:</b> ${escHtml(p.tujuan)}</div>
      <div><b>Klien/Instansi:</b> ${escHtml(p.klien || '-')}</div>
      <div><b>Tanggal:</b> ${formatDate(p.tanggalMulai)} - ${formatDate(p.tanggalSelesai)}</div>
      <div><b>Durasi:</b> ${durasi}</div>
      <div><b>Transportasi:</b> ${escHtml(p.transportasi || '-')}</div>
      <div><b>Akomodasi:</b> ${escHtml(p.akomodasi || '-')}</div>
    </div>
    <div class="mb-16"><b>Keperluan:</b><div class="text-sm mt-4" style="background:#f8f9ff;padding:10px;border-radius:6px">${escHtml(p.keperluan || '-')}</div></div>
    ${gradeBenefitHtml}
    <div class="fw-700 mb-8">💰 Estimasi Biaya:</div>
    <div class="grid-2 mb-16" style="background:#f8f9ff;padding:12px;border-radius:8px">
      <div>Transport: ${formatCurrency(p.biayaTransport)}</div>
      <div>Akomodasi: ${formatCurrency(p.biayaAkomodasi)}</div>
      <div>Makan & Saku: ${formatCurrency(p.biayaMakan)}</div>
      <div>Lain-lain: ${formatCurrency(p.biayaLain)}</div>
      <div class="fw-700" style="grid-column:span 2;border-top:1px solid var(--border);padding-top:8px;margin-top:4px">Total: ${formatCurrency(p.totalEstimasi)}</div>
    </div>
    ${p.catatan ? `<div class="mb-16"><b>Catatan:</b><div class="text-sm mt-4">${escHtml(p.catatan)}</div></div>` : ''}
    <div style="margin-top:16px;padding:14px;border-radius:10px;border:1px solid #e0e0e0;background:${p.status === 'approved' || p.status === 'selesai' ? '#e8f5e9' : p.status === 'rejected' ? '#fce4ec' : '#fff8e1'}">
      <div class="fw-700 mb-8" style="color:${p.status === 'approved' || p.status === 'selesai' ? '#2e7d32' : p.status === 'rejected' ? '#c62828' : '#f57f17'}">📋 Status Approval</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.85rem">
        <div><b>Status:</b> <span class="badge ${badge}">${(p.status || 'pending').toUpperCase()}</span></div>
        <div><b>Diajukan:</b> ${formatDate(p.createdAt)}</div>
        ${p.approvedBy ? `<div><b>Disetujui oleh:</b> ${escHtml(p.approvedBy)}</div>` : ''}
        ${p.approvedAt ? `<div><b>Tgl Approve:</b> ${formatDate(p.approvedAt)}</div>` : ''}
        ${p.rejectedBy ? `<div><b>Ditolak oleh:</b> ${escHtml(p.rejectedBy)}</div>` : ''}
        ${p.rejectedAt ? `<div><b>Tgl Tolak:</b> ${formatDate(p.rejectedAt)}</div>` : ''}
      </div>
      ${p.alasanTolak || p.approvalComment || p.komentar ? `<div style="margin-top:10px;padding:10px;background:#fff;border-radius:6px;border-left:3px solid ${p.status === 'approved' ? '#2e7d32' : '#c62828'}"><div class="text-xs fw-700 mb-4">💬 Komentar Approval:</div><div class="text-sm">${escHtml(p.alasanTolak || p.approvalComment || p.komentar || '')}</div></div>` : ''}
    </div>
    ${p.status === 'approved' ? `<div class="flex gap-8 mt-16"><button class="btn btn-primary btn-sm" onclick="closeModalDirect();modalUangMukaDinas('${id}')">💰 Ajukan Uang Muka</button><button class="btn btn-info btn-sm" onclick="closeModalDirect();modalLaporanDinas('${id}')">📝 Buat Laporan</button></div>` : ''}`,
    true
  );
}

function cetakSPPD(id) {
  db.collection('hrd_perjalanan_dinas')
    .doc(id)
    .get()
    .then((doc) => {
      const p = doc.data();
      const durasi =
        p.tanggalMulai && p.tanggalSelesai
          ? Math.ceil(
              (new Date(p.tanggalSelesai) - new Date(p.tanggalMulai)) / (1000 * 60 * 60 * 24) + 1
            ) + ' hari'
          : '-';
      const win = window.open('', '_blank');
      win.document
        .write(`<html><head><title>SPPD ${p.noSPPD}</title><style>body{font-family:serif;padding:40px;max-width:800px;margin:auto}h2{text-align:center}table{width:100%;border-collapse:collapse;margin:20px 0}td{padding:8px;border:1px solid #333;font-size:14px}.no-border td{border:none}.sign{display:flex;justify-content:space-between;margin-top:60px;text-align:center}.sign div{width:200px}@media print{button{display:none}}</style></head><body>
      <h2>SURAT PERINTAH PERJALANAN DINAS</h2>
      <p style="text-align:center">No: ${escHtml(p.noSPPD)}</p>
      <table><tr><td width="30%"><b>Nama</b></td><td>${escHtml(p.nama)}</td></tr><tr><td><b>Departemen</b></td><td>${escHtml(p.departemen || '-')}</td></tr><tr><td><b>Tujuan</b></td><td>${escHtml(p.tujuan)}</td></tr><tr><td><b>Klien/Instansi</b></td><td>${escHtml(p.klien || '-')}</td></tr><tr><td><b>Tanggal</b></td><td>${formatDate(p.tanggalMulai)} s/d ${formatDate(p.tanggalSelesai)} (${durasi})</td></tr><tr><td><b>Transportasi</b></td><td>${escHtml(p.transportasi || '-')}</td></tr><tr><td><b>Akomodasi</b></td><td>${escHtml(p.akomodasi || '-')}</td></tr><tr><td><b>Keperluan</b></td><td>${escHtml(p.keperluan || '-')}</td></tr><tr><td><b>Estimasi Biaya</b></td><td>${formatCurrency(p.totalEstimasi)}</td></tr></table>
      <div class="sign"><div><p>Yang Bersangkutan,</p><br><br><br><p><b>${escHtml(p.nama)}</b></p></div><div><p>Disetujui,</p><br><br><br><p><b>${escHtml(p.approvedBy || '___________')}</b></p></div></div>
      <button onclick="window.print()" style="margin-top:30px;padding:10px 20px;cursor:pointer">🖨️ Cetak</button></body></html>`);
    });
}

// ── UANG MUKA PERJALANAN DINAS ────────────────────────────────

async function loadSPPDUangMuka(el) {
  const isPortal = window._portalDinasMode || !hasAccess(3);
  const snap = await db.collection('hrd_uang_muka_dinas').get();
  let h = `<div class="card"><div class="card-header"><div class="card-title">💰 Uang Muka Perjalanan Dinas</div><button class="btn btn-primary btn-sm" onclick="modalUangMukaDinasNew()">+ Ajukan Uang Muka</button></div>
    <div class="table-wrap"><table><thead><tr><th>No. SPPD</th><th>Nama</th><th>Jumlah</th><th>Status</th><th>Aksi</th></tr></thead><tbody>`;
  let hasData = false;
  snap.forEach((d) => {
    const p = d.data();
    if (isPortal && p.userId !== currentUser.id) return;
    // Manager (level 3) only sees own department; Head/BOD/Admin (level 4+) sees all
    if (!isPortal && hasAccess(3) && !hasAccess(4)) {
      if (
        p.userId !== currentUser.id &&
        (p.departemen || '').toLowerCase() !== (currentUser.departemen || '').toLowerCase()
      )
        return;
    }
    hasData = true;
    const badge =
      p.status === 'dicairkan'
        ? 'badge-success'
        : p.status === 'ditolak'
          ? 'badge-danger'
          : 'badge-warning';
    h += `<tr><td class="fw-700">${escHtml(p.noSPPD || '-')}</td><td>${escHtml(p.nama)}</td><td>${formatCurrency(p.jumlah)}</td><td><span class="badge ${badge}">${p.status}</span></td><td><button class="btn btn-xs btn-info" onclick="viewUangMukaDinas('${d.id}')">👁️</button> ${hasAccess(3) && p.status === 'pending' ? `<button class="btn btn-xs btn-success" onclick="cairkanUangMuka('${d.id}')">💸</button>` : ''}</td></tr>`;
  });
  if (!hasData)
    h += '<tr><td colspan="5" class="text-center">Belum ada pengajuan uang muka</td></tr>';
  h += '</tbody></table></div></div>';
  el.innerHTML = h;
}

async function modalUangMukaDinas(sppdId) {
  const doc = await db.collection('hrd_perjalanan_dinas').doc(sppdId).get();
  const p = doc.data();
  const maxUM = Math.floor((p.totalEstimasi || 0) * 0.8);
  openModal(`<div class="modal-title">💰 Ajukan Uang Muka Perjalanan Dinas</div>
    <div style="background:#f0f4ff;padding:10px;border-radius:8px;margin-bottom:16px"><b>SPPD:</b> ${escHtml(p.noSPPD)} — ${escHtml(p.tujuan)}<br><b>Estimasi Total:</b> ${formatCurrency(p.totalEstimasi)} | <b>Maks Uang Muka (80%):</b> ${formatCurrency(maxUM)}</div>
    <div class="form-group"><label>Jumlah Uang Muka (Rp)</label><input class="form-control" type="number" id="umJumlah" value="${maxUM}" max="${maxUM}"></div>
    <div class="form-group"><label>Rincian Penggunaan</label><textarea class="form-control" id="umRincian" placeholder="Transport: Rp..., Hotel: Rp..., dll"></textarea></div>
    <div class="form-group"><label>Metode Transfer</label><select class="form-control" id="umMetode"><option value="Transfer Bank">Transfer Bank</option><option value="Cash">Cash</option><option value="E-Wallet">E-Wallet</option></select></div>
    <button class="btn btn-primary" onclick="simpanUangMukaDinas('${sppdId}','${p.noSPPD}')">💰 Ajukan</button>`);
}

async function modalUangMukaDinasNew() {
  const snap = await db.collection('hrd_perjalanan_dinas').where('status', '==', 'approved').get();
  let options = '<option value="">-- Pilih SPPD --</option>';
  snap.forEach((d) => {
    const p = d.data();
    if (p.userId === currentUser.id || hasAccess(3))
      options += `<option value="${d.id}" data-total="${p.totalEstimasi || 0}" data-nosppd="${p.noSPPD}">${p.noSPPD} — ${p.tujuan}</option>`;
  });
  openModal(`<div class="modal-title">💰 Ajukan Uang Muka Perjalanan Dinas</div>
    <div class="form-group"><label>Pilih SPPD</label><select class="form-control" id="umSPPDSelect" onchange="updateUMMax()">${options}</select></div>
    <div id="umMaxInfo" class="mb-8"></div>
    <div class="form-group"><label>Jumlah Uang Muka (Rp)</label><input class="form-control" type="number" id="umJumlah" value="0"></div>
    <div class="form-group"><label>Rincian Penggunaan</label><textarea class="form-control" id="umRincian" placeholder="Transport: Rp..., Hotel: Rp..., dll"></textarea></div>
    <div class="form-group"><label>Metode Transfer</label><select class="form-control" id="umMetode"><option value="Transfer Bank">Transfer Bank</option><option value="Cash">Cash</option><option value="E-Wallet">E-Wallet</option></select></div>
    <button class="btn btn-primary" onclick="simpanUangMukaDinasFromSelect()">💰 Ajukan</button>`);
}

function updateUMMax() {
  const sel = document.getElementById('umSPPDSelect');
  const opt = sel.options[sel.selectedIndex];
  const total = parseInt(opt?.getAttribute('data-total')) || 0;
  const max = Math.floor(total * 0.8);
  document.getElementById('umMaxInfo').innerHTML = total
    ? `<span class="text-sm" style="color:#666">Estimasi: ${formatCurrency(total)} | Maks UM (80%): <b>${formatCurrency(max)}</b></span>`
    : '';
  document.getElementById('umJumlah').value = max;
  document.getElementById('umJumlah').max = max;
}

async function simpanUangMukaDinasFromSelect() {
  const sel = document.getElementById('umSPPDSelect');
  const sppdId = sel.value;
  const noSPPD = sel.options[sel.selectedIndex]?.getAttribute('data-nosppd') || '';
  if (!sppdId) return toast('Pilih SPPD dulu', 'warning');
  await simpanUangMukaDinas(sppdId, noSPPD);
}

async function simpanUangMukaDinas(sppdId, noSPPD) {
  const jumlah = parseInt(document.getElementById('umJumlah').value) || 0;
  const rincian = document.getElementById('umRincian').value;
  const metode = document.getElementById('umMetode').value;
  if (!jumlah) return toast('Jumlah harus lebih dari 0', 'warning');
  await db.collection('hrd_uang_muka_dinas').add({
    sppdId,
    noSPPD,
    nama: currentUser.nama,
    userId: currentUser.id,
    jumlah,
    rincian,
    metode,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  await sendNotification(
    'admin',
    'Uang Muka Dinas',
    `${currentUser.nama} mengajukan uang muka ${formatCurrency(jumlah)} untuk ${noSPPD}`
  );
  closeModalDirect();
  toast('✅ Uang muka diajukan', 'success');
  showSPPDTab('uang-muka');
}

async function cairkanUangMuka(id) {
  if (!confirm('Cairkan uang muka ini?')) return;
  await db.collection('hrd_uang_muka_dinas').doc(id).update({
    status: 'dicairkan',
    dicairkanOleh: currentUser.nama,
    dicairkanAt: new Date().toISOString(),
  });
  const doc = await db.collection('hrd_uang_muka_dinas').doc(id).get();
  const p = doc.data();
  await sendNotification(
    p.userId,
    'Uang Muka Dicairkan',
    `Uang muka ${formatCurrency(p.jumlah)} untuk ${p.noSPPD} telah dicairkan`
  );
  toast('💸 Uang muka dicairkan', 'success');
  showSPPDTab('uang-muka');
}

function viewUangMukaDinas(id) {
  db.collection('hrd_uang_muka_dinas')
    .doc(id)
    .get()
    .then((doc) => {
      const p = doc.data();
      openModal(`<div class="modal-title">💰 Detail Uang Muka Dinas</div>
      <div class="grid-2 mb-16"><div><b>No. SPPD:</b> ${escHtml(p.noSPPD)}</div><div><b>Nama:</b> ${escHtml(p.nama)}</div><div><b>Jumlah:</b> ${formatCurrency(p.jumlah)}</div><div><b>Metode:</b> ${escHtml(p.metode || '-')}</div><div><b>Status:</b> <span class="badge badge-${p.status === 'dicairkan' ? 'success' : 'warning'}">${p.status}</span></div><div><b>Tanggal:</b> ${formatDate(p.createdAt)}</div></div>
      ${p.rincian ? `<div><b>Rincian:</b><div class="text-sm mt-4" style="background:#f8f9ff;padding:10px;border-radius:6px">${escHtml(p.rincian)}</div></div>` : ''}
      ${p.dicairkanOleh ? `<div class="mt-8 text-sm color-success">💸 Dicairkan oleh: ${escHtml(p.dicairkanOleh)} (${formatDate(p.dicairkanAt)})</div>` : ''}`);
    });
}

// ── LAPORAN PERJALANAN DINAS ──────────────────────────────────

async function loadSPPDLaporan(el) {
  const isPortal = window._portalDinasMode || !hasAccess(3);
  const snap = await db.collection('hrd_laporan_dinas').get();
  let h = `<div class="card"><div class="card-header"><div class="card-title">📝 Laporan Perjalanan Dinas</div><button class="btn btn-primary btn-sm" onclick="modalLaporanDinasNew()">+ Buat Laporan</button></div>
    <div class="table-wrap"><table><thead><tr><th>No. SPPD</th><th>Nama</th><th>Tujuan</th><th>Hasil</th><th>Tanggal Laporan</th><th>Aksi</th></tr></thead><tbody>`;
  let hasData = false;
  snap.forEach((d) => {
    const p = d.data();
    if (isPortal && p.userId !== currentUser.id) return;
    // Manager (level 3) only sees own department; Head/BOD/Admin (level 4+) sees all
    if (!isPortal && hasAccess(3) && !hasAccess(4)) {
      if (
        p.userId !== currentUser.id &&
        (p.departemen || '').toLowerCase() !== (currentUser.departemen || '').toLowerCase()
      )
        return;
    }
    hasData = true;
    h += `<tr><td class="fw-700">${escHtml(p.noSPPD || '-')}</td><td>${escHtml(p.nama)}</td><td>${escHtml(p.tujuan || '-')}</td><td class="text-sm">${escHtml((p.hasil || '').substring(0, 50))}${(p.hasil || '').length > 50 ? '...' : ''}</td><td>${formatDate(p.createdAt)}</td><td><button class="btn btn-xs btn-info" onclick="viewLaporanDinas('${d.id}')">👁️</button></td></tr>`;
  });
  if (!hasData) h += '<tr><td colspan="6" class="text-center">Belum ada laporan</td></tr>';
  h += '</tbody></table></div></div>';
  el.innerHTML = h;
}

async function modalLaporanDinas(sppdId) {
  const doc = await db.collection('hrd_perjalanan_dinas').doc(sppdId).get();
  const p = doc.data();
  openModal(
    `<div class="modal-title">📝 Laporan Perjalanan Dinas</div>
    <div style="background:#f0f4ff;padding:10px;border-radius:8px;margin-bottom:16px"><b>SPPD:</b> ${escHtml(p.noSPPD)} — ${escHtml(p.tujuan)}<br><b>Tanggal:</b> ${formatDate(p.tanggalMulai)} - ${formatDate(p.tanggalSelesai)}</div>
    <div class="form-group"><label>Hasil / Pencapaian</label><textarea class="form-control" id="lpdHasil" style="min-height:100px" placeholder="Jelaskan hasil dan pencapaian perjalanan dinas"></textarea></div>
    <div class="form-group"><label>Aktivitas yang Dilakukan</label><textarea class="form-control" id="lpdAktivitas" placeholder="Rincian aktivitas selama dinas"></textarea></div>
    <div class="form-group"><label>Kendala / Catatan</label><textarea class="form-control" id="lpdKendala" placeholder="Kendala yang dihadapi (jika ada)"></textarea></div>
    <div class="form-group"><label>Tindak Lanjut</label><textarea class="form-control" id="lpdTindakLanjut" placeholder="Rencana tindak lanjut setelah dinas"></textarea></div>
    <button class="btn btn-primary" onclick="simpanLaporanDinas('${sppdId}','${escHtml(p.noSPPD)}','${escHtml(p.tujuan)}')">📝 Simpan Laporan</button>`,
    true
  );
}

async function modalLaporanDinasNew() {
  const snap = await db.collection('hrd_perjalanan_dinas').where('status', '==', 'approved').get();
  let options = '<option value="">-- Pilih SPPD --</option>';
  snap.forEach((d) => {
    const p = d.data();
    if (p.userId === currentUser.id || hasAccess(3))
      options += `<option value="${d.id}" data-nosppd="${p.noSPPD}" data-tujuan="${p.tujuan}">${p.noSPPD} — ${p.tujuan}</option>`;
  });
  openModal(
    `<div class="modal-title">📝 Buat Laporan Perjalanan Dinas</div>
    <div class="form-group"><label>Pilih SPPD</label><select class="form-control" id="lpdSPPDSelect">${options}</select></div>
    <div class="form-group"><label>Hasil / Pencapaian</label><textarea class="form-control" id="lpdHasil" style="min-height:100px" placeholder="Jelaskan hasil dan pencapaian"></textarea></div>
    <div class="form-group"><label>Aktivitas yang Dilakukan</label><textarea class="form-control" id="lpdAktivitas" placeholder="Rincian aktivitas"></textarea></div>
    <div class="form-group"><label>Kendala / Catatan</label><textarea class="form-control" id="lpdKendala" placeholder="Kendala (opsional)"></textarea></div>
    <div class="form-group"><label>Tindak Lanjut</label><textarea class="form-control" id="lpdTindakLanjut" placeholder="Rencana tindak lanjut"></textarea></div>
    <button class="btn btn-primary" onclick="simpanLaporanDinasFromSelect()">📝 Simpan Laporan</button>`,
    true
  );
}

async function simpanLaporanDinasFromSelect() {
  const sel = document.getElementById('lpdSPPDSelect');
  const sppdId = sel.value;
  const noSPPD = sel.options[sel.selectedIndex]?.getAttribute('data-nosppd') || '';
  const tujuan = sel.options[sel.selectedIndex]?.getAttribute('data-tujuan') || '';
  if (!sppdId) return toast('Pilih SPPD dulu', 'warning');
  await simpanLaporanDinas(sppdId, noSPPD, tujuan);
}

async function simpanLaporanDinas(sppdId, noSPPD, tujuan) {
  const hasil = document.getElementById('lpdHasil').value;
  const aktivitas = document.getElementById('lpdAktivitas').value;
  const kendala = document.getElementById('lpdKendala').value;
  const tindakLanjut = document.getElementById('lpdTindakLanjut').value;
  if (!hasil) return toast('Hasil/Pencapaian wajib diisi', 'warning');
  await db.collection('hrd_laporan_dinas').add({
    sppdId,
    noSPPD,
    tujuan,
    nama: currentUser.nama,
    userId: currentUser.id,
    hasil,
    aktivitas,
    kendala,
    tindakLanjut,
    createdAt: new Date().toISOString(),
  });
  // Update status SPPD menjadi selesai
  await db
    .collection('hrd_perjalanan_dinas')
    .doc(sppdId)
    .update({ status: 'selesai', laporanAt: new Date().toISOString() });
  await sendNotification(
    'admin',
    'Laporan Dinas',
    `${currentUser.nama} telah submit laporan perjalanan dinas ${noSPPD}`
  );
  closeModalDirect();
  toast('📝 Laporan dinas disimpan', 'success');
  showSPPDTab('laporan');
}

function viewLaporanDinas(id) {
  db.collection('hrd_laporan_dinas')
    .doc(id)
    .get()
    .then((doc) => {
      const p = doc.data();
      openModal(
        `<div class="modal-title">📝 Laporan Perjalanan Dinas</div>
      <div class="grid-2 mb-16"><div><b>No. SPPD:</b> ${escHtml(p.noSPPD)}</div><div><b>Nama:</b> ${escHtml(p.nama)}</div><div><b>Tujuan:</b> ${escHtml(p.tujuan || '-')}</div><div><b>Tanggal:</b> ${formatDate(p.createdAt)}</div></div>
      <div class="mb-12"><b>Hasil / Pencapaian:</b><div class="text-sm mt-4" style="background:#e8f5e9;padding:12px;border-radius:6px;white-space:pre-wrap">${escHtml(p.hasil || '-')}</div></div>
      ${p.aktivitas ? `<div class="mb-12"><b>Aktivitas:</b><div class="text-sm mt-4" style="background:#f8f9ff;padding:12px;border-radius:6px;white-space:pre-wrap">${escHtml(p.aktivitas)}</div></div>` : ''}
      ${p.kendala ? `<div class="mb-12"><b>Kendala:</b><div class="text-sm mt-4" style="background:#fff3e0;padding:12px;border-radius:6px;white-space:pre-wrap">${escHtml(p.kendala)}</div></div>` : ''}
      ${p.tindakLanjut ? `<div class="mb-12"><b>Tindak Lanjut:</b><div class="text-sm mt-4" style="background:#e3f2fd;padding:12px;border-radius:6px;white-space:pre-wrap">${escHtml(p.tindakLanjut)}</div></div>` : ''}`,
        true
      );
    });
}

// ── REIMBURSEMENT PERJALANAN DINAS ────────────────────────────

async function loadSPPDReimbursement(el) {
  const isPortal = window._portalDinasMode || !hasAccess(3);
  const snap = await db.collection('hrd_reimburse_dinas').get();
  let h = `<div class="card"><div class="card-header"><div class="card-title">🧾 Reimbursement Perjalanan Dinas</div><button class="btn btn-primary btn-sm" onclick="modalReimburseDinasNew()">+ Ajukan Reimburse</button></div>
    <p class="text-sm mb-16" style="color:#666">Pertanggungjawaban biaya perjalanan dinas. Selisih uang muka vs pengeluaran aktual akan dikembalikan/dibayarkan.</p>
    <div class="table-wrap"><table><thead><tr><th>No. SPPD</th><th>Nama</th><th>Uang Muka</th><th>Aktual</th><th>Selisih</th><th>Status</th><th>Aksi</th></tr></thead><tbody>`;
  let hasData = false;
  snap.forEach((d) => {
    const p = d.data();
    if (isPortal && p.userId !== currentUser.id) return;
    // Manager (level 3) only sees own department; Head/BOD/Admin (level 4+) sees all
    if (!isPortal && hasAccess(3) && !hasAccess(4)) {
      if (
        p.userId !== currentUser.id &&
        (p.departemen || '').toLowerCase() !== (currentUser.departemen || '').toLowerCase()
      )
        return;
    }
    hasData = true;
    const selisih = (p.totalAktual || 0) - (p.uangMuka || 0);
    const selisihLabel =
      selisih > 0
        ? `<span style="color:var(--danger)">+${formatCurrency(selisih)}</span>`
        : `<span style="color:var(--success)">${formatCurrency(selisih)}</span>`;
    const badge =
      p.status === 'approved'
        ? 'badge-success'
        : p.status === 'rejected'
          ? 'badge-danger'
          : 'badge-warning';
    h += `<tr><td class="fw-700">${escHtml(p.noSPPD || '-')}</td><td>${escHtml(p.nama)}</td><td>${formatCurrency(p.uangMuka)}</td><td>${formatCurrency(p.totalAktual)}</td><td>${selisihLabel}</td><td><span class="badge ${badge}">${p.status}</span></td><td><button class="btn btn-xs btn-info" onclick="viewReimburseDinas('${d.id}')">👁️</button> ${hasAccess(3) && p.status === 'pending' ? `<button class="btn btn-xs btn-success" onclick="approveReimburseDinas('${d.id}')">✅</button>` : ''}</td></tr>`;
  });
  if (!hasData) h += '<tr><td colspan="7" class="text-center">Belum ada reimbursement</td></tr>';
  h += '</tbody></table></div></div>';
  el.innerHTML = h;
}

async function modalReimburseDinasNew() {
  const snap = await db.collection('hrd_perjalanan_dinas').where('status', '==', 'selesai').get();
  let options = '<option value="">-- Pilih SPPD (Selesai) --</option>';
  snap.forEach((d) => {
    const p = d.data();
    if (p.userId === currentUser.id || hasAccess(3))
      options += `<option value="${d.id}" data-nosppd="${p.noSPPD}" data-total="${p.totalEstimasi || 0}">${p.noSPPD} — ${p.tujuan}</option>`;
  });
  openModal(
    `<div class="modal-title">🧾 Ajukan Reimbursement Perjalanan Dinas</div>
    <div class="form-group"><label>Pilih SPPD</label><select class="form-control" id="rdSPPDSelect" onchange="loadUangMukaForReimburse()">${options}</select></div>
    <div id="rdUangMukaInfo" class="mb-8"></div>
    <div class="fw-700 text-sm mb-8 color-primary">💰 Pengeluaran Aktual</div>
    <div class="grid-2">
      <div class="form-group"><label>Transport (Rp)</label><input class="form-control" type="number" id="rdTransport" value="0"></div>
      <div class="form-group"><label>Akomodasi (Rp)</label><input class="form-control" type="number" id="rdAkomodasi" value="0"></div>
      <div class="form-group"><label>Makan & Uang Saku (Rp)</label><input class="form-control" type="number" id="rdMakan" value="0"></div>
      <div class="form-group"><label>Lain-lain (Rp)</label><input class="form-control" type="number" id="rdLain" value="0"></div>
    </div>
    <div class="form-group"><label>Keterangan Bukti</label><textarea class="form-control" id="rdKeterangan" placeholder="Daftar bukti/kwitansi yang dilampirkan"></textarea></div>
    <button class="btn btn-primary" onclick="simpanReimburseDinas()">🧾 Ajukan Reimburse</button>`,
    true
  );
}

async function loadUangMukaForReimburse() {
  const sel = document.getElementById('rdSPPDSelect');
  const sppdId = sel.value;
  const noSPPD = sel.options[sel.selectedIndex]?.getAttribute('data-nosppd') || '';
  const el = document.getElementById('rdUangMukaInfo');
  if (!sppdId) {
    el.innerHTML = '';
    return;
  }
  const umSnap = await db.collection('hrd_uang_muka_dinas').where('noSPPD', '==', noSPPD).get();
  let totalUM = 0;
  umSnap.forEach((d) => {
    const data = d.data();
    if (data.status === 'dicairkan') totalUM += data.jumlah || 0;
  });
  el.innerHTML = `<div class="text-sm" style="background:#e8f5e9;padding:8px 12px;border-radius:6px">💰 Uang Muka Dicairkan: <b>${formatCurrency(totalUM)}</b></div>`;
  window._rdUangMuka = totalUM;
}

async function simpanReimburseDinas() {
  const sel = document.getElementById('rdSPPDSelect');
  const sppdId = sel.value;
  const noSPPD = sel.options[sel.selectedIndex]?.getAttribute('data-nosppd') || '';
  if (!sppdId) return toast('Pilih SPPD dulu', 'warning');
  const transport = parseInt(document.getElementById('rdTransport').value) || 0;
  const akomodasi = parseInt(document.getElementById('rdAkomodasi').value) || 0;
  const makan = parseInt(document.getElementById('rdMakan').value) || 0;
  const lain = parseInt(document.getElementById('rdLain').value) || 0;
  const totalAktual = transport + akomodasi + makan + lain;
  const keterangan = document.getElementById('rdKeterangan').value;
  const uangMuka = window._rdUangMuka || 0;
  if (!totalAktual) return toast('Isi pengeluaran aktual', 'warning');
  await db.collection('hrd_reimburse_dinas').add({
    sppdId,
    noSPPD,
    nama: currentUser.nama,
    userId: currentUser.id,
    uangMuka,
    totalAktual,
    biayaTransport: transport,
    biayaAkomodasi: akomodasi,
    biayaMakan: makan,
    biayaLain: lain,
    selisih: totalAktual - uangMuka,
    keterangan,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  await sendNotification(
    'admin',
    'Reimburse Dinas',
    `${currentUser.nama} mengajukan reimbursement dinas ${noSPPD}: ${formatCurrency(totalAktual)}`
  );
  closeModalDirect();
  toast('🧾 Reimbursement diajukan', 'success');
  showSPPDTab('reimbursement');
}

async function approveReimburseDinas(id) {
  var komentar = prompt('Komentar approval (opsional):') || '';
  if (!confirm('Setujui reimbursement ini?')) return;
  var updateData = {
    status: 'approved',
    approvedBy: currentUser.nama,
    approvedAt: new Date().toISOString(),
  };
  if (komentar) updateData.approvalComment = komentar;
  await db.collection('hrd_reimburse_dinas').doc(id).update(updateData);
  const doc = await db.collection('hrd_reimburse_dinas').doc(id).get();
  const p = doc.data();
  await sendNotification(
    p.userId,
    'Reimburse Dinas Disetujui',
    `Reimbursement ${p.noSPPD} sebesar ${formatCurrency(p.totalAktual)} telah disetujui`
  );
  toast('✅ Reimbursement disetujui', 'success');
  showSPPDTab('reimbursement');
}

function viewReimburseDinas(id) {
  db.collection('hrd_reimburse_dinas')
    .doc(id)
    .get()
    .then((doc) => {
      const p = doc.data();
      const selisih = (p.totalAktual || 0) - (p.uangMuka || 0);
      const selisihLabel =
        selisih > 0
          ? `Kurang Bayar: ${formatCurrency(selisih)} (perusahaan bayar ke karyawan)`
          : `Kelebihan: ${formatCurrency(Math.abs(selisih))} (karyawan kembalikan ke perusahaan)`;
      openModal(`<div class="modal-title">🧾 Detail Reimbursement Dinas</div>
      <div class="grid-2 mb-16"><div><b>No. SPPD:</b> ${escHtml(p.noSPPD)}</div><div><b>Nama:</b> ${escHtml(p.nama)}</div><div><b>Status:</b> <span class="badge badge-${p.status === 'approved' ? 'success' : 'warning'}">${p.status}</span></div><div><b>Tanggal:</b> ${formatDate(p.createdAt)}</div></div>
      <div class="mb-16" style="background:#f8f9ff;padding:14px;border-radius:8px">
        <div class="fw-700 mb-8">💰 Rincian Biaya:</div>
        <div class="grid-2"><div>Transport: ${formatCurrency(p.biayaTransport)}</div><div>Akomodasi: ${formatCurrency(p.biayaAkomodasi)}</div><div>Makan & Saku: ${formatCurrency(p.biayaMakan)}</div><div>Lain-lain: ${formatCurrency(p.biayaLain)}</div></div>
        <div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px"><b>Total Aktual:</b> ${formatCurrency(p.totalAktual)}</div>
        <div><b>Uang Muka:</b> ${formatCurrency(p.uangMuka)}</div>
        <div class="fw-700 mt-8" style="color:${selisih > 0 ? 'var(--danger)' : 'var(--success)'}">${selisihLabel}</div>
      </div>
      ${p.keterangan ? `<div><b>Keterangan Bukti:</b><div class="text-sm mt-4">${escHtml(p.keterangan)}</div></div>` : ''}
      ${p.approvedBy ? `<div class="mt-8 text-sm color-success">✅ Disetujui oleh: ${escHtml(p.approvedBy)}</div>` : ''}`);
    });
}
