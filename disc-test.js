'use strict';
// DISC-TEST.JS — DISC Personality Assessment Module — IJEF Corp
const firebaseConfig={apiKey:"AIzaSyAWlNi_iBOWxZBD6E20aHOSrRpPsirDdOM",authDomain:"test-kesehatan-ijef-corp-7c278.firebaseapp.com",projectId:"test-kesehatan-ijef-corp-7c278",storageBucket:"test-kesehatan-ijef-corp-7c278.appspot.com",messagingSenderId:"123456789",appId:"1:123456789:web:abc123"};
firebase.initializeApp(firebaseConfig);
const db=firebase.firestore();
let testState={mode:null,nama:'',usia:'',jenisKelamin:'',tanggalTes:'',departemen:'',posisi:'',nip:'',evaluasiPeriode:'',kontak:'',currentQuestion:0,answers:{}};

const Q=[
{n:1,o:[['Gampangan, Mudah setuju','S'],['Percaya, Mudah percaya pada orang','I'],['Petualang, Mengambil resiko','D'],['Toleran, Menghormati','C']]},
{n:2,o:[['Lembut suara, Pendiam','C'],['Optimistik, Visioner','D'],['Pusat Perhatian, Suka gaul','I'],['Pendamai, Membawa Harmoni','S']]},
{n:3,o:[['Menyemangati orang','I'],['Berusaha sempurna','C'],['Bagian dari kelompok','S'],['Ingin membuat tujuan','D']]},
{n:4,o:[['Menjadi frustrasi','S'],['Menyimpan perasaan saya','C'],['Menceritakan sisi saya','I'],['Siap beroposisi','D']]},
{n:5,o:[['Hidup, Suka bicara','I'],['Gerak cepat, Tekun','D'],['Usaha menjaga keseimbangan','S'],['Usaha mengikuti aturan','C']]},
{n:6,o:[['Kelola waktu secara efisien','C'],['Sering terburu-buru, Merasa tertekan','D'],['Masalah sosial itu penting','I'],['Suka selesaikan apa yang saya mulai','S']]},
{n:7,o:[['Tolak perubahan mendadak','S'],['Cenderung janji berlebihan','I'],['Tarik diri di tengah tekanan','C'],['Tidak takut bertempur','D']]},
{n:8,o:[['Penyemangat yang baik','I'],['Pendengar yang baik','S'],['Penganalisa yang baik','C'],['Delegator yang baik','D']]},
{n:9,o:[['Hasil adalah penting','D'],['Lakukan dengan benar, Akurasi penting','C'],['Dibuat menyenangkan','I'],['Mari kerjakan bersama','S']]},
{n:10,o:[['Akan berjalan terus tanpa kontrol diri','D'],['Akan membeli sesuai dorongan hati','I'],['Akan menunggu, Tanpa tekanan','S'],['Akan mengusahakan yang kuinginkan','C']]},
{n:11,o:[['Ramah, Mudah bergabung','I'],['Unik, Bosan rutinitas','D'],['Aktif mengubah sesuatu','D'],['Ingin hal-hal yang pasti','C']]},
{n:12,o:[['Non-konfrontasi, Menyerah','S'],['Dipenuhi hal detail','C'],['Perubahan pada menit terakhir','I'],['Menuntut, Kasar','D']]},
{n:13,o:[['Ingin kemajuan','D'],['Puas dengan segalanya','S'],['Terbuka memperlihatkan perasaan','I'],['Rendah hati, Sederhana','C']]},
{n:14,o:[['Tenang, Pendiam','S'],['Bahagia, Tanpa beban','I'],['Menyenangkan, Baik hati','S'],['Tak gentar, Berani','D']]},
{n:15,o:[['Menggunakan waktu berkualitas dgn teman','I'],['Rencanakan masa depan, Bersiap','C'],['Bepergian demi petualangan baru','D'],['Menerima ganjaran atas tujuan yg dicapai','S']]},
{n:16,o:[['Aturan perlu dipertanyakan','D'],['Aturan membuat adil','S'],['Aturan membuat bosan','I'],['Aturan membuat aman','C']]},
{n:17,o:[['Pendidikan, Kebudayaan','C'],['Prestasi, Ganjaran','D'],['Keselamatan, keamanan','S'],['Sosial, Perkumpulan kelompok','I']]},
{n:18,o:[['Memimpin, Pendekatan langsung','D'],['Suka bergaul, Antusias','I'],['Dapat diramal, Konsisten','S'],['Waspada, Hati-hati','C']]},
{n:19,o:[['Tidak mudah dikalahkan','D'],['Kerjakan sesuai perintah, Ikut pimpinan','S'],['Mudah terangsang, Riang','I'],['Ingin segalanya teratur, Rapi','C']]},
{n:20,o:[['Saya akan pimpin mereka','D'],['Saya akan melaksanakan','S'],['Saya akan meyakinkan mereka','I'],['Saya dapatkan fakta','C']]},
{n:21,o:[['Memikirkan orang dahulu','S'],['Kompetitif, Suka tantangan','D'],['Optimis, Positif','I'],['Pemikir logis, Sistematik','C']]},
{n:22,o:[['Menyenangkan orang, Mudah setuju','S'],['Tertawa lepas, Hidup','I'],['Berani, Tak gentar','D'],['Tenang, Pendiam','C']]},
{n:23,o:[['Ingin otoritas lebih','D'],['Ingin kesempatan baru','I'],['Menghindari konflik','S'],['Ingin petunjuk yang jelas','C']]},
{n:24,o:[['Dapat diandalkan, Dapat dipercaya','S'],['Kreatif, Unik','I'],['Garis dasar, Orientasi hasil','D'],['Jalankan standar yang tinggi, Akurat','C']]}
];

