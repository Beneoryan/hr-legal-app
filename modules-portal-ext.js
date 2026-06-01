'use strict';
// ── PORTAL SHARE — Admin share link/QR ke karyawan ────────────
// Setiap karyawan punya link unik yang bisa didownload/share
// ══════════════════════════════════════════════════════════════

async function renderPortalShare() {
  if (!hasAccess(3)) return document.getElementById('mainContent').innerHTML = '<div class="card"><p>Akses ditolak.</p></div>';
  const main = document.getElementById('mainContent');
  const downloadLink = getAppDownloadLink();
  main.innerHTML = `<div class="page-title"><span>📲 Download Aplikasi</span></div>
    <div class="card mb-16"><div class="card-title">📥 Link Aplikasi</div><p class="text-sm mb-16" style="color:#666">Bagikan link ini ke semua karyawan agar mereka bisa mengakses portal lewat browser atau menginstal sebagai aplikasi PWA di Android, iOS, Windows, dan Mac.</p>
      <div class="form-group"><label>Link Download</label><input class="form-control" readonly value="${downloadLink}" id="portalAppLink"></div>
      <div class="flex gap-8"><button class="btn btn-primary btn-sm" onclick="copyDownloadLink()">📋 Salin Link</button><button class="btn btn-success btn-sm" onclick="shareDownloadWhatsApp()">💬 Share WA</button><button class="btn btn-info btn-sm" onclick="shareDownloadEmail()">✉️ Email</button></div>
    </div>
    <div class="grid-2"><div class="card"><div class="card-title mb-16">📱 Android</div><p class="text-sm" style="color:#666">Buka link di browser Chrome, lalu pilih menu dan "Add to Home screen". Aplikasi akan terpasang seperti biasa.</p></div><div class="card"><div class="card-title mb-16">🍎 iOS</div><p class="text-sm" style="color:#666">Buka link di Safari, tap tombol Share lalu pilih "Add to Home Screen". Jika diminta, pilih "Add".</p></div></div>
    <div class="grid-2"><div class="card"><div class="card-title mb-16">💻 Windows</div><p class="text-sm" style="color:#666">Buka link di browser Edge/Chrome, lalu pilih install PWA dari menu browser atau toolbar.</p></div><div class="card"><div class="card-title mb-16"> Mac</div><p class="text-sm" style="color:#666">Buka link di browser Safari/Chrome, lalu gunakan opsi "Add to Home Screen" / "Install App".</p></div></div>`;
}

function getAppDownloadLink() {
  return window.location.origin + window.location.pathname;
}

function copyDownloadLink() {
  const link = getAppDownloadLink();
  navigator.clipboard?.writeText(link).then(() => toast('Link disalin!','success')).catch(() => {
    const ta = document.createElement('textarea'); ta.value = link; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    toast('Link disalin!','success');
  });
}

