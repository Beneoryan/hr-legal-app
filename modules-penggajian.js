'use strict';
// ── PENGGAJIAN ────────────────────────────────────────────────
async function renderPenggajian(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>💰 Penggajian</span><div class="flex gap-8"><button class="btn btn-primary btn-sm" onclick="modalGaji()">+ Generate Slip</button><button class="btn btn-success btn-sm" onclick="generateAllGaji()">⚡ Generate Semua</button><button class="btn btn-secondary btn-sm" onclick="modalImportPenggajian()">⬇️ Import</button></div></div><div class="card"><div class="flex gap-8 mb-16 flex-wrap"><input class="form-control" type="month" id="filterBulanGaji" value="${monthStr()}" onchange="loadGaji()" style="max-width:160px"><input class="form-control" placeholder="🔍 Cari nama..." id="filterNamaGaji" oninput="filterGajiTable()" style="max-width:180px"><select class="form-control" id="filterDeptGaji" onchange="filterGajiTable()" style="max-width:160px"><option value="">Semua Dept</option></select><select class="form-control" id="filterGajiRange" onchange="filterGajiTable()" style="max-width:160px"><option value="">Semua Gaji</option><option value="0-3000000">&lt; 3 Juta</option><option value="3000000-5000000">3-5 Juta</option><option value="5000000-10000000">5-10 Juta</option><option value="10000000-99999999">&gt; 10 Juta</option></select><button class="btn btn-sm btn-info" onclick="loadGaji()">🔍</button></div><div id="gajiSummary" class="stats-grid mb-16"></div><div class="flex gap-8 mb-8"><label style="font-size:.78rem;display:flex;align-items:center;gap:4px"><input type="checkbox" id="selectAllGaji" onchange="toggleSelectAllGaji()"> Pilih Semua</label><button class="btn btn-xs btn-danger" onclick="hapusSelectedGaji()">🗑️ Hapus Terpilih</button><button class="btn btn-xs btn-danger" onclick="hapusSemuaGaji()">🗑️ Hapus Semua</button></div><div class="table-wrap"><table><thead><tr><th style="width:30px"><input type="checkbox" id="selectAllGajiHead" onchange="toggleSelectAllGaji()"></th><th>Karyawan</th><th>Gaji Pokok</th><th>Tunjangan</th><th>Insentif</th><th>Reimburse</th><th>Lembur</th><th>Potongan</th><th>Loan</th><th>PPH21</th><th>THP</th><th>Aksi</th></tr></thead><tbody id="tblGaji"></tbody></table></div></div>`;loadGaji();}
async function loadGaji(){const bulan=document.getElementById('filterBulanGaji')?.value||monthStr();const allSnap=await db.collection('hrd_penggajian').get();window._gajiData=[];allSnap.forEach(d=>{const data=d.data();if(data.periode===bulan)window._gajiData.push({id:d.id,...data});});
  // Populate dept filter from karyawan data
  const kSnap=await db.collection('hrd_karyawan').get();const depts=new Set();const karyDeptMap={};kSnap.forEach(d=>{const k=d.data();depts.add(k.departemen||'');karyDeptMap[(k.nama||'').toLowerCase()]=k.departemen||'';});
  window._gajiData.forEach(g=>{g._dept=karyDeptMap[(g.nama||'').toLowerCase()]||'';});
  const sel=document.getElementById('filterDeptGaji');if(sel){let opts='<option value="">Semua Dept</option>';depts.forEach(d=>{if(d)opts+=`<option>${escHtml(d)}</option>`;});sel.innerHTML=opts;}
  filterGajiTable();}

function filterGajiTable(){
  const q=(document.getElementById('filterNamaGaji')?.value||'').toLowerCase();
  const dept=document.getElementById('filterDeptGaji')?.value||'';
  const range=document.getElementById('filterGajiRange')?.value||'';
  let filtered=(window._gajiData||[]).filter(p=>{
    if(q&&!(p.nama||'').toLowerCase().includes(q))return false;
    if(dept&&p._dept!==dept)return false;
    if(range){const[min,max]=range.split('-').map(Number);const gaji=p.gajiPokok||0;if(gaji<min||gaji>=max)return false;}
    return true;
  });
  let h='',totBruto=0,totNet=0,totPPH=0,count=0;
  if(!filtered.length)h='<tr><td colspan="12" class="text-center">Tidak ada data</td></tr>';
  else filtered.forEach(p=>{totBruto+=p.gajiPokok||0;totNet+=p.totalBersih||0;totPPH+=p.pph21||0;count++;h+=`<tr><td><input type="checkbox" class="gaji-cb" value="${p.id}"></td><td class="fw-700">${escHtml(p.nama)}</td><td>${formatCurrency(p.gajiPokok)}</td><td>${formatCurrency(p.tunjangan)}</td><td>${formatCurrency(p.insentif||0)}</td><td>${formatCurrency(p.reimbursement||0)}</td><td>${formatCurrency(p.lembur||0)}</td><td>${formatCurrency(p.potongan)}</td><td>${formatCurrency(p.kasbon||0)}</td><td>${formatCurrency(p.pph21)}</td><td class="fw-700">${formatCurrency(p.totalBersih)}</td><td><button class="btn btn-xs btn-info" onclick="lihatSlip('${p.id}')">📄</button> <button class="btn btn-xs btn-warning" onclick="editGaji('${p.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_penggajian','${p.id}','penggajian')">🗑️</button></td></tr>`;});
  document.getElementById('tblGaji').innerHTML=h;
  document.getElementById('gajiSummary').innerHTML=`<div class="stat-card"><div class="stat-value">${count}</div><div class="stat-label">Karyawan</div></div><div class="stat-card"><div class="stat-value">${formatCurrency(totBruto)}</div><div class="stat-label">Total Gaji Pokok</div></div><div class="stat-card"><div class="stat-value">${formatCurrency(totNet)}</div><div class="stat-label">Total THP</div></div><div class="stat-card"><div class="stat-value">${formatCurrency(totPPH)}</div><div class="stat-label">Total PPH21</div></div>`;
}

function toggleSelectAllGaji(){const checked=document.getElementById('selectAllGaji')?.checked||document.getElementById('selectAllGajiHead')?.checked;document.querySelectorAll('.gaji-cb').forEach(cb=>cb.checked=checked);document.getElementById('selectAllGaji').checked=checked;document.getElementById('selectAllGajiHead').checked=checked;}

async function hapusSelectedGaji(){const ids=[];document.querySelectorAll('.gaji-cb:checked').forEach(cb=>ids.push(cb.value));if(!ids.length)return toast('Pilih slip yang ingin dihapus','warning');if(!confirm(`Hapus ${ids.length} slip gaji terpilih?`))return;for(const id of ids){await db.collection('hrd_penggajian').doc(id).delete();}toast(`${ids.length} slip dihapus`,'success');loadGaji();}

async function hapusSemuaGaji(){if(!confirm('⚠️ HAPUS SEMUA slip gaji periode ini?'))return;if(!confirm('Konfirmasi: Yakin hapus SEMUA?'))return;const bulan=document.getElementById('filterBulanGaji')?.value||monthStr();const snap=await db.collection('hrd_penggajian').where('periode','==',bulan).get();const batch=db.batch();snap.forEach(d=>batch.delete(d.ref));await batch.commit();toast(`${snap.size} slip dihapus`,'success');loadGaji();}

async function generateAllGaji(){
  openModal(`<div class="modal-title">⚡ Generate Slip Gaji Semua Karyawan</div>
    <p class="text-sm mb-16" style="color:#666">Perhitungan: Tgl 20 bulan lalu s/d Tgl 20 bulan ini. Terintegrasi dengan kehadiran & lembur.</p>
    <div class="fw-700 text-sm mb-8">Komponen yang disertakan:</div>
    <div style="background:#f8f9ff;padding:12px;border-radius:8px;margin-bottom:16px">
      <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:.85rem"><input type="checkbox" id="genIncTunjCuti"> Tunjangan Cuti (1/12 gaji pokok)</label>
      <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:.85rem"><input type="checkbox" id="genIncBPJSKes" checked> BPJS Kesehatan (1% karyawan)</label>
      <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:.85rem"><input type="checkbox" id="genIncBPJSTK" checked> BPJS TK/JHT (2% karyawan)</label>
      <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:.85rem"><input type="checkbox" id="genIncPPH" checked> PPH 21 (progresif UU HPP)</label>
    </div>
    <button class="btn btn-success" onclick="doGenerateAllGaji()">⚡ Generate Sekarang</button>`);
}
async function doGenerateAllGaji(){
  const incTunjCuti=document.getElementById('genIncTunjCuti')?.checked||false;
  const incBPJSKes=document.getElementById('genIncBPJSKes')?.checked||false;
  const incBPJSTK=document.getElementById('genIncBPJSTK')?.checked||false;
  const incPPH=document.getElementById('genIncPPH')?.checked||false;
  closeModalDirect();
  if(!confirm('Konfirmasi: Generate slip gaji untuk semua karyawan aktif?'))return;
  try{
  console.log('[PAYROLL] Starting generate for period:', document.getElementById('filterBulanGaji')?.value||monthStr());
  const bulan=document.getElementById('filterBulanGaji')?.value||monthStr();
  const[year,month]=bulan.split('-').map(Number);
  // Periode gaji: tgl 20 bulan lalu s/d tgl 20 bulan ini
  const prevMonth=month===1?12:month-1;
  const prevYear=month===1?year-1:year;
  const periodeStart=`${prevYear}-${String(prevMonth).padStart(2,'0')}-20`;
  const periodeEnd=`${year}-${String(month).padStart(2,'0')}-20`;

  const kSnapAll=await db.collection('hrd_karyawan').get();
  const kDocs=[];kSnapAll.forEach(d=>{const data=d.data();if(data.status==='aktif')kDocs.push({id:d.id,data:()=>data,ref:d.ref});});
  const kSnap={empty:kDocs.length===0,docs:kDocs,size:kDocs.length};
  if(kSnap.empty){toast('Tidak ada karyawan aktif','warning');return;}
  // Delete existing slips for this period
  const existSnapAll=await db.collection('hrd_penggajian').get();
  const toDelete=[];existSnapAll.forEach(d=>{if(d.data().periode===bulan)toDelete.push(d.ref);});
  if(toDelete.length>0){for(const ref of toDelete){await ref.delete();}}
  // Load all related data (using simple queries + client-side filtering to avoid composite index requirements)
  const[absenSnap,reimbSnap,kasbonSnap,tunjSnap,kpiSnap,insentifSnap,cutiSnap,overtimeSnap,dinasLuarSnap,usersSnap]=await Promise.all([
    db.collection('hrd_absensi').get(),
    db.collection('hrd_reimbursement').get(),
    db.collection('hrd_kasbon').get(),
    db.collection('hrd_tunjangan').get(),
    db.collection('hrd_kpi').get(),
    db.collection('hrd_insentif').get(),
    db.collection('hrd_cuti').get(),
    db.collection('hrd_overtime').get(),
    db.collection('hrd_dinas_luar').get().catch(()=>({forEach:()=>{}})),
    db.collection('hrd_users').get()
  ]);
  // Build userId -> nama map from hrd_users for cross-referencing overtime
  const userNamaMap={};
  usersSnap.forEach(d=>{const u=d.data();userNamaMap[d.id]=(u.nama||'').trim().toLowerCase();});
  // Build attendance map: userId -> {hadir, izin, cuti, lembur_jam}
  const absenMap={};
  absenSnap.forEach(d=>{const p=d.data();if(p.tanggal<periodeStart||p.tanggal>periodeEnd)return;const uid=p.userId;if(!absenMap[uid])absenMap[uid]={hadir:0,lembur:0};if(p.tipe==='masuk')absenMap[uid].hadir++;if(p.tipe==='pulang'&&p.lembur&&p.lemburJam)absenMap[uid].lembur+=p.lemburJam;});
  // Cuti map: userId -> jumlah hari cuti dalam periode
  const cutiMap={};
  cutiSnap.forEach(d=>{const c=d.data();if(c.status!=='approved')return;const uid=c.userId;if(!uid)return;const start=new Date(c.mulai);const end=new Date(c.selesai);let days=0;for(let dt=new Date(start);dt<=end;dt.setDate(dt.getDate()+1)){const ds=dt.toISOString().split('T')[0];if(ds>=periodeStart&&ds<=periodeEnd)days++;}if(!cutiMap[uid])cutiMap[uid]=0;cutiMap[uid]+=days;});
  // Overtime map: index by userId, overtime nama, AND hrd_users nama for reliable lookup
  const otMap={};
  overtimeSnap.forEach(d=>{const o=d.data();if(o.status!=='approved')return;if(o.tanggal>=periodeStart&&o.tanggal<=periodeEnd){
    const uid=o.userId||'';
    const nama=(o.nama||'').trim().toLowerCase();
    const userNama=uid?userNamaMap[uid]||'':'';
    const dur=typeof o.durasi==='number'?o.durasi:(typeof o.durasi==='string'?parseFloat(o.durasi.replace(/[^0-9.]/g,''))||0:parseFloat(o.durasi)||0);
    if(uid){if(!otMap[uid])otMap[uid]=0;otMap[uid]+=dur;}
    if(nama){if(!otMap[nama])otMap[nama]=0;otMap[nama]+=dur;}
    if(userNama&&userNama!==nama){if(!otMap[userNama])otMap[userNama]=0;otMap[userNama]+=dur;}
  }});
  console.log('[PAYROLL DEBUG] otMap keys:', Object.keys(otMap), 'values:', otMap);
  console.log('[PAYROLL DEBUG] Periode:', periodeStart, '->', periodeEnd);
  // Dinas luar map: userId -> jumlah hari dinas dalam periode
  const dinasMap={};
  dinasLuarSnap.forEach(d=>{const dl=d.data();if(dl.status!=='approved')return;const uid=dl.userId||dl.nama;const startD=dl.tanggalMulai||dl.tanggal;const endD=dl.tanggalSelesai||dl.tanggal;if(!startD)return;let days=0;const endTime=new Date(endD||startD).getTime();let maxIter=366;for(let dt=new Date(startD);dt.getTime()<=endTime;dt.setDate(dt.getDate()+1)){if(--maxIter<0)break;const ds=dt.toISOString().split('T')[0];if(ds>=periodeStart&&ds<=periodeEnd)days++;}if(!dinasMap[uid])dinasMap[uid]=0;dinasMap[uid]+=days;});
  // Build other maps
  const reimbMap={},kasbonMap={},kpiMap={},insentifMap={};
  reimbSnap.forEach(d=>{const r=d.data();if(r.status!=='approved')return;const n=(r.nama||'').toLowerCase();reimbMap[n]=(reimbMap[n]||0)+(r.jumlah||0);});
  kasbonSnap.forEach(d=>{const r=d.data();if(r.status==='aktif'){const n=(r.nama||'').toLowerCase();const angsuran=Math.ceil((r.jumlah||0)/(r.cicilan||1));kasbonMap[n]=(kasbonMap[n]||0)+angsuran;}});
  kpiSnap.forEach(d=>{const r=d.data();const n=(r.nama||'').toLowerCase();if(!kpiMap[n]||r.skor>kpiMap[n])kpiMap[n]=r.skor||0;});
  insentifSnap.forEach(d=>{const r=d.data();const n=(r.nama||'').toLowerCase();insentifMap[n]=(insentifMap[n]||0)+(r.nominal||0);});
  const tunjList=[];tunjSnap.forEach(d=>tunjList.push(d.data()));

  // Hitung hari kerja dalam periode (exclude weekend)
  let hariKerja=0;
  for(let dt=new Date(periodeStart);dt<=new Date(periodeEnd);dt.setDate(dt.getDate()+1)){
    const day=dt.getDay();if(day!==0&&day!==6)hariKerja++;
  }

  let count=0;
  for(const doc of kSnap.docs){
    const k=doc.data();const namaLow=(k.nama||'').trim().toLowerCase();const uid=doc.id;
    const gaji=k.gajiPokok||0;
    const gajiPerHari=Math.round(gaji/hariKerja);

    // Kehadiran
    const kehadiran=absenMap[uid]?.hadir||0;
    const cutiHari=cutiMap[uid]||0;
    const dinasHari=dinasMap[uid]||dinasMap[namaLow]||0;
    const hariEfektif=Math.min(kehadiran+cutiHari+dinasHari,hariKerja); // Cuti & dinas dihitung hadir
    const tidakHadir=Math.max(0,hariKerja-hariEfektif);
    const potonganAbsen=tidakHadir*gajiPerHari;

    // Lembur: 1.5x gaji per jam untuk 1 jam pertama, 2x setelahnya (UU Cipta Kerja)
    const autoLembur=absenMap[uid]?.lembur||0;
    const manualLembur=otMap[uid]||otMap[namaLow]||0;
    console.log(`[PAYROLL] ${k.nama} (uid:${uid}, namaLow:"${namaLow}"): autoLembur=${autoLembur}, manualLembur=${manualLembur}, otMap[namaLow]=${otMap[namaLow]}, otMap[uid]=${otMap[uid]}`);
    const lemburJam=autoLembur+manualLembur;
    const gajiPerJam=Math.round(gaji/(hariKerja*8)); // 8 jam per hari
    let lemburNominal=0;
    if(lemburJam>0){
      const jam1=Math.min(lemburJam,1);
      const jamSisa=Math.max(0,lemburJam-1);
      lemburNominal=Math.round(jam1*gajiPerJam*1.5+jamSisa*gajiPerJam*2);
    }

    // Tunjangan
    let tunj=0;tunjList.forEach(t=>{const p=(t.penerima||'Semua').toLowerCase();if(p==='semua'||p.includes(namaLow))tunj+=t.nominal||0;});
    // Tunjangan cuti TIDAK di-generate otomatis (dikelola manual di menu Tunjangan)
    const tunjCuti=incTunjCuti?Math.round(gaji/12):0;

    // Insentif
    const insentif=insentifMap[namaLow]||0;
    // Reimbursement & Loan
    const reimb=reimbMap[namaLow]||0;const loan=kasbonMap[namaLow]||0;
    // BPJS (sesuai ketentuan pemerintah) - conditional based on checkbox
    const bpjsKes=incBPJSKes?Math.round(gaji*0.01):0;
    const bpjsTK=incBPJSTK?Math.round(gaji*0.02):0;
    // PPH21 Progressive (UU HPP 2022) - conditional
    const bruto=gaji+tunj+tunjCuti+insentif+reimb+lemburNominal-potonganAbsen;
    let pph21=0;
    if(incPPH){
      const penghasilanNetto=Math.max(0,(gaji+tunj+tunjCuti-bpjsKes-bpjsTK)*12-54000000);
      let pphT=0;
      if(penghasilanNetto<=60000000)pphT=penghasilanNetto*0.05;
      else if(penghasilanNetto<=250000000)pphT=3000000+(penghasilanNetto-60000000)*0.15;
      else if(penghasilanNetto<=500000000)pphT=3000000+28500000+(penghasilanNetto-250000000)*0.25;
      else pphT=3000000+28500000+62500000+(penghasilanNetto-500000000)*0.30;
      pph21=Math.max(0,Math.round(pphT/12));
    }
    // THP
    const totalPotongan=bpjsKes+bpjsTK+loan+pph21+potonganAbsen;
    const thp=bruto-bpjsKes-bpjsTK-loan-pph21;

    await db.collection('hrd_penggajian').add({
      nama:k.nama,karyawanId:uid,periode:bulan,periodeStart,periodeEnd,
      gajiPokok:gaji,tunjangan:tunj,tunjCuti,insentif,bonus:0,
      reimbursement:reimb,lembur:lemburNominal,lemburJam,
      lemburDetail:{auto:autoLembur,manual:manualLembur,total:lemburJam},
      bpjsKesehatan:bpjsKes,bpjsTK,potongan:potonganAbsen,kasbon:loan,pph21,
      totalBersih:thp,
      // Detail kehadiran
      hariKerja,kehadiran,cutiHari,dinasHari,tidakHadir,
      kpiScore:kpiMap[namaLow]||0,
      createdAt:new Date().toISOString()
    });
    count++;
  }
  toast(`${count} slip gaji di-generate.\nPeriode: ${periodeStart} s/d ${periodeEnd}\nTerintegrasi: Kehadiran, Lembur, Cuti, PPH21 (UU HPP)`,'success');loadGaji();
  }catch(e){console.error('Generate gaji error:',e);toast('Error: '+e.message,'error');}
}
function modalGaji(){loadKaryawanDropdownGaji();}
async function loadKaryawanDropdownGaji(){
  const kSnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  let opts='<option value="">-- Pilih Karyawan --</option>';
  kSnap.forEach(d=>{const k=d.data();opts+=`<option value="${escHtml(k.nama)}">${escHtml(k.nama)} — ${escHtml(k.departemen||'')} (${escHtml(k.posisi||'')})</option>`;});
  openModal(`<div class="modal-title">Generate Slip Gaji</div><div class="grid-2"><div class="form-group"><label>Karyawan</label><select class="form-control" id="gjNama" onchange="autoFillGajiFromKaryawan()">${opts}</select></div><div class="form-group"><label>Periode</label><input class="form-control" type="month" id="gjPeriode" value="${monthStr()}"></div></div>
    <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:8px"><div class="fw-700 text-sm mb-8 color-primary">💰 Pendapatan</div><div class="grid-2"><div class="form-group"><label>Gaji Pokok</label><input class="form-control" type="number" id="gjPokok" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Tunj. Jabatan</label><input class="form-control" type="number" id="gjTunjJabatan" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Tunj. Transport</label><input class="form-control" type="number" id="gjTunjTransport" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Tunj. Makan</label><input class="form-control" type="number" id="gjTunjMakan" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Tunj. Komunikasi</label><input class="form-control" type="number" id="gjTunjKom" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Lembur</label><input class="form-control" type="number" id="gjLembur" value="0" oninput="hitungGaji()"></div></div></div>
    <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:8px"><div class="fw-700 text-sm mb-8" style="color:#ff6f00">🏆 Insentif & Bonus</div><div class="grid-2"><div class="form-group"><label>Insentif Kinerja (auto KPI)</label><input class="form-control" type="number" id="gjInsentif" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Bonus</label><input class="form-control" type="number" id="gjBonus" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Tunj. Lainnya (auto)</label><input class="form-control" type="number" id="gjTunjLain" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Reimbursement (auto)</label><input class="form-control" type="number" id="gjReimburse" value="0" oninput="hitungGaji()"></div></div></div>
    <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:8px"><div class="fw-700 text-sm mb-8 color-danger">📉 Potongan</div><div class="grid-2"><div class="form-group"><label>BPJS Kesehatan (1%)</label><input class="form-control" type="number" id="gjBPJSKes" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>BPJS TK (2%)</label><input class="form-control" type="number" id="gjBPJSTK" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Kasbon/Loan (auto)</label><input class="form-control" type="number" id="gjKasbon" value="0" oninput="hitungGaji()"></div><div class="form-group"><label>Potongan Lain</label><input class="form-control" type="number" id="gjPotongan" value="0" oninput="hitungGaji()"></div></div></div>
    <div style="border-top:2px solid var(--primary);padding-top:12px;margin-top:12px;background:#f8f9ff;padding:12px;border-radius:8px"><div class="grid-2"><div class="form-group"><label>Total Bruto</label><input class="form-control" id="gjBruto" readonly style="font-weight:700;background:#e8f5e9"></div><div class="form-group"><label>Total Potongan</label><input class="form-control" id="gjTotPot" readonly style="color:var(--danger);background:#ffebee"></div><div class="form-group"><label>PPH 21 (auto)</label><input class="form-control" id="gjPPH" readonly style="color:var(--danger);background:#ffebee"></div><div class="form-group"><label>Take Home Pay (THP)</label><input class="form-control" id="gjTotal" readonly style="font-weight:700;font-size:1rem;background:#e8f5e9"></div></div></div>
    <button class="btn btn-primary mt-16" onclick="simpanGaji()">💾 Simpan Slip</button>`,true);
}
function hitungGaji(){const pokok=Number(document.getElementById('gjPokok').value)||0;const tJabatan=Number(document.getElementById('gjTunjJabatan').value)||0;const tTransport=Number(document.getElementById('gjTunjTransport').value)||0;const tMakan=Number(document.getElementById('gjTunjMakan').value)||0;const tKom=Number(document.getElementById('gjTunjKom').value)||0;const lembur=Number(document.getElementById('gjLembur').value)||0;const insentif=Number(document.getElementById('gjInsentif').value)||0;const bonus=Number(document.getElementById('gjBonus').value)||0;const tLain=Number(document.getElementById('gjTunjLain').value)||0;const reimburse=Number(document.getElementById('gjReimburse').value)||0;const bpjsKes=Number(document.getElementById('gjBPJSKes').value)||0;const bpjsTK=Number(document.getElementById('gjBPJSTK').value)||0;const potLain=Number(document.getElementById('gjPotongan').value)||0;const kasbon=Number(document.getElementById('gjKasbon').value)||0;
  const totalTunjangan=tJabatan+tTransport+tMakan+tKom+lembur+tLain;const bruto=pokok+totalTunjangan+insentif+bonus+reimburse;const totalPotongan=bpjsKes+bpjsTK+potLain+kasbon;
  const tahunan=(pokok+totalTunjangan-bpjsKes-bpjsTK)*12;let pphTahunan=0;
  if(tahunan<=60000000)pphTahunan=tahunan*0.05;
  else if(tahunan<=250000000)pphTahunan=60000000*0.05+(tahunan-60000000)*0.15;
  else if(tahunan<=500000000)pphTahunan=60000000*0.05+190000000*0.15+(tahunan-250000000)*0.25;
  else pphTahunan=60000000*0.05+190000000*0.15+250000000*0.25+(tahunan-500000000)*0.30;
  const pph21=Math.max(0,Math.round(pphTahunan/12));const total=bruto-totalPotongan-pph21;
  document.getElementById('gjBruto').value=formatCurrency(bruto);document.getElementById('gjTotPot').value=formatCurrency(totalPotongan);document.getElementById('gjPPH').value=formatCurrency(pph21);document.getElementById('gjTotal').value=formatCurrency(total);
  window._gajiCalc={pph21,total,bruto,totalTunjangan,totalPotongan,insentif,reimburse};}
async function autoFillGajiFromKaryawan(){const nama=(document.getElementById('gjNama').value||'').trim();if(!nama)return;
  // Find karyawan
  let k=null;const snap=await db.collection('hrd_karyawan').where('nama','==',nama).limit(1).get();
  if(!snap.empty){k=snap.docs[0].data();}else{const all=await db.collection('hrd_karyawan').get();all.forEach(d=>{if(d.data().nama?.toLowerCase()===nama.toLowerCase())k=d.data();});if(!k)return toast('Karyawan tidak ditemukan','warning');}
  const gaji=k.gajiPokok||0;document.getElementById('gjPokok').value=gaji;
  document.getElementById('gjBPJSKes').value=Math.round(gaji*0.01);
  document.getElementById('gjBPJSTK').value=Math.round(gaji*0.02);
  // Auto-load tunjangan from hrd_tunjangan
  const tunjSnap=await db.collection('hrd_tunjangan').get();let tunjTotal=0;
  tunjSnap.forEach(d=>{const t=d.data();const penerima=(t.penerima||'Semua').toLowerCase();if(penerima==='semua'||penerima.includes(nama.toLowerCase()))tunjTotal+=t.nominal||0;});
  document.getElementById('gjTunjLain').value=tunjTotal;
  // Auto-load reimbursement (approved)
  const reimbSnap=await db.collection('hrd_reimbursement').where('status','==','approved').get();
  let totalReimb=0;reimbSnap.forEach(d=>{const r=d.data();if((r.nama||'').toLowerCase()===nama.toLowerCase())totalReimb+=r.jumlah||0;});
  document.getElementById('gjReimburse').value=totalReimb;
  // Auto-load kasbon/loan (aktif)
  const kasbonSnap=await db.collection('hrd_kasbon').get();let totalLoan=0;
  kasbonSnap.forEach(d=>{const r=d.data();if((r.nama||'').toLowerCase()===nama.toLowerCase()&&(r.status==='aktif'||r.status==='approved'))totalLoan+=r.angsuran||r.jumlah||0;});
  document.getElementById('gjKasbon').value=totalLoan;
  // Auto-calculate insentif based on KPI score
  const kpiSnap=await db.collection('hrd_kpi').get();let kpiScore=0,kpiFound=false;
  kpiSnap.forEach(d=>{const r=d.data();if((r.nama||'').toLowerCase()===nama.toLowerCase()){kpiScore=r.skor||0;kpiFound=true;}});
  if(kpiFound&&kpiScore>0){
    // Insentif formula: KPI >= 90 = 15% gaji, >= 80 = 10%, >= 70 = 5%, < 70 = 0
    let insentifPct=0;if(kpiScore>=90)insentifPct=0.15;else if(kpiScore>=80)insentifPct=0.10;else if(kpiScore>=70)insentifPct=0.05;
    document.getElementById('gjInsentif').value=Math.round(gaji*insentifPct);
  }
  // Auto-load overtime (approved) for current period
  const periode=document.getElementById('gjPeriode').value||monthStr();
  const[pYear,pMonth]=periode.split('-').map(Number);
  const prevMo=pMonth===1?12:pMonth-1;
  const prevYr=pMonth===1?pYear-1:pYear;
  const pStart=`${prevYr}-${String(prevMo).padStart(2,'0')}-20`;
  const pEnd=`${pYear}-${String(pMonth).padStart(2,'0')}-20`;
  const otSnap=await db.collection('hrd_overtime').get();
  let totalOTJam=0;
  otSnap.forEach(d=>{const o=d.data();if(o.status!=='approved')return;if(!o.tanggal||o.tanggal<pStart||o.tanggal>pEnd)return;if((o.nama||'').toLowerCase()===nama.toLowerCase())totalOTJam+=parseFloat(o.durasi)||0;});
  if(totalOTJam>0){
    const gajiPerJam=Math.round(gaji/(22*8));
    let lemburNominal=0;
    const jam1=Math.min(totalOTJam,1);
    const jamSisa=Math.max(0,totalOTJam-1);
    lemburNominal=Math.round(jam1*gajiPerJam*1.5+jamSisa*gajiPerJam*2);
    document.getElementById('gjLembur').value=lemburNominal;
  }
  hitungGaji();toast(`Data dimuat: Gaji ${formatCurrency(gaji)}, Tunj ${formatCurrency(tunjTotal)}, Reimb ${formatCurrency(totalReimb)}, Loan ${formatCurrency(totalLoan)}${totalOTJam>0?`, Lembur ${totalOTJam} jam`:''}`,'success');}
async function simpanGaji(){const tJab=Number(document.getElementById('gjTunjJabatan').value)||0;const tTrans=Number(document.getElementById('gjTunjTransport').value)||0;const tMakan=Number(document.getElementById('gjTunjMakan').value)||0;const tKom=Number(document.getElementById('gjTunjKom').value)||0;const lembur=Number(document.getElementById('gjLembur').value)||0;const insentif=Number(document.getElementById('gjInsentif').value)||0;const bonus=Number(document.getElementById('gjBonus').value)||0;const tLain=Number(document.getElementById('gjTunjLain').value)||0;const reimburse=Number(document.getElementById('gjReimburse').value)||0;const nama=document.getElementById('gjNama').value;const data={nama,periode:document.getElementById('gjPeriode').value,gajiPokok:Number(document.getElementById('gjPokok').value)||0,tunjangan:tJab+tTrans+tMakan+tKom+lembur+tLain,tunjJabatan:tJab,tunjTransport:tTrans,tunjMakan:tMakan,tunjKomunikasi:tKom,lembur,insentif,bonus,tunjLain:tLain,reimbursement:reimburse,bpjsKesehatan:Number(document.getElementById('gjBPJSKes').value)||0,bpjsTK:Number(document.getElementById('gjBPJSTK').value)||0,potongan:Number(document.getElementById('gjPotongan').value)||0,kasbon:Number(document.getElementById('gjKasbon').value)||0,pph21:window._gajiCalc?.pph21||0,totalBersih:window._gajiCalc?.total||0,createdAt:new Date().toISOString()};if(!nama)return toast('Pilih karyawan dulu','warning');await db.collection('hrd_penggajian').add(data);closeModalDirect();toast('Slip disimpan','success');renderPenggajian();}
function modalImportPenggajian(){openModal(`<div class="modal-title">📥 Import Data Penggajian</div>
    <div class="tabs mb-16"><div class="tab active" onclick="switchImportTab('gaji','file')">📄 Upload CSV</div><div class="tab" onclick="switchImportTab('gaji','api')">🔗 API Google Sheets</div></div>
    <div id="importGajiTab">
      <p class="text-sm mb-8" style="color:#666">Upload file CSV. Header: Nama, Periode, Gaji Pokok, Tunjangan, Potongan, PPH21, Total Bersih.</p>
      <div class="form-group"><label>File CSV</label><input class="form-control" type="file" accept=".csv" id="importGajiFile"></div>
      <div class="flex gap-8 mb-16"><button class="btn btn-primary" onclick="processImportPenggajian()">📥 Proses Import</button><button class="btn btn-outline btn-sm" onclick="downloadPenggajianTemplate()">📄 Download Template</button></div>
      <div class="text-xs" style="color:#666">Template CSV akan membantu memastikan header sesuai dengan format sheet.</div>
    </div>`,true);}

async function processImportPenggajianFromText(text){
  const rows=parseCsvRows(text);if(rows.length<2)return toast('Data kosong','warning');
  const headers=rows[0].map(h=>normalizeHeader(h));const map={};
  headers.forEach((h,i)=>{if(['nama','name','nama karyawan','employee name'].includes(h))map.nama=i;else if(['periode','period','bulan','month','periode gaji'].includes(h))map.periode=i;else if(['gaji pokok','salary','basic salary','gaji','upah pokok'].includes(h))map.gajiPokok=i;else if(['tunjangan','allowance','tunjangan total','total tunjangan'].includes(h))map.tunjangan=i;else if(['potongan','deduction','deductions','total potongan'].includes(h))map.potongan=i;else if(['pph21','pph','pph 21','pajak'].includes(h))map.pph21=i;else if(['total bersih','total','net total','net salary','take home pay','thp','gaji bersih'].includes(h))map.totalBersih=i;else if(['lembur','overtime','uang lembur'].includes(h))map.lembur=i;else if(['bonus'].includes(h))map.bonus=i;});
  if(map.nama===undefined)return toast('Header harus berisi kolom "Nama"','warning');
  let added=0,updated=0;
  for(let i=1;i<rows.length;i++){const row=rows[i];const nama=(row[map.nama]||'').trim();if(!nama)continue;
    const periode=(map.periode!==undefined?(row[map.periode]||'').trim():monthStr());
    if(!periode)continue;
    const gajiPokok=Number(String(map.gajiPokok!==undefined?row[map.gajiPokok]:'').replace(/[^0-9.-]/g,''))||0;
    const tunjangan=Number(String(map.tunjangan!==undefined?row[map.tunjangan]:'').replace(/[^0-9.-]/g,''))||0;
    const lembur=Number(String(map.lembur!==undefined?row[map.lembur]:'').replace(/[^0-9.-]/g,''))||0;
    const bonus=Number(String(map.bonus!==undefined?row[map.bonus]:'').replace(/[^0-9.-]/g,''))||0;
    const potongan=Number(String(map.potongan!==undefined?row[map.potongan]:'').replace(/[^0-9.-]/g,''))||0;
    const pph21=Number(String(map.pph21!==undefined?row[map.pph21]:'').replace(/[^0-9.-]/g,''))||0;
    let totalBersih=Number(String(map.totalBersih!==undefined?row[map.totalBersih]:'').replace(/[^0-9.-]/g,''))||0;
    if(!totalBersih)totalBersih=gajiPokok+tunjangan+lembur+bonus-potongan-pph21;
    const payload={nama,periode,gajiPokok,tunjangan:tunjangan+lembur+bonus,potongan,pph21,totalBersih,updatedAt:new Date().toISOString()};
    const snap=await db.collection('hrd_penggajian').where('nama','==',nama).get();
    let existDoc=null;
    snap.forEach(d=>{if(d.data().periode===periode)existDoc=d;});
    if(existDoc){await db.collection('hrd_penggajian').doc(existDoc.id).update(payload);updated++;}
    else{await db.collection('hrd_penggajian').add({...payload,createdAt:new Date().toISOString()});added++;}
  }
  closeModalDirect();toast(`✅ Import selesai: ${added} baru, ${updated} terupdate`,'success');renderPenggajian();
}

async function processImportPenggajian(){const file=document.getElementById('importGajiFile')?.files?.[0];if(!file)return toast('Pilih file CSV','warning');const text=await file.text();await processImportPenggajianFromText(text);}
function lihatSlip(id){db.collection('hrd_penggajian').doc(id).get().then(async d=>{const p=d.data();
  // Get karyawan data for jabatan & status
  let jabatan='-',statusKary='-',departemen='-';
  if(p.karyawanId){const kDoc=await db.collection('hrd_karyawan').doc(p.karyawanId).get();if(kDoc.exists){const k=kDoc.data();jabatan=k.posisi||'-';statusKary=k.tipeKaryawan||k.status||'-';departemen=k.departemen||'-';}}
  else{const kSnap=await db.collection('hrd_karyawan').where('nama','==',p.nama).limit(1).get();if(!kSnap.empty){const k=kSnap.docs[0].data();jabatan=k.posisi||'-';statusKary=k.tipeKaryawan||k.status||'-';departemen=k.departemen||'-';}}
  const bruto=(p.gajiPokok||0)+(p.tunjangan||0)+(p.tunjCuti||0)+(p.insentif||0)+(p.bonus||0)+(p.reimbursement||0)+(p.lembur||0);
  const totPot=(p.bpjsKesehatan||0)+(p.bpjsTK||0)+(p.potongan||0)+(p.kasbon||0)+(p.pph21||0);
  openModal(`<div id="slipGajiPrint">
    <div style="text-align:center;padding:16px;border:2px solid var(--primary);border-radius:8px;margin-bottom:16px"><div class="fw-700 color-primary" style="font-size:1.2rem">LPK IJEF CORP</div><div class="text-xs">Slip Gaji Periode: ${p.periode}</div><div class="text-xs" style="color:#999">${p.periodeStart?`(${p.periodeStart} s/d ${p.periodeEnd})`:''}</div></div>
    <div style="background:#f8f9ff;padding:12px;border-radius:8px;margin-bottom:16px"><div style="font-size:.82rem;display:grid;grid-template-columns:1fr 1fr;gap:6px"><div><b>Nama:</b> ${escHtml(p.nama)}</div><div><b>Periode:</b> ${p.periode}</div><div><b>Jabatan:</b> ${escHtml(jabatan)}</div><div><b>Departemen:</b> ${escHtml(departemen)}</div><div><b>Status:</b> <span class="badge badge-${statusKary==='tetap'||statusKary==='aktif'?'success':'warning'}" style="font-size:.7rem">${escHtml(statusKary)}</span></div><div></div></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    <div><div class="fw-700 text-sm color-primary mb-8">💰 Pendapatan</div><table style="width:100%;font-size:.82rem"><tr><td>Gaji Pokok</td><td style="text-align:right">${formatCurrency(p.gajiPokok)}</td></tr><tr><td>Tunjangan</td><td style="text-align:right">${formatCurrency(p.tunjangan)}</td></tr>${p.tunjCuti?`<tr><td>Tunj. Cuti (1/12)</td><td style="text-align:right">${formatCurrency(p.tunjCuti)}</td></tr>`:''}${p.lembur?`<tr><td>Lembur (${p.lemburJam||0} jam)</td><td style="text-align:right">${formatCurrency(p.lembur)}</td></tr>`:''}${p.insentif?`<tr><td>Insentif</td><td style="text-align:right">${formatCurrency(p.insentif)}</td></tr>`:''}${p.bonus?`<tr><td>Bonus</td><td style="text-align:right">${formatCurrency(p.bonus)}</td></tr>`:''}${p.reimbursement?`<tr><td>Reimbursement</td><td style="text-align:right">${formatCurrency(p.reimbursement)}</td></tr>`:''}<tr style="border-top:2px solid var(--primary);font-weight:700"><td>Total Bruto</td><td style="text-align:right">${formatCurrency(bruto)}</td></tr></table></div>
    <div><div class="fw-700 text-sm color-danger mb-8">📉 Potongan</div><table style="width:100%;font-size:.82rem">${p.potongan?`<tr><td>Pot. Absen (${p.tidakHadir||0} hari)</td><td style="text-align:right;color:var(--danger)">-${formatCurrency(p.potongan)}</td></tr>`:''}<tr><td>BPJS Kesehatan (1%)</td><td style="text-align:right;color:var(--danger)">-${formatCurrency(p.bpjsKesehatan)}</td></tr><tr><td>BPJS TK (2%)</td><td style="text-align:right;color:var(--danger)">-${formatCurrency(p.bpjsTK)}</td></tr>${p.kasbon?`<tr><td>Kasbon/Loan</td><td style="text-align:right;color:var(--danger)">-${formatCurrency(p.kasbon)}</td></tr>`:''}<tr><td>PPH 21</td><td style="text-align:right;color:var(--danger)">-${formatCurrency(p.pph21)}</td></tr><tr style="border-top:2px solid var(--danger);font-weight:700"><td>Total Potongan</td><td style="text-align:right;color:var(--danger)">-${formatCurrency(totPot)}</td></tr></table></div></div>
    <div style="background:var(--primary);color:#fff;padding:16px;border-radius:8px;text-align:center"><div style="font-size:.8rem;opacity:.8">TAKE HOME PAY</div><div style="font-size:1.5rem;font-weight:700">${formatCurrency(p.totalBersih)}</div></div>
    ${p.hariKerja?`<div class="mt-16 slip-no-print" style="background:#fff3e0;padding:10px;border-radius:6px;font-size:.72rem;line-height:1.6"><b>Dasar Perhitungan:</b><br>• Gaji/hari: ${formatCurrency(Math.round((p.gajiPokok||0)/(p.hariKerja||22)))} (${p.gajiPokok?formatCurrency(p.gajiPokok):'-'} ÷ ${p.hariKerja} hari)<br>• Lembur: 1.5x jam pertama + 2x jam berikutnya (UU Cipta Kerja)<br>• PPH21: Tarif progresif UU HPP 2022 (PTKP TK/0 = Rp 54.000.000)<br>• Periode: Tgl 20 bulan lalu s/d Tgl 20 bulan ini</div>`:''}</div>
    <div class="mt-16 flex gap-8" style="justify-content:center"><button class="btn btn-primary btn-sm" onclick="cetakSlipPDF()">📄 Cetak / Save PDF</button><button class="btn btn-outline btn-sm" onclick="window.print()">🖨️ Print</button></div>`,true);});}

function cetakSlipPDF(){
  const content=document.getElementById('slipGajiPrint');
  if(!content)return;
  // Clone and remove "dasar perhitungan" section
  const clone=content.cloneNode(true);
  clone.querySelectorAll('.slip-no-print').forEach(el=>el.remove());
  const win=window.open('','_blank');
  win.document.write('<html><head><title>Slip Gaji</title><style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}table{border-collapse:collapse;width:100%}td{padding:4px 8px}.fw-700{font-weight:700}.color-primary{color:#1a237e}.color-danger{color:#d32f2f}.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.text-sm{font-size:11px}.text-xs{font-size:10px}.mb-8{margin-bottom:8px}.mt-16{margin-top:16px}</style></head><body>');
  win.document.write(clone.innerHTML);
  win.document.write('</body></html>');
  win.document.close();
  setTimeout(()=>{win.print();},500);
}

function editGaji(id){db.collection('hrd_penggajian').doc(id).get().then(d=>{const p=d.data();openModal(`<div class="modal-title">✏️ Edit Slip Gaji — ${escHtml(p.nama)}</div>
  <div class="grid-2"><div class="form-group"><label>Karyawan</label><input class="form-control" id="egNama" value="${escHtml(p.nama||'')}" readonly></div><div class="form-group"><label>Periode</label><input class="form-control" type="month" id="egPeriode" value="${p.periode||''}"></div></div>
  <div class="fw-700 text-sm mb-8 mt-16 color-primary">💰 Pendapatan</div>
  <div class="grid-2">
    <div class="form-group"><label>Gaji Pokok</label><input class="form-control" type="number" id="egPokok" value="${p.gajiPokok||0}" oninput="calcEditGaji()"></div>
    <div class="form-group"><label>Tunjangan Tetap</label><input class="form-control" type="number" id="egTunjangan" value="${p.tunjangan||0}" oninput="calcEditGaji()"></div>
    <div class="form-group"><label>Tunjangan Cuti (1/12)</label><input class="form-control" type="number" id="egTunjCuti" value="${p.tunjCuti||0}" oninput="calcEditGaji()"></div>
    <div class="form-group"><label>Lembur</label><input class="form-control" type="number" id="egLembur" value="${p.lembur||0}" oninput="calcEditGaji()"></div>
    <div class="form-group"><label>Insentif</label><input class="form-control" type="number" id="egInsentif" value="${p.insentif||0}" oninput="calcEditGaji()"></div>
    <div class="form-group"><label>Reimbursement</label><input class="form-control" type="number" id="egReimburse" value="${p.reimbursement||0}" oninput="calcEditGaji()"></div>
  </div>
  <div class="fw-700 text-sm mb-8 mt-16" style="color:var(--accent)">📉 Potongan</div>
  <div class="grid-2">
    <div class="form-group"><label>BPJS Kesehatan (1%)</label><input class="form-control" type="number" id="egBPJSKes" value="${p.bpjsKesehatan||0}" oninput="calcEditGaji()"></div>
    <div class="form-group"><label>BPJS TK/JHT (2%)</label><input class="form-control" type="number" id="egBPJSTK" value="${p.bpjsTK||0}" oninput="calcEditGaji()"></div>
    <div class="form-group"><label>Potongan Absen/Lain</label><input class="form-control" type="number" id="egPotongan" value="${p.potongan||0}" oninput="calcEditGaji()"></div>
    <div class="form-group"><label>Kasbon/Loan</label><input class="form-control" type="number" id="egKasbon" value="${p.kasbon||0}" oninput="calcEditGaji()"></div>
    <div class="form-group"><label>PPH 21</label><input class="form-control" type="number" id="egPPH" value="${p.pph21||0}" oninput="calcEditGaji()"></div>
  </div>
  <div style="background:var(--primary);color:#fff;padding:12px;border-radius:8px;text-align:center;margin-top:16px"><div style="font-size:.8rem;opacity:.8">TAKE HOME PAY</div><div style="font-size:1.3rem;font-weight:700" id="egTHPDisplay">${formatCurrency(p.totalBersih||0)}</div></div>
  <input type="hidden" id="egTotal" value="${p.totalBersih||0}">
  <div class="flex gap-8 mt-16"><button class="btn btn-primary" onclick="updateGaji('${id}')">💾 Simpan</button><button class="btn btn-danger" onclick="hapusDoc('hrd_penggajian','${id}','penggajian')">🗑️ Hapus</button></div>`,true);
  calcEditGaji();});}
function calcEditGaji(){
  const gaji=Number(document.getElementById('egPokok')?.value)||0;
  const tunj=Number(document.getElementById('egTunjangan')?.value)||0;
  const tunjCuti=Number(document.getElementById('egTunjCuti')?.value)||0;
  const lembur=Number(document.getElementById('egLembur')?.value)||0;
  const insentif=Number(document.getElementById('egInsentif')?.value)||0;
  const reimburse=Number(document.getElementById('egReimburse')?.value)||0;
  const bpjsKes=Number(document.getElementById('egBPJSKes')?.value)||0;
  const bpjsTK=Number(document.getElementById('egBPJSTK')?.value)||0;
  const potongan=Number(document.getElementById('egPotongan')?.value)||0;
  const kasbon=Number(document.getElementById('egKasbon')?.value)||0;
  const pph=Number(document.getElementById('egPPH')?.value)||0;
  const bruto=gaji+tunj+tunjCuti+lembur+insentif+reimburse;
  const thp=bruto-bpjsKes-bpjsTK-potongan-kasbon-pph;
  const el=document.getElementById('egTHPDisplay');if(el)el.textContent=formatCurrency(thp);
  const elH=document.getElementById('egTotal');if(elH)elH.value=thp;
}
async function updateGaji(id){const data={nama:document.getElementById('egNama').value,periode:document.getElementById('egPeriode').value,gajiPokok:Number(document.getElementById('egPokok').value)||0,tunjangan:Number(document.getElementById('egTunjangan').value)||0,tunjCuti:Number(document.getElementById('egTunjCuti').value)||0,lembur:Number(document.getElementById('egLembur').value)||0,insentif:Number(document.getElementById('egInsentif').value)||0,reimbursement:Number(document.getElementById('egReimburse').value)||0,bpjsKesehatan:Number(document.getElementById('egBPJSKes').value)||0,bpjsTK:Number(document.getElementById('egBPJSTK').value)||0,potongan:Number(document.getElementById('egPotongan').value)||0,kasbon:Number(document.getElementById('egKasbon').value)||0,pph21:Number(document.getElementById('egPPH').value)||0,totalBersih:Number(document.getElementById('egTotal').value)||0,updatedAt:new Date().toISOString()};await db.collection('hrd_penggajian').doc(id).update(data);closeModalDirect();toast('Slip gaji diupdate','success');loadGaji();}

// ── REIMBURSEMENT ─────────────────────────────────────────────
async function renderReimbursement(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>🧾 Reimbursement</span><button class="btn btn-primary btn-sm" onclick="modalReimburse()">+ Pengajuan</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Kategori</th><th>Jumlah</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblReimb"></tbody></table></div></div>`;const snap=await db.collection('hrd_reimbursement').get();let h='';if(snap.empty)h='<tr><td colspan="5" class="text-center">Belum ada</td></tr>';else snap.forEach(d=>{const p=d.data();const badge=p.status==='approved'?'badge-success':p.status==='rejected'?'badge-danger':'badge-warning';h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.kategori)}</td><td>${formatCurrency(p.jumlah)}</td><td><span class="badge ${badge}">${p.status}</span></td><td>${p.status==='pending'&&hasAccess(3)?`<button class="btn btn-xs btn-success" onclick="approveReimb('${d.id}','approved')">✅</button> <button class="btn btn-xs btn-danger" onclick="approveReimb('${d.id}','rejected')">❌</button>`:''} <button class="btn btn-xs btn-warning" onclick="editReimb('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_reimbursement','${d.id}','reimbursement')">🗑️</button></td></tr>`;});document.getElementById('tblReimb').innerHTML=h;}
function modalReimburse(){openModal(`<div class="modal-title">Pengajuan Reimbursement</div><div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="rbNama" value="${currentUser.nama}"></div><div class="form-group"><label>Kategori</label><select class="form-control" id="rbKat"><option>Transport</option><option>Makan</option><option>Kesehatan</option><option>Operasional</option></select></div></div><div class="form-group"><label>Jumlah (Rp)</label><input class="form-control" type="number" id="rbJumlah"></div><div class="form-group"><label>Keterangan</label><textarea class="form-control" id="rbKet"></textarea></div><button class="btn btn-primary" onclick="simpanReimburse()">Ajukan</button>`);}
async function simpanReimburse(){const data={nama:document.getElementById('rbNama').value,kategori:document.getElementById('rbKat').value,jumlah:Number(document.getElementById('rbJumlah').value)||0,keterangan:document.getElementById('rbKet').value,status:'pending',userId:currentUser.id,createdAt:new Date().toISOString()};if(!data.jumlah)return toast('Jumlah wajib','warning');await db.collection('hrd_reimbursement').add(data);await sendNotification('admin','📋 Reimbursement Baru',`${currentUser.nama} mengajukan reimbursement ${data.kategori} ${formatCurrency(data.jumlah)}`,'reimbursement');closeModalDirect();toast('Diajukan','success');renderReimbursement();}
async function approveReimb(id,status){var komentar='';if(status==='rejected'){komentar=prompt('Alasan penolakan:');if(!komentar)return;}else{komentar=prompt('Komentar approval (opsional):')|| '';}await db.collection('hrd_reimbursement').doc(id).update({status,approvedBy:currentUser.nama,approvalComment:komentar||''});const rbDoc=await db.collection('hrd_reimbursement').doc(id).get();const rbData=rbDoc.data();if(rbData.userId){await sendNotification(rbData.userId,status==='approved'?'✅ Reimbursement Disetujui':'❌ Reimbursement Ditolak',`Pengajuan reimbursement ${rbData.kategori||''} ${formatCurrency(rbData.jumlah||0)} telah ${status==='approved'?'disetujui':'ditolak'}${komentar?': '+komentar:''}`,'reimbursement');}toast('Updated','success');renderReimbursement();}

// ── KASBON & LOAN ─────────────────────────────────────────────
async function renderKasbon(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>💳 Kasbon & Loan</span><button class="btn btn-primary btn-sm" onclick="modalKasbon()">+ Pengajuan</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Jenis</th><th>Total Pinjaman</th><th>Angsuran/Bln</th><th>Durasi</th><th>Sudah Bayar</th><th>Sisa</th><th>Sisa Bulan</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tblKasbon"></tbody></table></div></div>`;const snap=await db.collection('hrd_kasbon').get();const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));let h='';if(!items.length)h='<tr><td colspan="10" class="text-center">Belum ada</td></tr>';else items.forEach(p=>{
    const jumlah=p.jumlah||0;const cicilan=p.cicilan||1;const angsuran=Math.ceil(jumlah/cicilan);const sudahBayar=p.sudahBayar||0;const sisa=Math.max(0,jumlah-sudahBayar);const sisaBulan=Math.ceil(sisa/angsuran)||0;
    const badge=p.status==='approved'||p.status==='aktif'?'badge-success':p.status==='lunas'?'badge-primary':p.status==='rejected'?'badge-danger':'badge-warning';
    h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.jenis||'-')}</td><td>${formatCurrency(jumlah)}</td><td class="fw-700">${formatCurrency(angsuran)}</td><td>${cicilan} bulan</td><td>${formatCurrency(sudahBayar)}</td><td class="fw-700" style="color:${sisa>0?'var(--danger)':'var(--success)'}">${formatCurrency(sisa)}</td><td>${p.status==='lunas'?'✅ Lunas':sisaBulan+' bln'}</td><td><span class="badge ${badge}">${p.status||'pending'}</span></td><td>${p.status==='pending'&&hasAccess(3)?`<button class="btn btn-xs btn-success" onclick="approveKasbon('${p.id}','aktif')">✅</button> <button class="btn btn-xs btn-danger" onclick="approveKasbon('${p.id}','rejected')">❌</button>`:''} ${p.status==='aktif'?`<button class="btn btn-xs btn-info" onclick="bayarAngsuran('${p.id}')">💰 Bayar</button>`:''} <button class="btn btn-xs btn-warning" onclick="editKasbonDoc('${p.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_kasbon','${p.id}','kasbon')">🗑️</button></td></tr>`;});document.getElementById('tblKasbon').innerHTML=h;}
function modalKasbon(){openModal(`<div class="modal-title">Pengajuan Kasbon/Loan</div><div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="kbNama" value="${currentUser.nama}"></div><div class="form-group"><label>Jenis</label><select class="form-control" id="kbJenis"><option>Kasbon</option><option>Pinjaman Karyawan</option></select></div></div><div class="grid-2"><div class="form-group"><label>Total Pinjaman (Rp)</label><input class="form-control" type="number" id="kbJumlah" oninput="calcKasbonPreview()"></div><div class="form-group"><label>Durasi Cicilan (bulan)</label><input class="form-control" type="number" id="kbCicilan" value="3" min="1" oninput="calcKasbonPreview()"></div></div><div style="background:#f8f9ff;border-radius:8px;padding:10px;margin-bottom:14px"><div class="grid-2" style="font-size:.82rem"><div><b>Angsuran/bulan:</b> <span id="kbAngsuranPreview">Rp 0</span></div><div><b>Potongan gaji otomatis:</b> Ya</div></div></div><div class="form-group"><label>Keterangan</label><input class="form-control" id="kbKet" placeholder="Keperluan pinjaman"></div><button class="btn btn-primary" onclick="simpanKasbon()">Ajukan</button>`);}
function calcKasbonPreview(){const jml=Number(document.getElementById('kbJumlah').value)||0;const cic=Number(document.getElementById('kbCicilan').value)||1;document.getElementById('kbAngsuranPreview').textContent=formatCurrency(Math.ceil(jml/cic));}
async function simpanKasbon(){const jumlah=Number(document.getElementById('kbJumlah').value)||0;const cicilan=Number(document.getElementById('kbCicilan').value)||1;if(!jumlah)return toast('Jumlah wajib','warning');const data={nama:document.getElementById('kbNama').value,jenis:document.getElementById('kbJenis').value,jumlah,cicilan,angsuran:Math.ceil(jumlah/cicilan),sudahBayar:0,keterangan:document.getElementById('kbKet').value,status:'pending',userId:currentUser.id,createdAt:new Date().toISOString()};await db.collection('hrd_kasbon').add(data);await sendNotification('admin','📋 Kasbon/Loan Baru',`${currentUser.nama} mengajukan ${data.jenis} ${formatCurrency(data.jumlah)}`,'kasbon');closeModalDirect();toast('Diajukan','success');renderKasbon();}
async function approveKasbon(id,status){var komentar='';if(status==='rejected'){komentar=prompt('Alasan penolakan:');if(!komentar)return;}else{komentar=prompt('Komentar approval (opsional):')|| '';}await db.collection('hrd_kasbon').doc(id).update({status,approvedBy:currentUser.nama,approvedAt:new Date().toISOString(),approvalComment:komentar||''});const kbDoc=await db.collection('hrd_kasbon').doc(id).get();const kbData=kbDoc.data();if(kbData.userId){await sendNotification(kbData.userId,status==='aktif'?'✅ Kasbon Disetujui':'❌ Kasbon Ditolak',`Pengajuan ${kbData.jenis||'kasbon'} ${formatCurrency(kbData.jumlah||0)} telah ${status==='aktif'?'disetujui':'ditolak'}${komentar?': '+komentar:''}`,'kasbon');}toast('Updated','success');renderKasbon();}
async function bayarAngsuran(id){const doc=await db.collection('hrd_kasbon').doc(id).get();const p=doc.data();const angsuran=Math.ceil((p.jumlah||0)/(p.cicilan||1));const newSudahBayar=(p.sudahBayar||0)+angsuran;const sisa=Math.max(0,(p.jumlah||0)-newSudahBayar);const update={sudahBayar:newSudahBayar,lastPayment:new Date().toISOString()};if(sisa<=0)update.status='lunas';await db.collection('hrd_kasbon').doc(id).update(update);toast(`Angsuran ${formatCurrency(angsuran)} dibayar. Sisa: ${formatCurrency(sisa)}`,'success');renderKasbon();}

// ── TUNJANGAN ─────────────────────────────────────────────────
async function renderTunjangan(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>🎁 Tunjangan & Benefit</span><div class="flex gap-8"><button class="btn btn-success btn-sm" onclick="generateDefaultTunjangan()">⚡ Generate Default</button><button class="btn btn-primary btn-sm" onclick="modalTunjangan()">+ Tambah</button></div></div>
  <div class="card mb-16" style="background:#f8f9ff;border-left:4px solid var(--info)"><div class="text-sm" style="line-height:1.6"><b>Komponen Tunjangan:</b><br>• <b>Tunjangan Tetap</b>: Transport, Makan, Jabatan (berlaku untuk semua/per karyawan)<br>• <b>Tunjangan Tidak Tetap</b>: Komunikasi, Kehadiran (bisa berubah per bulan)<br>• Penerima "Semua" = berlaku untuk semua karyawan<br>• Penerima nama spesifik = hanya untuk karyawan tersebut</div></div>
  <div class="card"><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Jenis</th><th>Nominal</th><th>Penerima</th><th>Aksi</th></tr></thead><tbody id="tblTunj"></tbody></table></div></div>`;const snap=await db.collection('hrd_tunjangan').get();let h='';if(snap.empty)h='<tr><td colspan="5" class="text-center">Belum ada. Klik "Generate Default" untuk membuat tunjangan standar.</td></tr>';else snap.forEach(d=>{const p=d.data();h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td><span class="badge badge-${p.jenis==='tetap'?'success':'info'}">${p.jenis||'tetap'}</span></td><td>${formatCurrency(p.nominal)}</td><td>${escHtml(p.penerima||'Semua')}</td><td><button class="btn btn-xs btn-info" onclick="modalTunjangan('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_tunjangan','${d.id}','tunjangan')">🗑️</button></td></tr>`;});document.getElementById('tblTunj').innerHTML=h;}

async function generateDefaultTunjangan(){
  if(!confirm('Generate tunjangan default untuk semua karyawan?\n\n• Tunjangan Transport: Rp 500.000\n• Tunjangan Makan: Rp 300.000\n• Tunjangan Komunikasi: Rp 200.000\n\nBerlaku untuk SEMUA karyawan. Anda bisa edit setelahnya.'))return;
  const defaults=[
    {nama:'Tunjangan Transport',jenis:'tetap',nominal:500000,penerima:'Semua'},
    {nama:'Tunjangan Makan',jenis:'tetap',nominal:300000,penerima:'Semua'},
    {nama:'Tunjangan Komunikasi',jenis:'tidak_tetap',nominal:200000,penerima:'Semua'},
    {nama:'Tunjangan Cuti',jenis:'tetap',nominal:0,penerima:'Semua',keterangan:'Sesuai ketentuan pemerintah: 1x gaji pokok per tahun. Isi nominal per karyawan atau biarkan 0 jika belum berlaku.'}
  ];
  for(const t of defaults){
    await db.collection('hrd_tunjangan').add({...t,createdAt:new Date().toISOString()});
  }
  toast('3 tunjangan default berhasil dibuat','success');
  renderTunjangan();
}
function modalTunjangan(id){if(id)db.collection('hrd_tunjangan').doc(id).get().then(d=>showTunjForm(id,d.data()||{}));else showTunjForm(null,{});}
function showTunjForm(id,p){openModal(`<div class="modal-title">${id?'Edit':'Tambah'} Tunjangan</div><div class="form-group"><label>Nama</label><input class="form-control" id="tjNama" value="${escHtml(p.nama||'')}"></div><div class="grid-2"><div class="form-group"><label>Jenis</label><select class="form-control" id="tjJenis"><option value="tetap" ${p.jenis==='tetap'?'selected':''}>Tetap</option><option value="tidak_tetap" ${p.jenis==='tidak_tetap'?'selected':''}>Tidak Tetap</option></select></div><div class="form-group"><label>Nominal</label><input class="form-control" type="number" id="tjNominal" value="${p.nominal||0}"></div></div><div class="form-group"><label>Penerima</label><input class="form-control" id="tjPenerima" value="${escHtml(p.penerima||'Semua')}"></div><button class="btn btn-primary" onclick="simpanTunjangan('${id||''}')">Simpan</button>`);}
async function simpanTunjangan(id){const data={nama:document.getElementById('tjNama').value,jenis:document.getElementById('tjJenis').value,nominal:Number(document.getElementById('tjNominal').value)||0,penerima:document.getElementById('tjPenerima').value,updatedAt:new Date().toISOString()};if(!data.nama)return toast('Nama wajib','warning');if(id)await db.collection('hrd_tunjangan').doc(id).update(data);else await db.collection('hrd_tunjangan').add({...data,createdAt:new Date().toISOString()});closeModalDirect();toast('Disimpan','success');renderTunjangan();}


// ── INSENTIF MODULE ───────────────────────────────────────────
async function renderInsentif(){
  const main=document.getElementById('mainContent');
  main.innerHTML=`<div class="page-title"><span>🏆 Insentif Kinerja</span><button class="btn btn-primary btn-sm" onclick="modalInsentif()">+ Tambah Insentif</button></div>
  <div class="card"><div style="background:#fff3e0;border-radius:8px;padding:12px;margin-bottom:16px;border-left:4px solid var(--warning)"><p class="text-sm" style="line-height:1.6"><b>Dua Jenis Insentif:</b><br><br><b>1. Insentif KPI (Kinerja)</b><br>• KPI ≥ 90 (Grade A) = <b>15%</b> dari Gaji Pokok<br>• KPI ≥ 80 (Grade B) = <b>10%</b> dari Gaji Pokok<br>• KPI ≥ 70 (Grade C) = <b>5%</b> dari Gaji Pokok<br>• KPI < 70 = <b>0%</b><br><br><b>2. Insentif Target Siswa (Manual)</b><br>• Berdasarkan jumlah siswa yang diterima/masuk<br>• Nominal per siswa ditentukan manual<br>• Contoh: 10 siswa × Rp 200.000 = Rp 2.000.000</p></div>
  <div class="flex gap-8 mb-16 flex-wrap"><button class="btn btn-success btn-sm" onclick="generateInsentifFromKPI()">⚡ Generate dari KPI</button><button class="btn btn-info btn-sm" onclick="modalInsentifSiswa()">🎓 Insentif Target Siswa</button><button class="btn btn-danger btn-sm" onclick="hapusSemuaInsentif()">🗑️ Hapus Semua</button></div>
  <div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Dept</th><th>Jenis</th><th>Basis</th><th>Nominal</th><th>Periode</th><th>Aksi</th></tr></thead><tbody id="tblInsentif"></tbody></table></div></div>`;
  const snap=await db.collection('hrd_insentif').get();const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  let h='';if(!items.length)h='<tr><td colspan="7" class="text-center">Belum ada data insentif</td></tr>';
  else items.forEach(p=>{const jenis=p.jenis||'KPI';const basis=jenis==='KPI'?`KPI ${p.kpiScore||0} (${p.persen||0}% gaji)`:`${p.jumlahSiswa||0} siswa × ${formatCurrency(p.nominalPerSiswa||0)}`;h+=`<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.departemen||'-')}</td><td><span class="badge badge-${jenis==='KPI'?'info':'success'}">${jenis}</span></td><td style="font-size:.78rem">${basis}</td><td class="fw-700">${formatCurrency(p.nominal||0)}</td><td>${escHtml(p.periode||'-')}</td><td><button class="btn btn-xs btn-info" onclick="viewInsentifDetail('${p.id}')">👁️</button> <button class="btn btn-xs btn-primary" onclick="editInsentif('${p.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusDoc('hrd_insentif','${p.id}','insentif')">🗑️</button></td></tr>`;});
  document.getElementById('tblInsentif').innerHTML=h;
}

async function modalInsentif(){
  const kSnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  let opts='<option value="">-- Pilih --</option>';kSnap.forEach(d=>{const k=d.data();opts+=`<option value="${escHtml(k.nama)}" data-gaji="${k.gajiPokok||0}" data-dept="${escHtml(k.departemen||'')}">${escHtml(k.nama)} — ${escHtml(k.departemen||'')} (${formatCurrency(k.gajiPokok||0)})</option>`;});
  openModal(`<div class="modal-title">Tambah Insentif KPI</div>
    <div class="form-group"><label>Karyawan</label><select class="form-control" id="insKary" onchange="onInsKaryChange()">${opts}</select></div>
    <div class="grid-2"><div class="form-group"><label>KPI Score</label><input class="form-control" type="number" id="insKPI" value="0" oninput="calcInsentif()"></div><div class="form-group"><label>Periode</label><input class="form-control" id="insPeriode" value="${monthStr()}"></div></div>
    <div class="grid-2"><div class="form-group"><label>% Insentif (auto)</label><input class="form-control" id="insPersen" readonly></div><div class="form-group"><label>Nominal (auto)</label><input class="form-control" id="insNominal" readonly style="font-weight:700"></div></div>
    <button class="btn btn-primary" onclick="simpanInsentif()">Simpan</button>`);
}

async function modalInsentifSiswa(){
  const kSnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  let opts='<option value="">-- Pilih --</option>';kSnap.forEach(d=>{const k=d.data();opts+=`<option value="${escHtml(k.nama)}" data-dept="${escHtml(k.departemen||'')}">${escHtml(k.nama)} — ${escHtml(k.departemen||'')}</option>`;});
  openModal(`<div class="modal-title">🎓 Insentif Target Siswa</div>
    <div style="background:#e3f2fd;border-radius:8px;padding:10px;margin-bottom:14px;font-size:.82rem;border-left:4px solid var(--info)">Hitung insentif berdasarkan jumlah siswa yang diterima/masuk. Nominal dihitung: Jumlah Siswa × Nominal per Siswa.</div>
    <div class="form-group"><label>Karyawan (PIC Rekrutmen)</label><select class="form-control" id="insSiswaKary" onchange="window._insSiswaDept=this.options[this.selectedIndex]?.dataset?.dept||''">${opts}</select></div>
    <div class="grid-2"><div class="form-group"><label>Jumlah Siswa Diterima</label><input class="form-control" type="number" id="insSiswaJml" value="0" oninput="calcInsentifSiswa()"></div><div class="form-group"><label>Nominal per Siswa (Rp)</label><input class="form-control" type="number" id="insSiswaRate" value="200000" oninput="calcInsentifSiswa()"></div></div>
    <div class="grid-2"><div class="form-group"><label>Periode</label><input class="form-control" id="insSiswaPeriode" value="${monthStr()}"></div><div class="form-group"><label>Total Insentif (auto)</label><input class="form-control" id="insSiswaTotal" readonly style="font-weight:700;font-size:1rem;color:var(--success)"></div></div>
    <div class="form-group"><label>Keterangan</label><input class="form-control" id="insSiswaKet" placeholder="Contoh: Batch April 2026, Program Reguler"></div>
    <button class="btn btn-primary" onclick="simpanInsentifSiswa()">Simpan</button>`);
}
function calcInsentifSiswa(){const jml=Number(document.getElementById('insSiswaJml').value)||0;const rate=Number(document.getElementById('insSiswaRate').value)||0;document.getElementById('insSiswaTotal').value=formatCurrency(jml*rate);}
async function simpanInsentifSiswa(){const nama=document.getElementById('insSiswaKary').value;if(!nama)return toast('Pilih karyawan','warning');const jml=Number(document.getElementById('insSiswaJml').value)||0;const rate=Number(document.getElementById('insSiswaRate').value)||0;if(!jml)return toast('Isi jumlah siswa','warning');await db.collection('hrd_insentif').add({nama,departemen:window._insSiswaDept||'',jenis:'Target Siswa',jumlahSiswa:jml,nominalPerSiswa:rate,nominal:jml*rate,periode:document.getElementById('insSiswaPeriode').value,keterangan:document.getElementById('insSiswaKet').value,createdAt:new Date().toISOString()});closeModalDirect();toast('Insentif target siswa disimpan','success');renderInsentif();}

function onInsKaryChange(){const sel=document.getElementById('insKary');const opt=sel.options[sel.selectedIndex];window._insGaji=Number(opt?.dataset?.gaji)||0;window._insDept=opt?.dataset?.dept||'';calcInsentif();}
function calcInsentif(){const kpi=Number(document.getElementById('insKPI').value)||0;let pct=0;if(kpi>=90)pct=15;else if(kpi>=80)pct=10;else if(kpi>=70)pct=5;const nominal=Math.round((window._insGaji||0)*pct/100);document.getElementById('insPersen').value=pct+'%';document.getElementById('insNominal').value=formatCurrency(nominal);window._insCalc={pct,nominal};}
async function simpanInsentif(){const nama=document.getElementById('insKary').value;if(!nama)return toast('Pilih karyawan','warning');await db.collection('hrd_insentif').add({nama,departemen:window._insDept||'',gajiPokok:window._insGaji||0,jenis:'KPI',kpiScore:Number(document.getElementById('insKPI').value)||0,persen:window._insCalc?.pct||0,nominal:window._insCalc?.nominal||0,periode:document.getElementById('insPeriode').value,createdAt:new Date().toISOString()});closeModalDirect();toast('Insentif disimpan','success');renderInsentif();}

async function generateInsentifFromKPI(){
  if(!confirm('Generate insentif untuk semua karyawan berdasarkan data KPI terbaru?'))return;
  const kSnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  const kpiSnap=await db.collection('hrd_kpi').get();
  const kpiMap={};kpiSnap.forEach(d=>{const r=d.data();const n=(r.nama||'').toLowerCase();if(!kpiMap[n]||r.skor>kpiMap[n])kpiMap[n]=r.skor||0;});
  let count=0;
  for(const doc of kSnap.docs){
    const k=doc.data();const kpi=kpiMap[(k.nama||'').toLowerCase()]||0;
    let pct=0;if(kpi>=90)pct=15;else if(kpi>=80)pct=10;else if(kpi>=70)pct=5;
    if(pct===0)continue;
    const nominal=Math.round((k.gajiPokok||0)*pct/100);
    await db.collection('hrd_insentif').add({nama:k.nama,departemen:k.departemen||'',gajiPokok:k.gajiPokok||0,kpiScore:kpi,persen:pct,nominal,periode:monthStr(),createdAt:new Date().toISOString()});
    count++;
  }
  toast(`${count} insentif di-generate dari KPI`,'success');renderInsentif();
}
async function hapusSemuaInsentif(){if(!confirm('Hapus semua data insentif?'))return;const snap=await db.collection('hrd_insentif').get();const batch=db.batch();snap.forEach(d=>batch.delete(d.ref));await batch.commit();toast('Semua insentif dihapus','success');renderInsentif();}

function viewInsentifDetail(id){
  db.collection('hrd_insentif').doc(id).get().then(d=>{const p=d.data();
    openModal(`<div class="modal-title">🏆 Detail Insentif</div>
      <div class="grid-2 mb-16"><div><b>Nama:</b> ${escHtml(p.nama)}</div><div><b>Departemen:</b> ${escHtml(p.departemen||'-')}</div><div><b>Jenis:</b> ${escHtml(p.jenis||'KPI')}</div><div><b>Periode:</b> ${escHtml(p.periode||'-')}</div><div><b>Nominal:</b> <span class="fw-700">${formatCurrency(p.nominal||0)}</span></div>${p.jenis==='KPI'?`<div><b>KPI Score:</b> ${p.kpiScore||0} (${p.persen||0}%)</div>`:`<div><b>Siswa:</b> ${p.jumlahSiswa||0} × ${formatCurrency(p.nominalPerSiswa||0)}</div>`}</div>`);
  });
}
async function editInsentif(id){
  const d=await db.collection('hrd_insentif').doc(id).get();const p=d.data();
  openModal(`<div class="modal-title">✏️ Edit Insentif</div>
    <div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="eiNama" value="${escHtml(p.nama||'')}"></div><div class="form-group"><label>Nominal</label><input class="form-control" type="number" id="eiNominal" value="${p.nominal||0}"></div></div>
    <div class="form-group"><label>Periode</label><input class="form-control" id="eiPeriode" value="${escHtml(p.periode||'')}"></div>
    <button class="btn btn-primary" onclick="simpanEditInsentif('${id}')">💾 Simpan</button>`);
}
async function simpanEditInsentif(id){
  await db.collection('hrd_insentif').doc(id).update({nominal:Number(document.getElementById('eiNominal').value)||0,periode:document.getElementById('eiPeriode').value,updatedAt:new Date().toISOString()});
  closeModalDirect();toast('Insentif diupdate','success');renderInsentif();
}

// ── TAX & BPJS CALCULATOR ─────────────────────────────────────
async function renderTaxCalc(){
  const main=document.getElementById('mainContent');
  const kSnap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  let karyOpts='<option value="">-- Input Manual --</option>';
  kSnap.forEach(d=>{const k=d.data();karyOpts+=`<option value="${k.gajiPokok||0}" data-nama="${escHtml(k.nama)}">${escHtml(k.nama)} — ${formatCurrency(k.gajiPokok||0)}</option>`;});
  main.innerHTML=`<div class="page-title"><span>🧮 Tax & BPJS Calculator</span></div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title mb-16">🧮 Kalkulator Gaji</div>
        <div class="form-group"><label>Pilih Karyawan (atau input manual)</label><select class="form-control" id="tcKarySelect" onchange="onTcKarySelect()">${karyOpts}</select></div>
        <div class="form-group"><label>Gaji Pokok (Rp)</label><input class="form-control" type="number" id="tcGaji" value="5000000" oninput="calcTax()"></div>
        <div class="form-group"><label>Tunjangan (Rp)</label><input class="form-control" type="number" id="tcTunj" value="0" oninput="calcTax()"></div>
        <div class="form-group"><label>Lembur (Rp)</label><input class="form-control" type="number" id="tcLembur" value="0" oninput="calcTax()"></div>
        <div class="form-group"><label>Status PTKP</label><select class="form-control" id="tcPTKP" onchange="calcTax()"><option value="54000000">TK/0 (Rp 54.000.000)</option><option value="58500000">K/0 (Rp 58.500.000)</option><option value="63000000">K/1 (Rp 63.000.000)</option><option value="67500000">K/2 (Rp 67.500.000)</option><option value="72000000">K/3 (Rp 72.000.000)</option></select></div>
        <div style="background:#f8f9ff;padding:16px;border-radius:8px;margin-top:16px;border:1px solid var(--border)">
          <div class="fw-700 mb-12" style="color:var(--accent)">Hasil Perhitungan:</div>
          <div id="tcResultRows"></div>
          <div id="tcResultFooter" class="mt-12"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title mb-16">📊 Potongan per Karyawan</div>
        <div id="tcKaryList">Loading...</div>
      </div>
    </div>`;
  calcTax();loadTaxKaryList();
}
function onTcKarySelect(){const sel=document.getElementById('tcKarySelect');if(sel.value){document.getElementById('tcGaji').value=sel.value;calcTax();}}
function calcTax(){
  const gaji=Number(document.getElementById('tcGaji')?.value)||0;
  const tunj=Number(document.getElementById('tcTunj')?.value)||0;
  const lembur=Number(document.getElementById('tcLembur')?.value)||0;
  const ptkp=Number(document.getElementById('tcPTKP')?.value)||54000000;
  const bruto=gaji+tunj+lembur;
  // Allow manual override of potongan
  const bpjsKesAuto=Math.round(gaji*0.01);
  const bpjsTKAuto=Math.round(gaji*0.02);
  const bpjsKesPerusahaan=Math.round(gaji*0.04);
  const bpjsTKPerusahaan=Math.round(gaji*0.037);
  const nettoTahunan=Math.max(0,(bruto-bpjsKesAuto-bpjsTKAuto)*12-ptkp);
  let pphAuto=0;
  if(nettoTahunan<=60000000)pphAuto=nettoTahunan*0.05;
  else if(nettoTahunan<=250000000)pphAuto=3000000+(nettoTahunan-60000000)*0.15;
  else if(nettoTahunan<=500000000)pphAuto=3000000+28500000+(nettoTahunan-250000000)*0.25;
  else pphAuto=3000000+28500000+62500000+(nettoTahunan-500000000)*0.30;
  const pphBulananAuto=Math.round(pphAuto/12);
  // Use manual values if user edited them, otherwise auto
  const bpjsKes=Number(document.getElementById('tcBpjsKes')?.value)||bpjsKesAuto;
  const bpjsTK=Number(document.getElementById('tcBpjsTK')?.value)||bpjsTKAuto;
  const pphBulanan=Number(document.getElementById('tcPPH')?.value)||pphBulananAuto;
  const thp=bruto-bpjsKes-bpjsTK-pphBulanan;
  
  document.getElementById('tcResultRows').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee"><span style="font-size:.85rem">Bruto</span><span class="fw-700">${formatCurrency(bruto)}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee"><span style="font-size:.82rem">BPJS Kes (1%)</span><input class="form-control" type="number" id="tcBpjsKes" value="${bpjsKes}" oninput="calcTaxResult()" style="width:130px;text-align:right;padding:4px 8px;font-size:.82rem;color:var(--accent)"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee"><span style="font-size:.82rem">BPJS TK/JHT (2%)</span><input class="form-control" type="number" id="tcBpjsTK" value="${bpjsTK}" oninput="calcTaxResult()" style="width:130px;text-align:right;padding:4px 8px;font-size:.82rem;color:var(--accent)"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee"><span style="font-size:.82rem">PPH 21/bulan</span><input class="form-control" type="number" id="tcPPH" value="${pphBulanan}" oninput="calcTaxResult()" style="width:130px;text-align:right;padding:4px 8px;font-size:.82rem;color:var(--accent)"></div>
    <div style="display:flex;justify-content:space-between;padding:12px 0;font-weight:700;font-size:1.05rem;border-top:2px solid var(--accent);margin-top:4px"><span>Take Home Pay</span><span id="tcTHP">${formatCurrency(thp)}</span></div>`;
  document.getElementById('tcResultFooter').innerHTML=`<div style="font-size:.75rem;color:#666;padding-top:8px;border-top:1px dashed #ddd"><b>Kontribusi Perusahaan:</b><br>BPJS Kes (4%): ${formatCurrency(bpjsKesPerusahaan)}<br>BPJS TK (3.7%): ${formatCurrency(bpjsTKPerusahaan)}</div>
    <div class="text-xs mt-8" style="color:#999">💡 Nilai potongan bisa diedit manual. Klik angka untuk mengubah.</div>`;
}
function calcTaxResult(){
  const gaji=Number(document.getElementById('tcGaji')?.value)||0;
  const tunj=Number(document.getElementById('tcTunj')?.value)||0;
  const lembur=Number(document.getElementById('tcLembur')?.value)||0;
  const bruto=gaji+tunj+lembur;
  const bpjsKes=Number(document.getElementById('tcBpjsKes')?.value)||0;
  const bpjsTK=Number(document.getElementById('tcBpjsTK')?.value)||0;
  const pph=Number(document.getElementById('tcPPH')?.value)||0;
  const thp=bruto-bpjsKes-bpjsTK-pph;
  const el=document.getElementById('tcTHP');if(el)el.textContent=formatCurrency(thp);
}
async function loadTaxKaryList(){
  const snap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  let h='<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Gaji</th><th>BPJS Kes</th><th>BPJS TK</th><th>PPH21</th><th>THP</th></tr></thead><tbody>';
  snap.forEach(d=>{const k=d.data();const gaji=k.gajiPokok||0;
    const bpjsKes=Math.round(gaji*0.01);const bpjsTK=Math.round(gaji*0.02);
    const netto=Math.max(0,(gaji-bpjsKes-bpjsTK)*12-54000000);
    let pph=0;if(netto<=60000000)pph=netto*0.05;else if(netto<=250000000)pph=3000000+(netto-60000000)*0.15;else pph=3000000+28500000+(netto-250000000)*0.25;
    const pphBln=Math.round(pph/12);const thp=gaji-bpjsKes-bpjsTK-pphBln;
    h+=`<tr><td class="fw-700">${escHtml(k.nama)}</td><td>${formatCurrency(gaji)}</td><td style="color:var(--accent)">${formatCurrency(bpjsKes)}</td><td style="color:var(--accent)">${formatCurrency(bpjsTK)}</td><td style="color:var(--accent)">${formatCurrency(pphBln)}</td><td class="fw-700">${formatCurrency(thp)}</td></tr>`;
  });
  h+='</tbody></table></div>';
  document.getElementById('tcKaryList').innerHTML=h;
}