// Segment tables for scoring
const SEG1={D:[-6,-5.3,-4,-2.5,-1.7,-1.3,0,0.5,1,2,3,3.5,4,4.7,5.3,6.5,7,7,7,7.5,7.5],I:[-7,-4.6,-2.5,-1.3,1,3,3.5,5.3,5.7,6,6.5,7,7,7,7,7,7.5,7.5,7.5,7.5,8],S:[-5.7,-4.3,-3.5,-1.5,-0.7,0.5,1,2.5,3,4,4.6,5,5.7,6,6.5,6.5,7,7,7,7.5,7.5],C:[-6,-4.7,-3.5,-1.5,0.5,2,3,5.3,5.7,6,6.3,6.5,6.7,7,7.3,7.3,7.3,7.5,8,8,8]};
const SEG2={D:[7.5,6.5,4.3,2.5,1.5,0.5,0,-1.3,-1.5,-2.5,-3,-3.5,-4.3,-5.3,-5.7,-6,-6.5,-6.7,-7,-7.3,-7.5],I:[7,6,4,2.5,0.5,0,-2,-3.5,-4.3,-5.3,-6,-6.5,-7,-7.2,-7.2,-7.2,-7.3,-7.3,-7.3,-7.5,-8],S:[7.5,7,6,4,2.5,1.5,0.5,-1.3,-2,-3,-4.3,-5.3,-6,-6.5,-6.7,-6.7,-7,-7.2,-7.3,-7.5,-8],C:[7.5,7,5.6,4,2.5,1.5,0.5,0,-1.3,-2.5,-3.5,-5.3,-5.7,-6,-6.5,-7,-7.3,-7.5,-7.7,-7.9,-8]};

// Profile database
const PROFILES={
'D':{name:'ESTABLISHER',traits:['Individualis','Ego Tinggi','Efektif','High Motivation','Bersemangat Tinggi','Percaya Diri','Kreatif','Agresif']},
'I':{name:'COMMUNICATOR',traits:['Antusias','Percaya','Optimis','Persuasif','Bicara aktif','Ramah','Inspirasional','Emosional']},
'S':{name:'SPECIALIST',traits:['Stabil & Konsisten','Terkendali','Sabar','Loyal','Teguh','Process Oriented','Anti Perubahan']},
'C':{name:'LOGICAL THINKER',traits:['Pendiam','Perfeksionis','Detail','Empati','Rapi','Organized','Sistematis','Analitis']},
'D-I':{name:'PENGAMBIL KEPUTUSAN',traits:['Pekerja Keras','Leader','Banyak Minat','Tegas','Suka Tantangan','Cepat Bosan']},
'D-S':{name:'SELF-MOTIVATED',traits:['Objektif & Analitis','Mandiri','Good Planner','Komitmen thd Target','Menghindari Konflik']},
'D-C':{name:'CHALLENGER',traits:['Tekun','Sensitif terhadap permasalahan','Keputusan kuat','Kreatif memecahkan masalah','Reaksi cepat','Perfeksionis']},
'D-I-S':{name:'DIRECTOR',traits:['Pengelola','Enerjik','Kurang Detail','Mudah Bosan','Motivator']},
'D-I-C':{name:'CHANCELLOR',traits:['Ramah secara alami','Menggabungkan kesenangan dengan pekerjaan','Detail','Interaktif']},
'D-S-I':{name:'DIRECTOR',traits:['Obyektif dan analitis','Ingin terlibat','Termotivasi target pribadi','Tenang','Stabil','Ulet']},
'D-S-C':{name:'DIRECTOR',traits:['Obyektif','Analitis','Bantuan & dukungan','Termotivasi target','Stabil']},
'D-C-I':{name:'CHALLENGER',traits:['Tekun','Sensitif','Keputusan kuat','Kreatif','Reaksi cepat']},
'D-C-S':{name:'CHALLENGER',traits:['Tekun','Sensitif','Keputusan kuat','Perfeksionis','Ide-ide banyak']},
'I-S':{name:'ADVISOR',traits:['Hangat','Simpati','Tenang','Pendengar baik','Toleran','Penjaga damai']},
'I-C':{name:'ASSESSOR',traits:['Ramah','Suka berteman','Nyaman dengan orang asing','Dapat mengendalikan diri','Perfeksionis alamiah']},
'I-D':{name:'NEGOTIATOR',traits:['Suka Bergaul','Anti Rutin','Aktif','Percaya Diri','Optimis','Result Oriented']},
'I-S-C':{name:'RESPONSIVE & THOUGHTFUL',traits:['High Energy','Good Communication','Sensitif','Need Recognition']},
'I-S-D':{name:'MOTIVATOR',traits:['Leader Kelompok Kecil','Supporter','Sosialisasi Baik','Butuh Penghargaan']},
'I-D-C':{name:'CONFIDENT & DETERMINED',traits:['Pandai Memilih Orang','Leader','Good Interpersonal','Dominan','Perfeksionis']},
'I-D-S':{name:'REFORMER',traits:['Mudah Bergaul','Leader','Sadar Diri','Motivator','Optimis & Positif']},
'I-C-D':{name:'ASSESSOR',traits:['Analitis','Hati-hati','Ramah saat nyaman','Perfeksionis alami','Berorientasi kualitas']},
'I-C-S':{name:'RESPONSIVE & THOUGHTFUL',traits:['High Energy','Good Communication','Sensitif','Banyak Bicara']},
'S-D':{name:'SELF-MOTIVATED',traits:['Objektif','Analitis','Mandiri','Komitmen target','Stabil','Tekun']},
'S-I':{name:'ADVISOR',traits:['Hangat','Simpati','Pendengar baik','Toleran','Penjaga damai','Moderat']},
'S-C':{name:'PEACEMAKER',traits:['Anti Kritik','Detail','Empati','Loyal','Introvert','Sulit Adaptasi']},
'S-D-I':{name:'DIRECTOR',traits:['Obyektif','Analitis','Termotivasi target','Ulet','Mandiri']},
'S-D-C':{name:'INQUIRER',traits:['Full Self Control','Sabar','Penuh Pertimbangan','Good Interpersonal','Result Oriented']},
'S-I-D':{name:'ADVISOR',traits:['Hangat','Simpati','Tenang','Pendengar baik','Toleran','Berusaha keras']},
'S-I-C':{name:'ADVOCATE',traits:['Stabil','Ramah','Detail saat dibutuhkan','Teguh pendirian','Mendukung pihak lemah']},
'S-C-D':{name:'INQUIRER',traits:['Baik secara alamiah','Berorientasi detil','Teliti','Sangat berhati-hati']},
'S-C-I':{name:'ADVOCATE',traits:['Stabil','Ramah','Individualis','Teguh pendirian','Moderat','Cermat']},
'C-D':{name:'DESIGNER',traits:['Sensitif','Berorientasi tugas','Kukuh','Efektif memecahkan masalah','Dingin','Berdasar fakta']},
'C-I':{name:'ASSESSOR',traits:['Analitis','Hati-hati','Ramah saat nyaman','Perfeksionis alami','Berorientasi kualitas']},
'C-S':{name:'PERFECTIONIST',traits:['Detail & Teliti','Sistematik','Menghindari Konflik','Lambat Memutuskan','Anti Perubahan']},
'C-D-I':{name:'CHALLENGER',traits:['Berorientasi tugas','Sensitif','Kukuh','Efektif','Berdasar fakta','Pendiam']},
'C-D-S':{name:'CONTEMPLATOR',traits:['Berorientasi detil','Standard tinggi','Logis','Kompetitif','Mantap','Dapat diandalkan']},
'C-I-D':{name:'ASSESSOR',traits:['Analitis','Hati-hati','Ramah','Perfeksionis','Berorientasi kualitas']},
'C-I-S':{name:'MEDIATOR',traits:['Loyal','Curious','Sensitif','Good Communication','Good Analytical Think','Cepat Beradaptasi']},
'C-S-I':{name:'PRACTITIONER',traits:['Perfeksionis','Quality Oriented','Scheduled','Sistematis']},
'C-S-D':{name:'PRECISIONIST',traits:['Sistematis','Teratur','Teliti','Bijaksana','Diplomatis','Akurasi tinggi']}
};

