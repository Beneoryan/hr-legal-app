'use strict';
// ============================================================
// MODULES-TEST-KESEHATAN.JS - Health Test Module
// ============================================================

// ── STATUS BADGE HELPER ───────────────────────────────────────
function getStatusBadgeKesehatan(status) {
  const map = {
    sehat: '<span class="badge badge-success">🟢 Sehat</span>',
    tidak_sehat: '<span class="badge badge-danger">🔴 Tidak Sehat</span>',
    perlu_pemeriksaan: '<span class="badge badge-warning">🟡 Perlu Pemeriksaan Lanjut</span>',
    pending: '<span class="badge badge-info">⏳ Pending</span>',
    selesai: '<span class="badge badge-success">✅ Selesai</span>',
  };
  return map[status] || '<span class="badge badge-info">⏳ Pending</span>';
}

// ── ADMIN PAGE: RENDER TEST KESEHATAN ─────────────────────────
async function renderTestKesehatan() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
  <div class="page-title">
    <span>🏥 Test Kesehatan</span>
    <div class="flex gap-8">
      <button class="btn btn-primary btn-sm" onclick="modalJadwalTestKesehatan('calon')">+ Jadwalkan Calon</button>
      <button class="btn btn-info btn-sm" onclick="modalJadwalTestKesehatan('existing')">+ Jadwalkan Karyawan</button>
    </div>
  </div>
  <div class="card">
    <div class="tabs" id="testKesehatanTabs">
      <div class="tab active" onclick="showTestKesehatanTab('calon')">👤 Calon Karyawan</div>
      <div class="tab" onclick="showTestKesehatanTab('existing')">👥 Karyawan Existing</div>
      <div class="tab" onclick="showTestKesehatanTab('riwayat')">📋 Riwayat Test</div>
    </div>
    <div style="margin:12px 0">
      <input class="form-control" id="searchTestKesehatan" placeholder="🔍 Cari nama..." oninput="showTestKesehatanTab(window._tkTab||'calon')">
    </div>
    <div id="testKesehatanContent"></div>
  </div>`;
  showTestKesehatanTab('calon');
}

// ── TAB SWITCHING ─────────────────────────────────────────────
async function showTestKesehatanTab(tab) {
  window._tkTab = tab;
  document.querySelectorAll('#testKesehatanTabs .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#testKesehatanTabs .tab').forEach(t => {
    if (tab === 'calon' && t.textContent.includes('Calon')) t.classList.add('active');
    else if (tab === 'existing' && t.textContent.includes('Existing')) t.classList.add('active');
    else if (tab === 'riwayat' && t.textContent.includes('Riwayat')) t.classList.add('active');
  });
  const el = document.getElementById('testKesehatanContent');
  const search = (document.getElementById('searchTestKesehatan') || {}).value || '';
  const searchLower = search.toLowerCase();
  const snap = await db.collection('hrd_test_kesehatan').get();
  const docs = [];
  snap.forEach(d => docs.push({id: d.id, ...d.data()}));

  let filtered = [];
  if (tab === 'calon') {
    filtered = docs.filter(d => d.tipe === 'calon');
  } else if (tab === 'existing') {
    filtered = docs.filter(d => d.tipe === 'existing');
  } else {
    filtered = docs.filter(d => d.status === 'selesai');
  }

  if (searchLower) {
    filtered = filtered.filter(d => (d.nama || '').toLowerCase().includes(searchLower));
  }

  filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  let h = '<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Tipe</th><th>Tanggal</th><th>Status Test</th><th>Kesimpulan</th><th>Aksi</th></tr></thead><tbody>';
  if (!filtered.length) {
    h += '<tr><td colspan="6" class="text-center">Belum ada data</td></tr>';
  } else {
    filtered.forEach(p => {
      const kesimpulanStatus = (p.kesimpulan && p.kesimpulan.status) ? getStatusBadgeKesehatan(p.kesimpulan.status) : '-';
      const statusBadge = p.status === 'selesai' ? getStatusBadgeKesehatan('selesai') : getStatusBadgeKesehatan('pending');
      h += `<tr>
        <td class="fw-700">${escHtml(p.nama || '-')}</td>
        <td><span class="badge badge-${p.tipe === 'calon' ? 'warning' : 'info'}">${p.tipe === 'calon' ? 'Calon' : 'Existing'}</span></td>
        <td>${formatDate(p.tanggal)}</td>
        <td>${statusBadge}</td>
        <td>${kesimpulanStatus}</td>
        <td>
          <button class="btn btn-xs btn-info" onclick="detailTestKesehatan('${p.id}')">👁️</button>
          <button class="btn btn-xs btn-primary" onclick="modalFormTestKesehatan('${p.id}')">📝</button>
          <button class="btn btn-xs btn-danger" onclick="hapusTestKesehatan('${p.id}')">🗑️</button>
        </td>
      </tr>`;
    });
  }
  h += '</tbody></table></div>';
  el.innerHTML = h;
}

// ── MODAL JADWAL TEST ─────────────────────────────────────────
async function modalJadwalTestKesehatan(tipe) {
  let optionsHtml = '<option value="">-- Pilih --</option>';
  if (tipe === 'calon') {
    const snap = await db.collection('hrd_kandidat').get();
    snap.forEach(d => {
      const k = d.data();
      optionsHtml += `<option value="${d.id}" data-nama="${escHtml(k.nama || '')}">${escHtml(k.nama || '-')} - ${escHtml(k.posisiDilamar || k.posisi || '-')}</option>`;
    });
  } else {
    const snap = await db.collection('hrd_karyawan').where('status', '==', 'aktif').get();
    snap.forEach(d => {
      const k = d.data();
      optionsHtml += `<option value="${d.id}" data-nama="${escHtml(k.nama || '')}">${escHtml(k.nama || '-')} - ${escHtml(k.posisi || '-')}</option>`;
    });
  }
  openModal(`
    <div class="modal-title">📅 Jadwalkan Test Kesehatan (${tipe === 'calon' ? 'Calon Karyawan' : 'Karyawan Existing'})</div>
    <div class="grid-2">
      <div class="form-group">
        <label>${tipe === 'calon' ? 'Kandidat' : 'Karyawan'}</label>
        <select class="form-control" id="tkPerson" onchange="document.getElementById('tkNama').value=this.options[this.selectedIndex].dataset.nama||''">
          ${optionsHtml}
        </select>
      </div>
      <div class="form-group">
        <label>Nama</label>
        <input class="form-control" id="tkNama" placeholder="Nama peserta">
      </div>
      <div class="form-group">
        <label>Tanggal Test</label>
        <input type="date" class="form-control" id="tkTanggal" value="${todayStr()}">
      </div>
      <div class="form-group">
        <label>Catatan</label>
        <input class="form-control" id="tkCatatan" placeholder="Catatan tambahan">
      </div>
    </div>
    <button class="btn btn-primary" onclick="simpanJadwalTestKesehatan('${tipe}')">💾 Simpan</button>
  `);
}

async function simpanJadwalTestKesehatan(tipe) {
  const personId = document.getElementById('tkPerson').value;
  const nama = document.getElementById('tkNama').value;
  const tanggal = document.getElementById('tkTanggal').value;
  const catatan = document.getElementById('tkCatatan').value;
  if (!nama) return toast('Nama wajib diisi', 'warning');
  if (!tanggal) return toast('Tanggal wajib diisi', 'warning');

  const data = {
    id: generateId(),
    nama: nama,
    tipe: tipe,
    tanggal: tanggal,
    catatan: catatan,
    dataUmum: {},
    riwayatKesehatan: {},
    pemeriksaanFisik: {},
    pemeriksaanLab: {},
    kondisiMental: {},
    kebiasaan: {},
    kesimpulan: {},
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  if (tipe === 'calon') data.kandidatId = personId;
  else data.userId = personId;

  await db.collection('hrd_test_kesehatan').add(data);
  closeModalDirect();
  toast('Test kesehatan dijadwalkan', 'success');
  renderTestKesehatan();
}

// ── MODAL FORM TEST KESEHATAN (FULL FORM) ─────────────────────
async function modalFormTestKesehatan(id) {
  let data = {};
  if (id) {
    const doc = await db.collection('hrd_test_kesehatan').doc(id).get();
    if (doc.exists) data = doc.data();
  }
  const du = data.dataUmum || {};
  const rk = data.riwayatKesehatan || {};
  const pf = data.pemeriksaanFisik || {};
  const pl = data.pemeriksaanLab || {};
  const km = data.kondisiMental || {};
  const kb = data.kebiasaan || {};
  const ks = data.kesimpulan || {};

  const diseases = ['Diabetes', 'Hipertensi', 'Jantung', 'Asma', 'TBC', 'Hepatitis', 'Epilepsi', 'Alergi', 'Lainnya'];
  const diseaseChecks = diseases.map(d => {
    const checked = (rk.penyakit || []).includes(d) ? 'checked' : '';
    return `<label style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:.85rem"><input type="checkbox" class="tkDisease" value="${d}" ${checked}> ${d}</label>`;
  }).join('');

  const html = `
    <div class="modal-title">📋 Form Test Kesehatan - ${escHtml(data.nama || '')}</div>
    <div style="max-height:70vh;overflow-y:auto;padding-right:8px">

    <h4 style="margin:16px 0 8px;color:var(--primary)">A. Data Umum</h4>
    <div class="grid-2">
      <div class="form-group"><label>Nama</label><input class="form-control" id="tkfNama" value="${escHtml(du.nama || data.nama || '')}"></div>
      <div class="form-group"><label>Usia</label><input type="number" class="form-control" id="tkfUsia" value="${du.usia || ''}"></div>
      <div class="form-group"><label>Jenis Kelamin</label>
        <select class="form-control" id="tkfGender">
          <option value="">-- Pilih --</option>
          <option value="Laki-laki" ${du.jenisKelamin === 'Laki-laki' ? 'selected' : ''}>Laki-laki</option>
          <option value="Perempuan" ${du.jenisKelamin === 'Perempuan' ? 'selected' : ''}>Perempuan</option>
        </select>
      </div>
      <div class="form-group"><label>Golongan Darah</label>
        <select class="form-control" id="tkfGolDarah">
          <option value="">-- Pilih --</option>
          <option value="A" ${du.golonganDarah === 'A' ? 'selected' : ''}>A</option>
          <option value="B" ${du.golonganDarah === 'B' ? 'selected' : ''}>B</option>
          <option value="AB" ${du.golonganDarah === 'AB' ? 'selected' : ''}>AB</option>
          <option value="O" ${du.golonganDarah === 'O' ? 'selected' : ''}>O</option>
        </select>
      </div>
      <div class="form-group"><label>Tinggi Badan (cm)</label><input type="number" class="form-control" id="tkfTinggi" value="${du.tinggi || ''}" oninput="hitungBMI()"></div>
      <div class="form-group"><label>Berat Badan (kg)</label><input type="number" class="form-control" id="tkfBerat" value="${du.berat || ''}" oninput="hitungBMI()"></div>
      <div class="form-group"><label>BMI (otomatis)</label><input class="form-control" id="tkfBMI" value="${du.bmi || ''}" readonly style="background:#f5f5f5"></div>
    </div>

    <h4 style="margin:16px 0 8px;color:var(--primary)">B. Riwayat Kesehatan</h4>
    <div class="form-group"><label>Riwayat Penyakit Keluarga/Pribadi</label><div style="margin:8px 0">${diseaseChecks}</div></div>
    <div class="grid-2">
      <div class="form-group"><label>Riwayat Operasi</label><input class="form-control" id="tkfOperasi" value="${escHtml(rk.operasi || '')}"></div>
      <div class="form-group"><label>Obat yang Dikonsumsi</label><input class="form-control" id="tkfObat" value="${escHtml(rk.obat || '')}"></div>
      <div class="form-group"><label>Riwayat Rawat Inap</label><input class="form-control" id="tkfRawatInap" value="${escHtml(rk.rawatInap || '')}"></div>
    </div>

    <h4 style="margin:16px 0 8px;color:var(--primary)">C. Pemeriksaan Fisik</h4>
    <div class="grid-2">
      <div class="form-group"><label>Tekanan Darah Systole</label><input type="number" class="form-control" id="tkfSystole" value="${pf.systole || ''}"></div>
      <div class="form-group"><label>Tekanan Darah Diastole</label><input type="number" class="form-control" id="tkfDiastole" value="${pf.diastole || ''}"></div>
      <div class="form-group"><label>Nadi (bpm)</label><input type="number" class="form-control" id="tkfNadi" value="${pf.nadi || ''}"></div>
      <div class="form-group"><label>Suhu (C)</label><input type="number" step="0.1" class="form-control" id="tkfSuhu" value="${pf.suhu || ''}"></div>
      <div class="form-group"><label>Penglihatan Kiri</label><input class="form-control" id="tkfMataKiri" value="${escHtml(pf.penglihatanKiri || '')}"></div>
      <div class="form-group"><label>Penglihatan Kanan</label><input class="form-control" id="tkfMataKanan" value="${escHtml(pf.penglihatanKanan || '')}"></div>
      <div class="form-group"><label>Pendengaran</label><input class="form-control" id="tkfPendengaran" value="${escHtml(pf.pendengaran || '')}"></div>
      <div class="form-group"><label>Gigi</label><input class="form-control" id="tkfGigi" value="${escHtml(pf.gigi || '')}"></div>
    </div>

    <h4 style="margin:16px 0 8px;color:var(--primary)">D. Pemeriksaan Lab (Opsional)</h4>
    <div class="grid-2">
      <div class="form-group"><label>Hemoglobin</label><input class="form-control" id="tkfHb" value="${escHtml(pl.hemoglobin || '')}"></div>
      <div class="form-group"><label>Gula Darah</label><input class="form-control" id="tkfGula" value="${escHtml(pl.gulaDarah || '')}"></div>
      <div class="form-group"><label>Kolesterol</label><input class="form-control" id="tkfKolesterol" value="${escHtml(pl.kolesterol || '')}"></div>
      <div class="form-group"><label>Urine</label><input class="form-control" id="tkfUrine" value="${escHtml(pl.urine || '')}"></div>
    </div>

    <h4 style="margin:16px 0 8px;color:var(--primary)">E. Kondisi Mental</h4>
    <div class="grid-2">
      <div class="form-group"><label>Gangguan Mental</label>
        <select class="form-control" id="tkfMental">
          <option value="">-- Pilih --</option>
          <option value="tidak" ${km.gangguanMental === 'tidak' ? 'selected' : ''}>Tidak</option>
          <option value="ya" ${km.gangguanMental === 'ya' ? 'selected' : ''}>Ya</option>
        </select>
      </div>
      <div class="form-group"><label>Tingkat Stres</label>
        <select class="form-control" id="tkfStres">
          <option value="">-- Pilih --</option>
          <option value="rendah" ${km.stres === 'rendah' ? 'selected' : ''}>Rendah</option>
          <option value="sedang" ${km.stres === 'sedang' ? 'selected' : ''}>Sedang</option>
          <option value="tinggi" ${km.stres === 'tinggi' ? 'selected' : ''}>Tinggi</option>
        </select>
      </div>
      <div class="form-group"><label>Kualitas Tidur</label>
        <select class="form-control" id="tkfTidur">
          <option value="">-- Pilih --</option>
          <option value="baik" ${km.kualitasTidur === 'baik' ? 'selected' : ''}>Baik</option>
          <option value="cukup" ${km.kualitasTidur === 'cukup' ? 'selected' : ''}>Cukup</option>
          <option value="buruk" ${km.kualitasTidur === 'buruk' ? 'selected' : ''}>Buruk</option>
        </select>
      </div>
    </div>

    <h4 style="margin:16px 0 8px;color:var(--primary)">F. Kebiasaan</h4>
    <div class="grid-2">
      <div class="form-group"><label>Merokok</label>
        <select class="form-control" id="tkfMerokok">
          <option value="">-- Pilih --</option>
          <option value="tidak" ${kb.merokok === 'tidak' ? 'selected' : ''}>Tidak</option>
          <option value="ya" ${kb.merokok === 'ya' ? 'selected' : ''}>Ya</option>
        </select>
      </div>
      <div class="form-group"><label>Jumlah Batang/Hari</label><input type="number" class="form-control" id="tkfRokokJumlah" value="${kb.rokokPerHari || ''}"></div>
      <div class="form-group"><label>Alkohol</label>
        <select class="form-control" id="tkfAlkohol">
          <option value="">-- Pilih --</option>
          <option value="tidak" ${kb.alkohol === 'tidak' ? 'selected' : ''}>Tidak</option>
          <option value="ya" ${kb.alkohol === 'ya' ? 'selected' : ''}>Ya</option>
        </select>
      </div>
      <div class="form-group"><label>Olahraga</label>
        <select class="form-control" id="tkfOlahraga">
          <option value="">-- Pilih --</option>
          <option value="tidak" ${kb.olahraga === 'tidak' ? 'selected' : ''}>Tidak</option>
          <option value="ya" ${kb.olahraga === 'ya' ? 'selected' : ''}>Ya</option>
        </select>
      </div>
      <div class="form-group"><label>Olahraga (kali/minggu)</label><input type="number" class="form-control" id="tkfOlahragaJumlah" value="${kb.olahragaPerMinggu || ''}"></div>
    </div>

    <h4 style="margin:16px 0 8px;color:var(--primary)">G. Kesimpulan (Diisi Pemeriksa)</h4>
    <div class="grid-2">
      <div class="form-group"><label>Status Kesehatan</label>
        <select class="form-control" id="tkfStatus">
          <option value="">-- Pilih --</option>
          <option value="sehat" ${ks.status === 'sehat' ? 'selected' : ''}>Sehat</option>
          <option value="tidak_sehat" ${ks.status === 'tidak_sehat' ? 'selected' : ''}>Tidak Sehat</option>
          <option value="perlu_pemeriksaan" ${ks.status === 'perlu_pemeriksaan' ? 'selected' : ''}>Perlu Pemeriksaan Lanjut</option>
        </select>
      </div>
      <div class="form-group"><label>Diperiksa Oleh</label><input class="form-control" id="tkfPemeriksa" value="${escHtml(ks.pemeriksaOleh || '')}"></div>
    </div>
    <div class="form-group"><label>Catatan Dokter</label><textarea class="form-control" id="tkfCatatanDokter" rows="2">${escHtml(ks.catatan || '')}</textarea></div>
    <div class="form-group"><label>Rekomendasi</label><textarea class="form-control" id="tkfRekomendasi" rows="2">${escHtml(ks.rekomendasi || '')}</textarea></div>

    </div>
    <div style="margin-top:16px"><button class="btn btn-primary" onclick="simpanTestKesehatan('${id || ''}')">💾 Simpan</button></div>
  `;
  openModal(html);
  setTimeout(() => hitungBMI(), 100);
}