function shareDownloadWhatsApp() {
  const link = getAppDownloadLink();
  const text = encodeURIComponent(`Halo,

Berikut link download aplikasi HRD IJEF Corp:
${link}

Buka link menggunakan browser dan pilih "Add to Home Screen" atau install PWA untuk akses cepat di Android, iOS, Windows, atau Mac.

— HRD IJEF Corp`);
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

function shareDownloadEmail() {
  const link = getAppDownloadLink();
  const subject = encodeURIComponent('Link Download Aplikasi HRD IJEF Corp');
  const body = encodeURIComponent(`Halo,

Silakan buka link berikut untuk mengakses aplikasi HRD IJEF Corp:
${link}

Aplikasi mendukung browser, PWA, dan dapat dipasang di Android, iOS, Windows, dan Mac.`);
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

async function loadLamaranMasuk() {
  const snap = await db.collection('hrd_lamaran').get();
  let html = '';
  if (snap.empty) html = '<p class="text-sm" style="color:#999">Belum ada lamaran masuk</p>';
  else {
    html = '<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Posisi</th><th>Email</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
    snap.forEach(d => {
      const p = d.data();
      const badge = p.status==='diterima'?'badge-success':p.status==='ditolak'?'badge-danger':'badge-warning';
      html += `<tr><td class="fw-700">${escHtml(p.nama)}</td><td>${escHtml(p.posisi||'-')}</td><td>${escHtml(p.email||'-')}</td><td>${formatDate(p.createdAt)}</td><td><span class="badge ${badge}">${p.status||'baru'}</span></td><td><button class="btn btn-xs btn-info" onclick="detailLamaran('${d.id}')">👁️</button> <button class="btn btn-xs btn-success" onclick="updateLamaran('${d.id}','diterima')">✅</button> <button class="btn btn-xs btn-danger" onclick="updateLamaran('${d.id}','ditolak')">❌</button></td></tr>`;
    });
    html += '</tbody></table></div>';
  }
  document.getElementById('lamaranList').innerHTML = html;
}

function detailLamaran(id) {
  db.collection('hrd_lamaran').doc(id).get().then(d => {
    const p = d.data();
    openModal(`<div class="modal-title">📄 Detail Lamaran</div>
      <div class="grid-2 mb-16">
        <div><b>Nama:</b> ${escHtml(p.nama)}</div>
        <div><b>Email:</b> ${escHtml(p.email||'-')}</div>
        <div><b>Telepon:</b> ${escHtml(p.telepon||'-')}</div>
        <div><b>Posisi:</b> ${escHtml(p.posisi||'-')}</div>
        <div><b>Pendidikan:</b> ${escHtml(p.pendidikan||'-')}</div>
        <div><b>Pengalaman:</b> ${escHtml(p.pengalaman||'-')}</div>
      </div>
      <div class="mb-16"><b>Tentang Diri:</b><div class="text-sm mt-8" style="white-space:pre-wrap;background:#f8f9ff;padding:12px;border-radius:6px">${escHtml(p.tentang||'-')}</div></div>
      <div><b>Tanggal Melamar:</b> ${formatDateTime(p.createdAt)}</div>`, true);
  });
}

async function updateLamaran(id, status) {
  await db.collection('hrd_lamaran').doc(id).update({status, updatedBy: currentUser.nama, updatedAt: new Date().toISOString()});
  toast(`Lamaran ${status}`, 'success');
  loadLamaranMasuk();
}

// ══════════════════════════════════════════════════════════════
// ── PUBLIC PORTAL CALON KARYAWAN — No Login Required ──────────
// Accessible via #calon hash
// ══════════════════════════════════════════════════════════════

async function renderPublicPortalCalon() {
  document.getElementById('app').innerHTML = `
    <div style="background:linear-gradient(135deg,var(--primary-dark),var(--primary));color:#fff;padding:24px 20px;text-align:center">
      <div style="font-size:1.4rem;font-weight:700">🏛️ LPK IJEF CORP</div>
      <div style="font-size:.9rem;opacity:.8;margin-top:4px">Portal Calon Karyawan</div>
    </div>
    <div style="max-width:900px;margin:0 auto;padding:20px">
      <div class="tabs" id="calonTabs">
        <div class="tab active" onclick="loadCalonTab('lowongan')">📝 Lowongan</div>
        <div class="tab" onclick="loadCalonTab('lamar')">📤 Kirim Lamaran</div>
        <div class="tab" onclick="loadCalonTab('tentang')">🏛️ Tentang Perusahaan</div>
        <div class="tab" onclick="loadCalonTab('peraturan')">📜 Peraturan</div>
      </div>
      <div id="calonContent"></div>
      <div class="text-center mt-16" style="padding:20px;border-top:1px solid var(--border)">
        <p class="text-xs" style="color:#999">© 2026 LPK IJEF Corp — HRD & Legal System</p>
        <button class="btn btn-outline btn-sm mt-8" onclick="window.location.hash='';window.location.reload()">🔐 Login Karyawan</button>
      </div>
    </div>`;
  loadCalonTab('lowongan');
}

async function loadCalonTab(tab) {
  document.querySelectorAll('#calonTabs .tab').forEach((t,i) => t.classList.toggle('active',
    (tab==='lowongan'&&i===0)||(tab==='lamar'&&i===1)||(tab==='tentang'&&i===2)||(tab==='peraturan'&&i===3)));
  const el = document.getElementById('calonContent');

  if (tab === 'lowongan') {
    const snap = await db.collection('hrd_lowongan').where('status','==','open').get();
    let html = '<div class="card"><div class="card-title mb-16">📝 Lowongan Tersedia</div>';
    if (snap.empty) html += '<div class="empty-state"><div class="icon">📝</div><p>Saat ini belum ada lowongan terbuka</p></div>';
    else {
      snap.forEach(d => {
        const p = d.data();
        html += `<div style="padding:16px;border:1px solid var(--border);border-radius:8px;margin-bottom:12px;border-left:4px solid var(--primary)">
          <div class="fw-700" style="font-size:1rem;color:var(--primary)">${escHtml(p.posisi)}</div>
          <div class="text-sm mt-8"><b>Departemen:</b> ${escHtml(p.departemen||'-')}</div>
          <div class="text-sm"><b>Deadline:</b> ${formatDate(p.deadline)}</div>
          ${p.deskripsi?`<div class="text-sm mt-8" style="color:#666">${escHtml(p.deskripsi)}</div>`:''}
          <button class="btn btn-primary btn-sm mt-8" onclick="loadCalonTab('lamar')">📤 Lamar Posisi Ini</button>
        </div>`;
      });
    }
    html += '</div>';
    el.innerHTML = html;

  } else if (tab === 'lamar') {
    // Load open positions for dropdown
    const snap = await db.collection('hrd_lowongan').where('status','==','open').get();
    let posOptions = '<option value="">-- Pilih Posisi --</option>';
    snap.forEach(d => { const p=d.data(); posOptions += `<option value="${escHtml(p.posisi)}">${escHtml(p.posisi)} (${escHtml(p.departemen||'-')})</option>`; });

    el.innerHTML = `<div class="card">
      <div class="card-title mb-16">📤 Form Lamaran Kerja</div>
      <p class="text-sm mb-16" style="color:#666">Isi form di bawah untuk mengajukan lamaran kerja di LPK IJEF Corp.</p>
      <div class="grid-2">
        <div class="form-group"><label>Nama Lengkap *</label><input class="form-control" id="lamNama"></div>
        <div class="form-group"><label>Email *</label><input class="form-control" type="email" id="lamEmail"></div>
        <div class="form-group"><label>No. Telepon *</label><input class="form-control" id="lamTelp"></div>
        <div class="form-group"><label>Posisi yang Dilamar *</label><select class="form-control" id="lamPosisi">${posOptions}</select></div>
        <div class="form-group"><label>Pendidikan Terakhir</label><select class="form-control" id="lamPendidikan"><option>SMA/SMK</option><option>D3</option><option>S1</option><option>S2</option><option>S3</option></select></div>
        <div class="form-group"><label>Pengalaman Kerja</label><select class="form-control" id="lamPengalaman"><option>Fresh Graduate</option><option>1-2 Tahun</option><option>3-5 Tahun</option><option>5+ Tahun</option></select></div>
      </div>
      <div class="form-group"><label>Tentang Diri / Motivasi</label><textarea class="form-control" id="lamTentang" placeholder="Ceritakan tentang diri Anda, keahlian, dan motivasi melamar..." style="min-height:120px"></textarea></div>
      <div class="form-group"><label>Alamat</label><textarea class="form-control" id="lamAlamat" placeholder="Alamat lengkap"></textarea></div>
      <button class="btn btn-primary" style="width:100%;padding:12px" onclick="kirimLamaran()">📤 Kirim Lamaran</button>
    </div>`;

  } else if (tab === 'tentang') {
    el.innerHTML = `<div class="card">
      <div class="card-title mb-16">🏛️ Tentang LPK IJEF CORP</div>
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:2rem">🏛️</div>
        <div class="fw-700" style="font-size:1.2rem;color:var(--primary);margin-top:8px">LPK IJEF CORP</div>
      </div>
      <div class="text-sm" style="line-height:1.8">
        <p>LPK IJEF Corp adalah lembaga pelatihan kerja yang berkomitmen untuk mengembangkan sumber daya manusia berkualitas. Kami menyediakan lingkungan kerja yang profesional, mendukung pertumbuhan karir, dan menghargai kontribusi setiap karyawan.</p>
        <div class="mt-16"><b>Mengapa Bergabung dengan Kami?</b></div>
        <ul style="padding-left:20px;margin-top:8px">
          <li>Lingkungan kerja profesional dan kondusif</li>
          <li>Kesempatan pengembangan karir</li>
          <li>Program pelatihan berkelanjutan</li>
          <li>Tunjangan dan benefit kompetitif</li>
          <li>Work-life balance</li>
        </ul>
        <div class="mt-16"><b>Nilai-Nilai Perusahaan:</b></div>
        <div class="grid-2 mt-8">
          <div class="stat-card"><div class="stat-icon">🎯</div><div class="fw-700">Integritas</div><div class="text-xs">Jujur dan bertanggung jawab</div></div>
          <div class="stat-card"><div class="stat-icon">🤝</div><div class="fw-700">Kerjasama</div><div class="text-xs">Kolaborasi tim yang solid</div></div>
          <div class="stat-card"><div class="stat-icon">🚀</div><div class="fw-700">Inovasi</div><div class="text-xs">Terus belajar dan berkembang</div></div>
          <div class="stat-card"><div class="stat-icon">💪</div><div class="fw-700">Profesional</div><div class="text-xs">Standar kerja tinggi</div></div>
        </div>
      </div>
    </div>`;

  } else if (tab === 'peraturan') {
    el.innerHTML = `<div class="card"><div class="card-title mb-16">📜 Peraturan Perusahaan — LPK IJEF CORP</div><p class="text-sm mb-16" style="color:#666">Berikut ringkasan peraturan perusahaan yang berlaku bagi seluruh karyawan.</p>${renderPeraturanHTML(true)}</div>`;
  }
}

async function kirimLamaran() {
  const nama = document.getElementById('lamNama').value.trim();
  const email = document.getElementById('lamEmail').value.trim();
  const telp = document.getElementById('lamTelp').value.trim();
  const posisi = document.getElementById('lamPosisi').value;

  if (!nama || !email || !telp) return toast('Nama, email, dan telepon wajib diisi', 'warning');
  if (!posisi) return toast('Pilih posisi yang dilamar', 'warning');

  const data = {
    nama,
    email,
    telepon: telp,
    posisi,
    pendidikan: document.getElementById('lamPendidikan').value,
    pengalaman: document.getElementById('lamPengalaman').value,
    tentang: document.getElementById('lamTentang').value,
    alamat: document.getElementById('lamAlamat').value,
    status: 'baru',
    createdAt: new Date().toISOString()
  };

  await db.collection('hrd_lamaran').add(data);

  // Also add to kandidat pipeline
  await db.collection('hrd_kandidat').add({
    nama: data.nama,
    email: data.email,
    posisi: data.posisi,
    stage: 'Applied',
    sumber: 'Portal Calon Karyawan',
    createdAt: new Date().toISOString()
  });

  document.getElementById('calonContent').innerHTML = `<div class="card text-center" style="padding:40px">
    <div style="font-size:3rem;margin-bottom:16px">✅</div>
    <div class="fw-700" style="font-size:1.2rem;color:var(--success)">Lamaran Berhasil Dikirim!</div>
    <p class="text-sm mt-8" style="color:#666">Terima kasih, ${escHtml(nama)}. Lamaran Anda untuk posisi <b>${escHtml(posisi)}</b> telah kami terima.</p>
    <p class="text-sm mt-8" style="color:#666">Tim HRD kami akan menghubungi Anda melalui email/telepon jika lolos seleksi administrasi.</p>
    <button class="btn btn-primary mt-16" onclick="loadCalonTab('lowongan')">📝 Lihat Lowongan Lain</button>
  </div>`;
  toast('Lamaran terkirim!', 'success');
}


// ── DISC TEST PAGE (Admin/HR view with View, Edit, Delete, Sync KPI) ──────────
function renderDiscTestPage(){
  const main=document.getElementById('mainContent');
  main.innerHTML=`
  <div class="page-title"><span>🧠 DISC Personality Test</span></div>
  <div class="card">
    <div class="card-header"><div class="card-title">Tes Kepribadian DISC</div>
      <div class="flex gap-8">
        <a href="disc-test.html" target="_blank" class="btn btn-primary btn-sm">🔗 Link Tes (Calon Karyawan)</a>
        <button class="btn btn-warning btn-sm" onclick="modalDiscEvalKaryawan()">📊 Evaluasi Karyawan (Pilih)</button>
      </div>
    </div>
    <div style="background:#e3f2fd;border-radius:8px;padding:14px;margin-bottom:16px;border-left:4px solid var(--info)">
      <p class="text-sm" style="line-height:1.6"><strong>DISC</strong> = Dominance, Influence, Steadiness, Compliance.<br>
      • <strong>Calon Karyawan:</strong> Bagikan link tes kepada kandidat saat rekrutmen<br>
      • <strong>Evaluasi Periodik:</strong> Pilih karyawan dari database, data otomatis terisi<br>
      • <strong>Portal Karyawan:</strong> Karyawan aktif bisa tes langsung dari portal masing-masing<br>
      • <strong>Sinkron KPI:</strong> Hasil DISC bisa disinkronkan ke data KPI karyawan</p>
    </div>
  </div>
  <div class="card"><div class="card-header"><div class="card-title">📋 Riwayat Hasil Tes</div><div class="flex gap-8"><button class="btn btn-success btn-sm" onclick="syncAllDiscToKPI()">🔄 Sinkron Semua ke KPI</button><button class="btn btn-danger btn-sm" onclick="hapusSemuaDiscResults()">🗑️ Hapus Semua Riwayat</button></div></div>
    <div class="flex gap-8 mb-16"><input class="form-control" placeholder="Cari nama..." id="dSrc" oninput="fltDisc()" style="max-width:250px"><select class="form-control" id="dFlt" onchange="fltDisc()" style="max-width:180px"><option value="">Semua</option><option value="calon">Calon</option><option value="evaluasi">Evaluasi</option></select></div>
    <div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Nama</th><th>Mode</th><th>Posisi</th><th>Tipe</th><th>Profil</th><th>Aksi</th></tr></thead><tbody id="dTbl"><tr><td colspan="7" class="text-center">Memuat...</td></tr></tbody></table></div>
  </div>`;
  loadDiscHist();
}

async function modalDiscEvalKaryawan(){
  const snap=await db.collection('hrd_karyawan').where('status','==','aktif').get();
  let opts='<option value="">-- Pilih Karyawan --</option>';
  snap.forEach(d=>{const p=d.data();opts+=`<option value="${d.id}" data-nama="${escHtml(p.nama)}" data-nip="${escHtml(p.nip||'')}" data-dept="${escHtml(p.departemen||'')}" data-pos="${escHtml(p.posisi||'')}">${escHtml(p.nama)} — ${escHtml(p.departemen||'')} (${escHtml(p.nip||'')})</option>`;});
  openModal(`<div class="modal-title">📊 Evaluasi DISC — Pilih Karyawan</div>
    <div class="form-group"><label>Karyawan</label><select class="form-control" id="discEvalSelect" onchange="onDiscEvalSelect()">${opts}</select></div>
    <div id="discEvalInfo" style="display:none;background:#f8f9ff;border-radius:8px;padding:12px;margin-bottom:16px">
      <div class="grid-2" style="font-size:.82rem"><div><strong>Nama:</strong> <span id="deNama">-</span></div><div><strong>NIP:</strong> <span id="deNip">-</span></div><div><strong>Departemen:</strong> <span id="deDept">-</span></div><div><strong>Posisi:</strong> <span id="dePos">-</span></div></div>
    </div>
    <div class="form-group"><label>Periode Evaluasi</label><input class="form-control" id="discEvalPeriode" placeholder="Contoh: Q1 2026, Semester 1 2026"></div>
    <button class="btn btn-primary" onclick="startDiscEvalForKaryawan()">Mulai Tes DISC →</button>`,true);
}

function onDiscEvalSelect(){
  const sel=document.getElementById('discEvalSelect');
  const opt=sel.options[sel.selectedIndex];
  if(!sel.value){document.getElementById('discEvalInfo').style.display='none';return;}
  document.getElementById('discEvalInfo').style.display='block';
  document.getElementById('deNama').textContent=opt.dataset.nama;
  document.getElementById('deNip').textContent=opt.dataset.nip;
  document.getElementById('deDept').textContent=opt.dataset.dept;
  document.getElementById('dePos').textContent=opt.dataset.pos;
}

function startDiscEvalForKaryawan(){
  const sel=document.getElementById('discEvalSelect');
  const opt=sel.options[sel.selectedIndex];
  if(!sel.value)return toast('Pilih karyawan dulu','warning');
  const periode=document.getElementById('discEvalPeriode').value||'';
  const params=new URLSearchParams({nama:opt.dataset.nama,nip:opt.dataset.nip,dept:opt.dataset.dept,pos:opt.dataset.pos,periode,mode:'evaluasi'});
  closeModalDirect();
  window.open('disc-test.html#evaluasi?'+params.toString(),'_blank');
}

async function loadDiscHist(){const snap=await db.collection('hrd_disc_results').get();window._dData=[];snap.forEach(d=>window._dData.push({id:d.id,...d.data()}));fltDisc();}
function fltDisc(){
  const q=(document.getElementById('dSrc')?.value||'').toLowerCase(),m=document.getElementById('dFlt')?.value||'';
  const data=(window._dData||[]).filter(r=>{if(q&&!r.nama?.toLowerCase().includes(q))return false;if(m&&r.mode!==m)return false;return true;});
  let h='';if(!data.length)h='<tr><td colspan="7" class="text-center" style="color:var(--text-light)">Belum ada data</td></tr>';
  else data.forEach(r=>{const dt=r.createdAt?new Date(r.createdAt).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'-';const badge=r.mode==='evaluasi'?'<span class="badge badge-warning">Evaluasi</span>':'<span class="badge badge-info">Calon</span>';
    h+=`<tr><td>${dt}</td><td class="fw-700">${escHtml(r.nama)}</td><td>${badge}</td><td>${escHtml(r.posisi||'-')}</td><td class="fw-700" style="color:var(--primary)">${escHtml(r.pattern||'-')}</td><td>${escHtml(r.profileName||'-')}</td><td><button class="btn btn-xs btn-info" onclick="viewDiscResult('${r.id}')">👁️</button> <button class="btn btn-xs btn-warning" onclick="editDiscResult('${r.id}')">✏️</button> <button class="btn btn-xs btn-success" onclick="syncDiscToKPI('${r.id}')">📈</button> <button class="btn btn-xs btn-danger" onclick="deleteDiscResult('${r.id}')">🗑️</button></td></tr>`;
  });
  document.getElementById('dTbl').innerHTML=h;
}

async function viewDiscResult(id){
  const doc=await db.collection('hrd_disc_results').doc(id).get();if(!doc.exists)return toast('Data tidak ditemukan','error');
  const r=doc.data();const s1=r.seg1||{D:0,I:0,S:0,C:0};const s2=r.seg2||{D:0,I:0,S:0,C:0};const s3=r.seg3||{D:0,I:0,S:0,C:0};
  function bG(data,title,sub){const vals=['D','I','S','C'].map(t=>data[t]||0);const h=120;const toY=v=>h/2-((v/8)*(h/2));let dots='';vals.forEach((v,i)=>{dots+=`<circle cx="${15+i*40}" cy="${toY(v)}" r="3" fill="#1a237e"/><text x="${15+i*40}" y="${toY(v)-8}" text-anchor="middle" font-size="7" font-weight="700" fill="${v>=0?'#2e7d32':'#c62828'}">${v>0?'+':''}${typeof v==='number'?v.toFixed(1):v}</text>`;});const pts=vals.map((v,i)=>`${15+i*40},${toY(v)}`).join(' ');return`<div style="text-align:center;flex:1;min-width:150px"><div style="font-size:.63rem;font-weight:700;color:var(--primary)">${title}</div><div style="font-size:.55rem;color:#999">${sub}</div><svg width="155" height="${h+18}" viewBox="0 0 155 ${h+18}" style="border:1px solid #ddd;border-radius:4px;background:#fafafa"><line x1="5" y1="${h/2}" x2="150" y2="${h/2}" stroke="#999" stroke-width="0.5" stroke-dasharray="2"/><polyline points="${pts}" fill="none" stroke="#1a237e" stroke-width="1.5"/>${dots}<text x="15" y="${h+12}" text-anchor="middle" font-size="8" font-weight="700">D</text><text x="55" y="${h+12}" text-anchor="middle" font-size="8" font-weight="700">I</text><text x="95" y="${h+12}" text-anchor="middle" font-size="8" font-weight="700">S</text><text x="135" y="${h+12}" text-anchor="middle" font-size="8" font-weight="700">C</text></svg></div>`;}
  const graphs=bG(s1,'GRAPH 1 MOST','Mask Public Self')+bG(s2,'GRAPH 2 LEAST','Core Private Self')+bG(s3,'GRAPH 3 CHANGE','Mirror Perceived Self');
  const dt=r.createdAt?new Date(r.createdAt).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}):'-';
  const dProf={'D':{pos:['Individualis','High Motivation','Efektif','Percaya Diri','Kreatif','Leader'],neg:['Ego Tinggi','Kurang Sensitif','Agresif','Terlalu Dominan'],career:'Attorney, Sales Representative, Production Director, Strategic Planning, Self-Employment.'},'I':{pos:['Antusias','Optimis','Persuasif','Ramah','Inspirasional'],neg:['Emosional','Impulsif','Kurang fokus','Tidak terorganisir'],career:'Public Relations, Lecturing, Advertising, Hospitality, Human Resources.'},'S':{pos:['Stabil','Sabar','Loyal','Pendengar baik','Dapat diandalkan'],neg:['Anti Perubahan','Sulit Adaptasi','Menghindari Konflik','Lambat Memutuskan'],career:'Administrative Work, Accounting, Research, Retail, Service.'},'C':{pos:['Detail','Analitis','Rapi','Organized','Sistematis'],neg:['Pendiam','Anti Kritik','Kaku','Terlalu Detail'],career:'Planner, Engineer, IT Management, Quality Controller, Accountant.'},'D-I':{pos:['Pekerja Keras','Leader','Tegas','Logis'],neg:['Cepat Bosan','Dingin','Anti Aturan'],career:'General Management, Sales Management, Marketing, Consultancy.'},'D-S':{pos:['Objektif','Analitis','Mandiri','Stabil','Ulet'],neg:['Menghindari Konflik','Kurang fleksibel'],career:'Project Management, Researcher, Systems Analyst, IT.'},'D-C':{pos:['Tekun','Sensitif','Keputusan kuat','Kreatif'],neg:['Perfeksionis','Lambat keputusan'],career:'Engineering, Planning, Accountancy, Quality Control.'},'I-S':{pos:['Hangat','Simpati','Tenang','Pendengar baik','Toleran','Penjaga damai'],neg:['Kurang tegas','Terlalu toleran','Sulit membuat keputusan'],career:'Personnel, Training, Psychologist, Nursing, Social Work.'},'S-I':{pos:['Hangat','Simpati','Pendengar baik','Toleran','Penjaga damai','Moderat'],neg:['Kurang tegas','Terlalu toleran','Sulit membuat keputusan'],career:'Personnel, Training, Hotelier, Travel Agent, Psychologist, Nurse.'},'I-C':{pos:['Ramah','Suka berteman','Dapat mengendalikan diri','Perfeksionis alamiah'],neg:['Kadang salah menilai','Terlalu optimis'],career:'Teaching, Training, Specialist Selling, Marketing.'},'S-C':{pos:['Detail','Empati','Loyal','Teliti','Peduli'],neg:['Anti Kritik','Sulit Adaptasi','Introvert'],career:'Office Manager, Planner, Accountant, Health Care.'},'C-D':{pos:['Sensitif','Berorientasi tugas','Kukuh','Efektif'],neg:['Dingin','Menjaga jarak','Tidak mudah percaya'],career:'Engineering, Research, Planning, Accountancy.'},'C-S':{pos:['Detail','Sistematik','Bijaksana','Diplomatis'],neg:['Menghindari Konflik','Lambat Memutuskan','Anti Perubahan'],career:'Researcher, Engineer, IT Management, Planner.'}};
  function gPD(pat){if(dProf[pat])return dProf[pat];const p=pat?pat.split('-'):[];if(p.length>=2&&dProf[p[0]+'-'+p[1]])return dProf[p[0]+'-'+p[1]];if(dProf[p[0]])return dProf[p[0]];return{pos:[],neg:[],career:''};}
  const pD=gPD(r.pattern||'');const posT=r.positiveTraits&&r.positiveTraits.length?r.positiveTraits:pD.pos;const negT=r.negativeTraits&&r.negativeTraits.length?r.negativeTraits:pD.neg;const career=r.career||pD.career;
  let posH='',negH='',maskT='',coreT='',mirrorT='';
  posT.forEach(t=>{posH+=`<div style="padding:2px 0;font-size:.73rem;color:#2e7d32">✅ ${escHtml(t)}</div>`;maskT+=`<div style="font-size:.7rem">${escHtml(t)}</div>`;});
  negT.forEach(t=>{negH+=`<div style="padding:2px 0;font-size:.73rem;color:#c62828">⚠️ ${escHtml(t)}</div>`;coreT+=`<div style="font-size:.7rem">${escHtml(t)}</div>`;});
  [...posT,...negT].forEach(t=>{mirrorT+=`<div style="font-size:.7rem">${escHtml(t)}</div>`;});
  const dn={D:'Dominance',I:'Influence',S:'Steadiness',C:'Compliance'};const dd={D:'berorientasi pada hasil, suka tantangan, tegas, dan mandiri',I:'ramah, optimis, persuasif, dan suka bersosialisasi',S:'sabar, loyal, konsisten, dan kooperatif',C:'perfeksionis, detail, analitis, dan terorganisir'};const ddL={D:'pendiam, menghindari konfrontasi',I:'dingin, menjaga jarak, kurang percaya orang lain',S:'tidak sabar, suka perubahan',C:'spontan, fleksibel, kurang mengikuti aturan'};
  const sorted=Object.entries(s3).sort((a,b)=>b[1]-a[1]);const dom=sorted.filter(([_,v])=>v>0);const weak=sorted.filter(([_,v])=>v<0);
  let kes=`Berdasarkan hasil tes, <b>${escHtml(r.nama)}</b> memiliki profil kepribadian dominan <b>${escHtml(r.pattern||'-')}</b>. Ini berarti ia adalah seorang <b>${escHtml(r.profileName||'-')}</b>.<br><br>`;
  kes+=`<b>1. Profil Konsisten</b><br>Ketiga grafik menunjukkan pola serupa. Ini menandakan bahwa ia adalah <b>pribadi yang otentik dan apa adanya</b>. Cara ia menampilkan diri ke publik sama dengan karakter aslinya.<br><br>`;
  kes+=`<b>2. Karakter Utama: "${escHtml(r.profileName||'-')}"</b><br>Profilnya adalah gabungan dari tipe yang kuat:<br>`;
  dom.forEach(([t])=>{kes+=`<b>Sisi ${t} (${dn[t]}) yang tinggi:</b> Ini membuatnya menjadi pribadi yang <b>${dd[t]}</b>.<br>`;});
  weak.forEach(([t])=>{kes+=`<b>Sisi ${t} (${dn[t]}) yang rendah:</b> Ini menjelaskan mengapa ia cenderung <b>${ddL[t]}</b>.<br>`;});
  kes+=`<br><b>Kesimpulan Karakter</b><br>Secara keseluruhan, ${escHtml(r.nama)} adalah seorang "<b>${escHtml(r.profileName||'-')}</b>".<br><b>Kekuatan:</b> ${posT.join(', ')}.<br><b>Potensi Tantangan:</b> ${negT.join(', ')}.`;
  const descMap={'D':'Memiliki rasa ego yang tinggi dan cenderung individualis dengan standard yang sangat tinggi. Mampu memimpin situasi dan orang lain dalam rangka mencapai sasarannya. Ia menghindari sesuatu yang biasa-biasa dan cenderung mencari tantangan baru.','I':'Merupakan seorang yang antusias dan optimistik, ia lebih suka mencapai sasarannya melalui orang lain. Sangat menonjol dalam keterampilan berkomunikasi. Memiliki kemampuan untuk memotivasi dan memberi semangat.','S':'Merupakan individu konsisten yang berusaha menjaga lingkungan yang tidak berubah. Sabar, loyal dan suka menolong. Sangat baik bekerja dengan petunjuk dan peraturan yang jelas.','C':'Seorang yang praktis, cakap dan unik. Menyukai hal yang detil dan logis; secara alamiah sangat analitis. Hati-hati dalam membuat keputusan berdasarkan logika, bukan emosi.','D-I':'Tidak basa-basi dan tegas, berpandangan jauh ke depan, progresif dan mau berkompetisi. Mempunyai kemampuan memimpin yang baik dan minat dengan cakupan yang luas.','D-S':'Seorang yang obyektif dan analitis. Ingin terlibat dalam situasi dan memberikan bantuan. Termotivasi oleh target pribadi, ulet dalam memulai pekerjaan.','D-C':'Sensitif terhadap permasalahan, memiliki kreativitas baik dalam memecahkan masalah. Dapat menyelesaikan tugas penting dalam waktu singkat.','I-S':'Mengesankan orang akan kehangatan, simpati dan pengertiannya. Memiliki ketenangan dalam situasi sosial. Merupakan pendengar yang baik dan penjaga damai.','S-I':'Mengesankan orang akan kehangatan dan simpati. Penjaga damai yang sebenarnya dan akan bekerja untuk menjaga kedamaian dalam setiap keadaan.','I-C':'Ramah dan suka berteman; merasa nyaman walaupun dengan orang asing. Perfeksionis secara alamiah.','S-C':'Orang yang baik secara alamiah dan sangat berorientasi detil. Peduli dan teliti dalam penyelesaian tugas.','C-D':'Sangat berorientasi pada tugas dan sensitif pada permasalahan. Kukuh dan mempunyai pendekatan efektif dalam pemecahan masalah. Membuat keputusan berdasar fakta.','C-S':'Berpikir sistematis dan mengikuti prosedur. Teratur, teliti dan fokus pada detil. Sangat berhati-hati, mengharapkan akurasi dan standard tinggi.'};
  function gDesc(p){if(descMap[p])return descMap[p];const x=p?p.split('-'):[];if(x.length>=2&&descMap[x[0]+'-'+x[1]])return descMap[x[0]+'-'+x[1]];return descMap[x[0]]||'';}
  const kpiScore=r.kpiScore||70;const kpiGrade=kpiScore>=90?'A':kpiScore>=80?'B':kpiScore>=70?'C':kpiScore>=60?'D':'E';
  openModal(`<div class="modal-title">📊 D.I.S.C. Personality System Graph Page</div>
    <div style="font-size:.78rem;margin-bottom:8px;background:#f8f9ff;padding:10px;border-radius:8px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:3px"><div><b>Name:</b> ${escHtml(r.nama)}</div><div><b>Tanggal:</b> ${dt}</div><div><b>Mode:</b> ${r.mode==='evaluasi'?'Evaluasi':'Calon'}</div><div><b>Posisi:</b> ${escHtml(r.posisi||'-')}</div>${r.departemen?`<div><b>Dept:</b> ${escHtml(r.departemen)}</div>`:''}${r.evaluasiPeriode?`<div><b>Periode:</b> ${escHtml(r.evaluasiPeriode)}</div>`:''}<div><b>KPI:</b> <span class="badge badge-${kpiScore>=80?'success':kpiScore>=60?'warning':'danger'}">${kpiScore} (${kpiGrade})</span></div></div></div>
    <div style="text-align:center;margin-bottom:8px"><span style="display:inline-block;padding:5px 14px;background:linear-gradient(135deg,var(--primary),#283593);color:#fff;border-radius:14px;font-weight:700;font-size:.85rem">${escHtml(r.profileName||'-')} (${escHtml(r.pattern||'-')})</span></div>
    <div style="overflow-x:auto;margin-bottom:8px"><table style="width:auto;margin:0 auto;border-collapse:collapse;font-size:.7rem"><thead><tr style="background:var(--primary);color:#fff"><th style="padding:3px 7px">Line</th><th style="padding:3px 7px">D</th><th style="padding:3px 7px">I</th><th style="padding:3px 7px">S</th><th style="padding:3px 7px">C</th><th style="padding:3px 7px">tot</th></tr></thead><tbody><tr><td style="padding:3px 7px;border:1px solid #ddd;font-weight:700">1(P)</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawP?.D||0}</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawP?.I||0}</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawP?.S||0}</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawP?.C||0}</td><td style="padding:3px 7px;border:1px solid #ddd;color:red">24</td></tr><tr><td style="padding:3px 7px;border:1px solid #ddd;font-weight:700">2(K)</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawK?.D||0}</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawK?.I||0}</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawK?.S||0}</td><td style="padding:3px 7px;border:1px solid #ddd">${r.rawK?.C||0}</td><td style="padding:3px 7px;border:1px solid #ddd;color:red">24</td></tr><tr><td style="padding:3px 7px;border:1px solid #ddd;font-weight:700">3</td><td style="padding:3px 7px;border:1px solid #ddd">${typeof s3.D==='number'?s3.D.toFixed(1):s3.D}</td><td style="padding:3px 7px;border:1px solid #ddd">${typeof s3.I==='number'?s3.I.toFixed(1):s3.I}</td><td style="padding:3px 7px;border:1px solid #ddd">${typeof s3.S==='number'?s3.S.toFixed(1):s3.S}</td><td style="padding:3px 7px;border:1px solid #ddd">${typeof s3.C==='number'?s3.C.toFixed(1):s3.C}</td><td style="padding:3px 7px;border:1px solid #ddd"></td></tr></tbody></table></div>
    <div style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap">${graphs}</div>
    <div style="margin-bottom:10px"><div style="font-size:.75rem;font-weight:700;color:var(--primary);text-align:center;margin-bottom:6px">Gambaran Karakter</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><div><div style="font-size:.65rem;font-weight:700;text-decoration:underline;margin-bottom:3px">Mask Public Self</div><div style="font-size:.68rem;font-weight:700;color:var(--primary)">${escHtml(r.profileName||'-')}</div>${maskT}</div><div><div style="font-size:.65rem;font-weight:700;text-decoration:underline;margin-bottom:3px">Core Private Self</div><div style="font-size:.68rem;font-weight:700;color:var(--primary)">${escHtml(r.profileName||'-')}</div>${coreT}</div><div><div style="font-size:.65rem;font-weight:700;text-decoration:underline;margin-bottom:3px">Mirror Perceived Self</div><div style="font-size:.68rem;font-weight:700;color:var(--primary)">${escHtml(r.profileName||'-')}</div>${mirrorT}</div></div></div>
    <div style="background:#f8f9ff;border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:10px;font-size:.76rem;line-height:1.6"><b>📝 Deskripsi Kepribadian:</b><br>${escHtml(gDesc(r.pattern||''))}</div>
    <div style="border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:10px;font-size:.76rem;line-height:1.7"><b>🔍 Analisis & Kesimpulan Karakter:</b><br><br>${kes}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px"><div style="background:#e8f5e9;border-radius:6px;padding:8px"><div style="font-size:.7rem;font-weight:700;color:#2e7d32;margin-bottom:3px">✅ Sifat Positif</div>${posH||'-'}</div><div style="background:#ffebee;border-radius:6px;padding:8px"><div style="font-size:.7rem;font-weight:700;color:#c62828;margin-bottom:3px">⚠️ Sifat Negatif</div>${negH||'-'}</div></div>
    ${career?`<div style="background:#e8f5e9;border-radius:6px;padding:10px;margin-bottom:10px"><div style="font-size:.72rem;font-weight:700;color:#1b5e20;margin-bottom:6px">💼 Rekomendasi Bidang Pekerjaan yang Cocok</div><div style="font-size:.75rem;color:#2e7d32;line-height:1.6">Melihat profilnya yang kuat dalam ${dom.map(([t])=>dn[t].toLowerCase()).join(' dan ')}, <b>${escHtml(r.nama)}</b> akan sangat unggul dalam pekerjaan yang membutuhkan keahlian mendalam${dom.some(([t])=>t==='D')?', otonomi, dan kepemimpinan':dom.some(([t])=>t==='I')?', komunikasi, dan kerjasama':dom.some(([t])=>t==='S')?', kesabaran, dan konsistensi':', ketelitian, dan analisis'}.<br><br><b>Bidang pekerjaan yang sangat cocok antara lain:</b><br>${escHtml(career)}<br><br>Ia akan berkembang di lingkungan yang menghargai <b>${posT.slice(0,3).join(', ')}</b>. Peran yang kurang cocok untuknya adalah yang membutuhkan ${weak.length>0?ddL[weak[0][0]]:'karakteristik yang berlawanan'}.</div></div>`:''}
    <div style="background:#f8f9ff;border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:10px"><div style="display:flex;align-items:center;gap:12px"><div style="text-align:center;padding:10px 16px;border-radius:8px;border:2px solid ${kpiScore>=80?'var(--success)':'var(--warning)'}"><div style="font-size:1.5rem;font-weight:700;color:${kpiScore>=80?'var(--success)':'var(--warning)'}">${kpiScore}</div><div style="font-size:.65rem">Grade ${kpiGrade}</div></div><div style="font-size:.75rem;line-height:1.6"><b>📈 Dampak KPI</b><br>Kekuatan: ${posT.length} poin (+${Math.min(posT.length*3,20)})<br>Area Pengembangan: ${negT.length} poin (-${Math.min(negT.length*2,15)})</div></div></div>
    <div class="flex gap-8 flex-wrap"><button class="btn btn-success btn-sm" onclick="syncDiscToKPI('${id}');closeModalDirect()">📈 Sinkron ke KPI</button><button class="btn btn-warning btn-sm" onclick="closeModalDirect();editDiscResult('${id}')">✏️ Edit</button><button class="btn btn-primary btn-sm" onclick="printDiscResult()">🖨️ Cetak/Download</button></div>`,true);
}
function getDiscDesc(p){return '';}