const DESC={
'D':'Memiliki rasa ego yang tinggi dan cenderung individualis dengan standard yang sangat tinggi. Mampu memimpin situasi dan orang lain dalam rangka mencapai sasarannya. Ia menghindari sesuatu yang biasa-biasa dan cenderung mencari tantangan baru.',
'I':'Merupakan seorang yang antusias dan optimistik, ia lebih suka mencapai sasarannya melalui orang lain. Sangat menonjol dalam keterampilan berkomunikasi. Memiliki kemampuan untuk memotivasi dan memberi semangat dengan kata-katanya.',
'S':'Merupakan individu konsisten yang berusaha menjaga lingkungan yang tidak berubah. Sabar, loyal dan suka menolong. Sangat baik bekerja dengan petunjuk dan peraturan yang jelas.',
'C':'Seorang yang praktis, cakap dan unik. Menyukai hal yang detil dan logis; secara alamiah sangat analitis. Hati-hati dalam membuat keputusan berdasarkan logika, bukan emosi.',
'D-I':'Tidak basa-basi dan tegas, berpandangan jauh ke depan, progresif dan mau berkompetisi. Mempunyai kemampuan memimpin yang baik dan minat dengan cakupan yang luas.',
'D-S':'Seorang yang obyektif dan analitis. Ingin terlibat dalam situasi dan memberikan bantuan. Termotivasi oleh target pribadi, ulet dalam memulai pekerjaan.',
'D-C':'Sensitif terhadap permasalahan, memiliki kreativitas baik dalam memecahkan masalah. Dapat menyelesaikan tugas penting dalam waktu singkat karena keputusan yang kuat.',
'I-S':'Mengesankan orang akan kehangatan, simpati dan pengertiannya. Memiliki ketenangan dalam situasi sosial. Merupakan pendengar yang baik dan penjaga damai.',
'I-C':'Ramah dan suka berteman; merasa nyaman walaupun dengan orang asing. Dapat mengembangkan hubungan baru dengan mudah. Perfeksionis secara alamiah.',
'S-C':'Orang yang baik secara alamiah dan sangat berorientasi detil. Peduli dengan orang-orang di sekitarnya dan sangat teliti dalam penyelesaian tugas.',
'C-D':'Sangat berorientasi pada tugas dan sensitif pada permasalahan. Kukuh dan mempunyai pendekatan efektif dalam pemecahan masalah. Membuat keputusan berdasar fakta.',
'C-S':'Berpikir sistematis dan mengikuti prosedur. Teratur, teliti dan fokus pada detil. Sangat berhati-hati, mengharapkan akurasi dan standard tinggi.',
};

