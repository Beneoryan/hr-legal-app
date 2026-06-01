"use strict";
// TEST-KESEHATAN-PUBLIC.JS - Public Health Test Form for Candidates
// Standalone page (no login required) - accessed via shared link

const firebaseConfig = {
  apiKey: "AIzaSyAWlNi_iBOWxZBD6E20aHOSrRpPsirDdOM",
  authDomain: "test-kesehatan-ijef-corp-7c278.firebaseapp.com",
  projectId: "test-kesehatan-ijef-corp-7c278",
  storageBucket: "test-kesehatan-ijef-corp-7c278.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// == HELPERS ==
function toast(m, t) {
  t = t || "info";
  var c = document.getElementById("toastContainer");
  var el = document.createElement("div");
  el.style.cssText =
    "padding:12px 18px;border-radius:8px;color:#fff;font-size:.83rem;" +
    "font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.15);max-width:350px;" +
    "animation:slideIn .3s";
  el.style.background =
    t === "success"
      ? "#2e7d32"
      : t === "error"
        ? "#c62828"
        : t === "warning"
          ? "#f57f17"
          : "#0277bd";
  el.textContent = m;
  c.appendChild(el);
  setTimeout(function () {
    el.remove();
  }, 3500);
}

function escHtml(s) {
  var d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

function getStatusBadgeKesehatan(status) {
  var map = {
    sehat:
      '<span style="display:inline-block;padding:4px 10px;border-radius:12px;font-size:.78rem;font-weight:600;background:#e8f5e9;color:#2e7d32">Sehat</span>',
    tidak_sehat:
      '<span style="display:inline-block;padding:4px 10px;border-radius:12px;font-size:.78rem;font-weight:600;background:#ffebee;color:#c62828">Tidak Sehat</span>',
    perlu_pemeriksaan:
      '<span style="display:inline-block;padding:4px 10px;border-radius:12px;font-size:.78rem;font-weight:600;background:#fff8e1;color:#f57f17">Perlu Pemeriksaan Lanjut</span>',
  };
  return map[status] || "";
}

// == BMI CALCULATION ==
function hitungBMI() {
  var tinggi = parseFloat(document.getElementById("tkfTinggi").value) || 0;
  var berat = parseFloat(document.getElementById("tkfBerat").value) || 0;
  var bmiEl = document.getElementById("tkfBMI");
  if (tinggi > 0 && berat > 0) {
    var bmi = berat / ((tinggi / 100) * (tinggi / 100));
    bmiEl.value = bmi.toFixed(1);
  } else {
    bmiEl.value = "";
  }
  updateStatusPreview();
}

// == AUTO-CALCULATE HEALTH STATUS ==
function hitungStatusKesehatan() {
  var systole = parseFloat(document.getElementById("tkfSystole").value) || 0;
  var diastole = parseFloat(document.getElementById("tkfDiastole").value) || 0;
  var nadi = parseFloat(document.getElementById("tkfNadi").value) || 0;
  var suhu = parseFloat(document.getElementById("tkfSuhu").value) || 0;
  var bmi = parseFloat(document.getElementById("tkfBMI").value) || 0;
  var gulaDarah = parseFloat(document.getElementById("tkfGula").value) || 0;
  var kolesterol =
    parseFloat(document.getElementById("tkfKolesterol").value) || 0;
  var gangguanMental = document.getElementById("tkfMental").value;
  var stres = document.getElementById("tkfStres").value;
  var kualitasTidur = document.getElementById("tkfTidur").value;
  var merokok = document.getElementById("tkfMerokok").value;
  var rokokPerHari =
    parseFloat(document.getElementById("tkfRokokJumlah").value) || 0;

  var basicFilled = systole > 0 && diastole > 0 && nadi > 0 && suhu > 0;
  if (!basicFilled) return "";

  if (systole > 140 || systole < 90) return "tidak_sehat";
  if (diastole > 90 || diastole < 60) return "tidak_sehat";
  if (nadi > 100 || nadi < 60) return "tidak_sehat";
  if (suhu > 37.5 || suhu < 35.5) return "tidak_sehat";
  if (bmi > 30 || (bmi > 0 && bmi < 16)) return "tidak_sehat";
  if (gulaDarah > 200) return "tidak_sehat";
  if (gangguanMental === "ya") return "tidak_sehat";
  if (stres === "tinggi") return "tidak_sehat";

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

// == AUTO-GENERATE CATATAN ==
function generateCatatanOtomatis() {
  var systole = parseFloat(document.getElementById("tkfSystole").value) || 0;
  var diastole = parseFloat(document.getElementById("tkfDiastole").value) || 0;
  var nadi = parseFloat(document.getElementById("tkfNadi").value) || 0;
  var suhu = parseFloat(document.getElementById("tkfSuhu").value) || 0;
  var bmi = parseFloat(document.getElementById("tkfBMI").value) || 0;
  var gulaDarah = parseFloat(document.getElementById("tkfGula").value) || 0;
  var kolesterol =
    parseFloat(document.getElementById("tkfKolesterol").value) || 0;
  var gangguanMental = document.getElementById("tkfMental").value;
  var stres = document.getElementById("tkfStres").value;
  var kualitasTidur = document.getElementById("tkfTidur").value;
  var merokok = document.getElementById("tkfMerokok").value;
  var rokokPerHari =
    parseFloat(document.getElementById("tkfRokokJumlah").value) || 0;
  var hb = document.getElementById("tkfHb").value;

  var hasAnyData =
    systole > 0 || diastole > 0 || nadi > 0 || suhu > 0 || bmi > 0;
  if (!hasAnyData) return "Belum ada data untuk dianalisis.";

  var temuan = [];

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

  if (nadi > 100) temuan.push("Nadi tinggi/takikardia (" + nadi + " bpm)");
  else if (nadi > 0 && nadi < 60)
    temuan.push("Nadi rendah/bradikardia (" + nadi + " bpm)");

  if (suhu > 37.5) temuan.push("Suhu tubuh tinggi/demam (" + suhu + " C)");
  else if (suhu > 0 && suhu < 35.5)
    temuan.push("Suhu tubuh rendah/hipotermia (" + suhu + " C)");

  if (bmi > 30) temuan.push("BMI obesitas (" + bmi.toFixed(1) + ")");
  else if (bmi >= 25 && bmi <= 30)
    temuan.push("BMI kelebihan berat badan (" + bmi.toFixed(1) + ")");
  else if (bmi > 0 && bmi < 16)
    temuan.push("BMI sangat kurus (" + bmi.toFixed(1) + ")");
  else if (bmi >= 16 && bmi < 18.5)
    temuan.push("BMI kurus/underweight (" + bmi.toFixed(1) + ")");

  if (gulaDarah > 200)
    temuan.push("Gula darah sangat tinggi (" + gulaDarah + " mg/dL)");
  else if (gulaDarah >= 140 && gulaDarah <= 200)
    temuan.push("Gula darah tinggi/pra-diabetes (" + gulaDarah + " mg/dL)");

  if (kolesterol > 240)
    temuan.push("Kolesterol tinggi (" + kolesterol + " mg/dL)");

  if (hb) {
    var hbVal = parseFloat(hb) || 0;
    if (hbVal > 0 && hbVal < 12)
      temuan.push("Hemoglobin rendah/anemia (" + hbVal + " g/dL)");
  }

  if (gangguanMental === "ya") temuan.push("Memiliki riwayat gangguan mental");
  if (stres === "tinggi") temuan.push("Tingkat stres tinggi");
  else if (stres === "sedang") temuan.push("Tingkat stres sedang");
  if (kualitasTidur === "buruk") temuan.push("Kualitas tidur buruk");

  if (merokok === "ya" && rokokPerHari > 10)
    temuan.push("Perokok berat (" + rokokPerHari + " batang/hari)");
  else if (merokok === "ya")
    temuan.push("Perokok aktif (" + rokokPerHari + " batang/hari)");

  var penyakitChecked = [];
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

// == AUTO-GENERATE REKOMENDASI ==
function generateRekomendasiOtomatis() {
  var systole = parseFloat(document.getElementById("tkfSystole").value) || 0;
  var diastole = parseFloat(document.getElementById("tkfDiastole").value) || 0;
  var bmi = parseFloat(document.getElementById("tkfBMI").value) || 0;
  var gulaDarah = parseFloat(document.getElementById("tkfGula").value) || 0;
  var kolesterol =
    parseFloat(document.getElementById("tkfKolesterol").value) || 0;
  var gangguanMental = document.getElementById("tkfMental").value;
  var stres = document.getElementById("tkfStres").value;
  var kualitasTidur = document.getElementById("tkfTidur").value;
  var merokok = document.getElementById("tkfMerokok").value;
  var rokokPerHari =
    parseFloat(document.getElementById("tkfRokokJumlah").value) || 0;
  var nadi = parseFloat(document.getElementById("tkfNadi").value) || 0;
  var suhu = parseFloat(document.getElementById("tkfSuhu").value) || 0;
  var hb = document.getElementById("tkfHb").value;

  var hasAnyData =
    systole > 0 || diastole > 0 || nadi > 0 || suhu > 0 || bmi > 0;
  if (!hasAnyData) return "Belum ada data untuk dianalisis.";

  var rekomendasi = [];

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

  if (gulaDarah > 200) {
    rekomendasi.push(
      "Pemeriksaan HbA1c dan konsultasi ke dokter spesialis penyakit dalam segera.",
    );
  } else if (gulaDarah >= 140 && gulaDarah <= 200) {
    rekomendasi.push(
      "Pemeriksaan gula darah ulang dan kontrol pola makan. Kurangi gula dan karbohidrat.",
    );
  }

  if (kolesterol > 240) {
    rekomendasi.push(
      "Diet rendah lemak dan pemeriksaan profil lipid lanjutan. Konsultasi dokter.",
    );
  }

  if (hb) {
    var hbVal = parseFloat(hb) || 0;
    if (hbVal > 0 && hbVal < 12) {
      rekomendasi.push(
        "Tingkatkan asupan zat besi (daging merah, sayuran hijau). Pemeriksaan lanjutan untuk anemia.",
      );
    }
  }

  if (nadi > 100) {
    rekomendasi.push(
      "Evaluasi penyebab nadi tinggi. Hindari kafein berlebihan.",
    );
  }

  if (suhu > 37.5) {
    rekomendasi.push(
      "Istirahat cukup dan minum banyak air. Periksakan jika demam berlanjut.",
    );
  }

  if (merokok === "ya" && rokokPerHari > 10) {
    rekomendasi.push(
      "Sangat disarankan untuk berhenti merokok. Konsultasi program berhenti merokok.",
    );
  } else if (merokok === "ya") {
    rekomendasi.push("Disarankan untuk mengurangi dan berhenti merokok.");
  }

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

// == UPDATE STATUS PREVIEW ==
function updateStatusPreview() {
  var el = document.getElementById("tkfStatusPreview");
  if (!el) return;
  var status = hitungStatusKesehatan();
  if (status) {
    el.innerHTML = getStatusBadgeKesehatan(status);
  } else {
    el.innerHTML =
      '<span style="color:#999;font-size:.85rem">Isi data pemeriksaan fisik (Bagian C) terlebih dahulu</span>';
  }
  var catatanEl = document.getElementById("tkfCatatanPreview");
  if (catatanEl) {
    catatanEl.textContent = generateCatatanOtomatis();
  }
  var rekomendasiEl = document.getElementById("tkfRekomendasiPreview");
  if (rekomendasiEl) {
    rekomendasiEl.textContent = generateRekomendasiOtomatis();
  }
}

// == RENDER ERROR PAGE ==
function renderError(msg) {
  document.getElementById("app").innerHTML =
    '<div style="background:#fff;border-radius:10px;padding:40px;max-width:500px;' +
    'margin:40px auto;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.06)">' +
    '<div style="font-size:3rem;margin-bottom:16px">&#x26A0;&#xFE0F;</div>' +
    '<h2 style="color:var(--danger);margin-bottom:12px">' +
    escHtml(msg) +
    "</h2>" +
    '<p style="color:var(--text-light);font-size:.9rem">' +
    "Silakan hubungi HRD untuk informasi lebih lanjut.</p></div>";
}

// == RENDER COMPLETED PAGE ==
function renderCompleted() {
  document.getElementById("app").innerHTML =
    '<div style="background:#fff;border-radius:10px;padding:40px;max-width:500px;' +
    'margin:40px auto;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.06)">' +
    '<div style="font-size:3rem;margin-bottom:16px">&#x2705;</div>' +
    '<h2 style="color:var(--success);margin-bottom:12px">Test Sudah Diselesaikan</h2>' +
    '<p style="color:var(--text-light);font-size:.9rem">' +
    "Form test kesehatan ini sudah diisi sebelumnya. Hubungi HRD jika ada pertanyaan.</p></div>";
}

// == RENDER THANK YOU PAGE ==
function renderThankYou() {
  document.getElementById("app").innerHTML =
    '<div style="background:#fff;border-radius:10px;padding:40px;max-width:500px;' +
    'margin:40px auto;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.06)">' +
    '<div style="font-size:3.5rem;margin-bottom:16px">&#x2705;</div>' +
    '<h2 style="color:var(--success);margin-bottom:12px">TERIMA KASIH</h2>' +
    '<p style="color:var(--text-light);font-size:.9rem;line-height:1.7">' +
    "Form test kesehatan Anda telah berhasil dikirim.<br>" +
    "Tim HRD akan mereview hasil pemeriksaan Anda.</p>" +
    '<div style="margin-top:20px;padding:12px;background:#e8f5e9;border-radius:8px;font-size:.82rem;color:#2e7d32">' +
    "Anda dapat menutup halaman ini.</div></div>";
}

// == RENDER FORM ==
function renderForm(docId, data) {
  var du = data.dataUmum || {};
  var rk = data.riwayatKesehatan || {};
  var pf = data.pemeriksaanFisik || {};
  var pl = data.pemeriksaanLab || {};
  var km = data.kondisiMental || {};
  var kb = data.kebiasaan || {};
  var ks = data.kesimpulan || {};

  var diseases = [
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
  var diseaseChecks = diseases
    .map(function (d) {
      var checked = (rk.penyakit || []).includes(d) ? "checked" : "";
      return (
        '<label style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;' +
        'margin-bottom:6px;font-size:.85rem"><input type="checkbox" class="tkDisease" value="' +
        d +
        '" ' +
        checked +
        "> " +
        d +
        "</label>"
      );
    })
    .join("");

  var h = "";
  h +=
    '<div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)">';
  h +=
    '<h3 style="color:var(--primary);margin-bottom:8px">&#x1F3E5; Test Kesehatan - ' +
    escHtml(data.nama || "") +
    "</h3>";
  h +=
    '<div style="font-size:.85rem;color:var(--text-light);margin-bottom:16px">Tanggal: ' +
    escHtml(data.tanggal || "") +
    "</div>";

  // Tata Cara Pengisian
  h +=
    '<div style="background:#e3f2fd;border-radius:8px;padding:14px;margin-bottom:16px;border-left:4px solid #0277bd">';
  h +=
    '<p style="margin:0 0 8px;font-weight:700;font-size:.95rem;color:#01579b">&#x1F4D6; Tata Cara Pengisian Test Kesehatan</p>';
  h +=
    '<ol style="line-height:1.8;margin:0;padding-left:18px;font-size:.82rem;color:#333">';
  h +=
    "<li><strong>Isi Bagian A-F sesuai petunjuk</strong> yang tertera di setiap bagian form. Pastikan data yang diisi akurat.</li>";
  h +=
    "<li><strong>Bagian D (Lab) boleh dikosongkan</strong> jika belum ada hasil pemeriksaan laboratorium.</li>";
  h +=
    "<li><strong>Bagian G (Kesimpulan) dihasilkan otomatis sepenuhnya</strong> - status, catatan, dan rekomendasi dihitung dari data Bagian A-F.</li>";
  h +=
    "<li><strong>Klik Kirim</strong> setelah selesai mengisi. HRD akan menerima notifikasi dan mereview hasilnya.</li>";
  h += "</ol></div>";
  h += "</div>";

  // Section A - Data Umum
  h +=
    '<div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)">';
  h += '<h4 style="margin:0 0 8px;color:var(--primary)">A. Data Umum</h4>';
  h +=
    '<p style="margin:0 0 14px;font-size:.8rem;color:#666;font-style:italic">Isi data diri dasar. Tinggi badan dalam satuan cm, berat badan dalam kg. BMI akan terhitung otomatis.</p>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Nama</label>';
  h +=
    '<input id="tkfNama" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(du.nama || data.nama || "") +
    '"></div>';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Usia</label>';
  h +=
    '<input type="number" id="tkfUsia" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(du.usia || "") +
    '"></div>';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Jenis Kelamin</label>';
  h +=
    '<select id="tkfGender" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem">';
  h += '<option value="">-- Pilih --</option>';
  h +=
    '<option value="Laki-laki"' +
    (du.jenisKelamin === "Laki-laki" ? " selected" : "") +
    ">Laki-laki</option>";
  h +=
    '<option value="Perempuan"' +
    (du.jenisKelamin === "Perempuan" ? " selected" : "") +
    ">Perempuan</option>";
  h += "</select></div>";
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Golongan Darah</label>';
  h +=
    '<select id="tkfGolDarah" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem">';
  h += '<option value="">-- Pilih --</option>';
  h +=
    '<option value="A"' +
    (du.golonganDarah === "A" ? " selected" : "") +
    ">A</option>";
  h +=
    '<option value="B"' +
    (du.golonganDarah === "B" ? " selected" : "") +
    ">B</option>";
  h +=
    '<option value="AB"' +
    (du.golonganDarah === "AB" ? " selected" : "") +
    ">AB</option>";
  h +=
    '<option value="O"' +
    (du.golonganDarah === "O" ? " selected" : "") +
    ">O</option>";
  h += "</select></div>";
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Tinggi Badan (cm)</label>';
  h +=
    '<input type="number" id="tkfTinggi" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(du.tinggi || "") +
    '" oninput="hitungBMI()"></div>';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Berat Badan (kg)</label>';
  h +=
    '<input type="number" id="tkfBerat" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(du.berat || "") +
    '" oninput="hitungBMI()"></div>';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">BMI (otomatis)</label>';
  h +=
    '<input id="tkfBMI" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem;background:#f5f5f5" value="' +
    escHtml(du.bmi || "") +
    '" readonly></div>';
  h += "</div></div>";

  // Section B - Riwayat Kesehatan
  h +=
    '<div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)">';
  h +=
    '<h4 style="margin:0 0 8px;color:var(--primary)">B. Riwayat Kesehatan</h4>';
  h +=
    '<p style="margin:0 0 14px;font-size:.8rem;color:#666;font-style:italic">Centang penyakit yang pernah atau sedang diderita. Isi riwayat operasi, obat rutin, dan rawat inap jika ada.</p>';
  h +=
    '<div style="margin-bottom:14px"><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:8px">Riwayat Penyakit Keluarga/Pribadi</label>';
  h +=
    '<div style="display:flex;flex-wrap:wrap;gap:4px">' +
    diseaseChecks +
    "</div></div>";
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Riwayat Operasi</label>';
  h +=
    '<input id="tkfOperasi" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(rk.operasi || "") +
    '"></div>';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Obat yang Dikonsumsi</label>';
  h +=
    '<input id="tkfObat" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(rk.obat || "") +
    '"></div>';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Riwayat Rawat Inap</label>';
  h +=
    '<input id="tkfRawatInap" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(rk.rawatInap || "") +
    '"></div>';
  h += "</div></div>";

  // Section C - Pemeriksaan Fisik
  h +=
    '<div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)">';
  h +=
    '<h4 style="margin:0 0 8px;color:var(--primary)">C. Pemeriksaan Fisik</h4>';
  h +=
    '<p style="margin:0 0 14px;font-size:.8rem;color:#666;font-style:italic">Tekanan darah: systole/diastole dalam mmHg (normal: 120/80). Nadi normal: 60-100 bpm. Suhu normal: 36-37.5&deg;C. Penglihatan format "6/6" atau "20/20".</p>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Tekanan Darah Systole</label>';
  h +=
    '<input type="number" id="tkfSystole" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(pf.systole || "") +
    '"></div>';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Tekanan Darah Diastole</label>';
  h +=
    '<input type="number" id="tkfDiastole" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(pf.diastole || "") +
    '"></div>';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Nadi (bpm)</label>';
  h +=
    '<input type="number" id="tkfNadi" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(pf.nadi || "") +
    '"></div>';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Suhu (C)</label>';
  h +=
    '<input type="number" step="0.1" id="tkfSuhu" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(pf.suhu || "") +
    '"></div>';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Penglihatan Kiri</label>';
  h +=
    '<input id="tkfMataKiri" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(pf.penglihatanKiri || "") +
    '"></div>';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Penglihatan Kanan</label>';
  h +=
    '<input id="tkfMataKanan" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(pf.penglihatanKanan || "") +
    '"></div>';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Pendengaran</label>';
  h +=
    '<input id="tkfPendengaran" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(pf.pendengaran || "") +
    '"></div>';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Gigi</label>';
  h +=
    '<input id="tkfGigi" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(pf.gigi || "") +
    '"></div>';
  h += "</div></div>";

  // Section D - Pemeriksaan Lab
  h +=
    '<div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)">';
  h +=
    '<h4 style="margin:0 0 8px;color:var(--primary)">D. Pemeriksaan Lab (Opsional)</h4>';
  h +=
    '<p style="margin:0 0 14px;font-size:.8rem;color:#666;font-style:italic">Bagian ini opsional. Isi jika sudah ada hasil laboratorium. Kosongkan jika belum dilakukan pemeriksaan lab.</p>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Hemoglobin</label>';
  h +=
    '<input id="tkfHb" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(pl.hemoglobin || "") +
    '"></div>';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Gula Darah</label>';
  h +=
    '<input id="tkfGula" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(pl.gulaDarah || "") +
    '"></div>';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Kolesterol</label>';
  h +=
    '<input id="tkfKolesterol" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(pl.kolesterol || "") +
    '"></div>';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Urine</label>';
  h +=
    '<input id="tkfUrine" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(pl.urine || "") +
    '"></div>';
  h += "</div></div>";

  // Section E - Kondisi Mental
  h +=
    '<div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)">';
  h += '<h4 style="margin:0 0 8px;color:var(--primary)">E. Kondisi Mental</h4>';
  h +=
    '<p style="margin:0 0 14px;font-size:.8rem;color:#666;font-style:italic">Jawab sesuai kondisi yang Anda rasakan saat ini. Tidak ada jawaban benar atau salah.</p>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Gangguan Mental</label>';
  h +=
    '<select id="tkfMental" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem">';
  h += '<option value="">-- Pilih --</option>';
  h +=
    '<option value="tidak"' +
    (km.gangguanMental === "tidak" ? " selected" : "") +
    ">Tidak</option>";
  h +=
    '<option value="ya"' +
    (km.gangguanMental === "ya" ? " selected" : "") +
    ">Ya</option>";
  h += "</select></div>";
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Tingkat Stres</label>';
  h +=
    '<select id="tkfStres" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem">';
  h += '<option value="">-- Pilih --</option>';
  h +=
    '<option value="rendah"' +
    (km.stres === "rendah" ? " selected" : "") +
    ">Rendah</option>";
  h +=
    '<option value="sedang"' +
    (km.stres === "sedang" ? " selected" : "") +
    ">Sedang</option>";
  h +=
    '<option value="tinggi"' +
    (km.stres === "tinggi" ? " selected" : "") +
    ">Tinggi</option>";
  h += "</select></div>";
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Kualitas Tidur</label>';
  h +=
    '<select id="tkfTidur" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem">';
  h += '<option value="">-- Pilih --</option>';
  h +=
    '<option value="baik"' +
    (km.kualitasTidur === "baik" ? " selected" : "") +
    ">Baik</option>";
  h +=
    '<option value="cukup"' +
    (km.kualitasTidur === "cukup" ? " selected" : "") +
    ">Cukup</option>";
  h +=
    '<option value="buruk"' +
    (km.kualitasTidur === "buruk" ? " selected" : "") +
    ">Buruk</option>";
  h += "</select></div>";
  h += "</div></div>";

  // Section F - Kebiasaan
  h +=
    '<div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)">';
  h += '<h4 style="margin:0 0 8px;color:var(--primary)">F. Kebiasaan</h4>';
  h +=
    '<p style="margin:0 0 14px;font-size:.8rem;color:#666;font-style:italic">Jawab dengan jujur agar rekomendasi kesehatan yang diberikan sesuai dengan kondisi Anda.</p>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Merokok</label>';
  h +=
    '<select id="tkfMerokok" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem">';
  h += '<option value="">-- Pilih --</option>';
  h +=
    '<option value="tidak"' +
    (kb.merokok === "tidak" ? " selected" : "") +
    ">Tidak</option>";
  h +=
    '<option value="ya"' +
    (kb.merokok === "ya" ? " selected" : "") +
    ">Ya</option>";
  h += "</select></div>";
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Jumlah Batang/Hari</label>';
  h +=
    '<input type="number" id="tkfRokokJumlah" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(kb.rokokPerHari || "") +
    '"></div>';
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Alkohol</label>';
  h +=
    '<select id="tkfAlkohol" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem">';
  h += '<option value="">-- Pilih --</option>';
  h +=
    '<option value="tidak"' +
    (kb.alkohol === "tidak" ? " selected" : "") +
    ">Tidak</option>";
  h +=
    '<option value="ya"' +
    (kb.alkohol === "ya" ? " selected" : "") +
    ">Ya</option>";
  h += "</select></div>";
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Olahraga</label>';
  h +=
    '<select id="tkfOlahraga" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem">';
  h += '<option value="">-- Pilih --</option>';
  h +=
    '<option value="tidak"' +
    (kb.olahraga === "tidak" ? " selected" : "") +
    ">Tidak</option>";
  h +=
    '<option value="ya"' +
    (kb.olahraga === "ya" ? " selected" : "") +
    ">Ya</option>";
  h += "</select></div>";
  h +=
    '<div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Olahraga (kali/minggu)</label>';
  h +=
    '<input type="number" id="tkfOlahragaJumlah" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" value="' +
    escHtml(kb.olahragaPerMinggu || "") +
    '"></div>';
  h += "</div></div>";

  // Section G - Kesimpulan (auto-calculated)
  h +=
    '<div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)">';
  h += '<h4 style="margin:0 0 8px;color:var(--primary)">G. Kesimpulan</h4>';
  h +=
    '<div style="margin:0 0 14px;padding:10px 12px;background:#fff3e0;border-radius:6px;border-left:3px solid #ff9800;font-size:.8rem;color:#e65100">';
  h +=
    "&#x2699;&#xFE0F; Bagian ini dihasilkan <strong>otomatis</strong> berdasarkan data pemeriksaan Anda di Bagian A-F. Tidak perlu diisi manual. Hasil akan diperbarui secara langsung saat data diisi.</div>";
  h +=
    '<div style="margin-bottom:12px"><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Status Kesehatan (Otomatis)</label>';
  h +=
    '<div id="tkfStatusPreview" style="padding:8px 12px;background:#f5f5f5;border-radius:6px;min-height:36px;display:flex;align-items:center">';
  h += ks.status
    ? getStatusBadgeKesehatan(ks.status)
    : '<span style="color:#999;font-size:.85rem">Isi data pemeriksaan fisik (Bagian C) terlebih dahulu</span>';
  h += "</div></div>";
  h +=
    '<div style="margin-bottom:12px"><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Catatan Medis (Otomatis)</label>';
  h +=
    '<div id="tkfCatatanPreview" style="padding:10px 12px;background:#f5f5f5;border-radius:6px;min-height:44px;font-size:.85rem;color:#333;line-height:1.6;white-space:pre-wrap">' +
    escHtml(ks.catatan || "Belum ada data untuk dianalisis.") +
    "</div></div>";
  h +=
    '<div style="margin-bottom:12px"><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Rekomendasi (Otomatis)</label>';
  h +=
    '<div id="tkfRekomendasiPreview" style="padding:10px 12px;background:#f5f5f5;border-radius:6px;min-height:44px;font-size:.85rem;color:#333;line-height:1.6;white-space:pre-wrap">' +
    escHtml(ks.rekomendasi || "Belum ada data untuk dianalisis.") +
    "</div></div>";
  h += "</div>";

  // Submit button
  h += '<div style="text-align:center;margin:20px 0">';
  h +=
    "<button onclick=\"submitTestKesehatan('" +
    docId +
    '\')" style="padding:14px 40px;border:none;background:var(--primary);color:#fff;border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(26,35,126,.3)">&#x1F4E8; Kirim Hasil Test</button>';
  h += "</div>";

  document.getElementById("app").innerHTML = h;

  // Attach live update listeners
  setTimeout(function () {
    hitungBMI();
    updateStatusPreview();

    var inputFields = [
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
    inputFields.forEach(function (fId) {
      var el = document.getElementById(fId);
      if (el) el.addEventListener("input", updateStatusPreview);
    });

    var selectFields = [
      "tkfMental",
      "tkfStres",
      "tkfTidur",
      "tkfMerokok",
      "tkfAlkohol",
      "tkfOlahraga",
      "tkfGender",
      "tkfGolDarah",
    ];
    selectFields.forEach(function (fId) {
      var el = document.getElementById(fId);
      if (el) el.addEventListener("change", updateStatusPreview);
    });

    document.querySelectorAll(".tkDisease").forEach(function (cb) {
      cb.addEventListener("change", updateStatusPreview);
    });
  }, 100);
}

// == SUBMIT TEST ==
async function submitTestKesehatan(docId) {
  var penyakitArr = [];
  document.querySelectorAll(".tkDisease:checked").forEach(function (c) {
    penyakitArr.push(c.value);
  });

  var dataUmum = {
    nama: document.getElementById("tkfNama").value,
    usia: document.getElementById("tkfUsia").value,
    jenisKelamin: document.getElementById("tkfGender").value,
    golonganDarah: document.getElementById("tkfGolDarah").value,
    tinggi: document.getElementById("tkfTinggi").value,
    berat: document.getElementById("tkfBerat").value,
    bmi: document.getElementById("tkfBMI").value,
  };
  var riwayatKesehatan = {
    penyakit: penyakitArr,
    operasi: document.getElementById("tkfOperasi").value,
    obat: document.getElementById("tkfObat").value,
    rawatInap: document.getElementById("tkfRawatInap").value,
  };
  var pemeriksaanFisik = {
    systole: document.getElementById("tkfSystole").value,
    diastole: document.getElementById("tkfDiastole").value,
    nadi: document.getElementById("tkfNadi").value,
    suhu: document.getElementById("tkfSuhu").value,
    penglihatanKiri: document.getElementById("tkfMataKiri").value,
    penglihatanKanan: document.getElementById("tkfMataKanan").value,
    pendengaran: document.getElementById("tkfPendengaran").value,
    gigi: document.getElementById("tkfGigi").value,
  };
  var pemeriksaanLab = {
    hemoglobin: document.getElementById("tkfHb").value,
    gulaDarah: document.getElementById("tkfGula").value,
    kolesterol: document.getElementById("tkfKolesterol").value,
    urine: document.getElementById("tkfUrine").value,
  };
  var kondisiMental = {
    gangguanMental: document.getElementById("tkfMental").value,
    stres: document.getElementById("tkfStres").value,
    kualitasTidur: document.getElementById("tkfTidur").value,
  };
  var kebiasaan = {
    merokok: document.getElementById("tkfMerokok").value,
    rokokPerHari: document.getElementById("tkfRokokJumlah").value,
    alkohol: document.getElementById("tkfAlkohol").value,
    olahraga: document.getElementById("tkfOlahraga").value,
    olahragaPerMinggu: document.getElementById("tkfOlahragaJumlah").value,
  };
  var kesimpulan = {
    status: hitungStatusKesehatan(),
    catatan: generateCatatanOtomatis(),
    rekomendasi: generateRekomendasiOtomatis(),
  };

  var updateData = {
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

  try {
    await db.collection("hrd_test_kesehatan").doc(docId).update(updateData);
    renderThankYou();
  } catch (e) {
    toast("Gagal menyimpan data: " + e.message, "error");
  }
}

// == INIT ON PAGE LOAD ==
document.addEventListener("DOMContentLoaded", async function () {
  var params = new URLSearchParams(window.location.search);
  var docId = params.get("id");

  if (!docId) {
    renderError("Link tidak valid");
    return;
  }

  try {
    var doc = await db.collection("hrd_test_kesehatan").doc(docId).get();
    if (!doc.exists) {
      renderError("Link tidak valid");
      return;
    }
    var data = doc.data();
    if (data.status === "selesai") {
      renderCompleted();
      return;
    }
    renderForm(docId, data);
  } catch (e) {
    renderError("Terjadi kesalahan: " + e.message);
  }
});