function printDiscResult(){
  const modal=document.getElementById('modalContent');if(!modal)return;
  const printWin=window.open('','_blank','width=800,height=900');
  printWin.document.write(`<!DOCTYPE html><html><head><title>Hasil DISC Test - IJEF Corp</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;padding:20px;font-size:12px;color:#333}h1,h2,h3{color:#1a237e}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#1a237e;color:#fff}.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #1a237e;padding-bottom:10px}svg{max-width:100%}.section{margin-bottom:16px;page-break-inside:avoid}.badge{display:inline-block;padding:4px 12px;background:#1a237e;color:#fff;border-radius:12px;font-weight:700}@media print{body{padding:10px}}</style></head><body><div class="header"><h1>D.I.S.C. Personality System</h1><p>LPK IJEF CORP — Human Resource Assessment</p></div>${modal.innerHTML}<script>setTimeout(()=>{window.print();},500)<\/script></body></html>`);
  printWin.document.close();
}



async function editDiscResult(id){
  const doc=await db.collection('hrd_disc_results').doc(id).get();if(!doc.exists)return toast('Data tidak ditemukan','error');
  const r=doc.data();
  openModal(`<div class="modal-title">✏️ Edit Hasil DISC</div>
    <div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="edNama" value="${escHtml(r.nama||'')}"></div><div class="form-group"><label>NIP</label><input class="form-control" id="edNip" value="${escHtml(r.nip||'')}"></div><div class="form-group"><label>Departemen</label><input class="form-control" id="edDept" value="${escHtml(r.departemen||'')}"></div><div class="form-group"><label>Posisi</label><input class="form-control" id="edPos" value="${escHtml(r.posisi||'')}"></div><div class="form-group"><label>Periode</label><input class="form-control" id="edPeriode" value="${escHtml(r.evaluasiPeriode||'')}"></div><div class="form-group"><label>Mode</label><select class="form-control" id="edMode"><option value="calon" ${r.mode==='calon'?'selected':''}>Calon</option><option value="evaluasi" ${r.mode==='evaluasi'?'selected':''}>Evaluasi</option></select></div></div>
    <div class="form-group"><label>Catatan HR</label><textarea class="form-control" id="edNote" placeholder="Catatan tambahan dari HR...">${escHtml(r.catatanHR||'')}</textarea></div>
    <button class="btn btn-primary" onclick="saveEditDisc('${id}')">Simpan Perubahan</button>`,true);
}