// ── BMI CALCULATION ───────────────────────────────────────────
function hitungBMI() {
  const tinggi = parseFloat(document.getElementById('tkfTinggi').value) || 0;
  const berat = parseFloat(document.getElementById('tkfBerat').value) || 0;
  const bmiEl = document.getElementById('tkfBMI');
  if (tinggi > 0 && berat > 0) {
    const bmi = berat / ((tinggi / 100) * (tinggi / 100));
    bmiEl.value = bmi.toFixed(1);
  } else {
    bmiEl.value = '';
  }
}

// ── SIMPAN TEST KESEHATAN ─────────────────────────────────────
async function simpanTestKesehatan(id) {
  const penyakitArr = [];
  document.querySelectorAll('.tkDisease:checked').forEach(c => penyakitArr.push(c.value));

  const dataUmum = {
    nama: document.getElementById('tkfNama').value,
    usia: document.getElementById('tkfUsia').value,
    jenisKelamin: document.getElementById('tkfGender').value,
    golonganDarah: document.getElementById('tkfGolDarah').value,
    tinggi: document.getElementById('tkfTinggi').value,
    berat: document.getElementById('tkfBerat').value,
    bmi: document.getElementById('tkfBMI').value,
  };
  const riwayatKesehatan = {
    penyakit: penyakitArr,
    operasi: document.getElementById('tkfOperasi').value,
    obat: document.getElementById('tkfObat').value,
    rawatInap: document.getElementById('tkfRawatInap').value,
  };
  const pemeriksaanFisik = {
    systole: document.getElementById('tkfSystole').value,
    diastole: document.getElementById('tkfDiastole').value,
    nadi: document.getElementById('tkfNadi').value,
    suhu: document.getElementById('tkfSuhu').value,
    penglihatanKiri: document.getElementById('tkfMataKiri').value,
    penglihatanKanan: document.getElementById('tkfMataKanan').value,
    pendengaran: document.getElementById('tkfPendengaran').value,
    gigi: document.getElementById('tkfGigi').value,
  };
  const pemeriksaanLab = {
    hemoglobin: document.getElementById('tkfHb').value,
    gulaDarah: document.getElementById('tkfGula').value,
    kolesterol: document.getElementById('tkfKolesterol').value,
    urine: document.getElementById('tkfUrine').value,
  };
  const kondisiMental = {
    gangguanMental: document.getElementById('tkfMental').value,
    stres: document.getElementById('tkfStres').value,
    kualitasTidur: document.getElementById('tkfTidur').value,
  };
  const kebiasaan = {
    merokok: document.getElementById('tkfMerokok').value,
    rokokPerHari: document.getElementById('tkfRokokJumlah').value,
    alkohol: document.getElementById('tkfAlkohol').value,
    olahraga: document.getElementById('tkfOlahraga').value,
    olahragaPerMinggu: document.getElementById('tkfOlahragaJumlah').value,
  };
  const kesimpulan = {
    status: document.getElementById('tkfStatus').value,
    catatan: document.getElementById('tkfCatatanDokter').value,
    rekomendasi: document.getElementById('tkfRekomendasi').value,
    pemeriksaOleh: document.getElementById('tkfPemeriksa').value,
  };

  const updateData = {
    dataUmum: dataUmum,
    riwayatKesehatan: riwayatKesehatan,
    pemeriksaanFisik: pemeriksaanFisik,
    pemeriksaanLab: pemeriksaanLab,
    kondisiMental: kondisiMental,
    kebiasaan: kebiasaan,
    kesimpulan: kesimpulan,
    updatedAt: new Date().toISOString(),
  };

  if (kesimpulan.status) {
    updateData.status = 'selesai';
  }

  if (id) {
    await db.collection('hrd_test_kesehatan').doc(id).update(updateData);
  } else {
    updateData.id = generateId();
    updateData.nama = dataUmum.nama;
    updateData.tipe = 'existing';
    updateData.tanggal = todayStr();
    updateData.status = kesimpulan.status ? 'selesai' : 'pending';
    updateData.createdAt = new Date().toISOString();
    await db.collection('hrd_test_kesehatan').add(updateData);
  }

  // Send notification to admin when test is submitted
  if (typeof sendNotification === 'function') {
    sendNotification(
      'admin',
      'Test Kesehatan Disubmit',
      `Test kesehatan untuk ${dataUmum.nama || 'karyawan'} telah diisi.`,
      'test-kesehatan'
    );
  }

  closeModalDirect();
  toast('Data test kesehatan disimpan', 'success');
  if (typeof renderTestKesehatan === 'function') renderTestKesehatan();
}