// ── HELPERS ───────────────────────────────────────────────────
function toast(m,t='info'){const c=document.getElementById('toastContainer'),el=document.createElement('div');el.className='toast-'+t;el.style.cssText='padding:12px 18px;border-radius:8px;color:#fff;font-size:.83rem;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.15);max-width:350px;animation:slideIn .3s';el.style.background=t==='success'?'#2e7d32':t==='error'?'#c62828':t==='warning'?'#f57f17':'#0277bd';el.textContent=m;c.appendChild(el);setTimeout(()=>el.remove(),3500);}
function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function todayStr(){return new Date().toISOString().split('T')[0];}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  const h=window.location.hash;
  if(h==='#evaluasi')startMode('evaluasi');
  else if(h==='#history')renderHistory();
  else renderModeSelection();
});

function renderModeSelection(){
  document.getElementById('app').innerHTML=`
  <div style="background:#fff;border-radius:10px;padding:24px;max-width:600px;margin:40px auto;box-shadow:0 1px 4px rgba(0,0,0,.06);text-align:center">
    <h2 style="color:var(--primary);margin-bottom:8px">🧠 DISC Personality Test</h2>
    <p style="color:var(--text-light);margin-bottom:24px;font-size:.88rem">Pilih mode tes yang sesuai</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div onclick="startMode('calon')" style="cursor:pointer;background:#fff;border:2px solid var(--border);border-radius:10px;padding:20px;transition:all .2s" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="font-size:2.5rem;margin-bottom:8px">🧑‍💼</div>
        <h3 style="color:var(--primary);font-size:.95rem;margin-bottom:4px">Calon Karyawan</h3>
        <p style="font-size:.78rem;color:var(--text-light)">Tes untuk proses rekrutmen</p>
      </div>
      <div onclick="startMode('evaluasi')" style="cursor:pointer;background:#fff;border:2px solid var(--border);border-radius:10px;padding:20px;transition:all .2s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="font-size:2.5rem;margin-bottom:8px">📊</div>
        <h3 style="color:var(--accent);font-size:.95rem;margin-bottom:4px">Evaluasi Karyawan</h3>
        <p style="font-size:.78rem;color:var(--text-light)">Evaluasi periodik oleh HR</p>
      </div>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:16px">
      <button onclick="renderHistory()" style="padding:8px 16px;border:1.5px solid var(--primary);background:transparent;color:var(--primary);border-radius:6px;font-size:.82rem;font-weight:600;cursor:pointer">📋 Riwayat Hasil Tes</button>
    </div>
  </div>`;
}

function startMode(mode){testState={...testState,mode,answers:{},currentQuestion:0};mode==='calon'?renderCalonForm():renderEvaluasiForm();}

function renderCalonForm(){
  document.getElementById('app').innerHTML=`
  <div style="background:#fff;border-radius:10px;padding:24px;max-width:600px;margin:20px auto;box-shadow:0 1px 4px rgba(0,0,0,.06)">
    <h3 style="color:var(--primary);margin-bottom:16px">🧑‍💼 Data Calon Karyawan</h3>
    <div style="background:#e3f2fd;border-radius:8px;padding:12px;margin-bottom:16px;border-left:4px solid var(--info);font-size:.82rem">Silakan isi data diri sebelum memulai tes DISC.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Nama Lengkap *</label><input id="fNama" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" placeholder="Nama lengkap"></div>
      <div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Usia</label><input id="fUsia" type="number" min="17" max="65" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" placeholder="Usia"></div>
      <div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Jenis Kelamin</label><select id="fGender" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem"><option value="">-- Pilih --</option><option>Laki-laki</option><option>Perempuan</option></select></div>
      <div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Posisi Dilamar</label><input id="fPosisi" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" placeholder="Posisi"></div>
    </div>
    <div style="margin-top:14px"><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Email / No. HP</label><input id="fKontak" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" placeholder="Email atau HP"></div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button onclick="renderModeSelection()" style="padding:10px 20px;border:1.5px solid var(--primary);background:transparent;color:var(--primary);border-radius:6px;font-size:.85rem;font-weight:600;cursor:pointer">← Kembali</button>
      <button onclick="validateStart('calon')" style="padding:10px 20px;border:none;background:var(--primary);color:#fff;border-radius:6px;font-size:.85rem;font-weight:600;cursor:pointer">Mulai Tes →</button>
    </div>
  </div>`;
}