async function saveEditDisc(id){
  const data={nama:document.getElementById('edNama').value,nip:document.getElementById('edNip').value,departemen:document.getElementById('edDept').value,posisi:document.getElementById('edPos').value,evaluasiPeriode:document.getElementById('edPeriode').value,mode:document.getElementById('edMode').value,catatanHR:document.getElementById('edNote').value,updatedAt:new Date().toISOString()};
  await db.collection('hrd_disc_results').doc(id).update(data);
  closeModalDirect();toast('Data DISC diperbarui','success');loadDiscHist();
}

async function deleteDiscResult(id){
  if(!confirm('Yakin hapus hasil tes DISC ini?'))return;
  await db.collection('hrd_disc_results').doc(id).delete();
  toast('Hasil tes dihapus','success');loadDiscHist();
}

async function hapusSemuaDiscResults(){
  if(!confirm('⚠️ HAPUS SEMUA riwayat hasil tes DISC? Tindakan ini tidak bisa dibatalkan!'))return;
  if(!confirm('Konfirmasi sekali lagi: Yakin hapus SEMUA data DISC?'))return;
  const snap=await db.collection('hrd_disc_results').get();
  const batch=db.batch();
  snap.forEach(doc=>batch.delete(doc.ref));
  await batch.commit();
  toast(`${snap.size} hasil tes DISC dihapus`,'success');
  loadDiscHist();
}