// ── DETAIL TEST KESEHATAN (READ-ONLY) ─────────────────────────
async function detailTestKesehatan(id) {
  const doc = await db.collection('hrd_test_kesehatan').doc(id).get();
  if (!doc.exists) return toast('Data tidak ditemukan', 'warning');
  const data = doc.data();
  const du = data.dataUmum || {};
  const rk = data.riwayatKesehatan || {};
  const pf = data.pemeriksaanFisik || {};
  const pl = data.pemeriksaanLab || {};
  const km = data.kondisiMental || {};
  const kb = data.kebiasaan || {};
  const ks = data.kesimpulan || {};

  const html = `
    <div class="modal-title">📋 Detail Test Kesehatan - ${escHtml(data.nama || '')}</div>
    <div style="max-height:70vh;overflow-y:auto;padding-right:8px">
      <div style="margin-bottom:12px">
        <span class="badge badge-${data.tipe === 'calon' ? 'warning' : 'info'}">${data.tipe === 'calon' ? 'Calon Karyawan' : 'Karyawan Existing'}</span>
        ${ks.status ? getStatusBadgeKesehatan(ks.status) : getStatusBadgeKesehatan(data.status)}
        <span class="text-sm" style="margin-left:8px">Tanggal: ${formatDate(data.tanggal)}</span>
      </div>

      <h4 style="margin:12px 0 8px;color:var(--primary)">A. Data Umum</h4>
      <div class="table-wrap"><table>
        <tr><td class="fw-700" style="width:40%">Nama</td><td>${escHtml(du.nama || data.nama || '-')}</td></tr>
        <tr><td class="fw-700">Usia</td><td>${du.usia || '-'} tahun</td></tr>
        <tr><td class="fw-700">Jenis Kelamin</td><td>${escHtml(du.jenisKelamin || '-')}</td></tr>
        <tr><td class="fw-700">Golongan Darah</td><td>${escHtml(du.golonganDarah || '-')}</td></tr>
        <tr><td class="fw-700">Tinggi Badan</td><td>${du.tinggi || '-'} cm</td></tr>
        <tr><td class="fw-700">Berat Badan</td><td>${du.berat || '-'} kg</td></tr>
        <tr><td class="fw-700">BMI</td><td>${du.bmi || '-'}</td></tr>
      </table></div>

      <h4 style="margin:12px 0 8px;color:var(--primary)">B. Riwayat Kesehatan</h4>
      <div class="table-wrap"><table>
        <tr><td class="fw-700" style="width:40%">Penyakit</td><td>${(rk.penyakit || []).join(', ') || '-'}</td></tr>
        <tr><td class="fw-700">Riwayat Operasi</td><td>${escHtml(rk.operasi || '-')}</td></tr>
        <tr><td class="fw-700">Obat</td><td>${escHtml(rk.obat || '-')}</td></tr>
        <tr><td class="fw-700">Rawat Inap</td><td>${escHtml(rk.rawatInap || '-')}</td></tr>
      </table></div>

      <h4 style="margin:12px 0 8px;color:var(--primary)">C. Pemeriksaan Fisik</h4>
      <div class="table-wrap"><table>
        <tr><td class="fw-700" style="width:40%">Tekanan Darah</td><td>${pf.systole || '-'}/${pf.diastole || '-'} mmHg</td></tr>
        <tr><td class="fw-700">Nadi</td><td>${pf.nadi || '-'} bpm</td></tr>
        <tr><td class="fw-700">Suhu</td><td>${pf.suhu || '-'} &deg;C</td></tr>
        <tr><td class="fw-700">Penglihatan Kiri</td><td>${escHtml(pf.penglihatanKiri || '-')}</td></tr>
        <tr><td class="fw-700">Penglihatan Kanan</td><td>${escHtml(pf.penglihatanKanan || '-')}</td></tr>
        <tr><td class="fw-700">Pendengaran</td><td>${escHtml(pf.pendengaran || '-')}</td></tr>
        <tr><td class="fw-700">Gigi</td><td>${escHtml(pf.gigi || '-')}</td></tr>
      </table></div>

      <h4 style="margin:12px 0 8px;color:var(--primary)">D. Pemeriksaan Lab</h4>
      <div class="table-wrap"><table>
        <tr><td class="fw-700" style="width:40%">Hemoglobin</td><td>${escHtml(pl.hemoglobin || '-')}</td></tr>
        <tr><td class="fw-700">Gula Darah</td><td>${escHtml(pl.gulaDarah || '-')}</td></tr>
        <tr><td class="fw-700">Kolesterol</td><td>${escHtml(pl.kolesterol || '-')}</td></tr>
        <tr><td class="fw-700">Urine</td><td>${escHtml(pl.urine || '-')}</td></tr>
      </table></div>

      <h4 style="margin:12px 0 8px;color:var(--primary)">E. Kondisi Mental</h4>
      <div class="table-wrap"><table>
        <tr><td class="fw-700" style="width:40%">Gangguan Mental</td><td>${km.gangguanMental === 'ya' ? 'Ya' : 'Tidak'}</td></tr>
        <tr><td class="fw-700">Tingkat Stres</td><td>${escHtml(km.stres || '-')}</td></tr>
        <tr><td class="fw-700">Kualitas Tidur</td><td>${escHtml(km.kualitasTidur || '-')}</td></tr>
      </table></div>

      <h4 style="margin:12px 0 8px;color:var(--primary)">F. Kebiasaan</h4>
      <div class="table-wrap"><table>
        <tr><td class="fw-700" style="width:40%">Merokok</td><td>${kb.merokok === 'ya' ? 'Ya (' + (kb.rokokPerHari || 0) + ' batang/hari)' : 'Tidak'}</td></tr>
        <tr><td class="fw-700">Alkohol</td><td>${kb.alkohol === 'ya' ? 'Ya' : 'Tidak'}</td></tr>
        <tr><td class="fw-700">Olahraga</td><td>${kb.olahraga === 'ya' ? 'Ya (' + (kb.olahragaPerMinggu || 0) + ' kali/minggu)' : 'Tidak'}</td></tr>
      </table></div>

      <h4 style="margin:12px 0 8px;color:var(--primary)">G. Kesimpulan</h4>
      <div class="table-wrap"><table>
        <tr><td class="fw-700" style="width:40%">Status</td><td>${ks.status ? getStatusBadgeKesehatan(ks.status) : '-'}</td></tr>
        <tr><td class="fw-700">Catatan Dokter</td><td>${escHtml(ks.catatan || '-')}</td></tr>
        <tr><td class="fw-700">Rekomendasi</td><td>${escHtml(ks.rekomendasi || '-')}</td></tr>
        <tr><td class="fw-700">Diperiksa Oleh</td><td>${escHtml(ks.pemeriksaOleh || '-')}</td></tr>
      </table></div>
    </div>
  `;
  openModal(html);
}