function renderEvaluasiForm(){
  document.getElementById('app').innerHTML=`
  <div style="background:#fff;border-radius:10px;padding:24px;max-width:600px;margin:20px auto;box-shadow:0 1px 4px rgba(0,0,0,.06)">
    <h3 style="color:var(--accent);margin-bottom:16px">📊 Evaluasi Karyawan — DISC</h3>
    <div style="background:#e3f2fd;border-radius:8px;padding:12px;margin-bottom:16px;border-left:4px solid var(--info);font-size:.82rem">Form evaluasi kepribadian karyawan secara periodik.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Nama Karyawan *</label><input id="fNama" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" placeholder="Nama"></div>
      <div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">NIP</label><input id="fNip" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" placeholder="NIP"></div>
      <div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Departemen</label><input id="fDept" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" placeholder="Departemen"></div>
      <div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Posisi</label><input id="fPosisi" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" placeholder="Posisi"></div>
      <div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Usia</label><input id="fUsia" type="number" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" placeholder="Usia"></div>
      <div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Jenis Kelamin</label><select id="fGender" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem"><option value="">-- Pilih --</option><option>Laki-laki</option><option>Perempuan</option></select></div>
    </div>
    <div style="margin-top:14px"><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Periode Evaluasi</label><input id="fPeriode" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" placeholder="Contoh: Q1 2026"></div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button onclick="renderModeSelection()" style="padding:10px 20px;border:1.5px solid var(--primary);background:transparent;color:var(--primary);border-radius:6px;font-size:.85rem;font-weight:600;cursor:pointer">← Kembali</button>
      <button onclick="validateStart('evaluasi')" style="padding:10px 20px;border:none;background:var(--primary);color:#fff;border-radius:6px;font-size:.85rem;font-weight:600;cursor:pointer">Mulai Tes →</button>
    </div>
  </div>`;
}

function validateStart(mode){
  const nama=document.getElementById('fNama')?.value.trim();
  if(!nama)return toast('Nama wajib diisi','warning');
  testState.nama=nama;testState.usia=document.getElementById('fUsia')?.value||'';
  testState.jenisKelamin=document.getElementById('fGender')?.value||'';
  testState.posisi=document.getElementById('fPosisi')?.value||'';testState.tanggalTes=todayStr();
  if(mode==='evaluasi'){testState.nip=document.getElementById('fNip')?.value||'';testState.departemen=document.getElementById('fDept')?.value||'';testState.evaluasiPeriode=document.getElementById('fPeriode')?.value||'';}
  else{testState.kontak=document.getElementById('fKontak')?.value||'';}
  renderInstructions();
}

function renderInstructions(){
  document.getElementById('app').innerHTML=`
  <div style="background:#fff;border-radius:10px;padding:24px;max-width:700px;margin:20px auto;box-shadow:0 1px 4px rgba(0,0,0,.06)">
    <h3 style="color:var(--primary);margin-bottom:16px">📋 Instruksi Pengerjaan</h3>
    <div style="background:#f8f9ff;border-radius:8px;padding:16px;margin-bottom:16px;font-size:.88rem;line-height:1.8">
      <p>Tes ini terdiri dari <strong>24 nomor</strong>. Setiap nomor memuat <strong>4 kalimat</strong>.</p>
      <p style="margin-top:8px">Tugas Anda:</p>
      <ol style="padding-left:20px;margin-top:4px">
        <li>Pilih <strong style="color:var(--success)">P (PALING)</strong> — kalimat yang PALING menggambarkan diri Anda</li>
        <li>Pilih <strong style="color:var(--danger)">K (KURANG)</strong> — kalimat yang PALING TIDAK menggambarkan diri Anda</li>
      </ol>
      <div style="margin-top:12px;padding:10px;background:#fff3e0;border-radius:6px;border-left:3px solid var(--warning);font-size:.82rem;color:#e65100">
        <strong>⚠️</strong> Setiap nomor hanya boleh 1 pilihan P dan 1 pilihan K. P dan K tidak boleh pada kalimat yang sama.
      </div>
    </div>
    <div style="text-align:center"><button onclick="renderQuestion()" style="padding:14px 28px;border:none;background:var(--primary);color:#fff;border-radius:6px;font-size:.95rem;font-weight:600;cursor:pointer">Mulai Mengerjakan →</button></div>
  </div>`;
}