async function syncDiscToKPI(id){
  const doc=await db.collection('hrd_disc_results').doc(id).get();if(!doc.exists)return toast('Data tidak ditemukan','error');
  const r=doc.data();
  const kpiScore=r.kpiScore||70;
  const grade=kpiScore>=90?'A':kpiScore>=80?'B':kpiScore>=70?'C':kpiScore>=60?'D':'E';
  await db.collection('hrd_kpi').add({
    nama:r.nama,periode:r.evaluasiPeriode||r.tanggalTes||todayStr(),
    produktivitas:kpiScore,kualitas:kpiScore,kedisiplinan:kpiScore,kerjasama:kpiScore,skor:kpiScore,
    catatan:`[DISC] Tipe: ${r.pattern||'-'} | Profil: ${r.profileName||'-'} | Grade: ${grade}\nPositif: ${(r.positiveTraits||[]).join(', ')}\nNegatif: ${(r.negativeTraits||[]).join(', ')}\nKarir: ${(r.career||'').substring(0,100)}`,
    penilai:'DISC Auto-Sync',discResultId:id,discPattern:r.pattern||'',discProfile:r.profileName||'',
    createdAt:new Date().toISOString()
  });
  toast(`DISC ${r.nama} disinkronkan ke KPI (Skor: ${kpiScore}, Grade: ${grade})`,'success');
}

