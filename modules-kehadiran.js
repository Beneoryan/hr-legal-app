'use strict';
// ── CUTI / IZIN / WFH ─────────────────────────────────────────
async function renderCuti(){
  const main=document.getElementById('mainContent');
  main.innerHTML=`<div class="page-title"><span>🏖️ Cuti / Izin / WFH</span><button class="btn btn-primary btn-sm" onclick="modalCuti()">+ Pengajuan</button></div>
    ${hasAccess(3)?'<div class="card mb-16"><div class="card-title mb-8">📊 Sisa Jatah Cuti Karyawan</div><div id="cutiQuotaList">Loading...</div></div>':''}
    <div class="card"><div class="card-title mb-8">📋 Daftar Pengajuan</div><div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Jenis</th><th>Tanggal</th><th>Durasi</th><th>Sisa Cuti</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblCuti"></tbody></table></div></div>`;
  // Load data
  const[cutiSnap,karySnap]=await Promise.all([!hasAccess(3)?db.collection('hrd_cuti').where('userId','==',currentUser.id).get():db.collection('hrd_cuti').get(),db.collection('hrd_karyawan').where('status','==','aktif').get()]);
  // Calculate quota per karyawan
  const cutiUsed={};// userId -> total hari cuti tahunan approved
  cutiSnap.forEach(d=>{const p=d.data();if(p.status==='approved'&&p.jenis==='Cuti Tahunan'){const uid=p.userId||p.nama;cutiUsed[uid]=(cutiUsed[uid]||0)+(p.durasi||1);}});
  // Build quota table
  let quotaHtml='<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Dept</th><th>Masa Kerja</th><th>Jatah/Tahun</th><th>Terpakai</th><th>Sisa</th></tr></thead><tbody>';
  const karyList=[];karySnap.forEach(d=>karyList.push({id:d.id,...d.data()}));
  karyList.forEach(k=>{
    const quota=hitungJatahCuti(k);
    const used=cutiUsed[k.id]||cutiUsed[k.nama]||0;
    const sisa=Math.max(0,quota-used);
    const masaKerja=hitungMasaKerja(k.tanggalMasuk);
    const color=sisa<=2?'var(--danger)':sisa<=5?'var(--warning)':'var(--success)';
    quotaHtml+=`<tr><td class="fw-700">${escHtml(k.nama)}</td><td>${escHtml(k.departemen||'-')}</td><td>${masaKerja}</td><td>${quota} hari</td><td>${used} hari</td><td style="color:${color};font-weight:700">${sisa} hari</td></tr>`;
  });
  quotaHtml+='</tbody></table></div>';
  const cutiQuotaEl=document.getElementById('cutiQuotaList');if(cutiQuotaEl)cutiQuotaEl.innerHTML=quotaHtml;
  // Render cuti list with sisa info
  let h='';
  if(cutiSnap.empty)h='<tr><td colspan="7" class="text-center">Belum ada</td></tr>';
  else{
    const items=[];cutiSnap.forEach(d=>items.push({id:d.id,...d.data()}));
    items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    items.forEach(p=>{
      const badge=p.status==='approved'?'badge-success':p.status==='rejected'?'badge-danger':'badge-warning';
      const uid=p.userId||p.nama;
      const kary=karyList.find(k=>k.id===uid||k.nama===p.nama);
      const quota=kary?hitungJatahCuti(kary):12;
      const used=cutiUsed[uid]||0;
      const sisa=Math.max(0,quota-used);
      h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.jenis)}</td><td>${formatDate(p.mulai)}-${formatDate(p.selesai)}</td><td>${p.durasi||1}h</td><td><span class="badge badge-${sisa<=2?'danger':sisa<=5?'warning':'success'}">${sisa}/${quota}</span></td><td><span class="badge ${badge}">${p.status}</span></td><td><button class="btn btn-xs btn-info" onclick="viewCutiDetail('${p.id}')" title="Lihat Detail">👁️</button> ${p.status==='pending'&&hasAccess(3)?`<button class="btn btn-xs btn-success" onclick="approveCuti('${p.id}','approved')">✅</button> <button class="btn btn-xs btn-danger" onclick="approveCuti('${p.id}','rejected')">❌</button>`:''} ${hasAccess(6)||(p.userId===currentUser.id&&p.status==='pending')?`<button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_cuti','${p.id}','cuti')">🗑️</button>`:''}</td></tr>`;
    });
  }
  document.getElementById('tblCuti').innerHTML=h;
}

// Hitung jatah cuti berdasarkan masa kerja, status, dan ketentuan
function hitungJatahCuti(karyawan){
  // UU Cipta Kerja: minimal 12 hari/tahun setelah 1 tahun kerja
  // < 1 tahun: proporsional (1 hari per bulan kerja)
  // Karyawan tetap: 12 hari
  // Kontrak: proporsional
  // Probation: 0
  if(!karyawan.tanggalMasuk) return 12;
  const masuk=new Date(karyawan.tanggalMasuk);
  const now=new Date();
  const bulanKerja=Math.floor((now-masuk)/(30*24*60*60*1000));
  const tahunKerja=Math.floor(bulanKerja/12);

  if(karyawan.status==='probation') return 0;
  if(bulanKerja<12) return Math.min(12,bulanKerja); // Proporsional
  // Setelah 1 tahun: 12 hari (standar UU)
  // Bonus: +1 hari per 2 tahun kerja (kebijakan perusahaan, max 18)
  const bonus=Math.min(3,Math.floor(tahunKerja/2));
  return Math.min(18,12+bonus);
}

function hitungMasaKerja(tanggalMasuk){
  if(!tanggalMasuk) return '-';
  const masuk=new Date(tanggalMasuk);
  const now=new Date();
  const bulan=Math.floor((now-masuk)/(30*24*60*60*1000));
  const tahun=Math.floor(bulan/12);
  const sisaBulan=bulan%12;
  if(tahun>0) return `${tahun} thn ${sisaBulan} bln`;
  return `${bulan} bulan`;
}
function modalCuti(){openModal(`<div class="modal-title">Pengajuan Cuti/Izin/WFH</div><div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="ctNama" value="${currentUser.nama}"></div><div class="form-group"><label>Jenis</label><select class="form-control" id="ctJenis"><option>Cuti Tahunan</option><option>Cuti Sakit</option><option>Izin Pribadi</option><option>WFH</option><option>Cuti Melahirkan</option></select></div></div><div class="grid-2"><div class="form-group"><label>Mulai</label><input class="form-control" type="date" id="ctMulai" value="${todayStr()}"></div><div class="form-group"><label>Selesai</label><input class="form-control" type="date" id="ctSelesai" value="${todayStr()}"></div></div><div class="form-group"><label>Keterangan</label><textarea class="form-control" id="ctKet"></textarea></div><button class="btn btn-primary" onclick="simpanCuti()">Ajukan</button>`);}
async function simpanCuti(){
  const mulai=document.getElementById('ctMulai').value,selesai=document.getElementById('ctSelesai').value;
  const durasi=Math.max(1,Math.ceil((new Date(selesai)-new Date(mulai))/86400000)+1);
  const data={nama:document.getElementById('ctNama').value,jenis:document.getElementById('ctJenis').value,mulai,selesai,durasi,keterangan:document.getElementById('ctKet').value,status:'pending',userId:currentUser.id,createdAt:new Date().toISOString()};
  if(!data.nama)return toast('Nama wajib','warning');
  // Find atasan (supervisor) from karyawan data for hierarchical approval
  const kSnap=await db.collection('hrd_karyawan').where('nama','==',currentUser.nama).limit(1).get();
  if(!kSnap.empty){const kData=kSnap.docs[0].data();data.atasan=kData.atasan||'';data.departemen=kData.departemen||'';}
  await db.collection('hrd_cuti').add(data);
  // Notify atasan first, then HR
  if(data.atasan){
    const atasanSnap=await db.collection('hrd_users').where('nama','==',data.atasan).limit(1).get();
    if(!atasanSnap.empty)await sendNotification(atasanSnap.docs[0].id,'📋 Pengajuan Cuti',`${data.nama} mengajukan ${data.jenis} (${durasi} hari)`,'approval-center');
  }
  await sendNotification('hr','📋 Pengajuan Cuti',`${data.nama} mengajukan ${data.jenis}`,'approval-center');
  closeModalDirect();toast('Diajukan ke atasan & HR','success');renderCuti();
}
async function approveCuti(id,status){await db.collection('hrd_cuti').doc(id).update({status,approvedBy:currentUser.nama,approvedAt:new Date().toISOString()});toast('Updated','success');renderCuti();}

async function viewCutiDetail(id){
  const doc=await db.collection('hrd_cuti').doc(id).get();
  if(!doc.exists)return toast('Data tidak ditemukan','warning');
  const p=doc.data();
  openModal(`<div class="modal-title">Detail Cuti/Izin</div>
    <table style="width:100%;border-collapse:collapse">
      <tr><td class="fw-700" style="padding:6px 8px;width:120px">Nama</td><td style="padding:6px 8px">${escHtml(p.nama||'-')}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Jenis</td><td style="padding:6px 8px">${escHtml(p.jenis||'-')}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Mulai</td><td style="padding:6px 8px">${formatDate(p.mulai)}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Selesai</td><td style="padding:6px 8px">${formatDate(p.selesai)}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Durasi</td><td style="padding:6px 8px">${p.durasi||1} hari</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Keterangan</td><td style="padding:6px 8px">${escHtml(p.keterangan||'-')}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Status</td><td style="padding:6px 8px"><span class="badge badge-${p.status==='approved'?'success':p.status==='rejected'?'danger':'warning'}">${p.status||'pending'}</span></td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Approved By</td><td style="padding:6px 8px">${escHtml(p.approvedBy||'-')}</td></tr>
      <tr><td class="fw-700" style="padding:6px 8px">Created At</td><td style="padding:6px 8px">${p.createdAt?formatDate(p.createdAt.split('T')[0]):'-'}</td></tr>
    </table>
    <div class="mt-16"><button class="btn btn-outline" onclick="closeModalDirect()">Tutup</button></div>`);
}

// ── OVERTIME ──────────────────────────────────────────────────
async function renderOvertime(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>⏰ Overtime</span><button class="btn btn-primary btn-sm" onclick="modalOvertime()">+ Pengajuan</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Tanggal</th><th>Jam</th><th>Durasi</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblOT"></tbody></table></div></div>`;const snap=await (!hasAccess(3)?db.collection('hrd_overtime').where('userId','==',currentUser.id).get():db.collection('hrd_overtime').get());let h='';if(snap.empty)h='<tr><td colspan="6" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();const badge=p.status==='approved'?'badge-success':p.status==='rejected'?'badge-danger':'badge-warning';h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${formatDate(p.tanggal)}</td><td>${p.jamMulai||'-'}-${p.jamSelesai||'-'}</td><td>${p.durasi||0}j</td><td><span class="badge ${badge}">${p.status}</span></td><td>${p.status==='pending'&&hasAccess(3)?`<button class="btn btn-xs btn-success" onclick="approveOT('${d.id}','approved')">✅</button> <button class="btn btn-xs btn-danger" onclick="approveOT('${d.id}','rejected')">❌</button>`:''} ${hasAccess(6)?`<button class="btn btn-xs btn-warning" onclick="editOTDoc('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_overtime','${d.id}','overtime')">🗑️</button>`:''}</td></tr>`;});document.getElementById('tblOT').innerHTML=h;}
function modalOvertime(){openModal(`<div class="modal-title">Pengajuan Overtime</div><div class="form-group"><label>Nama</label><input class="form-control" id="otNama" value="${currentUser.nama}"></div><div class="grid-3"><div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="otTgl" value="${todayStr()}"></div><div class="form-group"><label>Mulai</label><input class="form-control" type="time" id="otStart"></div><div class="form-group"><label>Selesai</label><input class="form-control" type="time" id="otEnd"></div></div><div class="form-group"><label>Alasan</label><textarea class="form-control" id="otAlasan"></textarea></div><button class="btn btn-primary" onclick="simpanOvertime()">Ajukan</button>`);}
async function simpanOvertime(){const s=document.getElementById('otStart').value,e=document.getElementById('otEnd').value;const durasi=s&&e?Math.max(0,((new Date('2000-01-01T'+e)-new Date('2000-01-01T'+s))/3600000)).toFixed(1):0;await db.collection('hrd_overtime').add({nama:document.getElementById('otNama').value,tanggal:document.getElementById('otTgl').value,jamMulai:s,jamSelesai:e,durasi:parseFloat(durasi),alasan:document.getElementById('otAlasan').value,status:'pending',userId:currentUser.id,createdAt:new Date().toISOString()});closeModalDirect();toast('Diajukan','success');renderOvertime();}
async function approveOT(id,status){await db.collection('hrd_overtime').doc(id).update({status,approvedBy:currentUser.nama});toast('Updated','success');renderOvertime();}

// ── HARI LIBUR ────────────────────────────────────────────────

// Indonesian National Holidays 2025
const HARI_LIBUR_NASIONAL_2025 = [
  { tanggal: '2025-01-01', nama: 'Tahun Baru Masehi', tipe: 'nasional' },
  { tanggal: '2025-01-27', nama: 'Isra Mi\'raj Nabi Muhammad SAW', tipe: 'nasional' },
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
  { tanggal: '2025-12-26', nama: 'Cuti Bersama Natal', tipe: 'cuti_bersama' }
];

const HARI_LIBUR_NASIONAL_2026 = [
  { tanggal: '2026-01-01', nama: 'Tahun Baru Masehi', tipe: 'nasional' },
  { tanggal: '2026-01-16', nama: 'Isra Mi\'raj Nabi Muhammad SAW', tipe: 'nasional' },
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
  { tanggal: '2026-06-17', nama: 'Tahun Baru Islam 1448 H', tipe: 'nasional' },
  { tanggal: '2026-08-17', nama: 'Hari Kemerdekaan RI', tipe: 'nasional' },
  { tanggal: '2026-08-26', nama: 'Maulid Nabi Muhammad SAW', tipe: 'nasional' },
  { tanggal: '2026-12-24', nama: 'Cuti Bersama Natal', tipe: 'cuti_bersama' },
  { tanggal: '2026-12-25', nama: 'Hari Natal', tipe: 'nasional' },
  { tanggal: '2026-12-31', nama: 'Cuti Bersama Tahun Baru', tipe: 'cuti_bersama' }
];

let hariLiburCalendarMonth = null;
let hariLiburViewMode = 'kalender'; // 'kalender' or 'daftar'

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
        <div class="tab ${hariLiburViewMode==='kalender'?'active':''}" onclick="switchHariLiburView('kalender')">📅 Kalender</div>
        <div class="tab ${hariLiburViewMode==='daftar'?'active':''}" onclick="switchHariLiburView('daftar')">📋 Daftar</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px">
          <button class="btn btn-sm btn-outline" onclick="hariLiburPrevMonth()">&lt;</button>
          <span class="fw-700 color-primary" id="hariLiburMonthLabel" style="min-width:140px;text-align:center"></span>
          <button class="btn btn-sm btn-outline" onclick="hariLiburNextMonth()">&gt;</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${hasAccess(6)?'<button class="btn btn-info btn-sm" onclick="syncHariLiburNasional()">🔄 Sinkron Nasional</button>':''}
          ${hasAccess(6)?'<button class="btn btn-primary btn-sm" onclick="modalHariLibur()">+ Tambah Custom</button>':''}
        </div>
      </div>
      <div id="hariLiburContent"></div>
    </div>`;
  await loadHariLiburView();
  checkHariLiburReminders();
}

function switchHariLiburView(mode) {
  hariLiburViewMode = mode;
  renderHariLibur();
}

function hariLiburPrevMonth() {
  hariLiburCalendarMonth.month--;
  if (hariLiburCalendarMonth.month < 0) { hariLiburCalendarMonth.month = 11; hariLiburCalendarMonth.year--; }
  loadHariLiburView();
}

function hariLiburNextMonth() {
  hariLiburCalendarMonth.month++;
  if (hariLiburCalendarMonth.month > 11) { hariLiburCalendarMonth.month = 0; hariLiburCalendarMonth.year++; }
  loadHariLiburView();
}

async function loadHariLiburView() {
  const y = hariLiburCalendarMonth.year;
  const m = hariLiburCalendarMonth.month;
  const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const label = document.getElementById('hariLiburMonthLabel');
  if (label) label.textContent = `${monthNames[m]} ${y}`;

  // Load holidays from Firestore
  const startDate = `${y}-${String(m+1).padStart(2,'0')}-01`;
  const endDate = `${y}-${String(m+1).padStart(2,'0')}-${String(new Date(y, m+1, 0).getDate()).padStart(2,'0')}`;
  const snap = await db.collection('hrd_hari_libur').where('tanggal','>=',startDate).where('tanggal','<=',endDate).get();
  const holidays = [];
  snap.forEach(d => holidays.push({ id: d.id, ...d.data() }));

  // Load user reminders for this month
  try {
    const reminderSnap = await db.collection('hrd_hari_libur_reminders').where('userId','==',currentUser.id).get();
    window._hariLiburUserReminders = [];
    reminderSnap.forEach(d => window._hariLiburUserReminders.push({id:d.id,...d.data()}));
  } catch(e) { window._hariLiburUserReminders = []; }

  const container = document.getElementById('hariLiburContent');
  if (!container) return;

  if (hariLiburViewMode === 'kalender') {
    renderHariLiburCalendar(container, y, m, holidays);
  } else {
    renderHariLiburList(container, y, m, holidays);
  }
}

function renderHariLiburCalendar(container, year, month, holidays) {
  const today = new Date();
  const todayStr2 = today.toISOString().split('T')[0];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  // Monday = 0, Sunday = 6
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;

  const holidayMap = {};
  holidays.forEach(h => {
    const day = parseInt(h.tanggal.split('-')[2]);
    if (!holidayMap[day]) holidayMap[day] = [];
    holidayMap[day].push(h);
  });

  let html = `<style>
    .hl-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-top:8px}
    .hl-cal-header{padding:8px 4px;text-align:center;font-size:.75rem;font-weight:700;color:var(--primary);background:#f0f4ff;border-radius:4px}
    .hl-cal-cell{min-height:70px;padding:4px 6px;border-radius:6px;border:1.5px solid transparent;position:relative;cursor:default;transition:all .15s}
    .hl-cal-cell:hover{box-shadow:0 2px 8px rgba(0,0,0,.1)}
    .hl-cal-cell.hl-empty{background:transparent;border:none;min-height:auto}
    .hl-cal-cell.hl-weekend{background:#f5f5f5;color:#999}
    .hl-cal-cell.hl-holiday{background:#ffebee;border-color:#ef5350}
    .hl-cal-cell.hl-cuti-bersama{background:#fff3e0;border-color:#ff9800}
    .hl-cal-cell.hl-today{border-color:#1565c0;box-shadow:0 0 0 2px rgba(21,101,192,.3)}
    .hl-cal-day{font-size:.85rem;font-weight:700}
    .hl-cal-cell.hl-holiday .hl-cal-day{color:#c62828}
    .hl-cal-cell.hl-cuti-bersama .hl-cal-day{color:#e65100}
    .hl-cal-cell.hl-today .hl-cal-day{color:#1565c0}
    .hl-cal-name{font-size:.6rem;color:#c62828;margin-top:2px;line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .hl-cal-cell.hl-cuti-bersama .hl-cal-name{color:#e65100}
  </style>
  <div class="hl-calendar">
    <div class="hl-cal-header">Sen</div>
    <div class="hl-cal-header">Sel</div>
    <div class="hl-cal-header">Rab</div>
    <div class="hl-cal-header">Kam</div>
    <div class="hl-cal-header">Jum</div>
    <div class="hl-cal-header" style="color:var(--text-light)">Sab</div>
    <div class="hl-cal-header" style="color:var(--danger)">Min</div>`;

  // Empty cells for days before month start
  for (let i = 0; i < startDayOfWeek; i++) {
    html += '<div class="hl-cal-cell hl-empty"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayOfWeek = (startDayOfWeek + day - 1) % 7; // 0=Mon, 5=Sat, 6=Sun
    const isWeekend = dayOfWeek >= 5;
    const isToday = dateStr === todayStr2;
    const dayHolidays = holidayMap[day] || [];
    const hasHoliday = dayHolidays.some(h => h.tipe === 'nasional' || h.tipe === 'perusahaan');
    const hasCutiBersama = dayHolidays.some(h => h.tipe === 'cuti_bersama');

    let classes = 'hl-cal-cell';
    if (hasHoliday) classes += ' hl-holiday';
    else if (hasCutiBersama) classes += ' hl-cuti-bersama';
    else if (isWeekend) classes += ' hl-weekend';
    if (isToday) classes += ' hl-today';

    const title = dayHolidays.map(h => h.nama).join(', ');
    html += `<div class="${classes}" title="${escHtml(title)}">`;
    html += `<div class="hl-cal-day">${day}</div>`;
    if (dayHolidays.length > 0) {
      html += `<div class="hl-cal-name">${escHtml(dayHolidays[0].nama)}</div>`;
      const hasReminder = dayHolidays.some(dh=>(window._hariLiburUserReminders||[]).some(r=>r.holidayId===dh.id));
      if(hasReminder) html += '<div style="position:absolute;top:2px;right:4px;font-size:.6rem">🔔</div>';
    }
    html += '</div>';
  }

  html += '</div>';

  // Legend
  html += `<div style="margin-top:16px;display:flex;gap:16px;flex-wrap:wrap;align-items:center">
    <span class="text-xs"><span style="display:inline-block;width:14px;height:14px;background:#ffebee;border:1.5px solid #ef5350;border-radius:3px;vertical-align:middle"></span> Hari Libur</span>
    <span class="text-xs"><span style="display:inline-block;width:14px;height:14px;background:#fff3e0;border:1.5px solid #ff9800;border-radius:3px;vertical-align:middle"></span> Cuti Bersama</span>
    <span class="text-xs"><span style="display:inline-block;width:14px;height:14px;background:#f5f5f5;border:1.5px solid #ddd;border-radius:3px;vertical-align:middle"></span> Weekend</span>
    <span class="text-xs"><span style="display:inline-block;width:14px;height:14px;background:#fff;border:2px solid #1565c0;border-radius:3px;vertical-align:middle"></span> Hari Ini</span>
  </div>`;

  container.innerHTML = html;
}

function renderHariLiburList(container, year, month, holidays) {
  let html = '<div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Nama</th><th>Tipe</th><th>Catatan</th><th style="min-width:140px">Aksi</th></tr></thead><tbody>';
  if (!holidays.length) {
    html += '<tr><td colspan="5" class="text-center">Tidak ada hari libur bulan ini</td></tr>';
  } else {
    holidays.forEach(h => {
      const tipeBadge = h.tipe === 'nasional' ? 'badge-danger' : h.tipe === 'cuti_bersama' ? 'badge-warning' : 'badge-info';
      const tipeLabel = h.tipe === 'nasional' ? 'Nasional' : h.tipe === 'cuti_bersama' ? 'Cuti Bersama' : 'Perusahaan';
      const hasReminder = (window._hariLiburUserReminders||[]).some(r=>r.holidayId===h.id);
      html += `<tr>
        <td>${formatDate(h.tanggal)}</td>
        <td class="fw-700">${escHtml(h.nama)}</td>
        <td><span class="badge ${tipeBadge}">${tipeLabel}</span></td>
        <td class="text-sm">${escHtml(h.noted||h.catatan||'-')}</td>
        <td>
          <button class="btn btn-xs btn-info" onclick="editHariLiburNoted('${h.id}')" title="Edit Catatan">✏️</button>
          <button class="btn btn-xs btn-${hasReminder?'warning':'outline'}" onclick="setHariLiburReminder('${h.id}','${h.tanggal}','${escHtml(h.nama).replace(/'/g,"\\'")}')" title="Set Reminder">${hasReminder?'🔔':'🔕'}</button>
          <button class="btn btn-xs btn-danger" onclick="hapusHariLibur('${h.id}')">🗑️</button>
        </td>
      </tr>`;
    });
  }
  html += '</tbody></table></div>';
  container.innerHTML = html;
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
    tanggal, nama, tipe, tahun, createdAt: new Date().toISOString()
  });
  closeModalDirect();
  toast('Hari libur ditambahkan', 'success');
  loadHariLiburView();
}

async function editHariLiburNoted(id) {
  const doc = await db.collection('hrd_hari_libur').doc(id).get();
  if (!doc.exists) return toast('Data tidak ditemukan', 'warning');
  const p = doc.data();
  openModal(`<div class="modal-title">Edit Catatan Hari Libur</div>
    <div class="form-group"><label>Nama</label><input class="form-control" value="${escHtml(p.nama||'')}" disabled></div>
    <div class="form-group"><label>Catatan</label><textarea class="form-control" id="hlNotedText" style="min-height:80px">${escHtml(p.noted||p.catatan||'')}</textarea></div>
    <button class="btn btn-primary" onclick="simpanHariLiburNoted('${id}')">Simpan</button>`);
}

async function simpanHariLiburNoted(id) {
  const noted = document.getElementById('hlNotedText').value;
  await db.collection('hrd_hari_libur').doc(id).update({ noted });
  closeModalDirect();
  toast('Catatan disimpan', 'success');
  loadHariLiburView();
}

function setHariLiburReminder(id, tanggal, nama) {
  const existing = (window._hariLiburUserReminders||[]).find(r=>r.holidayId===id);
  openModal(`<div class="modal-title">🔔 Set Reminder</div>
    <p class="text-sm mb-16">Hari libur: <b>${nama}</b> (${formatDate(tanggal)})</p>
    <div class="form-group"><label>Ingatkan</label>
      <select class="form-control" id="hlReminderOpt" onchange="document.getElementById('hlReminderCustomWrap').style.display=this.value==='custom'?'block':'none'">
        <option value="1">1 hari sebelumnya</option>
        <option value="3">3 hari sebelumnya</option>
        <option value="7">1 minggu sebelumnya</option>
        <option value="custom">Tanggal custom</option>
      </select>
    </div>
    <div class="form-group" id="hlReminderCustomWrap" style="display:none"><label>Tanggal Reminder</label><input class="form-control" type="date" id="hlReminderCustomDate"></div>
    ${existing?'<p class="text-xs mb-8" style="color:var(--warning)">Reminder sudah ada. Simpan akan mengganti yang lama.</p>':''}
    <div class="flex gap-8">
      <button class="btn btn-primary" onclick="simpanHariLiburReminder('${id}','${tanggal}','${nama.replace(/'/g,"\\'")}')">Simpan</button>
      ${existing?`<button class="btn btn-danger" onclick="hapusHariLiburReminder('${existing.id}')">Hapus Reminder</button>`:''}
    </div>`);
}

async function simpanHariLiburReminder(holidayId, tanggal, holidayNama) {
  const opt = document.getElementById('hlReminderOpt').value;
  let reminderDate;
  if (opt === 'custom') {
    reminderDate = document.getElementById('hlReminderCustomDate').value;
    if (!reminderDate) return toast('Pilih tanggal reminder', 'warning');
  } else {
    const d = new Date(tanggal + 'T00:00:00');
    d.setDate(d.getDate() - parseInt(opt));
    reminderDate = d.toISOString().split('T')[0];
  }
  // Remove existing reminder for same holiday
  const existing = (window._hariLiburUserReminders||[]).find(r=>r.holidayId===holidayId);
  if (existing) await db.collection('hrd_hari_libur_reminders').doc(existing.id).delete();
  await db.collection('hrd_hari_libur_reminders').add({
    holidayId, holidayNama, userId: currentUser.id, reminderDate, createdAt: new Date().toISOString()
  });
  closeModalDirect();
  toast('Reminder disimpan', 'success');
  loadHariLiburView();
}

async function hapusHariLiburReminder(reminderId) {
  await db.collection('hrd_hari_libur_reminders').doc(reminderId).delete();
  closeModalDirect();
  toast('Reminder dihapus', 'success');
  loadHariLiburView();
}

async function checkHariLiburReminders() {
  try {
    const today = todayStr();
    const snap = await db.collection('hrd_hari_libur_reminders').where('userId','==',currentUser.id).where('reminderDate','<=',today).get();
    for (const d of snap.docs) {
      const r = d.data();
      toast(`🔔 Reminder: ${r.holidayNama} segera tiba!`, 'info');
      await db.collection('hrd_hari_libur_reminders').doc(d.id).delete();
    }
  } catch(e) { /* ignore */ }
}

async function syncHariLiburNasional() {
  const year = hariLiburCalendarMonth.year;
  let dataToSync = [];
  if (year === 2025) dataToSync = HARI_LIBUR_NASIONAL_2025;
  else if (year === 2026) dataToSync = HARI_LIBUR_NASIONAL_2026;
  else { toast(`Data hari libur nasional tahun ${year} belum tersedia. Tersedia: 2025, 2026`, 'warning'); return; }

  if (!confirm(`Sinkronisasi ${dataToSync.length} hari libur nasional tahun ${year}? Data yang sudah ada (nasional/cuti_bersama) akan diperbarui.`)) return;

  toast('Memproses sinkronisasi...', 'info');

  // Delete ALL existing national/cuti_bersama holidays for this year (by date range)
  const startYear=`${year}-01-01`,endYear=`${year}-12-31`;
  const existingSnap = await db.collection('hrd_hari_libur').get();
  const batch1 = [];
  existingSnap.forEach(d => {
    const data=d.data();
    const tgl=data.tanggal||'';
    const tipe=data.tipe||'';
    if(tgl>=startYear&&tgl<=endYear&&(tipe==='nasional'||tipe==='cuti_bersama'))batch1.push(d.ref.delete());
  });
  await Promise.all(batch1);

  // Add all national holidays
  const batch2 = [];
  dataToSync.forEach(h => {
    batch2.push(db.collection('hrd_hari_libur').add({
      tanggal: h.tanggal,
      nama: h.nama,
      tipe: h.tipe,
      tahun: year,
      createdAt: new Date().toISOString()
    }));
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

  const existingSnap = await db.collection('hrd_hari_libur').where('tahun','==',year).where('tipe','in',['nasional','cuti_bersama']).limit(1).get();
  if (!existingSnap.empty) return; // Already populated

  const batch = [];
  dataToSync.forEach(h => {
    batch.push(db.collection('hrd_hari_libur').add({
      tanggal: h.tanggal,
      nama: h.nama,
      tipe: h.tipe,
      tahun: year,
      createdAt: new Date().toISOString()
    }));
  });
  await Promise.all(batch);
}

// Check if a given date is a holiday - returns holiday info or null
async function checkHoliday(dateStr) {
  const snap = await db.collection('hrd_hari_libur').where('tanggal','==',dateStr).limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].data();
}

// ── PENALTY ───────────────────────────────────────────────────
async function renderPenalty(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>⚠️ Penalty Point</span><button class="btn btn-primary btn-sm" onclick="modalPenalty()">+ Tambah</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Tanggal</th><th>Jenis</th><th>Poin</th><th>Aksi</th></tr></thead><tbody id="tblPenalty"></tbody></table></div></div>`;const snap=await db.collection('hrd_penalty').get();let h='';if(snap.empty)h='<tr><td colspan="5" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${formatDate(p.tanggal)}</td><td>${escHtml(p.jenis)}</td><td><span class="badge badge-danger">${p.poin}</span></td><td><button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_penalty','${d.id}','penalty')">🗑️</button></td></tr>`;});document.getElementById('tblPenalty').innerHTML=h;}
function modalPenalty(){openModal(`<div class="modal-title">Tambah Penalty</div><div class="grid-2"><div class="form-group"><label>Karyawan</label><input class="form-control" id="penNama"></div><div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="penTgl" value="${todayStr()}"></div></div><div class="grid-2"><div class="form-group"><label>Jenis</label><select class="form-control" id="penJenis"><option>Terlambat</option><option>Mangkir</option><option>SP I</option><option>SP II</option><option>SP III</option></select></div><div class="form-group"><label>Poin</label><input class="form-control" type="number" id="penPoin" value="1"></div></div><button class="btn btn-primary" onclick="simpanPenalty()">Simpan</button>`);}
async function simpanPenalty(){const data={nama:document.getElementById('penNama').value,tanggal:document.getElementById('penTgl').value,jenis:document.getElementById('penJenis').value,poin:parseInt(document.getElementById('penPoin').value)||1,createdAt:new Date().toISOString()};if(!data.nama)return toast('Nama wajib','warning');await db.collection('hrd_penalty').add(data);closeModalDirect();toast('Ditambahkan','success');renderPenalty();}