function renderQuestion(){
  const qi=testState.currentQuestion,total=Q.length,q=Q[qi],ans=testState.answers[q.n]||{p:null,k:null};
  const pct=((qi+1)/total*100).toFixed(0);
  let opts='';
  q.o.forEach((opt,i)=>{
    const isP=ans.p===i,isK=ans.k===i;
    const border=isP?'var(--success)':isK?'var(--danger)':'var(--border)';
    const bg=isP?'#e8f5e9':isK?'#ffebee':'#fff';
    opts+=`<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1.5px solid ${border};background:${bg};border-radius:8px;margin-bottom:8px;cursor:pointer;transition:all .2s">
      <div style="flex:1;font-size:.88rem">${esc(opt[0])}</div>
      <div style="display:flex;gap:6px">
        <div onclick="selOpt(${q.n},${i},'p')" style="width:32px;height:32px;border-radius:50%;border:2px solid ${isP?'var(--success)':'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;cursor:pointer;background:${isP?'var(--success)':'#fff'};color:${isP?'#fff':'var(--text)'}">P</div>
        <div onclick="selOpt(${q.n},${i},'k')" style="width:32px;height:32px;border-radius:50%;border:2px solid ${isK?'var(--danger)':'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;cursor:pointer;background:${isK?'var(--danger)':'#fff'};color:${isK?'#fff':'var(--text)'}">K</div>
      </div>
    </div>`;
  });
  document.getElementById('app').innerHTML=`
  <div style="max-width:700px;margin:0 auto">
    <div style="background:#fff;border-radius:10px;padding:12px 20px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
      <div style="display:flex;justify-content:space-between;font-size:.82rem;color:var(--text-light)"><span>${esc(testState.nama)}</span><span>Soal ${qi+1}/${total}</span></div>
      <div style="width:100%;height:8px;background:#e0e0e0;border-radius:4px;margin-top:8px;overflow:hidden"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--primary),var(--accent));border-radius:4px;transition:width .3s"></div></div>
    </div>
    <div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,.06);border-left:4px solid var(--primary)">
      <div style="font-size:.75rem;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Nomor ${q.n}</div>
      <p style="font-size:.82rem;color:var(--text-light);margin-bottom:12px">Pilih <span style="color:var(--success);font-weight:700">P</span> = PALING menggambarkan, <span style="color:var(--danger);font-weight:700">K</span> = PALING TIDAK menggambarkan</p>
      ${opts}
    </div>
    <div style="display:flex;justify-content:space-between;gap:8px">
      <button onclick="prevQ()" ${qi===0?'disabled style="opacity:.5;cursor:not-allowed;padding:8px 16px;border:1.5px solid var(--primary);background:transparent;color:var(--primary);border-radius:6px;font-size:.82rem;font-weight:600"':'style="padding:8px 16px;border:1.5px solid var(--primary);background:transparent;color:var(--primary);border-radius:6px;font-size:.82rem;font-weight:600;cursor:pointer"'}>← Sebelumnya</button>
      <div style="display:flex;gap:8px">
        <button onclick="showNav()" style="padding:8px 16px;border:none;background:var(--info);color:#fff;border-radius:6px;font-size:.82rem;font-weight:600;cursor:pointer">📋 Nav</button>
        ${qi<total-1?'<button onclick="nextQ()" style="padding:8px 16px;border:none;background:var(--primary);color:#fff;border-radius:6px;font-size:.82rem;font-weight:600;cursor:pointer">Selanjutnya →</button>':'<button onclick="finishTest()" style="padding:8px 16px;border:none;background:var(--success);color:#fff;border-radius:6px;font-size:.82rem;font-weight:600;cursor:pointer">✅ Selesai</button>'}
      </div>
    </div>
  </div>`;
}

function selOpt(qn,idx,type){
  if(!testState.answers[qn])testState.answers[qn]={p:null,k:null};
  const ans=testState.answers[qn];
  if(ans[type]===idx){ans[type]=null;}
  else{const other=type==='p'?'k':'p';if(ans[other]===idx){toast('P dan K tidak boleh pada kalimat yang sama','warning');return;}ans[type]=idx;}
  renderQuestion();
}
function nextQ(){const q=Q[testState.currentQuestion],ans=testState.answers[q.n];if(!ans||ans.p===null||ans.k===null){toast('Pilih P dan K terlebih dahulu','warning');return;}if(testState.currentQuestion<Q.length-1){testState.currentQuestion++;renderQuestion();}}
function prevQ(){if(testState.currentQuestion>0){testState.currentQuestion--;renderQuestion();}}
function goQ(i){testState.currentQuestion=i;renderQuestion();}

function showNav(){
  let grid='';Q.forEach((q,i)=>{const ans=testState.answers[q.n];const done=ans&&ans.p!==null&&ans.k!==null;const cur=i===testState.currentQuestion;const bg=cur?'var(--primary)':done?'var(--success)':'var(--border)';const col=(cur||done)?'#fff':'var(--text)';grid+=`<div onclick="goQ(${i})" style="width:36px;height:36px;border-radius:6px;background:${bg};color:${col};display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;cursor:pointer">${q.n}</div>`;});
  const answered=Object.values(testState.answers).filter(a=>a&&a.p!==null&&a.k!==null).length;
  document.getElementById('app').innerHTML=`
  <div style="background:#fff;border-radius:10px;padding:24px;max-width:500px;margin:20px auto;box-shadow:0 1px 4px rgba(0,0,0,.06)">
    <h3 style="color:var(--primary);margin-bottom:12px">📋 Navigasi Soal</h3>
    <p style="font-size:.82rem;color:var(--text-light);margin-bottom:16px">Terjawab: <strong>${answered}</strong> / ${Q.length}</p>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">${grid}</div>
    <div style="display:flex;gap:8px">
      <button onclick="renderQuestion()" style="padding:8px 16px;border:1.5px solid var(--primary);background:transparent;color:var(--primary);border-radius:6px;font-size:.82rem;font-weight:600;cursor:pointer">← Kembali ke Soal</button>
      ${answered===Q.length?'<button onclick="finishTest()" style="padding:8px 16px;border:none;background:var(--success);color:#fff;border-radius:6px;font-size:.82rem;font-weight:600;cursor:pointer">✅ Selesai</button>':''}
    </div>
  </div>`;
}

function finishTest(){
  const answered=Object.values(testState.answers).filter(a=>a&&a.p!==null&&a.k!==null).length;
  if(answered<Q.length){toast(`Masih ada ${Q.length-answered} soal belum dijawab`,'warning');return;}
  const result=calcDISC();saveResult(result);renderResult(result);
}