async function syncAllDiscToKPI(){
  if(!confirm('Sinkronkan semua hasil DISC terbaru ke KPI?'))return;
  const snap=await db.collection('hrd_disc_results').get();
  let count=0;
  for(const doc of snap.docs){
    const r=doc.data();
    const existing=await db.collection('hrd_kpi').where('discResultId','==',doc.id).limit(1).get();
    if(existing.empty){
      const kpiScore=r.kpiScore||70;
      await db.collection('hrd_kpi').add({nama:r.nama,periode:r.evaluasiPeriode||r.tanggalTes||todayStr(),produktivitas:kpiScore,kualitas:kpiScore,kedisiplinan:kpiScore,kerjasama:kpiScore,skor:kpiScore,catatan:`[DISC] Tipe: ${r.pattern||'-'} | Profil: ${r.profileName||'-'}`,penilai:'DISC Auto-Sync',discResultId:doc.id,discPattern:r.pattern||'',discProfile:r.profileName||'',createdAt:new Date().toISOString()});
      count++;
    }
  }
  toast(`${count} hasil DISC disinkronkan ke KPI`,'success');
}

// ── PORTAL DISC (Karyawan self-test, data auto-filled) ────────
function renderPortalDisc(){
  const main=document.getElementById('mainContent');
  const u=currentUser;
  main.innerHTML=`
  <div class="page-title"><span>🧠 DISC Test Saya</span></div>
  <div class="card">
    <div style="background:#e3f2fd;border-radius:8px;padding:14px;margin-bottom:16px;border-left:4px solid var(--info)">
      <p class="text-sm" style="line-height:1.6">Tes DISC membantu Anda memahami gaya komunikasi dan kepribadian Anda. Hasil tes akan tersimpan dan dapat dilihat oleh HR untuk evaluasi.</p>
    </div>
    <div style="text-align:center;margin-bottom:16px">
      <button class="btn btn-primary btn-lg" onclick="startPortalDiscTest()">🧠 Mulai Tes DISC</button>
    </div>
  </div>
  <div class="card"><div class="card-title">📋 Riwayat Tes DISC Saya</div>
    <div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Tipe</th><th>Profil</th><th>Periode</th><th>Aksi</th></tr></thead><tbody id="myDiscTbl"><tr><td colspan="5" class="text-center">Memuat...</td></tr></tbody></table></div>
  </div>`;
  loadMyDiscHistory();
}