// ── HAPUS TEST KESEHATAN ──────────────────────────────────────
async function hapusTestKesehatan(id) {
  if (!confirm('Yakin ingin menghapus data test kesehatan ini?')) return;
  await db.collection('hrd_test_kesehatan').doc(id).delete();
  toast('Data dihapus', 'success');
  renderTestKesehatan();
}

// ── PORTAL: TEST KESEHATAN KARYAWAN ───────────────────────────
async function renderPortalTestKesehatan() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
  <div class="page-title"><span>🏥 Test Kesehatan Saya</span></div>
  <div class="card">
    <div style="background:#e3f2fd;border-radius:8px;padding:14px;margin-bottom:16px;border-left:4px solid var(--info)">
      <p class="text-sm" style="line-height:1.6">Halaman ini menampilkan jadwal test kesehatan dan riwayat pemeriksaan Anda. Jika ada test yang dijadwalkan, Anda dapat mengisi form pemeriksaan.</p>
    </div>
  </div>
  <div class="card">
    <div class="card-title">📅 Test Kesehatan Terjadwal</div>
    <div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Status</th><th>Catatan</th><th>Aksi</th></tr></thead>
    <tbody id="tblPortalTKPending"><tr><td colspan="4" class="text-center">Memuat...</td></tr></tbody></table></div>
  </div>
  <div class="card">
    <div class="card-title">📋 Riwayat Test Kesehatan</div>
    <div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Status</th><th>Kesimpulan</th><th>Pemeriksa</th><th>Aksi</th></tr></thead>
    <tbody id="tblPortalTKHistory"><tr><td colspan="5" class="text-center">Memuat...</td></tr></tbody></table></div>
  </div>`;
  loadPortalTestKesehatan();
}

async function loadPortalTestKesehatan() {
  const u = currentUser;
  const snap = await db.collection('hrd_test_kesehatan').get();
  const myTests = [];
  snap.forEach(d => {
    const r = d.data();
    const matchNama = (r.nama || '').toLowerCase().trim() === (u.nama || '').toLowerCase().trim();
    const matchId = r.userId === u.id;
    if (matchNama || matchId) myTests.push({id: d.id, ...r});
  });

  const pending = myTests.filter(t => t.status === 'pending');
  const completed = myTests.filter(t => t.status === 'selesai');
  pending.sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''));
  completed.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

  let hPending = '';
  if (!pending.length) {
    hPending = '<tr><td colspan="4" class="text-center" style="color:var(--text-light)">Tidak ada test terjadwal</td></tr>';
  } else {
    pending.forEach(t => {
      hPending += `<tr>
        <td>${formatDate(t.tanggal)}</td>
        <td>${getStatusBadgeKesehatan('pending')}</td>
        <td>${escHtml(t.catatan || '-')}</td>
        <td><button class="btn btn-xs btn-primary" onclick="modalFormTestKesehatan('${t.id}')">📝 Isi Form</button></td>
      </tr>`;
    });
  }
  document.getElementById('tblPortalTKPending').innerHTML = hPending;

  let hHistory = '';
  if (!completed.length) {
    hHistory = '<tr><td colspan="5" class="text-center" style="color:var(--text-light)">Belum ada riwayat</td></tr>';
  } else {
    completed.forEach(t => {
      const ks = t.kesimpulan || {};
      hHistory += `<tr>
        <td>${formatDate(t.tanggal)}</td>
        <td>${getStatusBadgeKesehatan('selesai')}</td>
        <td>${ks.status ? getStatusBadgeKesehatan(ks.status) : '-'}</td>
        <td>${escHtml(ks.pemeriksaOleh || '-')}</td>
        <td><button class="btn btn-xs btn-info" onclick="detailTestKesehatan('${t.id}')">👁️ Detail</button></td>
      </tr>`;
    });
  }
  document.getElementById('tblPortalTKHistory').innerHTML = hHistory;
}