function calcDISC(){
  let rawP={D:0,I:0,S:0,C:0},rawK={D:0,I:0,S:0,C:0};
  Q.forEach(q=>{const ans=testState.answers[q.n];if(!ans)return;if(ans.p!==null)rawP[q.o[ans.p][1]]++;if(ans.k!==null)rawK[q.o[ans.k][1]]++;});
  let s1={},s2={},s3={};
  ['D','I','S','C'].forEach(t=>{
    const p=Math.min(rawP[t],20),k=Math.min(rawK[t],20);
    s1[t]=SEG1[t][p]||0;s2[t]=SEG2[t][k]||0;s3[t]=parseFloat((s1[t]-s2[t]).toFixed(1));
  });
  const pattern=getPattern(s3);
  const profile=PROFILES[pattern]||PROFILES[pattern.split('-')[0]]||{name:'UNIQUE',traits:[]};
  const desc=DESC[pattern]||DESC[pattern.split('-').slice(0,2).join('-')]||DESC[pattern.split('-')[0]]||'Profil kepribadian unik.';
  return{rawP,rawK,s1,s2,s3,pattern,profile,desc,timestamp:new Date().toISOString()};
}

function getPattern(s3){
  const sorted=Object.entries(s3).sort((a,b)=>b[1]-a[1]);
  const pos=sorted.filter(([_,v])=>v>0);
  if(pos.length===0)return sorted[0][0];
  if(pos.length===1)return pos[0][0];
  if(pos.length>=2){
    const d12=pos[0][1]-pos[1][1];
    if(pos.length>=3&&pos[1][1]-pos[2][1]<1.5)return`${pos[0][0]}-${pos[1][0]}-${pos[2][0]}`;
    return`${pos[0][0]}-${pos[1][0]}`;
  }
  return sorted[0][0];
}

async function saveResult(r){
  try{await db.collection('hrd_disc_results').add({mode:testState.mode,nama:testState.nama,usia:testState.usia,jenisKelamin:testState.jenisKelamin,posisi:testState.posisi,tanggalTes:testState.tanggalTes,nip:testState.nip||'',departemen:testState.departemen||'',evaluasiPeriode:testState.evaluasiPeriode||'',kontak:testState.kontak||'',rawP:r.rawP,rawK:r.rawK,seg1:r.s1,seg2:r.s2,seg3:r.s3,pattern:r.pattern,profileName:r.profile.name,createdAt:new Date().toISOString()});toast('Hasil tes berhasil disimpan','success');}
  catch(e){console.error(e);toast('Gagal menyimpan','error');}
}

function renderResult(r){
  const{s1,s2,s3,pattern,profile,desc,rawP,rawK}=r;
  let graphHtml='';
  ['D','I','S','C'].forEach(t=>{
    const v=s3[t],pct=(Math.abs(v)/8*45).toFixed(0);
    const style=v>=0?`position:absolute;bottom:50%;width:100%;height:${pct}%;background:#4caf50;border-radius:6px 6px 0 0`:`position:absolute;top:50%;width:100%;height:${pct}%;background:#ef5350;border-radius:0 0 6px 6px`;
    graphHtml+=`<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div style="font-size:.75rem;font-weight:600;color:${v>=0?'var(--success)':'var(--danger)'}">${v>0?'+':''}${v.toFixed(1)}</div><div style="width:50px;height:160px;background:#f5f5f5;border-radius:8px;position:relative;border:1px solid var(--border)"><div style="position:absolute;top:50%;left:0;right:0;height:1px;background:#999"></div><div style="${style}"></div></div><div style="font-size:.85rem;font-weight:700;color:var(--primary)">${t}</div></div>`;
  });
  let traits='';(profile.traits||[]).forEach(t=>{traits+=`<div style="padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:.85rem">• ${esc(t)}</div>`;});
  document.getElementById('app').innerHTML=`
  <div style="max-width:800px;margin:0 auto">
    <div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06);text-align:center">
      <h2 style="color:var(--primary);margin-bottom:4px">Hasil Tes DISC</h2>
      <p style="color:var(--text-light);font-size:.85rem">${esc(testState.nama)} — ${testState.tanggalTes}</p>
      ${testState.mode==='evaluasi'?`<p style="font-size:.78rem;color:var(--text-light)">Periode: ${esc(testState.evaluasiPeriode)} | Dept: ${esc(testState.departemen)}</p>`:''}
      <div style="display:inline-block;padding:8px 20px;background:linear-gradient(135deg,var(--primary),var(--primary-light));color:#fff;border-radius:20px;font-size:1rem;font-weight:700;margin:12px 0">${esc(profile.name)} (${pattern})</div>
      <h4 style="margin-top:20px;color:var(--primary)">📊 Grafik Kepribadian</h4>
      <div style="display:flex;justify-content:center;gap:24px;margin:16px 0;flex-wrap:wrap">${graphHtml}</div>
      <div style="font-size:.75rem;color:var(--text-light)">D=Dominance | I=Influence | S=Steadiness | C=Compliance</div>
    </div>
    <div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
      <h4 style="color:var(--primary);margin-bottom:12px">📝 Deskripsi Kepribadian</h4>
      <div style="background:#f8f9ff;border-radius:8px;padding:16px;font-size:.85rem;line-height:1.7">${esc(desc)}</div>
    </div>
    <div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
      <h4 style="color:var(--primary);margin-bottom:12px">🎯 Karakteristik</h4>
      ${traits}
    </div>
    <div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
      <h4 style="color:var(--primary);margin-bottom:12px">📈 Detail Skor</h4>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.82rem"><thead><tr style="background:var(--primary);color:#fff"><th style="padding:10px">Dimensi</th><th style="padding:10px">Raw P</th><th style="padding:10px">Raw K</th><th style="padding:10px">Seg1</th><th style="padding:10px">Seg2</th><th style="padding:10px">Final</th></tr></thead><tbody>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:700">D</td><td style="padding:8px;border-bottom:1px solid #eee">${rawP.D}</td><td style="padding:8px;border-bottom:1px solid #eee">${rawK.D}</td><td style="padding:8px;border-bottom:1px solid #eee">${s1.D}</td><td style="padding:8px;border-bottom:1px solid #eee">${s2.D}</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:700">${s3.D>0?'+':''}${s3.D.toFixed(1)}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:700">I</td><td style="padding:8px;border-bottom:1px solid #eee">${rawP.I}</td><td style="padding:8px;border-bottom:1px solid #eee">${rawK.I}</td><td style="padding:8px;border-bottom:1px solid #eee">${s1.I}</td><td style="padding:8px;border-bottom:1px solid #eee">${s2.I}</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:700">${s3.I>0?'+':''}${s3.I.toFixed(1)}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:700">S</td><td style="padding:8px;border-bottom:1px solid #eee">${rawP.S}</td><td style="padding:8px;border-bottom:1px solid #eee">${rawK.S}</td><td style="padding:8px;border-bottom:1px solid #eee">${s1.S}</td><td style="padding:8px;border-bottom:1px solid #eee">${s2.S}</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:700">${s3.S>0?'+':''}${s3.S.toFixed(1)}</td></tr>
      <tr><td style="padding:8px;font-weight:700">C</td><td style="padding:8px">${rawP.C}</td><td style="padding:8px">${rawK.C}</td><td style="padding:8px">${s1.C}</td><td style="padding:8px">${s2.C}</td><td style="padding:8px;font-weight:700">${s3.C>0?'+':''}${s3.C.toFixed(1)}</td></tr>
      </tbody></table></div>
    </div>
    <div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06);text-align:center">
      <button onclick="window.print()" style="padding:10px 20px;border:none;background:var(--primary);color:#fff;border-radius:6px;font-size:.85rem;font-weight:600;cursor:pointer;margin:4px">🖨️ Cetak</button>
      <button onclick="renderModeSelection()" style="padding:10px 20px;border:none;background:var(--info);color:#fff;border-radius:6px;font-size:.85rem;font-weight:600;cursor:pointer;margin:4px">🔄 Tes Baru</button>
      <button onclick="renderHistory()" style="padding:10px 20px;border:1.5px solid var(--primary);background:transparent;color:var(--primary);border-radius:6px;font-size:.85rem;font-weight:600;cursor:pointer;margin:4px">📋 Riwayat</button>
    </div>
  </div>`;
}