function startPortalDiscTest(){
  const u=currentUser;
  const params=new URLSearchParams({nama:u.nama,nip:u.nip||'',dept:u.departemen||'',pos:u.posisi||u.role||'',mode:'evaluasi',periode:'Self-Assessment '+new Date().toLocaleDateString('id-ID',{month:'long',year:'numeric'})});
  window.open('disc-test.html#evaluasi?'+params.toString(),'_blank');
}

async function loadMyDiscHistory(){
  try{
    // Flexible name matching - case insensitive
    const snap=await db.collection('hrd_disc_results').get();
    const myName=currentUser.nama.toLowerCase().trim();
    const myNip=(currentUser.nip||'').toLowerCase().trim();
    let allResults=[];
    snap.forEach(d=>{const r=d.data();const rName=(r.nama||'').toLowerCase().trim();const rNip=(r.nip||'').toLowerCase().trim();if(rName===myName||(myNip&&rNip===myNip))allResults.push({id:d.id,...r});});
    allResults.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    let h='';
    if(!allResults.length)h='<tr><td colspan="5" class="text-center" style="color:var(--text-light)">Belum pernah tes</td></tr>';
    else allResults.slice(0,20).forEach(r=>{const dt=r.createdAt?new Date(r.createdAt).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'-';h+=`<tr><td>${dt}</td><td class="fw-700" style="color:var(--primary)">${escHtml(r.pattern||'-')}</td><td>${escHtml(r.profileName||'-')}</td><td>${escHtml(r.evaluasiPeriode||'-')}</td><td><button class="btn btn-xs btn-info" onclick="viewMyDiscDetail('${r.id}')">👁️ Detail</button></td></tr>`;});
    document.getElementById('myDiscTbl').innerHTML=h;
  }catch(e){document.getElementById('myDiscTbl').innerHTML='<tr><td colspan="5" class="text-center" style="color:var(--text-light)">Belum pernah tes</td></tr>';}
}

async function viewMyDiscDetail(id){
  // Reuse the admin detail view for consistency
  viewDiscResult(id);
}


// ── PORTAL: REIMBURSE ─────────────────────────────────────────
async function renderPortalReimburse(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>🧾 Reimbursement Saya</span><button class="btn btn-primary btn-sm" onclick="modalReimburse()">+ Ajukan</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Kategori</th><th>Jumlah</th><th>Status</th><th>Tanggal</th></tr></thead><tbody id="tblMyReimb"></tbody></table></div></div>`;const snap=await db.collection('hrd_reimbursement').get();const items=[];snap.forEach(d=>{const r=d.data();if((r.nama||'').toLowerCase()===currentUser.nama.toLowerCase())items.push(r);});let h='';if(!items.length)h='<tr><td colspan="4" class="text-center">Belum ada</td></tr>';else items.forEach(p=>{h+=`<tr><td>${escHtml(p.kategori||'-')}</td><td>${formatCurrency(p.jumlah)}</td><td><span class="badge badge-${p.status==='approved'?'success':p.status==='rejected'?'danger':'warning'}">${p.status}</span></td><td>${formatDate(p.createdAt)}</td></tr>`;});document.getElementById('tblMyReimb').innerHTML=h;}

// ── PORTAL: KASBON ────────────────────────────────────────────
async function renderPortalKasbon(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>💳 Kasbon & Loan Saya</span><button class="btn btn-primary btn-sm" onclick="modalKasbon()">+ Ajukan</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Jenis</th><th>Total</th><th>Angsuran/Bln</th><th>Sudah Bayar</th><th>Sisa</th><th>Status</th></tr></thead><tbody id="tblMyKasbon"></tbody></table></div></div>`;const snap=await db.collection('hrd_kasbon').get();const items=[];snap.forEach(d=>{const r=d.data();if((r.nama||'').toLowerCase()===currentUser.nama.toLowerCase())items.push(r);});let h='';if(!items.length)h='<tr><td colspan="6" class="text-center">Belum ada</td></tr>';else items.forEach(p=>{const angsuran=Math.ceil((p.jumlah||0)/(p.cicilan||1));const sisa=Math.max(0,(p.jumlah||0)-(p.sudahBayar||0));h+=`<tr><td>${escHtml(p.jenis||'-')}</td><td>${formatCurrency(p.jumlah)}</td><td>${formatCurrency(angsuran)}</td><td>${formatCurrency(p.sudahBayar||0)}</td><td class="fw-700" style="color:${sisa>0?'var(--danger)':'var(--success)'}">${formatCurrency(sisa)}</td><td><span class="badge badge-${p.status==='aktif'?'success':p.status==='lunas'?'primary':'warning'}">${p.status}</span></td></tr>`;});document.getElementById('tblMyKasbon').innerHTML=h;}

// ── PORTAL: KPI ───────────────────────────────────────────────
async function renderPortalKPI(){const main=document.getElementById('mainContent');main.innerHTML=`<div class="page-title"><span>📈 KPI Saya</span></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Periode</th><th>Skor</th><th>Grade</th><th>Penilai</th><th>Catatan</th></tr></thead><tbody id="tblMyKPI"></tbody></table></div></div>`;const snap=await db.collection('hrd_kpi').get();const items=[];snap.forEach(d=>{const r=d.data();if((r.nama||'').toLowerCase()===currentUser.nama.toLowerCase())items.push(r);});items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));let h='';if(!items.length)h='<tr><td colspan="5" class="text-center">Belum ada penilaian</td></tr>';else items.forEach(p=>{const grade=p.skor>=90?'A':p.skor>=80?'B':p.skor>=70?'C':p.skor>=60?'D':'E';h+=`<tr><td>${escHtml(p.periode||'-')}</td><td><span class="badge badge-${p.skor>=80?'success':p.skor>=60?'warning':'danger'}">${p.skor}/100</span></td><td class="fw-700">${grade}</td><td>${escHtml(p.penilai||'-')}</td><td style="font-size:.78rem">${escHtml(p.catatan||'-')}</td></tr>`;});document.getElementById('tblMyKPI').innerHTML=h;}

