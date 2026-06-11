"use strict";
// ============================================================
// MODULES-TEST-KESEHATAN.JS - Health Test Module
// ============================================================

// ── STATUS BADGE HELPER ───────────────────────────────────────
function getStatusBadgeKesehatan(status) {
  const map = {
    sehat: '<span class="badge badge-success">🟢 Sehat</span>',
    tidak_sehat: '<span class="badge badge-danger">🔴 Tidak Sehat</span>',
    perlu_pemeriksaan:
      '<span class="badge badge-warning">🟡 Perlu Pemeriksaan Lanjut</span>',
    pending: '<span class="badge badge-info">⏳ Pending</span>',
    selesai: '<span class="badge badge-success">✅ Selesai</span>',
  };
  return map[status] || '<span class="badge badge-info">⏳ Pending</span>';
}

// ── ADMIN PAGE: RENDER TEST KESEHATAN ─────────────────────────
async function renderTestKesehatan() {
  const main = document.getElementById("mainContent");
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
  showTestKesehatanTab("calon");
}

// ── TAB SWITCHING ─────────────────────────────────────────────
async function showTestKesehatanTab(tab) {
  window._tkTab = tab;
  document
    .querySelectorAll("#testKesehatanTabs .tab")
    .forEach((t) => t.classList.remove("active"));
  document.querySelectorAll("#testKesehatanTabs .tab").forEach((t) => {
    if (tab === "calon" && t.textContent.includes("Calon"))
      t.classList.add("active");
    else if (tab === "existing" && t.textContent.includes("Existing"))
      t.classList.add("active");
    else if (tab === "riwayat" && t.textContent.includes("Riwayat"))
      t.classList.add("active");
  });
  const el = document.getElementById("testKesehatanContent");
  const search =
    (document.getElementById("searchTestKesehatan") || {}).value || "";
  const searchLower = search.toLowerCase();
  const snap = await db.collection("hrd_test_kesehatan").get();
  const docs = [];
  snap.forEach((d) => docs.push({ ...d.data(), id: d.id }));

  let filtered = [];
  if (tab === "calon") {
    filtered = docs.filter((d) => d.tipe === "calon");
  } else if (tab === "existing") {
    filtered = docs.filter((d) => d.tipe === "existing");
  } else {
    filtered = docs.filter((d) => d.status === "selesai");
    // Filter riwayat by user access level to prevent cross-division data leaks
    if (typeof currentUser !== "undefined" && typeof hasAccess === "function") {
      const myLevel = ROLES[currentUser.role] || 0;
      if (!hasAccess(3)) {
        // staff/leader (level 1-2): only see their own records
        filtered = filtered.filter((d) =>
          d.userId === currentUser.id ||
          d.userId === currentUser.linkedKaryawan ||
          (d.nama || "").toLowerCase().trim() === (currentUser.nama || "").toLowerCase().trim()
        );
      } else if (!hasAccess(5)) {
        // manager/head (level 3-4): see records from own department only,
        // AND only for users whose level is equal to or lower than theirs.
        // This prevents managers from seeing bod/head/admin health data,
        // and prevents cross-division data leaks.
        filtered = filtered.filter((d) => {
          // Always allow seeing own records
          if (
            d.userId === currentUser.id ||
            d.userId === currentUser.linkedKaryawan ||
            (d.nama || "").toLowerCase().trim() === (currentUser.nama || "").toLowerCase().trim()
          ) {
            return true;
          }
          // Must be same department
          if (d.departemen !== currentUser.departemen) return false;
          // Must be equal or lower level (if roleLevel is stored)
          // If roleLevel is not stored (legacy data), default to hiding it
          // to avoid accidental exposure of higher-level data
          const recordLevel = d.roleLevel || 0;
          if (recordLevel === 0) return false;
          return recordLevel <= myLevel;
        });
      } else if (!hasAccess(6)) {
        // bod (level 5): can see all departments but not admin records
        filtered = filtered.filter((d) => {
          if (
            d.userId === currentUser.id ||
            d.userId === currentUser.linkedKaryawan ||
            (d.nama || "").toLowerCase().trim() === (currentUser.nama || "").toLowerCase().trim()
          ) {
            return true;
          }
          const recordLevel = d.roleLevel || 0;
          return recordLevel < 6; // hide admin records
        });
      }
      // admin (level 6): sees all - no filter needed
    }
  }

  if (searchLower) {
    filtered = filtered.filter((d) =>
      (d.nama || "").toLowerCase().includes(searchLower),
    );
  }

  filtered.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  let h =
    '<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Tipe</th><th>Tanggal</th><th>Status Test</th><th>Kesimpulan</th><th>Aksi</th></tr></thead><tbody>';
  if (!filtered.length) {
    h += '<tr><td colspan="6" class="text-center">Belum ada data</td></tr>';
  } else {
    filtered.forEach((p) => {
      const kesimpulanStatus =
        p.kesimpulan && p.kesimpulan.status
          ? getStatusBadgeKesehatan(p.kesimpulan.status)
          : "-";
      const statusBadge =
        p.status === "selesai"
          ? getStatusBadgeKesehatan("selesai")
          : getStatusBadgeKesehatan("pending");
      h += `<tr>
        <td class="fw-700">${escHtml(p.nama || "-")}</td>
        <td><span class="badge badge-${p.tipe === "calon" ? "warning" : "info"}">${p.tipe === "calon" ? "Calon" : "Existing"}</span></td>
        <td>${formatDate(p.tanggal)}</td>
        <td>${statusBadge}</td>
        <td>${kesimpulanStatus}</td>
        <td>
          <button class="btn btn-xs btn-info" onclick="detailTestKesehatan('${p.id}')">&#x1F441;&#xFE0F;</button>
          ${tab !== 'riwayat' ? `<button class="btn btn-xs btn-primary" onclick="modalFormTestKesehatan('${p.id}')">&#x1F4DD;</button>
          ${p.tipe === "calon" && p.status !== "selesai" ? `<button class="btn btn-xs btn-success" onclick="(function(){var url=window.location.origin+'/test-kesehatan?id=${p.id}';if(navigator.clipboard){navigator.clipboard.writeText(url).then(function(){toast('Link disalin ke clipboard','success')}).catch(function(){prompt('Salin link berikut:',url)})}else{prompt('Salin link berikut:',url)}})()">&#x1F4CB; Copy Link</button>` : ""}
          <button class="btn btn-xs btn-danger" onclick="hapusTestKesehatan('${p.id}')">&#x1F5D1;&#xFE0F;</button>` : ''}
        </td>
      </tr>`;
    });
  }
  h += "</tbody></table></div>";
  el.innerHTML = h;
}

// ── MODAL JADWAL TEST ─────────────────────────────────────────
async function modalJadwalTestKesehatan(tipe) {
  let optionsHtml = '<option value="">-- Pilih --</option>';
  if (tipe === "calon") {
    const snap = await db.collection("hrd_kandidat").get();
    snap.forEach((d) => {
      const k = d.data();
      optionsHtml += `<option value="${d.id}" data-nama="${escHtml(k.nama || "")}">${escHtml(k.nama || "-")} - ${escHtml(k.posisiDilamar || k.posisi || "-")}</option>`;
    });
  } else {
    const snap = await db.collection("hrd_karyawan").get();
    snap.forEach((d) => {
      const k = d.data();
      if (k.status === "aktif") {
        optionsHtml += `<option value="${d.id}" data-nama="${escHtml(k.nama || "")}">${escHtml(k.nama || "-")} - ${escHtml(k.posisi || "-")}</option>`;
      }
    });
  }
  openModal(`
    <div class="modal-title">📅 Jadwalkan Test Kesehatan (${tipe === "calon" ? "Calon Karyawan" : "Karyawan Existing"})</div>
    <div class="grid-2">
      <div class="form-group">
        <label>${tipe === "calon" ? "Kandidat" : "Karyawan"}</label>
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
  let personId = document.getElementById("tkPerson").value;
  const nama = document.getElementById("tkNama").value;
  const tanggal = document.getElementById("tkTanggal").value;
  const catatan = document.getElementById("tkCatatan").value;
  if (!nama) return toast("Nama wajib diisi", "warning");
  if (!tanggal) return toast("Tanggal wajib diisi", "warning");

  // If no person selected from dropdown, try to look up by name
  if (!personId && nama) {
    const col = tipe === "calon" ? "hrd_kandidat" : "hrd_karyawan";
    const lookupSnap = await db.collection(col).get();
    lookupSnap.forEach((d) => {
      const rec = d.data();
      if (
        !personId &&
        (rec.nama || "").toLowerCase().trim() === nama.toLowerCase().trim()
      ) {
        personId = d.id;
      }
    });
  }

  // Look up departemen and role level from karyawan data
  let empDepartemen = "";
  let empRoleLevel = 0;
  if (personId) {
    const col = tipe === "calon" ? "hrd_kandidat" : "hrd_karyawan";
    const empDoc = await db.collection(col).doc(personId).get();
    if (empDoc.exists) {
      const empData = empDoc.data();
      empDepartemen = empData.departemen || "";
      // For existing employees, look up their user account role level
      if (tipe === "existing") {
        const userSnap = await db.collection("hrd_users").get();
        userSnap.forEach((uDoc) => {
          const uData = uDoc.data();
          if (
            uDoc.id === personId ||
            uData.linkedKaryawan === personId ||
            (uData.nama || "").toLowerCase().trim() === (empData.nama || "").toLowerCase().trim()
          ) {
            empRoleLevel = ROLES[uData.role] || 0;
          }
        });
      }
    }
  }

  const data = {
    id: generateId(),
    nama: nama,
    tipe: tipe,
    tanggal: tanggal,
    catatan: catatan,
    departemen: empDepartemen,
    roleLevel: empRoleLevel,
    dataUmum: {},
    riwayatKesehatan: {},
    pemeriksaanFisik: {},
    pemeriksaanLab: {},
    kondisiMental: {},
    kebiasaan: {},
    kesimpulan: {},
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  if (tipe === "calon") data.kandidatId = personId || "";
  else data.userId = personId || "";

  var newDocRef = await db.collection("hrd_test_kesehatan").add(data);
  closeModalDirect();
  toast("Test kesehatan dijadwalkan", "success");
  if (tipe === "calon") {
    var shareUrl =
      window.location.origin + "/test-kesehatan?id=" + newDocRef.id;
    openModal(`
      <div class="modal-title">&#x1F517; Link Test Kesehatan</div>
      <p style="font-size:.85rem;margin-bottom:12px">Bagikan link berikut kepada calon karyawan untuk mengisi form test kesehatan:</p>
      <div style="display:flex;gap:8px;align-items:center">
        <input class="form-control" id="tkShareLink" value="${shareUrl}" readonly style="font-size:.82rem">
        <button class="btn btn-primary btn-sm" onclick="(function(){var url=document.getElementById('tkShareLink').value;if(navigator.clipboard){navigator.clipboard.writeText(url).then(function(){toast('Link berhasil disalin','success')}).catch(function(){prompt('Salin link berikut:',url)})}else{prompt('Salin link berikut:',url)}})()">&#x1F4CB; Copy</button>
      </div>
    `);
  }
  renderTestKesehatan();
}

// ── MODAL FORM TEST KESEHATAN (FULL FORM) ─────────────────────
async function modalFormTestKesehatan(id) {
  let data = {};
  if (id) {
    const doc = await db.collection("hrd_test_kesehatan").doc(id).get();
    if (doc.exists) data = doc.data();
  }
  const du = data.dataUmum || {};

  // Auto-fill from karyawan data if dataUmum is empty
  let karyawanData = null;
  if (!du.nama || !du.jenisKelamin || !du.golonganDarah) {
    const namaToSearch = (data.nama || (typeof currentUser !== 'undefined' ? currentUser.nama : '') || '').trim().toLowerCase();
    if (namaToSearch) {
      const kSnap = await db.collection('hrd_karyawan').get();
      kSnap.forEach(d => {
        const k = d.data();
        if ((k.nama || '').trim().toLowerCase() === namaToSearch) {
          karyawanData = k;
        }
      });
    }
  }

  // Calculate age from tanggalLahir
  let autoUsia = du.usia || '';
  if (!autoUsia && karyawanData && karyawanData.tanggalLahir) {
    const birthDate = new Date(karyawanData.tanggalLahir);
    const today = new Date();
    autoUsia = String(today.getFullYear() - birthDate.getFullYear());
  }

  // Pre-fill values from karyawan data
  const autoNama = du.nama || data.nama || (karyawanData ? karyawanData.nama : '') || (typeof currentUser !== 'undefined' ? currentUser.nama : '') || '';
  const autoGender = du.jenisKelamin || (karyawanData ? karyawanData.jenisKelamin : '') || '';
  const autoGolDarah = du.golonganDarah || (karyawanData ? karyawanData.golonganDarah : '') || '';

  const rk = data.riwayatKesehatan || {};
  const pf = data.pemeriksaanFisik || {};
  const pl = data.pemeriksaanLab || {};
  const km = data.kondisiMental || {};
  const kb = data.kebiasaan || {};
  const ks = data.kesimpulan || {};

  const diseases = [
    "Diabetes",
    "Hipertensi",
    "Jantung",
    "Asma",
    "TBC",
    "Hepatitis",
    "Epilepsi",
    "Alergi",
    "Lainnya",
  ];
  const diseaseChecks = diseases
    .map((d) => {
      const checked = (rk.penyakit || []).includes(d) ? "checked" : "";
      return `<label style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:.85rem"><input type="checkbox" class="tkDisease" value="${d}" ${checked}> ${d}</label>`;
    })
    .join("");

  const html = `
    <div class="modal-title">📋 Form Test Kesehatan - ${escHtml(data.nama || "")}</div>
    <div style="max-height:70vh;overflow-y:auto;padding-right:8px">
    <div style="background:#e8f5e9;border-radius:8px;padding:12px;margin-bottom:14px;border-left:4px solid #4caf50">
      <p style="margin:0;font-size:.82rem;color:#2e7d32;line-height:1.6">
        <strong>Petunjuk Pengisian:</strong> Isi Bagian A-F sesuai kondisi Anda. Bagian D (Lab) boleh dikosongkan jika belum ada hasil. Bagian G (Kesimpulan) dihitung otomatis dari data yang diisi.
      </p>
    </div>

    <h4 style="margin:16px 0 8px;color:var(--primary)">A. Data Umum</h4>
    <p style="margin:0 0 10px;font-size:.8rem;color:#666;font-style:italic">Isi data diri dasar. Tinggi badan dalam satuan cm, berat badan dalam kg. BMI akan terhitung otomatis.</p>
    <div class="grid-2">
      <div class="form-group"><label>Nama</label><input class="form-control" id="tkfNama" value="${escHtml(autoNama)}" ${id ? 'readonly style="background:#f0f0f0"' : ''}></div>
      <div class="form-group"><label>Usia</label><input type="number" class="form-control" id="tkfUsia" value="${autoUsia}"></div>
      <div class="form-group"><label>Jenis Kelamin</label>
        <select class="form-control" id="tkfGender">
          <option value="">-- Pilih --</option>
          <option value="Laki-laki" ${autoGender === "Laki-laki" ? "selected" : ""}>Laki-laki</option>
          <option value="Perempuan" ${autoGender === "Perempuan" ? "selected" : ""}>Perempuan</option>
        </select>
      </div>
      <div class="form-group"><label>Golongan Darah</label>
        <select class="form-control" id="tkfGolDarah">
          <option value="">-- Pilih --</option>
          <option value="A" ${autoGolDarah === "A" ? "selected" : ""}>A</option>
          <option value="B" ${autoGolDarah === "B" ? "selected" : ""}>B</option>
          <option value="AB" ${autoGolDarah === "AB" ? "selected" : ""}>AB</option>
          <option value="O" ${autoGolDarah === "O" ? "selected" : ""}>O</option>
        </select>
      </div>
      <div class="form-group"><label>Tinggi Badan (cm)</label><input type="number" class="form-control" id="tkfTinggi" value="${du.tinggi || ""}" oninput="hitungBMI()"></div>
      <div class="form-group"><label>Berat Badan (kg)</label><input type="number" class="form-control" id="tkfBerat" value="${du.berat || ""}" oninput="hitungBMI()"></div>
      <div class="form-group"><label>BMI (otomatis)</label><input class="form-control" id="tkfBMI" value="${du.bmi || ""}" readonly style="background:#f5f5f5"></div>
    </div>

    <h4 style="margin:16px 0 8px;color:var(--primary)">B. Riwayat Kesehatan</h4>
    <p style="margin:0 0 10px;font-size:.8rem;color:#666;font-style:italic">Centang penyakit yang pernah atau sedang diderita. Isi riwayat operasi, obat rutin, dan rawat inap jika ada.</p>
    <div class="form-group"><label>Riwayat Penyakit Keluarga/Pribadi</label><div style="margin:8px 0">${diseaseChecks}</div></div>
    <div class="grid-2">
      <div class="form-group"><label>Riwayat Operasi</label><input class="form-control" id="tkfOperasi" value="${escHtml(rk.operasi || "")}"></div>
      <div class="form-group"><label>Obat yang Dikonsumsi</label><input class="form-control" id="tkfObat" value="${escHtml(rk.obat || "")}"></div>
      <div class="form-group"><label>Riwayat Rawat Inap</label><input class="form-control" id="tkfRawatInap" value="${escHtml(rk.rawatInap || "")}"></div>
    </div>

    <h4 style="margin:16px 0 8px;color:var(--primary)">C. Pemeriksaan Fisik</h4>
    <p style="margin:0 0 10px;font-size:.8rem;color:#666;font-style:italic">Tekanan darah: systole/diastole dalam mmHg (normal: 120/80). Nadi normal: 60-100 bpm. Suhu normal: 36-37.5&deg;C. Penglihatan format "6/6" atau "20/20".</p>
    <div class="grid-2">
      <div class="form-group"><label>Tekanan Darah Systole</label><input type="number" class="form-control" id="tkfSystole" value="${pf.systole || ""}"></div>
      <div class="form-group"><label>Tekanan Darah Diastole</label><input type="number" class="form-control" id="tkfDiastole" value="${pf.diastole || ""}"></div>
      <div class="form-group"><label>Nadi (bpm)</label><input type="number" class="form-control" id="tkfNadi" value="${pf.nadi || ""}"></div>
      <div class="form-group"><label>Suhu (C)</label><input type="number" step="0.1" class="form-control" id="tkfSuhu" value="${pf.suhu || ""}"></div>
      <div class="form-group"><label>Penglihatan Kiri</label><input class="form-control" id="tkfMataKiri" value="${escHtml(pf.penglihatanKiri || "")}"></div>
      <div class="form-group"><label>Penglihatan Kanan</label><input class="form-control" id="tkfMataKanan" value="${escHtml(pf.penglihatanKanan || "")}"></div>
      <div class="form-group"><label>Pendengaran</label><input class="form-control" id="tkfPendengaran" value="${escHtml(pf.pendengaran || "")}"></div>
      <div class="form-group"><label>Gigi</label><input class="form-control" id="tkfGigi" value="${escHtml(pf.gigi || "")}"></div>
    </div>

    <h4 style="margin:16px 0 8px;color:var(--primary)">D. Pemeriksaan Lab (Opsional)</h4>
    <p style="margin:0 0 10px;font-size:.8rem;color:#666;font-style:italic">Bagian ini opsional. Isi jika sudah ada hasil laboratorium. Kosongkan jika belum dilakukan pemeriksaan lab.</p>
    <div class="grid-2">
      <div class="form-group"><label>Hemoglobin</label><input class="form-control" id="tkfHb" value="${escHtml(pl.hemoglobin || "")}"></div>
      <div class="form-group"><label>Gula Darah</label><input class="form-control" id="tkfGula" value="${escHtml(pl.gulaDarah || "")}"></div>
      <div class="form-group"><label>Kolesterol</label><input class="form-control" id="tkfKolesterol" value="${escHtml(pl.kolesterol || "")}"></div>
      <div class="form-group"><label>Urine</label><input class="form-control" id="tkfUrine" value="${escHtml(pl.urine || "")}"></div>
    </div>

    <h4 style="margin:16px 0 8px;color:var(--primary)">E. Kondisi Mental</h4>
    <p style="margin:0 0 10px;font-size:.8rem;color:#666;font-style:italic">Jawab sesuai kondisi yang Anda rasakan saat ini. Tidak ada jawaban benar atau salah.</p>
    <div class="grid-2">
      <div class="form-group"><label>Gangguan Mental</label>
        <select class="form-control" id="tkfMental">
          <option value="">-- Pilih --</option>
          <option value="tidak" ${km.gangguanMental === "tidak" ? "selected" : ""}>Tidak</option>
          <option value="ya" ${km.gangguanMental === "ya" ? "selected" : ""}>Ya</option>
        </select>
      </div>
      <div class="form-group"><label>Tingkat Stres</label>
        <select class="form-control" id="tkfStres">
          <option value="">-- Pilih --</option>
          <option value="rendah" ${km.stres === "rendah" ? "selected" : ""}>Rendah</option>
          <option value="sedang" ${km.stres === "sedang" ? "selected" : ""}>Sedang</option>
          <option value="tinggi" ${km.stres === "tinggi" ? "selected" : ""}>Tinggi</option>
        </select>
      </div>
      <div class="form-group"><label>Kualitas Tidur</label>
        <select class="form-control" id="tkfTidur">
          <option value="">-- Pilih --</option>
          <option value="baik" ${km.kualitasTidur === "baik" ? "selected" : ""}>Baik</option>
          <option value="cukup" ${km.kualitasTidur === "cukup" ? "selected" : ""}>Cukup</option>
          <option value="buruk" ${km.kualitasTidur === "buruk" ? "selected" : ""}>Buruk</option>
        </select>
      </div>
    </div>

    <h4 style="margin:16px 0 8px;color:var(--primary)">F. Kebiasaan</h4>
    <p style="margin:0 0 10px;font-size:.8rem;color:#666;font-style:italic">Jawab dengan jujur agar rekomendasi kesehatan yang diberikan sesuai dengan kondisi Anda.</p>
    <div class="grid-2">
      <div class="form-group"><label>Merokok</label>
        <select class="form-control" id="tkfMerokok">
          <option value="">-- Pilih --</option>
          <option value="tidak" ${kb.merokok === "tidak" ? "selected" : ""}>Tidak</option>
          <option value="ya" ${kb.merokok === "ya" ? "selected" : ""}>Ya</option>
        </select>
      </div>
      <div class="form-group"><label>Jumlah Batang/Hari</label><input type="number" class="form-control" id="tkfRokokJumlah" value="${kb.rokokPerHari || ""}"></div>
      <div class="form-group"><label>Alkohol</label>
        <select class="form-control" id="tkfAlkohol">
          <option value="">-- Pilih --</option>
          <option value="tidak" ${kb.alkohol === "tidak" ? "selected" : ""}>Tidak</option>
          <option value="ya" ${kb.alkohol === "ya" ? "selected" : ""}>Ya</option>
        </select>
      </div>
      <div class="form-group"><label>Olahraga</label>
        <select class="form-control" id="tkfOlahraga">
          <option value="">-- Pilih --</option>
          <option value="tidak" ${kb.olahraga === "tidak" ? "selected" : ""}>Tidak</option>
          <option value="ya" ${kb.olahraga === "ya" ? "selected" : ""}>Ya</option>
        </select>
      </div>
      <div class="form-group"><label>Olahraga (kali/minggu)</label><input type="number" class="form-control" id="tkfOlahragaJumlah" value="${kb.olahragaPerMinggu || ""}"></div>
    </div>

    <h4 style="margin:16px 0 8px;color:var(--primary)">G. Kesimpulan</h4>
    <div style="margin:0 0 10px;padding:10px 12px;background:#fff3e0;border-radius:6px;border-left:3px solid #ff9800;font-size:.8rem;color:#e65100">
      ⚙️ Bagian ini dihasilkan <strong>otomatis</strong> berdasarkan data pemeriksaan Anda di Bagian A-F. Tidak perlu diisi manual. Hasil akan diperbarui secara langsung saat data diisi.
    </div>
    <div class="form-group"><label>Status Kesehatan (Otomatis)</label>
      <div id="tkfStatusPreview" style="padding:8px 12px;background:#f5f5f5;border-radius:6px;min-height:36px;display:flex;align-items:center">
        ${ks.status ? getStatusBadgeKesehatan(ks.status) : '<span style="color:#999;font-size:.85rem">Isi data pemeriksaan fisik (Bagian C) terlebih dahulu</span>'}
      </div>
    </div>
    <div class="form-group"><label>Catatan Medis (Otomatis)</label>
      <div id="tkfCatatanPreview" style="padding:10px 12px;background:#f5f5f5;border-radius:6px;min-height:44px;font-size:.85rem;color:#333;line-height:1.6;white-space:pre-wrap">${escHtml(ks.catatan || "Belum ada data untuk dianalisis.")}</div>
    </div>
    <div class="form-group"><label>Rekomendasi (Otomatis)</label>
      <div id="tkfRekomendasiPreview" style="padding:10px 12px;background:#f5f5f5;border-radius:6px;min-height:44px;font-size:.85rem;color:#333;line-height:1.6;white-space:pre-wrap">${escHtml(ks.rekomendasi || "Belum ada data untuk dianalisis.")}</div>
    </div>

    </div>
    <div style="margin-top:16px"><button class="btn btn-primary" onclick="simpanTestKesehatan('${id || ""}')">💾 Simpan</button></div>
  `;
  openModal(html);
  setTimeout(() => {
    hitungBMI();
    updateStatusPreview();
    // Add live update listeners on ALL relevant fields (sections A-F)
    const inputFields = [
      "tkfTinggi",
      "tkfBerat",
      "tkfSystole",
      "tkfDiastole",
      "tkfNadi",
      "tkfSuhu",
      "tkfGula",
      "tkfKolesterol",
      "tkfRokokJumlah",
      "tkfOlahragaJumlah",
      "tkfHb",
    ];
    inputFields.forEach((fId) => {
      const el = document.getElementById(fId);
      if (el) el.addEventListener("input", updateStatusPreview);
    });
    const selectFields = [
      "tkfMental",
      "tkfStres",
      "tkfTidur",
      "tkfMerokok",
      "tkfAlkohol",
      "tkfOlahraga",
      "tkfGender",
      "tkfGolDarah",
    ];
    selectFields.forEach((fId) => {
      const el = document.getElementById(fId);
      if (el) el.addEventListener("change", updateStatusPreview);
    });
    // Disease checkboxes
    document.querySelectorAll(".tkDisease").forEach((cb) => {
      cb.addEventListener("change", updateStatusPreview);
    });
  }, 100);
}

// ── BMI CALCULATION ───────────────────────────────────────────
function hitungBMI() {
  const tinggi = parseFloat(document.getElementById("tkfTinggi").value) || 0;
  const berat = parseFloat(document.getElementById("tkfBerat").value) || 0;
  const bmiEl = document.getElementById("tkfBMI");
  if (tinggi > 0 && berat > 0) {
    const bmi = berat / ((tinggi / 100) * (tinggi / 100));
    bmiEl.value = bmi.toFixed(1);
  } else {
    bmiEl.value = "";
  }
  updateStatusPreview();
}

// ── AUTO-GENERATE CATATAN (DOCTOR'S NOTES) ────────────────────
function generateCatatanOtomatis() {
  const systole = parseFloat(document.getElementById("tkfSystole").value) || 0;
  const diastole =
    parseFloat(document.getElementById("tkfDiastole").value) || 0;
  const nadi = parseFloat(document.getElementById("tkfNadi").value) || 0;
  const suhu = parseFloat(document.getElementById("tkfSuhu").value) || 0;
  const bmi = parseFloat(document.getElementById("tkfBMI").value) || 0;
  const gulaDarah = parseFloat(document.getElementById("tkfGula").value) || 0;
  const kolesterol =
    parseFloat(document.getElementById("tkfKolesterol").value) || 0;
  const gangguanMental = document.getElementById("tkfMental").value;
  const stres = document.getElementById("tkfStres").value;
  const kualitasTidur = document.getElementById("tkfTidur").value;
  const merokok = document.getElementById("tkfMerokok").value;
  const rokokPerHari =
    parseFloat(document.getElementById("tkfRokokJumlah").value) || 0;
  const hb = document.getElementById("tkfHb").value;

  // Check if any data is filled
  const hasAnyData =
    systole > 0 || diastole > 0 || nadi > 0 || suhu > 0 || bmi > 0;
  if (!hasAnyData) return "Belum ada data untuk dianalisis.";

  const temuan = [];

  // Blood pressure
  if (systole > 140)
    temuan.push(
      "Tekanan darah tinggi/hipertensi (systole: " + systole + " mmHg)",
    );
  else if (systole >= 130 && systole <= 140)
    temuan.push("Tekanan darah pra-hipertensi (systole: " + systole + " mmHg)");
  else if (systole > 0 && systole < 90)
    temuan.push(
      "Tekanan darah rendah/hipotensi (systole: " + systole + " mmHg)",
    );

  if (diastole > 90) temuan.push("Diastole tinggi (" + diastole + " mmHg)");
  else if (diastole >= 80 && diastole <= 90)
    temuan.push("Diastole pra-hipertensi (" + diastole + " mmHg)");
  else if (diastole > 0 && diastole < 60)
    temuan.push("Diastole rendah (" + diastole + " mmHg)");

  // Heart rate
  if (nadi > 100) temuan.push("Nadi tinggi/takikardia (" + nadi + " bpm)");
  else if (nadi > 0 && nadi < 60)
    temuan.push("Nadi rendah/bradikardia (" + nadi + " bpm)");

  // Temperature
  if (suhu > 37.5) temuan.push("Suhu tubuh tinggi/demam (" + suhu + " C)");
  else if (suhu > 0 && suhu < 35.5)
    temuan.push("Suhu tubuh rendah/hipotermia (" + suhu + " C)");

  // BMI
  if (bmi > 30) temuan.push("BMI obesitas (" + bmi.toFixed(1) + ")");
  else if (bmi >= 25 && bmi <= 30)
    temuan.push("BMI kelebihan berat badan (" + bmi.toFixed(1) + ")");
  else if (bmi > 0 && bmi < 16)
    temuan.push("BMI sangat kurus (" + bmi.toFixed(1) + ")");
  else if (bmi >= 16 && bmi < 18.5)
    temuan.push("BMI kurus/underweight (" + bmi.toFixed(1) + ")");

  // Blood sugar
  if (gulaDarah > 200)
    temuan.push("Gula darah sangat tinggi (" + gulaDarah + " mg/dL)");
  else if (gulaDarah >= 140 && gulaDarah <= 200)
    temuan.push("Gula darah tinggi/pra-diabetes (" + gulaDarah + " mg/dL)");

  // Cholesterol
  if (kolesterol > 240)
    temuan.push("Kolesterol tinggi (" + kolesterol + " mg/dL)");

  // Hemoglobin
  if (hb) {
    const hbVal = parseFloat(hb) || 0;
    if (hbVal > 0 && hbVal < 12)
      temuan.push("Hemoglobin rendah/anemia (" + hbVal + " g/dL)");
  }

  // Mental health
  if (gangguanMental === "ya") temuan.push("Memiliki riwayat gangguan mental");
  if (stres === "tinggi") temuan.push("Tingkat stres tinggi");
  else if (stres === "sedang") temuan.push("Tingkat stres sedang");
  if (kualitasTidur === "buruk") temuan.push("Kualitas tidur buruk");

  // Habits
  if (merokok === "ya" && rokokPerHari > 10)
    temuan.push("Perokok berat (" + rokokPerHari + " batang/hari)");
  else if (merokok === "ya")
    temuan.push("Perokok aktif (" + rokokPerHari + " batang/hari)");

  // Disease history
  const penyakitChecked = [];
  document.querySelectorAll(".tkDisease:checked").forEach(function (c) {
    penyakitChecked.push(c.value);
  });
  if (penyakitChecked.length > 0)
    temuan.push("Riwayat penyakit: " + penyakitChecked.join(", "));

  if (temuan.length === 0) {
    return "Semua hasil pemeriksaan dalam batas normal.";
  }

  return "Temuan: " + temuan.join("; ") + ".";
}

// ── AUTO-GENERATE REKOMENDASI ─────────────────────────────────
function generateRekomendasiOtomatis() {
  const systole = parseFloat(document.getElementById("tkfSystole").value) || 0;
  const diastole =
    parseFloat(document.getElementById("tkfDiastole").value) || 0;
  const bmi = parseFloat(document.getElementById("tkfBMI").value) || 0;
  const gulaDarah = parseFloat(document.getElementById("tkfGula").value) || 0;
  const kolesterol =
    parseFloat(document.getElementById("tkfKolesterol").value) || 0;
  const gangguanMental = document.getElementById("tkfMental").value;
  const stres = document.getElementById("tkfStres").value;
  const kualitasTidur = document.getElementById("tkfTidur").value;
  const merokok = document.getElementById("tkfMerokok").value;
  const rokokPerHari =
    parseFloat(document.getElementById("tkfRokokJumlah").value) || 0;
  const nadi = parseFloat(document.getElementById("tkfNadi").value) || 0;
  const suhu = parseFloat(document.getElementById("tkfSuhu").value) || 0;
  const hb = document.getElementById("tkfHb").value;

  // Check if any data is filled
  const hasAnyData =
    systole > 0 || diastole > 0 || nadi > 0 || suhu > 0 || bmi > 0;
  if (!hasAnyData) return "Belum ada data untuk dianalisis.";

  const rekomendasi = [];

  // Blood pressure recommendations
  if (systole > 140 || diastole > 90) {
    rekomendasi.push(
      "Konsultasi ke dokter spesialis jantung. Kurangi konsumsi garam dan makanan berlemak.",
    );
  } else if (
    (systole >= 130 && systole <= 140) ||
    (diastole >= 80 && diastole <= 90)
  ) {
    rekomendasi.push(
      "Monitor tekanan darah secara rutin. Kurangi konsumsi garam.",
    );
  }

  // BMI recommendations
  if (bmi > 30) {
    rekomendasi.push(
      "Program diet dan olahraga teratur disarankan. Konsultasi ahli gizi.",
    );
  } else if (bmi >= 25 && bmi <= 30) {
    rekomendasi.push("Jaga pola makan sehat dan tingkatkan aktivitas fisik.");
  } else if (bmi > 0 && bmi < 18.5) {
    rekomendasi.push(
      "Tingkatkan asupan nutrisi dan kalori. Konsultasi ahli gizi jika perlu.",
    );
  }

  // Blood sugar recommendations
  if (gulaDarah > 200) {
    rekomendasi.push(
      "Pemeriksaan HbA1c dan konsultasi ke dokter spesialis penyakit dalam segera.",
    );
  } else if (gulaDarah >= 140 && gulaDarah <= 200) {
    rekomendasi.push(
      "Pemeriksaan gula darah ulang dan kontrol pola makan. Kurangi gula dan karbohidrat.",
    );
  }

  // Cholesterol recommendations
  if (kolesterol > 240) {
    rekomendasi.push(
      "Diet rendah lemak dan pemeriksaan profil lipid lanjutan. Konsultasi dokter.",
    );
  }

  // Hemoglobin
  if (hb) {
    const hbVal = parseFloat(hb) || 0;
    if (hbVal > 0 && hbVal < 12) {
      rekomendasi.push(
        "Tingkatkan asupan zat besi (daging merah, sayuran hijau). Pemeriksaan lanjutan untuk anemia.",
      );
    }
  }

  // Heart rate
  if (nadi > 100) {
    rekomendasi.push(
      "Evaluasi penyebab nadi tinggi. Hindari kafein berlebihan.",
    );
  }

  // Temperature
  if (suhu > 37.5) {
    rekomendasi.push(
      "Istirahat cukup dan minum banyak air. Periksakan jika demam berlanjut.",
    );
  }

  // Smoking recommendations
  if (merokok === "ya" && rokokPerHari > 10) {
    rekomendasi.push(
      "Sangat disarankan untuk berhenti merokok. Konsultasi program berhenti merokok.",
    );
  } else if (merokok === "ya") {
    rekomendasi.push("Disarankan untuk mengurangi dan berhenti merokok.");
  }

  // Mental health recommendations
  if (gangguanMental === "ya") {
    rekomendasi.push(
      "Konsultasi psikolog/psikiater disarankan untuk evaluasi lanjutan.",
    );
  }
  if (stres === "tinggi") {
    rekomendasi.push(
      "Manajemen stres: olahraga teratur, meditasi, dan istirahat cukup.",
    );
  }
  if (kualitasTidur === "buruk") {
    rekomendasi.push(
      "Evaluasi pola tidur. Hindari gadget sebelum tidur, atur jadwal tidur teratur.",
    );
  }

  if (rekomendasi.length === 0) {
    return "Pertahankan pola hidup sehat. Kontrol ulang berkala sesuai jadwal.";
  }

  return rekomendasi.join(" ");
}

// ── AUTO-CALCULATE HEALTH STATUS ──────────────────────────────
function hitungStatusKesehatan() {
  const systole = parseFloat(document.getElementById("tkfSystole").value) || 0;
  const diastole =
    parseFloat(document.getElementById("tkfDiastole").value) || 0;
  const nadi = parseFloat(document.getElementById("tkfNadi").value) || 0;
  const suhu = parseFloat(document.getElementById("tkfSuhu").value) || 0;
  const bmi = parseFloat(document.getElementById("tkfBMI").value) || 0;
  const gulaDarah = parseFloat(document.getElementById("tkfGula").value) || 0;
  const kolesterol =
    parseFloat(document.getElementById("tkfKolesterol").value) || 0;
  const gangguanMental = document.getElementById("tkfMental").value;
  const stres = document.getElementById("tkfStres").value;
  const kualitasTidur = document.getElementById("tkfTidur").value;
  const merokok = document.getElementById("tkfMerokok").value;
  const rokokPerHari =
    parseFloat(document.getElementById("tkfRokokJumlah").value) || 0;

  // Check if basic fields are filled
  const basicFilled = systole > 0 && diastole > 0 && nadi > 0 && suhu > 0;
  if (!basicFilled) return "";

  // Conditions for "tidak_sehat"
  if (systole > 140 || systole < 90) return "tidak_sehat";
  if (diastole > 90 || diastole < 60) return "tidak_sehat";
  if (nadi > 100 || nadi < 60) return "tidak_sehat";
  if (suhu > 37.5 || suhu < 35.5) return "tidak_sehat";
  if (bmi > 30 || (bmi > 0 && bmi < 16)) return "tidak_sehat";
  if (gulaDarah > 200) return "tidak_sehat";
  if (gangguanMental === "ya") return "tidak_sehat";
  if (stres === "tinggi") return "tidak_sehat";

  // Conditions for "perlu_pemeriksaan"
  if (systole >= 130 && systole <= 140) return "perlu_pemeriksaan";
  if (diastole >= 80 && diastole <= 90) return "perlu_pemeriksaan";
  if (nadi === 100) return "perlu_pemeriksaan";
  if (suhu >= 37.1 && suhu <= 37.5) return "perlu_pemeriksaan";
  if (bmi >= 25 && bmi <= 30) return "perlu_pemeriksaan";
  if (bmi >= 16 && bmi < 18.5) return "perlu_pemeriksaan";
  if (gulaDarah >= 140 && gulaDarah <= 200) return "perlu_pemeriksaan";
  if (kolesterol > 240) return "perlu_pemeriksaan";
  if (kualitasTidur === "buruk") return "perlu_pemeriksaan";
  if (merokok === "ya" && rokokPerHari > 10) return "perlu_pemeriksaan";

  return "sehat";
}

function updateStatusPreview() {
  const el = document.getElementById("tkfStatusPreview");
  if (!el) return;
  const status = hitungStatusKesehatan();
  if (status) {
    el.innerHTML = getStatusBadgeKesehatan(status);
  } else {
    el.innerHTML =
      '<span style="color:#999;font-size:.85rem">Isi data pemeriksaan fisik (Bagian C) terlebih dahulu</span>';
  }
  // Update auto-generated catatan
  const catatanEl = document.getElementById("tkfCatatanPreview");
  if (catatanEl) {
    catatanEl.textContent = generateCatatanOtomatis();
  }
  // Update auto-generated rekomendasi
  const rekomendasiEl = document.getElementById("tkfRekomendasiPreview");
  if (rekomendasiEl) {
    rekomendasiEl.textContent = generateRekomendasiOtomatis();
  }
}

// ── SIMPAN TEST KESEHATAN ─────────────────────────────────────
async function simpanTestKesehatan(id) {
  try {
    const penyakitArr = [];
    document
      .querySelectorAll(".tkDisease:checked")
      .forEach((c) => penyakitArr.push(c.value));

  // Mandatory field validation
  const missingFields = [];
  if (!(document.getElementById("tkfNama").value || "").trim()) missingFields.push("Nama");
  if (!(document.getElementById("tkfUsia").value || "").trim()) missingFields.push("Usia");
  if (!(document.getElementById("tkfGender").value || "").trim()) missingFields.push("Jenis Kelamin");
  if (!(document.getElementById("tkfGolDarah").value || "").trim()) missingFields.push("Golongan Darah");
  if (!(document.getElementById("tkfTinggi").value || "").trim()) missingFields.push("Tinggi Badan");
  if (!(document.getElementById("tkfBerat").value || "").trim()) missingFields.push("Berat Badan");
  const hasSystole = (document.getElementById("tkfSystole").value || "").trim();
  const hasDiastole = (document.getElementById("tkfDiastole").value || "").trim();
  const hasNadi = (document.getElementById("tkfNadi").value || "").trim();
  const hasSuhu = (document.getElementById("tkfSuhu").value || "").trim();
  if (!hasSystole && !hasDiastole && !hasNadi && !hasSuhu) missingFields.push("Pemeriksaan Fisik (minimal salah satu: Systole/Diastole/Nadi/Suhu)");
  if (!(document.getElementById("tkfMental").value || "").trim()) missingFields.push("Gangguan Mental");
  if (!(document.getElementById("tkfStres").value || "").trim()) missingFields.push("Tingkat Stres");
  if (!(document.getElementById("tkfTidur").value || "").trim()) missingFields.push("Kualitas Tidur");
  if (!(document.getElementById("tkfMerokok").value || "").trim()) missingFields.push("Merokok");
  if (!(document.getElementById("tkfAlkohol").value || "").trim()) missingFields.push("Alkohol");
  if (!(document.getElementById("tkfOlahraga").value || "").trim()) missingFields.push("Olahraga");

  if (missingFields.length > 0) {
    toast("Field wajib belum diisi: " + missingFields.join(", "), "warning");
    return;
  }

  const dataUmum = {
    nama: document.getElementById("tkfNama").value,
    usia: document.getElementById("tkfUsia").value,
    jenisKelamin: document.getElementById("tkfGender").value,
    golonganDarah: document.getElementById("tkfGolDarah").value,
    tinggi: document.getElementById("tkfTinggi").value,
    berat: document.getElementById("tkfBerat").value,
    bmi: document.getElementById("tkfBMI").value,
  };
  const riwayatKesehatan = {
    penyakit: penyakitArr,
    operasi: document.getElementById("tkfOperasi").value,
    obat: document.getElementById("tkfObat").value,
    rawatInap: document.getElementById("tkfRawatInap").value,
  };
  const pemeriksaanFisik = {
    systole: document.getElementById("tkfSystole").value,
    diastole: document.getElementById("tkfDiastole").value,
    nadi: document.getElementById("tkfNadi").value,
    suhu: document.getElementById("tkfSuhu").value,
    penglihatanKiri: document.getElementById("tkfMataKiri").value,
    penglihatanKanan: document.getElementById("tkfMataKanan").value,
    pendengaran: document.getElementById("tkfPendengaran").value,
    gigi: document.getElementById("tkfGigi").value,
  };
  const pemeriksaanLab = {
    hemoglobin: document.getElementById("tkfHb").value,
    gulaDarah: document.getElementById("tkfGula").value,
    kolesterol: document.getElementById("tkfKolesterol").value,
    urine: document.getElementById("tkfUrine").value,
  };
  const kondisiMental = {
    gangguanMental: document.getElementById("tkfMental").value,
    stres: document.getElementById("tkfStres").value,
    kualitasTidur: document.getElementById("tkfTidur").value,
  };
  const kebiasaan = {
    merokok: document.getElementById("tkfMerokok").value,
    rokokPerHari: document.getElementById("tkfRokokJumlah").value,
    alkohol: document.getElementById("tkfAlkohol").value,
    olahraga: document.getElementById("tkfOlahraga").value,
    olahragaPerMinggu: document.getElementById("tkfOlahragaJumlah").value,
  };
  const kesimpulan = {
    status: hitungStatusKesehatan(),
    catatan: generateCatatanOtomatis(),
    rekomendasi: generateRekomendasiOtomatis(),
    pemeriksaOleh: "TENAGA MEDIS IJEF",
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
    updateData.status = "selesai";
  }

  if (id && id.trim()) {
    // Ensure userId is set for existing employee tests so portal queries work
    if (typeof currentUser !== "undefined" && currentUser && currentUser.id) {
      const existingDoc = await db.collection("hrd_test_kesehatan").doc(id).get();
      const existingData = existingDoc.exists ? existingDoc.data() : {};
      if (existingData.tipe === "existing" && !existingData.userId) {
        updateData.userId = currentUser.id;
      } else if (existingData.tipe === "existing" && existingData.userId === currentUser.linkedKaryawan && currentUser.linkedKaryawan !== currentUser.id) {
        // If userId was set to linkedKaryawan (karyawan doc id), also store user login id
        updateData.userId = currentUser.id;
      }
      // Store departemen and roleLevel if not yet set (for older records)
      if (!existingData.departemen || !existingData.roleLevel) {
        const targetUserId = updateData.userId || existingData.userId || "";
        if (targetUserId) {
          const usersSnap = await db.collection("hrd_users").get();
          usersSnap.forEach((uDoc) => {
            const uData = uDoc.data();
            if (uDoc.id === targetUserId || uData.linkedKaryawan === targetUserId) {
              if (!existingData.departemen) updateData.departemen = uData.departemen || "";
              if (!existingData.roleLevel) updateData.roleLevel = ROLES[uData.role] || 0;
            }
          });
        }
        // Fallback: use currentUser's info if this is their own record
        if (!updateData.departemen && !existingData.departemen && currentUser.departemen) {
          updateData.departemen = currentUser.departemen;
        }
        if (!updateData.roleLevel && !existingData.roleLevel) {
          updateData.roleLevel = ROLES[currentUser.role] || 0;
        }
      }
    }
    try {
      await db.collection("hrd_test_kesehatan").doc(id).update(updateData);
    } catch (updateErr) {
      console.warn(
        "[TEST KESEHATAN] Update failed, trying set with merge:",
        updateErr.message,
      );
      await db
        .collection("hrd_test_kesehatan")
        .doc(id)
        .set(updateData, { merge: true });
    }
  } else {
    updateData.id = generateId();
    updateData.nama = dataUmum.nama;
    updateData.tipe = "existing";
    updateData.tanggal = todayStr();
    updateData.status = kesimpulan.status ? "selesai" : "pending";
    updateData.createdAt = new Date().toISOString();
    // Set userId, departemen, and roleLevel for new records
    if (typeof currentUser !== "undefined" && currentUser && currentUser.id) {
      updateData.userId = currentUser.id;
      updateData.departemen = currentUser.departemen || "";
      updateData.roleLevel = ROLES[currentUser.role] || 0;
    }
    await db.collection("hrd_test_kesehatan").add(updateData);
  }

  // Send notification to admin when test is submitted
  if (typeof sendNotification === "function") {
    sendNotification(
      "admin",
      "Test Kesehatan Disubmit",
      `Test kesehatan untuk ${dataUmum.nama || "karyawan"} telah diisi.`,
      "test-kesehatan",
    );
  }

  closeModalDirect();
  toast("Data test kesehatan disimpan", "success");
  if (typeof renderTestKesehatan === "function") renderTestKesehatan();
  } catch (e) {
    console.error("[TEST KESEHATAN] Gagal menyimpan:", e);
    toast("Gagal menyimpan: " + e.message, "error");
  }
}

// ── DETAIL TEST KESEHATAN (READ-ONLY) ─────────────────────────
async function detailTestKesehatan(id) {
  const doc = await db.collection("hrd_test_kesehatan").doc(id).get();
  if (!doc.exists) return toast("Data tidak ditemukan", "warning");
  const data = doc.data();

  // Enforce access control: prevent unauthorized viewing
  if (typeof currentUser !== "undefined" && typeof hasAccess === "function") {
    const myLevel = ROLES[currentUser.role] || 0;
    const isOwnRecord =
      data.userId === currentUser.id ||
      data.userId === currentUser.linkedKaryawan ||
      (data.nama || "").toLowerCase().trim() === (currentUser.nama || "").toLowerCase().trim();

    if (!isOwnRecord) {
      if (myLevel < 3) {
        // staff/leader cannot view other people's records
        return toast("Anda tidak memiliki akses untuk melihat data ini", "warning");
      } else if (myLevel < 5) {
        // manager/head: only own department + equal or lower level
        if (data.departemen !== currentUser.departemen) {
          return toast("Anda tidak memiliki akses untuk melihat data lintas divisi", "warning");
        }
        const recordLevel = data.roleLevel || 0;
        if (recordLevel > myLevel) {
          return toast("Anda tidak memiliki akses untuk melihat data level di atas Anda", "warning");
        }
      } else if (myLevel < 6) {
        // bod: can see all except admin
        const recordLevel = data.roleLevel || 0;
        if (recordLevel >= 6) {
          return toast("Anda tidak memiliki akses untuk melihat data ini", "warning");
        }
      }
      // admin (level 6): no restriction
    }
  }

  const du = data.dataUmum || {};
  const rk = data.riwayatKesehatan || {};
  const pf = data.pemeriksaanFisik || {};
  const pl = data.pemeriksaanLab || {};
  const km = data.kondisiMental || {};
  const kb = data.kebiasaan || {};
  const ks = data.kesimpulan || {};

  const html = `
    <div class="modal-title">📋 Detail Test Kesehatan - ${escHtml(data.nama || "")}</div>
    <div style="max-height:70vh;overflow-y:auto;padding-right:8px">
      <div style="margin-bottom:12px">
        <span class="badge badge-${data.tipe === "calon" ? "warning" : "info"}">${data.tipe === "calon" ? "Calon Karyawan" : "Karyawan Existing"}</span>
        ${ks.status ? getStatusBadgeKesehatan(ks.status) : getStatusBadgeKesehatan(data.status)}
        <span class="text-sm" style="margin-left:8px">Tanggal: ${formatDate(data.tanggal)}</span>
      </div>

      <h4 style="margin:12px 0 8px;color:var(--primary)">A. Data Umum</h4>
      <div class="table-wrap"><table>
        <tr><td class="fw-700" style="width:40%">Nama</td><td>${escHtml(du.nama || data.nama || "-")}</td></tr>
        <tr><td class="fw-700">Usia</td><td>${du.usia || "-"} tahun</td></tr>
        <tr><td class="fw-700">Jenis Kelamin</td><td>${escHtml(du.jenisKelamin || "-")}</td></tr>
        <tr><td class="fw-700">Golongan Darah</td><td>${escHtml(du.golonganDarah || "-")}</td></tr>
        <tr><td class="fw-700">Tinggi Badan</td><td>${du.tinggi || "-"} cm</td></tr>
        <tr><td class="fw-700">Berat Badan</td><td>${du.berat || "-"} kg</td></tr>
        <tr><td class="fw-700">BMI</td><td>${du.bmi || "-"}</td></tr>
      </table></div>

      <h4 style="margin:12px 0 8px;color:var(--primary)">B. Riwayat Kesehatan</h4>
      <div class="table-wrap"><table>
        <tr><td class="fw-700" style="width:40%">Penyakit</td><td>${(rk.penyakit || []).join(", ") || "-"}</td></tr>
        <tr><td class="fw-700">Riwayat Operasi</td><td>${escHtml(rk.operasi || "-")}</td></tr>
        <tr><td class="fw-700">Obat</td><td>${escHtml(rk.obat || "-")}</td></tr>
        <tr><td class="fw-700">Rawat Inap</td><td>${escHtml(rk.rawatInap || "-")}</td></tr>
      </table></div>

      <h4 style="margin:12px 0 8px;color:var(--primary)">C. Pemeriksaan Fisik</h4>
      <div class="table-wrap"><table>
        <tr><td class="fw-700" style="width:40%">Tekanan Darah</td><td>${pf.systole || "-"}/${pf.diastole || "-"} mmHg</td></tr>
        <tr><td class="fw-700">Nadi</td><td>${pf.nadi || "-"} bpm</td></tr>
        <tr><td class="fw-700">Suhu</td><td>${pf.suhu || "-"} &deg;C</td></tr>
        <tr><td class="fw-700">Penglihatan Kiri</td><td>${escHtml(pf.penglihatanKiri || "-")}</td></tr>
        <tr><td class="fw-700">Penglihatan Kanan</td><td>${escHtml(pf.penglihatanKanan || "-")}</td></tr>
        <tr><td class="fw-700">Pendengaran</td><td>${escHtml(pf.pendengaran || "-")}</td></tr>
        <tr><td class="fw-700">Gigi</td><td>${escHtml(pf.gigi || "-")}</td></tr>
      </table></div>

      <h4 style="margin:12px 0 8px;color:var(--primary)">D. Pemeriksaan Lab</h4>
      <div class="table-wrap"><table>
        <tr><td class="fw-700" style="width:40%">Hemoglobin</td><td>${escHtml(pl.hemoglobin || "-")}</td></tr>
        <tr><td class="fw-700">Gula Darah</td><td>${escHtml(pl.gulaDarah || "-")}</td></tr>
        <tr><td class="fw-700">Kolesterol</td><td>${escHtml(pl.kolesterol || "-")}</td></tr>
        <tr><td class="fw-700">Urine</td><td>${escHtml(pl.urine || "-")}</td></tr>
      </table></div>

      <h4 style="margin:12px 0 8px;color:var(--primary)">E. Kondisi Mental</h4>
      <div class="table-wrap"><table>
        <tr><td class="fw-700" style="width:40%">Gangguan Mental</td><td>${km.gangguanMental === "ya" ? "Ya" : "Tidak"}</td></tr>
        <tr><td class="fw-700">Tingkat Stres</td><td>${escHtml(km.stres || "-")}</td></tr>
        <tr><td class="fw-700">Kualitas Tidur</td><td>${escHtml(km.kualitasTidur || "-")}</td></tr>
      </table></div>

      <h4 style="margin:12px 0 8px;color:var(--primary)">F. Kebiasaan</h4>
      <div class="table-wrap"><table>
        <tr><td class="fw-700" style="width:40%">Merokok</td><td>${kb.merokok === "ya" ? "Ya (" + (kb.rokokPerHari || 0) + " batang/hari)" : "Tidak"}</td></tr>
        <tr><td class="fw-700">Alkohol</td><td>${kb.alkohol === "ya" ? "Ya" : "Tidak"}</td></tr>
        <tr><td class="fw-700">Olahraga</td><td>${kb.olahraga === "ya" ? "Ya (" + (kb.olahragaPerMinggu || 0) + " kali/minggu)" : "Tidak"}</td></tr>
      </table></div>

      <h4 style="margin:12px 0 8px;color:var(--primary)">G. Kesimpulan</h4>
      <div class="table-wrap"><table>
        <tr><td class="fw-700" style="width:40%">Status</td><td>${ks.status ? getStatusBadgeKesehatan(ks.status) : "-"}</td></tr>
        <tr><td class="fw-700">Catatan Dokter</td><td>${escHtml(ks.catatan || "-")}</td></tr>
        <tr><td class="fw-700">Rekomendasi</td><td>${escHtml(ks.rekomendasi || "-")}</td></tr>
        <tr><td class="fw-700">Diperiksa Oleh</td><td>${escHtml(ks.pemeriksaOleh || "-")}</td></tr>
      </table></div>
    </div>
  `;
  openModal(html);
}

// ── HAPUS TEST KESEHATAN ──────────────────────────────────────
async function hapusTestKesehatan(id) {
  if (!confirm("Yakin ingin menghapus data test kesehatan ini?")) return;
  await db.collection("hrd_test_kesehatan").doc(id).delete();
  toast("Data dihapus", "success");
  renderTestKesehatan();
}

// ── PORTAL: TEST KESEHATAN KARYAWAN ───────────────────────────
async function renderPortalTestKesehatan() {
  const main = document.getElementById("mainContent");
  main.innerHTML = `
  <div class="page-title"><span>🏥 Test Kesehatan Saya</span></div>
  <div class="card">
    <div style="background:#e3f2fd;border-radius:8px;padding:14px;margin-bottom:16px;border-left:4px solid var(--info)">
      <p class="fw-700" style="margin-bottom:8px;font-size:.95rem">📖 Tata Cara Pengisian Test Kesehatan</p>
      <ol class="text-sm" style="line-height:1.8;margin:0;padding-left:18px">
        <li><strong>Test dijadwalkan oleh HRD/Admin</strong> - Anda akan melihat jadwal test di tabel bawah.</li>
        <li><strong>Klik tombol "Isi Form"</strong> pada test yang berstatus Pending untuk membuka form pemeriksaan.</li>
        <li><strong>Isi Bagian A-F sesuai petunjuk</strong> yang tertera di setiap bagian form. Pastikan data yang diisi akurat.</li>
        <li><strong>Bagian G (Kesimpulan) dihasilkan otomatis sepenuhnya</strong> - status, catatan, dan rekomendasi dihitung dari data Bagian A-F.</li>
        <li><strong>Klik Simpan</strong> setelah selesai mengisi. HRD akan menerima notifikasi.</li>
      </ol>
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

  // Query only current user's test records by userId for privacy
  const snap = await db.collection("hrd_test_kesehatan").where("userId", "==", u.id).get();
  const myTests = [];
  snap.forEach((d) => {
    myTests.push({ ...d.data(), id: d.id });
  });
  // Also check by nama if linkedKaryawan might have different userId
  if (u.linkedKaryawan && u.linkedKaryawan !== u.id) {
    const snap2 = await db.collection("hrd_test_kesehatan").where("userId", "==", u.linkedKaryawan).get();
    snap2.forEach((d) => {
      if (!myTests.find(t => t.id === d.id)) myTests.push({ ...d.data(), id: d.id });
    });
  }
  // Fallback: also query by nama field for records that may not have userId set
  const namaSnap = await db.collection("hrd_test_kesehatan").where("nama", "==", u.nama).get();
  namaSnap.forEach((d) => {
    if (!myTests.find(t => t.id === d.id)) myTests.push({ ...d.data(), id: d.id });
  });

  const pending = myTests.filter((t) => t.status === "pending");
  const completed = myTests.filter((t) => t.status === "selesai");
  pending.sort((a, b) => (a.tanggal || "").localeCompare(b.tanggal || ""));
  completed.sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || ""));

  let hPending = "";
  if (!pending.length) {
    hPending =
      '<tr><td colspan="4" class="text-center" style="color:var(--text-light)">Tidak ada test terjadwal</td></tr>';
  } else {
    pending.forEach((t) => {
      hPending += `<tr>
        <td>${formatDate(t.tanggal)}</td>
        <td>${getStatusBadgeKesehatan("pending")}</td>
        <td>${escHtml(t.catatan || "-")}</td>
        <td><button class="btn btn-xs btn-primary" onclick="modalFormTestKesehatan('${t.id}')">📝 Isi Form</button></td>
      </tr>`;
    });
  }
  document.getElementById("tblPortalTKPending").innerHTML = hPending;

  let hHistory = "";
  if (!completed.length) {
    hHistory =
      '<tr><td colspan="5" class="text-center" style="color:var(--text-light)">Belum ada riwayat</td></tr>';
  } else {
    completed.forEach((t) => {
      const ks = t.kesimpulan || {};
      hHistory += `<tr>
        <td>${formatDate(t.tanggal)}</td>
        <td>${getStatusBadgeKesehatan("selesai")}</td>
        <td>${ks.status ? getStatusBadgeKesehatan(ks.status) : "-"}</td>
        <td>${escHtml(ks.pemeriksaOleh || "-")}</td>
        <td><button class="btn btn-xs btn-info" onclick="detailTestKesehatan('${t.id}')">👁️ Detail</button></td>
      </tr>`;
    });
  }
  document.getElementById("tblPortalTKHistory").innerHTML = hHistory;
}