async function renderHistory(){
  document.getElementById('app').innerHTML=`
  <div style="max-width:900px;margin:0 auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 style="color:var(--primary)">📋 Riwayat Hasil Tes DISC</h3><button onclick="renderModeSelection()" style="padding:8px 16px;border:1.5px solid var(--primary);background:transparent;color:var(--primary);border-radius:6px;font-size:.82rem;font-weight:600;cursor:pointer">← Kembali</button></div>
    <div style="background:#fff;border-radius:10px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <input placeholder="Cari nama..." id="srcH" oninput="filterH()" style="padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem;max-width:250px">
        <select id="fltM" onchange="filterH()" style="padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem"><option value="">Semua</option><option value="calon">Calon</option><option value="evaluasi">Evaluasi</option></select>
      </div>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.82rem"><thead><tr style="background:var(--primary);color:#fff"><th style="padding:10px">Tanggal</th><th style="padding:10px">Nama</th><th style="padding:10px">Mode</th><th style="padding:10px">Posisi</th><th style="padding:10px">Tipe</th><th style="padding:10px">Profil</th></tr></thead><tbody id="hTbl"><tr><td colspan="6" style="text-align:center;padding:20px">Memuat...</td></tr></tbody></table></div>
    </div>
  </div>`;
  const snap=await db.collection('hrd_disc_results').orderBy('createdAt','desc').limit(100).get();
  window._dh=[];snap.forEach(d=>window._dh.push({id:d.id,...d.data()}));filterH();
}

function filterH(){
  const q=(document.getElementById('srcH')?.value||'').toLowerCase(),m=document.getElementById('fltM')?.value||'';
  const data=(window._dh||[]).filter(r=>{if(q&&!r.nama?.toLowerCase().includes(q))return false;if(m&&r.mode!==m)return false;return true;});
  let h='';
  if(!data.length)h='<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-light)">Belum ada data</td></tr>';
  else data.forEach(r=>{
    const dt=r.createdAt?new Date(r.createdAt).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'-';
    const badge=r.mode==='evaluasi'?'<span style="background:#fff8e1;color:#f57f17;padding:2px 8px;border-radius:12px;font-size:.7rem;font-weight:600">Evaluasi</span>':'<span style="background:#e1f5fe;color:#0277bd;padding:2px 8px;border-radius:12px;font-size:.7rem;font-weight:600">Calon</span>';
    h+=`<tr><td style="padding:8px;border-bottom:1px solid #eee">${dt}</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:700">${esc(r.nama)}</td><td style="padding:8px;border-bottom:1px solid #eee">${badge}</td><td style="padding:8px;border-bottom:1px solid #eee">${esc(r.posisi||'-')}</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:700;color:var(--primary)">${esc(r.pattern||'-')}</td><td style="padding:8px;border-bottom:1px solid #eee">${esc(r.profileName||'-')}</td></tr>`;
  });
  document.getElementById('hTbl').innerHTML=h;
}