// ── PORTAL: SETTING AKUN ──────────────────────────────────────
function renderPortalSetting(){const u=currentUser;const main=document.getElementById('mainContent');const avatar=u.profilePic||'';main.innerHTML=`<div class="page-title"><span>⚙️ Setting Akun</span></div><div class="card"><h4 class="color-primary mb-16">👤 Data Pribadi</h4>
  <div style="display:flex;align-items:center;gap:20px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--border)">
    <div id="psAvatarPreview" style="width:80px;height:80px;border-radius:50%;border:3px solid var(--accent);overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f5f5f5;font-size:2rem;font-weight:700;color:var(--primary);cursor:pointer" onclick="document.getElementById('psAvatarFile').click()">${avatar?`<img src="${avatar}" style="width:100%;height:100%;object-fit:cover">`:`${u.nama?.charAt(0)||'?'}`}</div>
    <div>
      <input type="file" id="psAvatarFile" accept="image/png,image/jpeg,image/webp" style="display:none" onchange="previewProfilePic(this)">
      <button class="btn btn-sm btn-primary" onclick="document.getElementById('psAvatarFile').click()">📷 Upload Foto Profil</button>
      <div class="text-xs mt-4" style="color:#999">Klik foto atau tombol untuk upload. Format: JPG/PNG.</div>
    </div>
  </div>
  <div class="grid-2"><div class="form-group"><label>Nama</label><input class="form-control" id="psNama" value="${escHtml(u.nama||'')}"></div><div class="form-group"><label>Username</label><input class="form-control" id="psUser" value="${escHtml(u.id||'')}"></div><div class="form-group"><label>Email</label><input class="form-control" id="psEmail" value="${escHtml(u.email||'')}"></div><div class="form-group"><label>Telepon</label><input class="form-control" id="psTelp" value="${escHtml(u.telepon||'')}"></div><div class="form-group"><label>Password Baru</label><input class="form-control" type="password" id="psPass" placeholder="Kosongkan jika tidak diubah"></div><div class="form-group"><label>Departemen</label><input class="form-control" value="${escHtml(u.departemen||'-')}" readonly></div></div><button class="btn btn-primary" onclick="simpanPortalSetting()">💾 Simpan Perubahan</button></div>`;}

function previewProfilePic(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      // Crop to square center and resize to 128x128
      const canvas=document.createElement('canvas');
      canvas.width=128;canvas.height=128;
      const ctx=canvas.getContext('2d');
      const size=Math.min(img.width,img.height);
      const sx=(img.width-size)/2,sy=(img.height-size)/2;
      ctx.beginPath();ctx.arc(64,64,64,0,Math.PI*2);ctx.clip();
      ctx.drawImage(img,sx,sy,size,size,0,0,128,128);
      window._profilePic=canvas.toDataURL('image/jpeg',0.8);
      document.getElementById('psAvatarPreview').innerHTML=`<img src="${window._profilePic}" style="width:100%;height:100%;object-fit:cover">`;
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

async function simpanPortalSetting(){const data={nama:document.getElementById('psNama').value,email:document.getElementById('psEmail').value,telepon:document.getElementById('psTelp').value,updatedAt:new Date().toISOString()};if(window._profilePic)data.profilePic=window._profilePic;const newPass=document.getElementById('psPass').value;if(newPass)data.password=newPass;const newUser=document.getElementById('psUser').value.trim();if(newUser&&newUser!==currentUser.id){await db.collection('hrd_users').doc(newUser).set({...currentUser,...data,username:newUser});await db.collection('hrd_users').doc(currentUser.id).delete();currentUser={...currentUser,...data,id:newUser};localStorage.setItem('hrd_session',JSON.stringify(currentUser));}else{await db.collection('hrd_users').doc(currentUser.id).update(data);currentUser={...currentUser,...data};localStorage.setItem('hrd_session',JSON.stringify(currentUser));}window._profilePic=null;toast('Akun diperbarui','success');renderApp();}

// ── SYSTEM ADMIN — Reset & Backup ─────────────────────────────
function renderSystemAdmin(){
  if(!hasAccess(6))return document.getElementById('mainContent').innerHTML='<div class="card"><p>Akses ditolak.</p></div>';
  const main=document.getElementById('mainContent');
  main.innerHTML=`<div class="page-title"><span>🔧 Reset & Backup Sistem</span></div>
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

async function backupAllData(){
  toast('Memproses backup...','info');
  const collections=['hrd_karyawan','hrd_users','hrd_absensi','hrd_cuti','hrd_overtime','hrd_penggajian','hrd_reimbursement','hrd_kasbon','hrd_insentif','hrd_tunjangan','hrd_notifikasi','hrd_pengumuman','hrd_broadcast','hrd_meeting','hrd_online_meeting','hrd_chat_threads','hrd_chat_messages','hrd_approval_flow','hrd_settings'];
  const backup={exportDate:new Date().toISOString(),exportBy:currentUser.nama,data:{}};
  for(const col of collections){
    try{const snap=await db.collection(col).get();backup.data[col]=[];snap.forEach(d=>backup.data[col].push({id:d.id,...d.data()}));}catch(e){}
  }
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`IMS_backup_${todayStr()}.json`;a.click();
  toast('Backup berhasil didownload','success');
}

async function resetCollection(col,label){
  if(!confirm(`Hapus SEMUA data ${label}? Ini tidak bisa dibatalkan.`))return;
  if(!confirm(`KONFIRMASI: Yakin hapus semua ${label}?`))return;
  const snap=await db.collection(col).get();
  if(snap.empty)return toast(`${label} sudah kosong`,'info');
  const batchSize=400;let count=0;
  let batch=db.batch();
  snap.forEach(d=>{batch.delete(d.ref);count++;if(count%batchSize===0){batch.commit();batch=db.batch();}});
  await batch.commit();
  toast(`${count} data ${label} dihapus`,'success');
}

async function resetEntireSystem(){
  if(!confirm('⚠️ PERINGATAN: Ini akan menghapus SELURUH data sistem!\n\nHanya akun admin yang dipertahankan.\n\nApakah Anda yakin?'))return;
  if(!confirm('KONFIRMASI TERAKHIR: Ketik "RESET" di prompt berikutnya untuk melanjutkan.'))return;
  const input=prompt('Ketik RESET untuk konfirmasi:');
  if(input!=='RESET')return toast('Reset dibatalkan','info');
  toast('Mereset sistem...','warning');
  const collections=['hrd_karyawan','hrd_absensi','hrd_cuti','hrd_overtime','hrd_penggajian','hrd_reimbursement','hrd_kasbon','hrd_insentif','hrd_tunjangan','hrd_notifikasi','hrd_pengumuman','hrd_broadcast','hrd_meeting','hrd_online_meeting','hrd_chat_threads','hrd_chat_messages','hrd_approval_flow','hrd_meeting_invites','hrd_kpi','hrd_disc_results'];
  for(const col of collections){
    try{const snap=await db.collection(col).get();const batch=db.batch();snap.forEach(d=>batch.delete(d.ref));await batch.commit();}catch(e){}
  }
  // Delete non-admin users
  const usersSnap=await db.collection('hrd_users').get();
  const batch=db.batch();
  usersSnap.forEach(d=>{if(d.data().role!=='admin')batch.delete(d.ref);});
  await batch.commit();
  toast('Sistem berhasil direset. Hanya akun admin yang tersisa.','success');
}


// ══════════════════════════════════════════════════════════════
