'use strict';
// DISC-TEST.JS — DISC Personality Assessment Module — IJEF Corp
const firebaseConfig = {
  apiKey: 'AIzaSyAWlNi_iBOWxZBD6E20aHOSrRpPsirDdOM',
  authDomain: 'test-kesehatan-ijef-corp-7c278.firebaseapp.com',
  projectId: 'test-kesehatan-ijef-corp-7c278',
  storageBucket: 'test-kesehatan-ijef-corp-7c278.firebasestorage.app',
  messagingSenderId: '48180557823',
  appId: '1:48180557823:web:47ea8db8126737dbc0d9ca',
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
let testState = {
  mode: null,
  nama: '',
  usia: '',
  jenisKelamin: '',
  tanggalTes: '',
  departemen: '',
  posisi: '',
  nip: '',
  evaluasiPeriode: '',
  kontak: '',
  currentQuestion: 0,
  answers: {},
};

const Q = [
  {
    n: 1,
    o: [
      ['Gampangan, Mudah setuju', 'S'],
      ['Percaya, Mudah percaya pada orang', 'I'],
      ['Petualang, Mengambil resiko', 'D'],
      ['Toleran, Menghormati', 'C'],
    ],
  },
  {
    n: 2,
    o: [
      ['Lembut suara, Pendiam', 'C'],
      ['Optimistik, Visioner', 'D'],
      ['Pusat Perhatian, Suka gaul', 'I'],
      ['Pendamai, Membawa Harmoni', 'S'],
    ],
  },
  {
    n: 3,
    o: [
      ['Menyemangati orang', 'I'],
      ['Berusaha sempurna', 'C'],
      ['Bagian dari kelompok', 'S'],
      ['Ingin membuat tujuan', 'D'],
    ],
  },
  {
    n: 4,
    o: [
      ['Menjadi frustrasi', 'S'],
      ['Menyimpan perasaan saya', 'C'],
      ['Menceritakan sisi saya', 'I'],
      ['Siap beroposisi', 'D'],
    ],
  },
  {
    n: 5,
    o: [
      ['Hidup, Suka bicara', 'I'],
      ['Gerak cepat, Tekun', 'D'],
      ['Usaha menjaga keseimbangan', 'S'],
      ['Usaha mengikuti aturan', 'C'],
    ],
  },
  {
    n: 6,
    o: [
      ['Kelola waktu secara efisien', 'C'],
      ['Sering terburu-buru, Merasa tertekan', 'D'],
      ['Masalah sosial itu penting', 'I'],
      ['Suka selesaikan apa yang saya mulai', 'S'],
    ],
  },
  {
    n: 7,
    o: [
      ['Tolak perubahan mendadak', 'S'],
      ['Cenderung janji berlebihan', 'I'],
      ['Tarik diri di tengah tekanan', 'C'],
      ['Tidak takut bertempur', 'D'],
    ],
  },
  {
    n: 8,
    o: [
      ['Penyemangat yang baik', 'I'],
      ['Pendengar yang baik', 'S'],
      ['Penganalisa yang baik', 'C'],
      ['Delegator yang baik', 'D'],
    ],
  },
  {
    n: 9,
    o: [
      ['Hasil adalah penting', 'D'],
      ['Lakukan dengan benar, Akurasi penting', 'C'],
      ['Dibuat menyenangkan', 'I'],
      ['Mari kerjakan bersama', 'S'],
    ],
  },
  {
    n: 10,
    o: [
      ['Akan berjalan terus tanpa kontrol diri', 'D'],
      ['Akan membeli sesuai dorongan hati', 'I'],
      ['Akan menunggu, Tanpa tekanan', 'S'],
      ['Akan mengusahakan yang kuinginkan', 'C'],
    ],
  },
  {
    n: 11,
    o: [
      ['Ramah, Mudah bergabung', 'I'],
      ['Unik, Bosan rutinitas', 'D'],
      ['Aktif mengubah sesuatu', 'D'],
      ['Ingin hal-hal yang pasti', 'C'],
    ],
  },
  {
    n: 12,
    o: [
      ['Non-konfrontasi, Menyerah', 'S'],
      ['Dipenuhi hal detail', 'C'],
      ['Perubahan pada menit terakhir', 'I'],
      ['Menuntut, Kasar', 'D'],
    ],
  },
  {
    n: 13,
    o: [
      ['Ingin kemajuan', 'D'],
      ['Puas dengan segalanya', 'S'],
      ['Terbuka memperlihatkan perasaan', 'I'],
      ['Rendah hati, Sederhana', 'C'],
    ],
  },
  {
    n: 14,
    o: [
      ['Tenang, Pendiam', 'S'],
      ['Bahagia, Tanpa beban', 'I'],
      ['Menyenangkan, Baik hati', 'S'],
      ['Tak gentar, Berani', 'D'],
    ],
  },
  {
    n: 15,
    o: [
      ['Menggunakan waktu berkualitas dgn teman', 'I'],
      ['Rencanakan masa depan, Bersiap', 'C'],
      ['Bepergian demi petualangan baru', 'D'],
      ['Menerima ganjaran atas tujuan yg dicapai', 'S'],
    ],
  },
  {
    n: 16,
    o: [
      ['Aturan perlu dipertanyakan', 'D'],
      ['Aturan membuat adil', 'S'],
      ['Aturan membuat bosan', 'I'],
      ['Aturan membuat aman', 'C'],
    ],
  },
  {
    n: 17,
    o: [
      ['Pendidikan, Kebudayaan', 'C'],
      ['Prestasi, Ganjaran', 'D'],
      ['Keselamatan, keamanan', 'S'],
      ['Sosial, Perkumpulan kelompok', 'I'],
    ],
  },
  {
    n: 18,
    o: [
      ['Memimpin, Pendekatan langsung', 'D'],
      ['Suka bergaul, Antusias', 'I'],
      ['Dapat diramal, Konsisten', 'S'],
      ['Waspada, Hati-hati', 'C'],
    ],
  },
  {
    n: 19,
    o: [
      ['Tidak mudah dikalahkan', 'D'],
      ['Kerjakan sesuai perintah, Ikut pimpinan', 'S'],
      ['Mudah terangsang, Riang', 'I'],
      ['Ingin segalanya teratur, Rapi', 'C'],
    ],
  },
  {
    n: 20,
    o: [
      ['Saya akan pimpin mereka', 'D'],
      ['Saya akan melaksanakan', 'S'],
      ['Saya akan meyakinkan mereka', 'I'],
      ['Saya dapatkan fakta', 'C'],
    ],
  },
  {
    n: 21,
    o: [
      ['Memikirkan orang dahulu', 'S'],
      ['Kompetitif, Suka tantangan', 'D'],
      ['Optimis, Positif', 'I'],
      ['Pemikir logis, Sistematik', 'C'],
    ],
  },
  {
    n: 22,
    o: [
      ['Menyenangkan orang, Mudah setuju', 'S'],
      ['Tertawa lepas, Hidup', 'I'],
      ['Berani, Tak gentar', 'D'],
      ['Tenang, Pendiam', 'C'],
    ],
  },
  {
    n: 23,
    o: [
      ['Ingin otoritas lebih', 'D'],
      ['Ingin kesempatan baru', 'I'],
      ['Menghindari konflik', 'S'],
      ['Ingin petunjuk yang jelas', 'C'],
    ],
  },
  {
    n: 24,
    o: [
      ['Dapat diandalkan, Dapat dipercaya', 'S'],
      ['Kreatif, Unik', 'I'],
      ['Garis dasar, Orientasi hasil', 'D'],
      ['Jalankan standar yang tinggi, Akurat', 'C'],
    ],
  },
];

// Segment tables for scoring
const SEG1 = {
  D: [-6, -5.3, -4, -2.5, -1.7, -1.3, 0, 0.5, 1, 2, 3, 3.5, 4, 4.7, 5.3, 6.5, 7, 7, 7, 7.5, 7.5],
  I: [-7, -4.6, -2.5, -1.3, 1, 3, 3.5, 5.3, 5.7, 6, 6.5, 7, 7, 7, 7, 7, 7.5, 7.5, 7.5, 7.5, 8],
  S: [-5.7, -4.3, -3.5, -1.5, -0.7, 0.5, 1, 2.5, 3, 4, 4.6, 5, 5.7, 6, 6.5, 6.5, 7, 7, 7, 7.5, 7.5],
  C: [-6, -4.7, -3.5, -1.5, 0.5, 2, 3, 5.3, 5.7, 6, 6.3, 6.5, 6.7, 7, 7.3, 7.3, 7.3, 7.5, 8, 8, 8],
};
const SEG2 = {
  D: [
    7.5, 6.5, 4.3, 2.5, 1.5, 0.5, 0, -1.3, -1.5, -2.5, -3, -3.5, -4.3, -5.3, -5.7, -6, -6.5, -6.7,
    -7, -7.3, -7.5,
  ],
  I: [
    7, 6, 4, 2.5, 0.5, 0, -2, -3.5, -4.3, -5.3, -6, -6.5, -7, -7.2, -7.2, -7.2, -7.3, -7.3, -7.3,
    -7.5, -8,
  ],
  S: [
    7.5, 7, 6, 4, 2.5, 1.5, 0.5, -1.3, -2, -3, -4.3, -5.3, -6, -6.5, -6.7, -6.7, -7, -7.2, -7.3,
    -7.5, -8,
  ],
  C: [
    7.5, 7, 5.6, 4, 2.5, 1.5, 0.5, 0, -1.3, -2.5, -3.5, -5.3, -5.7, -6, -6.5, -7, -7.3, -7.5, -7.7,
    -7.9, -8,
  ],
};

// Profile database with positive, negative traits and career recommendations
const PROFILES = {
  D: {
    name: 'ESTABLISHER',
    pos: [
      'Individualis',
      'High Motivation',
      'Bersemangat Tinggi',
      'Percaya Diri',
      'Kreatif',
      'Efektif',
      'Leader',
    ],
    neg: [
      'Ego Tinggi',
      'Kurang Sensitif',
      'Kurang Pertimbangan',
      'Agresif',
      'Terlalu Dominan',
      'Terlalu Dinamis',
    ],
    career:
      'Attorney, Sales Representative, Production Director/Manager, Strategic Planning, Trouble Shooting, Self-Employment, Marketing Services, Consultant.',
  },
  I: {
    name: 'COMMUNICATOR',
    pos: [
      'Antusias',
      'Optimis',
      'Persuasif',
      'Ramah',
      'Inspirasional',
      'Bicara aktif',
      'Penjaga damai',
    ],
    neg: [
      'Emosional',
      'Impulsif',
      'Kurang fokus',
      'Terlalu banyak bersosialisasi',
      'Tidak terorganisir',
    ],
    career:
      'Promoting, Public Relations, Lecturing, Advertising, Hospitality, Retail, Human Resources, Journalist, Travel Agent, Politician.',
  },
  S: {
    name: 'SPECIALIST',
    pos: [
      'Stabil & Konsisten',
      'Terkendali',
      'Sabar',
      'Loyal',
      'Teguh',
      'Pendengar baik',
      'Dapat diandalkan',
    ],
    neg: [
      'Anti Perubahan',
      'Sulit Adaptasi',
      'Menghindari Konflik',
      'Lambat Memutuskan',
      'Process Oriented',
    ],
    career:
      'Administrative Work, Engineering (Sales, Services, Project), Chef, Accounting, Research and Development, Retail, Landscape Gardener.',
  },
  C: {
    name: 'LOGICAL THINKER',
    pos: ['Detail', 'Analitis', 'Rapi', 'Organized', 'Sistematis', 'Empati', 'Perfeksionis'],
    neg: ['Pendiam', 'Anti Kritik', 'Kaku pada Metode', 'Cenderung Santai', 'Terlalu Detail'],
    career:
      'Planner, Engineer, Technical/Research, Academic, Statistician, IT Management, Quality Controller, Accountant.',
  },
  'D-I': {
    name: 'PENGAMBIL KEPUTUSAN',
    pos: ['Pekerja Keras', 'Leader', 'Banyak Minat', 'Tegas', 'Logis', 'Kritis', 'Imajinatif'],
    neg: ['Cepat Bosan', 'Dingin/Task Oriented', 'Kurang Pergaulan', 'Keras kepala', 'Anti Aturan'],
    career:
      'General Management, Public Relations, Business Management, Sales Management, Marketing, Production Director, Consultancy, Self-Employment.',
  },
  'D-S': {
    name: 'SELF-MOTIVATED',
    pos: [
      'Objektif & Analitis',
      'Mandiri',
      'Good Planner',
      'Komitmen thd Target',
      'Stabil',
      'Ulet',
    ],
    neg: ['Menghindari Konflik', 'Kurang fleksibel', 'Terlalu mandiri', 'Kurang sosial'],
    career:
      'Engineering (Directing, Managing), Project Management, Researcher, Systems Analyst, Computer Engineer, Programmer, IT, Lawyer.',
  },
  'D-C': {
    name: 'CHALLENGER',
    pos: [
      'Tekun',
      'Sensitif terhadap permasalahan',
      'Keputusan kuat',
      'Kreatif memecahkan masalah',
      'Reaksi cepat',
    ],
    neg: ['Perfeksionis', 'Lambat mengambil keputusan', 'Terlalu fokus pada ketepatan'],
    career:
      'Engineering (Management, Research), Actuaries, Planning, Accountancy, Fund Management, Specialist Finance, Quality Control, Strategic Planning.',
  },
  'D-I-S': {
    name: 'DIRECTOR',
    pos: ['Pengelola', 'Enerjik', 'Motivator', 'Percaya diri', 'Meyakinkan orang'],
    neg: ['Kurang Detail', 'Mudah Bosan', 'Agresif', 'Arogan', 'Kurang Focus'],
    career:
      'Engineering and Production (Directing, Managing), Sales Management, Service Manager, Distribution, Public Relations, Office Management.',
  },
  'D-I-C': {
    name: 'CHANCELLOR',
    pos: ['Ramah secara alami', 'Detail', 'Interaktif', 'Menilai hati-hati', 'Tepat'],
    neg: [
      'Sering melalaikan perencanaan',
      'Mudah beralih proyek',
      'Kurang pertimbangan menyeluruh',
    ],
    career:
      'Technical/Scientific (Directing, Management), Engineering, Finance, Production Planning, Self-Employment, IT, Banking, Consultancy.',
  },
  'D-S-I': {
    name: 'DIRECTOR',
    pos: [
      'Obyektif dan analitis',
      'Termotivasi target pribadi',
      'Tenang',
      'Stabil',
      'Ulet',
      'Mandiri',
    ],
    neg: ['Kurang fleksibel', 'Terlalu mandiri', 'Kurang ekspresif'],
    career:
      'Engineering and Production (Directing, Managing), Sales Management, Distribution, Office Management, Customer Service, Projects Manager.',
  },
  'D-S-C': {
    name: 'DIRECTOR',
    pos: ['Obyektif', 'Analitis', 'Bantuan & dukungan', 'Termotivasi target', 'Stabil'],
    neg: ['Terlalu analitis', 'Lambat bertindak', 'Kurang spontan'],
    career:
      'Engineering and Production (Directing, Managing), Sales, Creative Designer, Chief Engineer, Business Consultant, Research Planning.',
  },
  'D-C-I': {
    name: 'CHALLENGER',
    pos: ['Tekun', 'Sensitif', 'Keputusan kuat', 'Kreatif', 'Reaksi cepat'],
    neg: ['Perfeksionis', 'Terlalu fokus tugas', 'Kurang peduli perasaan orang'],
    career:
      'Technical/Scientific (Directing, Management), Engineering, Finance, Production Planning, Consultancy, Industrial Relations.',
  },
  'D-C-S': {
    name: 'CHALLENGER',
    pos: ['Tekun', 'Sensitif', 'Keputusan kuat', 'Perfeksionis', 'Ide-ide banyak'],
    neg: ['Lambat keputusan', 'Terlalu detail', 'Kurang fleksibel'],
    career:
      'Engineering, Production and Finance (Directing, Managing), Work Study, Accountant, Quality Controller, Safety Officer, Planner.',
  },
  'I-S': {
    name: 'ADVISOR',
    pos: [
      'Hangat',
      'Simpati',
      'Tenang',
      'Pendengar baik',
      'Toleran',
      'Penjaga damai',
      'Demonstratif',
    ],
    neg: [
      'Kurang tegas',
      'Menerima kritik sebagai serangan pribadi',
      'Terlalu toleran pada yang tidak produktif',
    ],
    career:
      'Personnel, Welfare, Training, Hotelier, Promoting, Travel Agent, Lecturing, Soft/Service Selling, Psychologist, Nursing, Social Work.',
  },
  'I-C': {
    name: 'ASSESSOR',
    pos: [
      'Ramah',
      'Suka berteman',
      'Nyaman dengan orang asing',
      'Dapat mengendalikan diri',
      'Perfeksionis alamiah',
    ],
    neg: ['Kadang salah menilai kemampuan orang', 'Terlalu optimis', 'Kurang fokus saat tugas'],
    career:
      'Teaching, Training, Specialist Selling, Project Engineer, Finance, Service Engineer, Public Relations, Marketing, Conference Organiser.',
  },
  'I-D': {
    name: 'NEGOTIATOR',
    pos: [
      'Suka Bergaul',
      'Aktif',
      'Percaya Diri',
      'Optimis',
      'Result Oriented',
      'Perhatian tinggi',
    ],
    neg: ['Anti Rutin', 'Kurang Detail', 'Terlalu Percaya Diri', 'Impulsif', 'Terlalu antusias'],
    career:
      'Sales and Marketing, Public Relations, Recruitment Consultant, Director, Self-Employed, Hotelier, Trainer, Hospitality, Lawyer, Team Leader.',
  },
  'I-S-C': {
    name: 'RESPONSIVE & THOUGHTFUL',
    pos: ['High Energy', 'Good Communication', 'Sensitif', 'Loyal', 'Cerdas berbagai hal'],
    neg: ['Need Recognition', 'Anti Kritik', 'Terlalu banyak bersosialisasi', 'Leadership kurang'],
    career:
      'Personnel, Welfare, Training, Teaching, Accounting, Customer Services, Public Relations, Engineering (Sales, Service), Selling, Purchasing.',
  },
  'I-S-D': {
    name: 'MOTIVATOR',
    pos: ['Leader Kelompok Kecil', 'Supporter', 'Sosialisasi Baik', 'Peduli', 'Komunikasi baik'],
    neg: ['Butuh Penghargaan', 'Kurang Detail', 'Agak Kaku', 'Butuh Ketegasan'],
    career:
      'Hotelier, Community Counseling, Customer Service, Recruitment Consultant, Hospitality, Teacher, Production Manager, Call Centre Manager.',
  },
  'I-D-C': {
    name: 'CONFIDENT & DETERMINED',
    pos: [
      'Pandai Memilih Orang',
      'Leader',
      'Good Interpersonal',
      'Good Communication',
      'Logika tinggi',
    ],
    neg: ['Dominan', 'Agresif', 'Perfeksionis', 'Tidak konsisten', 'Kurang mendengarkan'],
    career:
      'Specialist/Technical Selling, Financial Manager, Engineering Manager, Project Engineer, Sales Engineer, Consultant, Trainer, Lecturer.',
  },
  'I-D-S': {
    name: 'REFORMER',
    pos: ['Mudah Bergaul', 'Leader', 'Sadar Diri', 'Motivator', 'Optimis & Positif', 'Peduli'],
    neg: ['Cepat Percaya Orang', 'Anti Aturan', 'Kurang Detail', 'Terlalu Selektif'],
    career:
      'Hotelier, Customer Service, Sales Manager, Marketing Services, Public Relations, Computer Software Sales, Lecturer, Engineering Manager.',
  },
  'I-C-D': {
    name: 'ASSESSOR',
    pos: [
      'Analitis',
      'Hati-hati',
      'Ramah saat nyaman',
      'Perfeksionis alami',
      'Berorientasi kualitas',
    ],
    neg: [
      'Sangat biasa dengan orang asing',
      'Suka situasi yang dapat diramalkan',
      'Kurang spontan',
    ],
    career:
      'Specialist/Technical Selling, Financial Manager, Engineering Manager, Project Engineer, Sales Engineer, Consultant, Trainer.',
  },
  'I-C-S': {
    name: 'RESPONSIVE & THOUGHTFUL',
    pos: ['High Energy', 'Good Communication', 'Sensitif', 'Banyak Bicara', 'Cerdas'],
    neg: ['Need Recognition', 'Anti Kritik', 'Terlalu khawatir pendapat orang'],
    career:
      'Personnel, Welfare, Training, Teaching, Customer Services, Public Relations, Engineering, Selling, Purchasing, Administration.',
  },

  'S-D': {
    name: 'SELF-MOTIVATED',
    pos: ['Objektif', 'Analitis', 'Mandiri', 'Komitmen target', 'Stabil', 'Tekun'],
    neg: ['Menghindari Konflik', 'Kurang fleksibel', 'Terlalu mandiri'],
    career:
      'Investigator, Researcher, Accountant, Engineering, Computer Specialist, Architect, Quality Controller, Property Manager, Attorney.',
  },
  'S-I': {
    name: 'ADVISOR',
    pos: ['Hangat', 'Simpati', 'Pendengar baik', 'Toleran', 'Penjaga damai', 'Moderat'],
    neg: ['Kurang tegas', 'Terlalu toleran', 'Sulit membuat keputusan', 'Mudah diramalkan'],
    career:
      'Personnel Welfare, Training, Hotelier, Promoting, Travel Agent, Lecturing, Child Care, Charitable Organizations, Psychologist, Therapist, Nurse.',
  },
  'S-C': {
    name: 'PEACEMAKER',
    pos: ['Detail', 'Empati', 'Loyal', 'Teliti', 'Peduli orang sekitar'],
    neg: ['Anti Kritik', 'Sulit Adaptasi', 'Introvert', 'Pendendam', 'Terlalu Mendalam Berpikir'],
    career:
      'Office Manager, Chief Clerk, General Administrator, Production Supervisor, Planner, Accountant, Computer Programmer, Doctor, Receptionist, Health Care.',
  },
  'S-D-I': {
    name: 'DIRECTOR',
    pos: ['Obyektif', 'Analitis', 'Termotivasi target', 'Ulet', 'Mandiri', 'Cermat'],
    neg: ['Kurang ekspresif', 'Terlalu mandiri', 'Kurang spontan'],
    career:
      'Engineering and Production (Supervision), Service Selling, Distribution, Office Management, Customer Service, System Analyst, Programmer.',
  },
  'S-D-C': {
    name: 'INQUIRER',
    pos: [
      'Full Self Control',
      'Sabar',
      'Penuh Pertimbangan',
      'Good Interpersonal',
      'Result Oriented',
    ],
    neg: ['Lambat Adaptasi', 'Inisiatif kurang', 'Kaku dan Keras Kepala'],
    career:
      'Directing, Managing or Supervising (Engineering, Accountancy, R&D, Computing), Research Manager, Accountant, Project Engineer, Designer, Analyst.',
  },
  'S-I-D': {
    name: 'ADVISOR',
    pos: ['Hangat', 'Simpati', 'Tenang', 'Pendengar baik', 'Toleran', 'Berusaha keras'],
    neg: ['Kurang tegas', 'Mudah diramalkan', 'Terlalu moderat'],
    career:
      'Engineering and Production (Supervision), Service Selling, Distribution, Office Management, Customer Service, System Analyst, Programmer.',
  },
  'S-I-C': {
    name: 'ADVOCATE',
    pos: ['Stabil', 'Ramah', 'Detail saat dibutuhkan', 'Teguh pendirian', 'Mendukung pihak lemah'],
    neg: ['Cenderung individualis', 'Sulit membuat keputusan', 'Terlalu moderat'],
    career:
      'Personnel Welfare, Training, Teaching, Customer Service, Public Relations, Engineer (Sales, Service), Selling, Purchasing, Administration.',
  },
  'S-C-D': {
    name: 'INQUIRER',
    pos: ['Baik secara alamiah', 'Berorientasi detil', 'Teliti', 'Sangat berhati-hati'],
    neg: ['Lambat adaptasi', 'Kaku dan keras kepala', 'Terlalu hati-hati'],
    career:
      'Directing, Managing or Supervising (Engineering, Accountancy, R&D), Accountant, Project Engineer, Designer, Analyst, Technician, Service Engineer.',
  },
  'S-C-I': {
    name: 'ADVOCATE',
    pos: ['Stabil', 'Ramah', 'Individualis', 'Teguh pendirian', 'Moderat', 'Cermat'],
    neg: ['Sulit membuat keputusan', 'Terlalu moderat', 'Ingin orang lain menyukainya'],
    career:
      'Personnel Welfare, Training, Teaching, Customer Service, Public Relations, Counseling, Accounting, Sales Engineer, Legal, Negotiator.',
  },
  'C-D': {
    name: 'DESIGNER',
    pos: [
      'Sensitif',
      'Berorientasi tugas',
      'Kukuh',
      'Efektif memecahkan masalah',
      'Berdasar fakta',
    ],
    neg: ['Dingin', 'Tidak berperasaan', 'Menjaga jarak', 'Pendiam', 'Tidak mudah percaya'],
    career:
      'Engineering (Management, Research, Design), Research (R&D), Planning, Chemist, Accountancy, Specialist Finance, Quality Control, Production Planning.',
  },
  'C-I': {
    name: 'ASSESSOR',
    pos: [
      'Analitis',
      'Hati-hati',
      'Ramah saat nyaman',
      'Perfeksionis alami',
      'Berorientasi kualitas',
    ],
    neg: [
      'Sangat biasa dengan orang asing',
      'Mengisolasi diri',
      'Suka situasi yang dapat diramalkan',
    ],
    career:
      'Sales (Technical/Specialist), Public Relations, Lecturer, Academic, Personnel Administration, Purchasing, Travel Agent, Training, Teaching.',
  },
  'C-S': {
    name: 'PERFECTIONIST',
    pos: ['Detail & Teliti', 'Sistematik', 'Bijaksana', 'Diplomatis', 'Akurasi tinggi'],
    neg: ['Menghindari Konflik', 'Lambat Memutuskan', 'Anti Perubahan', 'Terjebak dalam detail'],
    career:
      'Researcher, Engineer (Project, Draughtsman), Statistician, Medical Specialist, IT Management, Planner, Technical Writing, Quality Control, Dentist, Architect.',
  },
  'C-D-I': {
    name: 'CHALLENGER',
    pos: ['Berorientasi tugas', 'Sensitif', 'Kukuh', 'Efektif', 'Berdasar fakta'],
    neg: ['Pendiam', 'Dingin', 'Tidak mudah percaya', 'Menjaga jarak'],
    career:
      'Engineering (Management, Research, Design), Actuaries, Research (R&D), Planning, Accountancy, Fund Management, Quality Control, Strategic Planning.',
  },
  'C-D-S': {
    name: 'CONTEMPLATOR',
    pos: [
      'Berorientasi detil',
      'Standard tinggi',
      'Logis',
      'Kompetitif',
      'Mantap',
      'Dapat diandalkan',
    ],
    neg: ['Terlalu fokus tugas', 'Sensitif tapi tertutupi logika', 'Kurang spontan'],
    career:
      'Directing, Managing or Supervising (Engineering, Research, Finance, Planning), Designer, Work Study, Sales (Technical/Specialist), Logistic Support, Systems Analyst.',
  },
  'C-I-D': {
    name: 'ASSESSOR',
    pos: ['Analitis', 'Hati-hati', 'Ramah', 'Perfeksionis', 'Berorientasi kualitas'],
    neg: ['Mengisolasi diri', 'Kurang spontan', 'Terlalu hati-hati'],
    career:
      'Directing, Managing or Supervising (Engineering, Research, Finance, Planning), Designer, Work Study, Sales (Technical/Specialist), Lecturer.',
  },
  'C-I-S': {
    name: 'MEDIATOR',
    pos: [
      'Loyal',
      'Curious',
      'Sensitif',
      'Good Communication',
      'Good Analytical Think',
      'Cepat Beradaptasi',
    ],
    neg: ['Anti Kritik', 'Not Leader', 'Work/Play Conflict', 'Terlalu khawatir pendapat orang'],
    career:
      'Engineering and Production (Supervisor, Installer, Technician), Research, Trainer, Finance, Public Relations, Administration, System Analyst, Programmer.',
  },
  'C-S-I': {
    name: 'PRACTITIONER',
    pos: ['Perfeksionis', 'Quality Oriented', 'Scheduled', 'Sistematis'],
    neg: ['Kaku/Tidak fleksibel', 'Monoton', 'Anti Deadline', 'Terlalu Detail'],
    career:
      'Engineering and Production (Supervisor, Installer, Technician), Research, Finance (Manager, Accountant), Public Relations, Purchasing, Office Administrator, Programmer.',
  },
  'C-S-D': {
    name: 'PRECISIONIST',
    pos: ['Sistematis', 'Teratur', 'Teliti', 'Bijaksana', 'Diplomatis', 'Akurasi tinggi'],
    neg: [
      'Terjebak dalam detail',
      'Menginginkan petunjuk standard',
      'Tidak menginginkan perubahan mendadak',
    ],
    career:
      'Engineering, Research, Production and Finance (Director, Manager, Supervisor), Work Study, Accountant, Administrator, Quality Controller, Safety Officer, Planner.',
  },
};

const DESC = {
  D: 'Memiliki rasa ego yang tinggi dan cenderung individualis dengan standard yang sangat tinggi. Mampu memimpin situasi dan orang lain dalam rangka mencapai sasarannya. Ia menghindari sesuatu yang biasa-biasa dan cenderung mencari tantangan baru.',
  I: 'Merupakan seorang yang antusias dan optimistik, ia lebih suka mencapai sasarannya melalui orang lain. Sangat menonjol dalam keterampilan berkomunikasi. Memiliki kemampuan untuk memotivasi dan memberi semangat dengan kata-katanya.',
  S: 'Merupakan individu konsisten yang berusaha menjaga lingkungan yang tidak berubah. Sabar, loyal dan suka menolong. Sangat baik bekerja dengan petunjuk dan peraturan yang jelas.',
  C: 'Seorang yang praktis, cakap dan unik. Menyukai hal yang detil dan logis; secara alamiah sangat analitis. Hati-hati dalam membuat keputusan berdasarkan logika, bukan emosi.',
  'D-I':
    'Tidak basa-basi dan tegas, berpandangan jauh ke depan, progresif dan mau berkompetisi. Mempunyai kemampuan memimpin yang baik dan minat dengan cakupan yang luas.',
  'D-S':
    'Seorang yang obyektif dan analitis. Ingin terlibat dalam situasi dan memberikan bantuan. Termotivasi oleh target pribadi, ulet dalam memulai pekerjaan.',
  'D-C':
    'Sensitif terhadap permasalahan, memiliki kreativitas baik dalam memecahkan masalah. Dapat menyelesaikan tugas penting dalam waktu singkat karena keputusan yang kuat.',
  'I-S':
    'Mengesankan orang akan kehangatan, simpati dan pengertiannya. Memiliki ketenangan dalam situasi sosial. Merupakan pendengar yang baik dan penjaga damai.',
  'I-C':
    'Ramah dan suka berteman; merasa nyaman walaupun dengan orang asing. Dapat mengembangkan hubungan baru dengan mudah. Perfeksionis secara alamiah.',
  'S-C':
    'Orang yang baik secara alamiah dan sangat berorientasi detil. Peduli dengan orang-orang di sekitarnya dan sangat teliti dalam penyelesaian tugas.',
  'C-D':
    'Sangat berorientasi pada tugas dan sensitif pada permasalahan. Kukuh dan mempunyai pendekatan efektif dalam pemecahan masalah. Membuat keputusan berdasar fakta.',
  'C-S':
    'Berpikir sistematis dan mengikuti prosedur. Teratur, teliti dan fokus pada detil. Sangat berhati-hati, mengharapkan akurasi dan standard tinggi.',
};

// ── HELPERS ───────────────────────────────────────────────────
function toast(m, t = 'info') {
  const c = document.getElementById('toastContainer'),
    el = document.createElement('div');
  el.className = 'toast-' + t;
  el.style.cssText =
    'padding:12px 18px;border-radius:8px;color:#fff;font-size:.83rem;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.15);max-width:350px;animation:slideIn .3s';
  el.style.background =
    t === 'success'
      ? '#2e7d32'
      : t === 'error'
        ? '#c62828'
        : t === 'warning'
          ? '#f57f17'
          : '#0277bd';
  el.textContent = m;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const h = window.location.hash;
  if (h.startsWith('#evaluasi')) {
    const paramStr = h.includes('?') ? h.split('?')[1] : '';
    if (paramStr) {
      const p = new URLSearchParams(paramStr);
      testState.mode = 'evaluasi';
      testState.nama = p.get('nama') || '';
      testState.nip = p.get('nip') || '';
      testState.departemen = p.get('dept') || '';
      testState.posisi = p.get('pos') || '';
      testState.evaluasiPeriode = p.get('periode') || '';
      testState.tanggalTes = todayStr();
      testState.answers = {};
      testState.currentQuestion = 0;
      renderInstructions();
    } else {
      startMode('evaluasi');
    }
  } else if (h === '#history') renderHistory();
  else {
    startMode('calon');
  } // Default: langsung ke form calon karyawan
});

function renderModeSelection() {
  startMode('calon');
}

function startMode(mode) {
  testState = { ...testState, mode, answers: {}, currentQuestion: 0 };
  mode === 'calon' ? renderCalonForm() : renderEvaluasiForm();
}

function renderCalonForm() {
  document.getElementById('app').innerHTML = `
  <div style="background:#fff;border-radius:10px;padding:24px;max-width:600px;margin:20px auto;box-shadow:0 1px 4px rgba(0,0,0,.06)">
    <h3 style="color:var(--primary);margin-bottom:16px">🧑‍💼 Data Calon Karyawan</h3>
    <div style="background:#e3f2fd;border-radius:8px;padding:12px;margin-bottom:16px;border-left:4px solid var(--info);font-size:.82rem">Silakan isi data diri sebelum memulai tes DISC.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Nama Lengkap *</label><input id="fNama" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" placeholder="Nama lengkap"></div>
      <div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Usia</label><input id="fUsia" type="number" min="17" max="65" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" placeholder="Usia"></div>
      <div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Jenis Kelamin</label><select id="fGender" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem"><option value="">-- Pilih --</option><option>Laki-laki</option><option>Perempuan</option></select></div>
      <div><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Posisi yang Dilamar *</label><select id="fPosisi" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem"><option value="">Memuat lowongan...</option></select></div>
    </div>
    <div style="margin-top:14px"><label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:4px">Email / No. HP</label><input id="fKontak" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem" placeholder="Email atau HP"></div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button onclick="renderModeSelection()" style="padding:10px 20px;border:1.5px solid var(--primary);background:transparent;color:var(--primary);border-radius:6px;font-size:.85rem;font-weight:600;cursor:pointer">← Kembali</button>
      <button onclick="validateStart('calon')" style="padding:10px 20px;border:none;background:var(--primary);color:#fff;border-radius:6px;font-size:.85rem;font-weight:600;cursor:pointer">Mulai Tes →</button>
    </div>
  </div>`;
  loadLowonganOptions();
}
async function loadLowonganOptions() {
  try {
    const snap = await db.collection('hrd_lowongan').where('status', '==', 'open').get();
    const sel = document.getElementById('fPosisi');
    if (!sel) return;
    let opts = '<option value="">-- Pilih Posisi Lowongan --</option>';
    if (snap.empty) {
      opts += '<option value="General">General (Belum ada lowongan aktif)</option>';
    } else {
      snap.forEach((d) => {
        const p = d.data();
        opts += `<option value="${p.posisi || ''}">${p.posisi || '-'}${p.departemen ? ' — ' + p.departemen : ''}</option>`;
      });
    }
    opts += '<option value="Lainnya">Lainnya (Posisi tidak terdaftar)</option>';
    sel.innerHTML = opts;
  } catch (e) {
    const sel = document.getElementById('fPosisi');
    if (sel) sel.innerHTML = '<option value="">-- Pilih posisi --</option>';
  }
}

function renderEvaluasiForm() {
  document.getElementById('app').innerHTML = `
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

function validateStart(mode) {
  const nama = document.getElementById('fNama')?.value.trim();
  if (!nama) return toast('Nama wajib diisi', 'warning');
  testState.nama = nama;
  testState.usia = document.getElementById('fUsia')?.value || '';
  testState.jenisKelamin = document.getElementById('fGender')?.value || '';
  testState.posisi = document.getElementById('fPosisi')?.value || '';
  testState.tanggalTes = todayStr();
  if (mode === 'evaluasi') {
    testState.nip = document.getElementById('fNip')?.value || '';
    testState.departemen = document.getElementById('fDept')?.value || '';
    testState.evaluasiPeriode = document.getElementById('fPeriode')?.value || '';
  } else {
    testState.kontak = document.getElementById('fKontak')?.value || '';
  }
  renderInstructions();
}

function renderInstructions() {
  document.getElementById('app').innerHTML = `
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

function renderQuestion() {
  const qi = testState.currentQuestion,
    total = Q.length,
    q = Q[qi],
    ans = testState.answers[q.n] || { p: null, k: null };
  const pct = (((qi + 1) / total) * 100).toFixed(0);
  let opts = '';
  q.o.forEach((opt, i) => {
    const isP = ans.p === i,
      isK = ans.k === i;
    const border = isP ? 'var(--success)' : isK ? 'var(--danger)' : 'var(--border)';
    const bg = isP ? '#e8f5e9' : isK ? '#ffebee' : '#fff';
    opts += `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1.5px solid ${border};background:${bg};border-radius:8px;margin-bottom:8px;cursor:pointer;transition:all .2s">
      <div style="flex:1;font-size:.88rem">${esc(opt[0])}</div>
      <div style="display:flex;gap:6px">
        <div onclick="selOpt(${q.n},${i},'p')" style="width:32px;height:32px;border-radius:50%;border:2px solid ${isP ? 'var(--success)' : 'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;cursor:pointer;background:${isP ? 'var(--success)' : '#fff'};color:${isP ? '#fff' : 'var(--text)'}">P</div>
        <div onclick="selOpt(${q.n},${i},'k')" style="width:32px;height:32px;border-radius:50%;border:2px solid ${isK ? 'var(--danger)' : 'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;cursor:pointer;background:${isK ? 'var(--danger)' : '#fff'};color:${isK ? '#fff' : 'var(--text)'}">K</div>
      </div>
    </div>`;
  });
  document.getElementById('app').innerHTML = `
  <div style="max-width:700px;margin:0 auto">
    <div style="background:#fff;border-radius:10px;padding:12px 20px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
      <div style="display:flex;justify-content:space-between;font-size:.82rem;color:var(--text-light)"><span>${esc(testState.nama)}</span><span>Soal ${qi + 1}/${total}</span></div>
      <div style="width:100%;height:8px;background:#e0e0e0;border-radius:4px;margin-top:8px;overflow:hidden"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--primary),var(--accent));border-radius:4px;transition:width .3s"></div></div>
    </div>
    <div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,.06);border-left:4px solid var(--primary)">
      <div style="font-size:.75rem;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Nomor ${q.n}</div>
      <p style="font-size:.82rem;color:var(--text-light);margin-bottom:12px">Pilih <span style="color:var(--success);font-weight:700">P</span> = PALING menggambarkan, <span style="color:var(--danger);font-weight:700">K</span> = PALING TIDAK menggambarkan</p>
      ${opts}
    </div>
    <div style="display:flex;justify-content:space-between;gap:8px">
      <button onclick="prevQ()" ${qi === 0 ? 'disabled style="opacity:.5;cursor:not-allowed;padding:8px 16px;border:1.5px solid var(--primary);background:transparent;color:var(--primary);border-radius:6px;font-size:.82rem;font-weight:600"' : 'style="padding:8px 16px;border:1.5px solid var(--primary);background:transparent;color:var(--primary);border-radius:6px;font-size:.82rem;font-weight:600;cursor:pointer"'}>← Sebelumnya</button>
      <div style="display:flex;gap:8px">
        <button onclick="showNav()" style="padding:8px 16px;border:none;background:var(--info);color:#fff;border-radius:6px;font-size:.82rem;font-weight:600;cursor:pointer">📋 Nav</button>
        ${qi < total - 1 ? '<button onclick="nextQ()" style="padding:8px 16px;border:none;background:var(--primary);color:#fff;border-radius:6px;font-size:.82rem;font-weight:600;cursor:pointer">Selanjutnya →</button>' : '<button onclick="finishTest()" style="padding:8px 16px;border:none;background:var(--success);color:#fff;border-radius:6px;font-size:.82rem;font-weight:600;cursor:pointer">✅ Selesai</button>'}
      </div>
    </div>
  </div>`;
}

function selOpt(qn, idx, type) {
  if (!testState.answers[qn]) testState.answers[qn] = { p: null, k: null };
  const ans = testState.answers[qn];
  if (ans[type] === idx) {
    ans[type] = null;
  } else {
    const other = type === 'p' ? 'k' : 'p';
    if (ans[other] === idx) {
      toast('P dan K tidak boleh pada kalimat yang sama', 'warning');
      return;
    }
    ans[type] = idx;
  }
  renderQuestion();
}
function nextQ() {
  const q = Q[testState.currentQuestion],
    ans = testState.answers[q.n];
  if (!ans || ans.p === null || ans.k === null) {
    toast('Pilih P dan K terlebih dahulu', 'warning');
    return;
  }
  if (testState.currentQuestion < Q.length - 1) {
    testState.currentQuestion++;
    renderQuestion();
  }
}
function prevQ() {
  if (testState.currentQuestion > 0) {
    testState.currentQuestion--;
    renderQuestion();
  }
}
function goQ(i) {
  testState.currentQuestion = i;
  renderQuestion();
}

function showNav() {
  let grid = '';
  Q.forEach((q, i) => {
    const ans = testState.answers[q.n];
    const done = ans && ans.p !== null && ans.k !== null;
    const cur = i === testState.currentQuestion;
    const bg = cur ? 'var(--primary)' : done ? 'var(--success)' : 'var(--border)';
    const col = cur || done ? '#fff' : 'var(--text)';
    grid += `<div onclick="goQ(${i})" style="width:36px;height:36px;border-radius:6px;background:${bg};color:${col};display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;cursor:pointer">${q.n}</div>`;
  });
  const answered = Object.values(testState.answers).filter(
    (a) => a && a.p !== null && a.k !== null
  ).length;
  document.getElementById('app').innerHTML = `
  <div style="background:#fff;border-radius:10px;padding:24px;max-width:500px;margin:20px auto;box-shadow:0 1px 4px rgba(0,0,0,.06)">
    <h3 style="color:var(--primary);margin-bottom:12px">📋 Navigasi Soal</h3>
    <p style="font-size:.82rem;color:var(--text-light);margin-bottom:16px">Terjawab: <strong>${answered}</strong> / ${Q.length}</p>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">${grid}</div>
    <div style="display:flex;gap:8px">
      <button onclick="renderQuestion()" style="padding:8px 16px;border:1.5px solid var(--primary);background:transparent;color:var(--primary);border-radius:6px;font-size:.82rem;font-weight:600;cursor:pointer">← Kembali ke Soal</button>
      ${answered === Q.length ? '<button onclick="finishTest()" style="padding:8px 16px;border:none;background:var(--success);color:#fff;border-radius:6px;font-size:.82rem;font-weight:600;cursor:pointer">✅ Selesai</button>' : ''}
    </div>
  </div>`;
}

function finishTest() {
  const answered = Object.values(testState.answers).filter(
    (a) => a && a.p !== null && a.k !== null
  ).length;
  if (answered < Q.length) {
    toast(`Masih ada ${Q.length - answered} soal belum dijawab`, 'warning');
    return;
  }
  const result = calcDISC();
  saveResult(result);
  renderResult(result);
}

function calcDISC() {
  let rawP = { D: 0, I: 0, S: 0, C: 0 },
    rawK = { D: 0, I: 0, S: 0, C: 0 };
  Q.forEach((q) => {
    const ans = testState.answers[q.n];
    if (!ans) return;
    if (ans.p !== null) rawP[q.o[ans.p][1]]++;
    if (ans.k !== null) rawK[q.o[ans.k][1]]++;
  });
  let s1 = {},
    s2 = {},
    s3 = {};
  ['D', 'I', 'S', 'C'].forEach((t) => {
    const p = Math.min(rawP[t], 20),
      k = Math.min(rawK[t], 20);
    s1[t] = SEG1[t][p] || 0;
    s2[t] = SEG2[t][k] || 0;
    s3[t] = parseFloat((s1[t] - s2[t]).toFixed(1));
  });
  const pattern = getPattern(s3);
  const profile = PROFILES[pattern] ||
    PROFILES[pattern.split('-')[0]] || { name: 'UNIQUE', traits: [] };
  const desc =
    DESC[pattern] ||
    DESC[pattern.split('-').slice(0, 2).join('-')] ||
    DESC[pattern.split('-')[0]] ||
    'Profil kepribadian unik.';
  return { rawP, rawK, s1, s2, s3, pattern, profile, desc, timestamp: new Date().toISOString() };
}

function getPattern(s3) {
  const sorted = Object.entries(s3).sort((a, b) => b[1] - a[1]);
  const pos = sorted.filter(([_, v]) => v > 0);
  if (pos.length === 0) return sorted[0][0];
  if (pos.length === 1) return pos[0][0];
  if (pos.length >= 2) {
    const d12 = pos[0][1] - pos[1][1];
    if (pos.length >= 3 && pos[1][1] - pos[2][1] < 1.5)
      return `${pos[0][0]}-${pos[1][0]}-${pos[2][0]}`;
    return `${pos[0][0]}-${pos[1][0]}`;
  }
  return sorted[0][0];
}

async function saveResult(r) {
  try {
    const posCount = r.profile.pos ? r.profile.pos.length : 0;
    const negCount = r.profile.neg ? r.profile.neg.length : 0;
    const kpiScore = Math.min(
      100,
      Math.max(0, 70 + Math.min(posCount * 3, 20) - Math.min(negCount * 2, 15))
    );
    await db.collection('hrd_disc_results').add({
      mode: testState.mode,
      nama: testState.nama,
      usia: testState.usia,
      jenisKelamin: testState.jenisKelamin,
      posisi: testState.posisi,
      tanggalTes: testState.tanggalTes,
      nip: testState.nip || '',
      departemen: testState.departemen || '',
      evaluasiPeriode: testState.evaluasiPeriode || '',
      kontak: testState.kontak || '',
      rawP: r.rawP,
      rawK: r.rawK,
      seg1: r.s1,
      seg2: r.s2,
      seg3: r.s3,
      pattern: r.pattern,
      profileName: r.profile.name,
      positiveTraits: r.profile.pos || [],
      negativeTraits: r.profile.neg || [],
      career: r.profile.career || '',
      kpiScore,
      createdAt: new Date().toISOString(),
    });
    // Sync calon karyawan to recruitment pipeline
    if (testState.mode === 'calon') {
      await db.collection('hrd_kandidat').add({
        nama: testState.nama,
        email: testState.kontak || '',
        posisi: testState.posisi,
        stage: 'DISC Test Done',
        sumber: 'DISC Test Online',
        discPattern: r.pattern,
        discProfile: r.profile.name,
        discScore: kpiScore,
        usia: testState.usia,
        jenisKelamin: testState.jenisKelamin,
        kontak: testState.kontak || '',
        createdAt: new Date().toISOString(),
      });
      toast('Hasil tes disimpan & data masuk ke pipeline rekrutmen', 'success');
    } else {
      toast('Hasil tes berhasil disimpan', 'success');
    }
  } catch (e) {
    console.error(e);
    toast('Gagal menyimpan', 'error');
  }
}

function renderResult(r) {
  // Calon karyawan: jangan tampilkan hasil, hanya ucapan terima kasih
  if (testState.mode === 'calon') {
    document.getElementById('app').innerHTML = `
    <div style="max-width:600px;margin:60px auto;text-align:center">
      <div style="background:#fff;border-radius:16px;padding:40px 30px;box-shadow:0 4px 20px rgba(0,0,0,.1)">
        <div style="font-size:3rem;margin-bottom:16px">✅</div>
        <h2 style="color:var(--primary);margin-bottom:12px">TERIMA KASIH</h2>
        <p style="font-size:1rem;color:var(--text);line-height:1.8;margin-bottom:24px">Tes DISC Anda telah selesai dan tersimpan.<br><br><strong style="color:var(--primary);font-size:1.1rem">SEGERA HUBUNGI PIC UNTUK MENGETAHUI HASIL TEST ANDA</strong></p>
        <p style="font-size:.85rem;color:var(--text-light);margin-bottom:24px">Hasil tes akan dievaluasi oleh tim HR IJEF Corp dan akan diinformasikan melalui kontak yang Anda berikan.</p>
        <button onclick="startMode('calon')" style="padding:12px 28px;border:none;background:var(--primary);color:#fff;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer">🔄 Tes Baru</button>
      </div>
      <p style="margin-top:20px;font-size:.72rem;color:#999">© 2026 LPK IJEF Corp — HR Assessment System</p>
    </div>`;
    return;
  }
  const { s1, s2, s3, pattern, profile, desc, rawP, rawK } = r;
  function buildLineGraph(data, title, subtitle) {
    const vals = ['D', 'I', 'S', 'C'].map((t) => data[t] || 0);
    const h = 160;
    const toY = (v) => h / 2 - (v / 8) * (h / 2);
    let dots = '';
    vals.forEach((v, i) => {
      dots += `<circle cx="${20 + i * 50}" cy="${toY(v)}" r="4" fill="#1a237e"/><text x="${20 + i * 50}" y="${toY(v) - 10}" text-anchor="middle" font-size="9" font-weight="700" fill="${v >= 0 ? '#2e7d32' : '#c62828'}">${v > 0 ? '+' : ''}${v.toFixed(1)}</text>`;
    });
    const points = vals.map((v, i) => `${20 + i * 50},${toY(v)}`).join(' ');
    return `<div style="flex:1;min-width:200px;text-align:center"><div style="font-size:.72rem;font-weight:700;color:var(--primary)">${title}</div><div style="font-size:.62rem;color:#999;margin-bottom:4px">${subtitle}</div><svg width="200" height="${h + 25}" viewBox="0 0 200 ${h + 25}" style="border:1px solid #e0e0e0;border-radius:6px;background:#fafafa"><line x1="10" y1="${h / 2}" x2="190" y2="${h / 2}" stroke="#999" stroke-width="1" stroke-dasharray="3"/><line x1="10" y1="${h / 4}" x2="190" y2="${h / 4}" stroke="#eee" stroke-width="0.5"/><line x1="10" y1="${(h * 3) / 4}" x2="190" y2="${(h * 3) / 4}" stroke="#eee" stroke-width="0.5"/><polyline points="${points}" fill="none" stroke="#1a237e" stroke-width="2"/>${dots}<text x="20" y="${h + 15}" text-anchor="middle" font-size="10" font-weight="700" fill="#1a237e">D</text><text x="70" y="${h + 15}" text-anchor="middle" font-size="10" font-weight="700" fill="#1a237e">I</text><text x="120" y="${h + 15}" text-anchor="middle" font-size="10" font-weight="700" fill="#1a237e">S</text><text x="170" y="${h + 15}" text-anchor="middle" font-size="10" font-weight="700" fill="#1a237e">C</text></svg></div>`;
  }
  const graph1 = buildLineGraph(s1, 'GRAPH 1 MOST', 'Mask Public Self');
  const graph2 = buildLineGraph(s2, 'GRAPH 2 LEAST', 'Core Private Self');
  const graph3 = buildLineGraph(s3, 'GRAPH 3 CHANGE', 'Mirror Perceived Self');
  let maskT = '',
    coreT = '',
    mirrorT = '';
  (profile.pos || []).forEach((t) => {
    maskT += `<div style="font-size:.8rem;padding:2px 0">${esc(t)}</div>`;
  });
  (profile.neg || []).forEach((t) => {
    coreT += `<div style="font-size:.8rem;padding:2px 0">${esc(t)}</div>`;
  });
  [...(profile.pos || []), ...(profile.neg || [])].forEach((t) => {
    mirrorT += `<div style="font-size:.8rem;padding:2px 0">${esc(t)}</div>`;
  });
  const sorted = Object.entries(s3).sort((a, b) => b[1] - a[1]);
  const dominant = sorted.filter(([_, v]) => v > 0);
  const weak = sorted.filter(([_, v]) => v < 0);
  const dn = { D: 'Dominance', I: 'Influence', S: 'Steadiness', C: 'Compliance' };
  const dd = {
    D: '<strong>berorientasi pada hasil (result-oriented), suka tantangan, dan mandiri</strong>. Ia memiliki pendekatan yang tegas dan efektif dalam memecahkan masalah',
    I: '<strong>ramah, optimis, persuasif, dan suka bersosialisasi</strong>. Ia memiliki kemampuan komunikasi yang sangat baik dan mampu memotivasi orang lain',
    S: '<strong>sabar, loyal, konsisten, dan kooperatif</strong>. Ia bekerja dengan baik dalam tim dan menghindari konflik',
    C: '<strong>perfeksionis, detail, rapi, dan terorganisir</strong>. Ia adalah pemikir logis yang membuat keputusan berdasarkan fakta dan data, bukan emosi',
  };
  const ddLow = {
    D: '<strong>pendiam, menghindari konfrontasi, dan kurang agresif</strong>. Fokus utamanya bukan pada dominasi atau pengendalian situasi',
    I: '<strong>pendiam, dingin, menjaga jarak, dan kurang percaya pada orang lain</strong>. Fokus utamanya adalah pada tugas, bukan pada interaksi sosial atau membangun hubungan',
    S: '<strong>tidak sabar, suka perubahan, dan dinamis</strong>. Ia lebih suka tantangan baru daripada rutinitas',
    C: '<strong>spontan, fleksibel, dan tidak terlalu mengikuti aturan</strong>. Ia lebih mengutamakan kecepatan daripada kesempurnaan',
  };
  const nicknames = {
    D: 'Pemimpin Tegas',
    I: 'Komunikator Handal',
    S: 'Pendukung Setia',
    C: 'Ahli Pemecah Masalah',
    'D-I': 'Pemimpin Visioner',
    'D-S': 'Strategis Mandiri',
    'D-C': 'Ahli Pemecah Masalah',
    'I-S': 'Diplomat Hangat',
    'I-C': 'Analis Kreatif',
    'I-D': 'Negosiator Ulung',
    'S-I': 'Penasihat Bijak',
    'S-C': 'Pelaksana Teliti',
    'S-D': 'Pekerja Tangguh',
    'C-D': 'Perancang Sistem',
    'C-I': 'Penilai Cermat',
    'C-S': 'Perfeksionis Terstruktur',
  };
  const nickname =
    nicknames[pattern] ||
    nicknames[pattern.split('-').slice(0, 2).join('-')] ||
    nicknames[pattern.split('-')[0]] ||
    'Profesional Unik';

  let kesimp = `Berdasarkan hasil tes, <strong>${esc(testState.nama)}</strong> memiliki profil kepribadian dominan <strong>${pattern} (${dn[sorted[0][0]]}/${sorted.length > 1 ? dn[sorted[1][0]] : ''})</strong>. Ini berarti ia adalah seorang <strong>${esc(profile.name)}</strong>.\n\nBerikut adalah rinciannya:\n`;
  kesimp += `\n<strong>1. Profil yang Konsisten</strong>\nKetiga grafik (Grafik 1, 2, dan 3) menunjukkan pola yang serupa. Ini menandakan bahwa ia adalah <strong>pribadi yang otentik dan apa adanya</strong>. Cara ia menampilkan diri ke publik sama dengan karakter aslinya.\n`;
  kesimp += `\n<strong>2. Karakter Utama: "${esc(profile.name)}"</strong>\nProfilnya adalah gabungan dari tipe yang kuat:\n`;
  dominant.forEach(([t, v]) => {
    kesimp += `<strong>Sisi ${t} (${dn[t]}) yang tinggi:</strong> Ini membuatnya menjadi pribadi yang ${dd[t]}.\n`;
  });
  weak.forEach(([t, v]) => {
    kesimp += `<strong>Sisi ${t} (${dn[t]}) yang rendah:</strong> Ini menjelaskan mengapa ia digambarkan sebagai ${ddLow[t]}.\n`;
  });
  kesimp += `\n<strong>Kesimpulan Karakter</strong>\n\nSecara keseluruhan, ${esc(testState.nama)} adalah seorang "<strong>${nickname}</strong>" (${esc(profile.name)}). Ia adalah individu yang didorong oleh ${dominant.length > 0 ? dd[dominant[0][0]].replace(/<[^>]*>/g, '') : 'karakteristik uniknya'}.\n`;
  kesimp += `\n<strong>Kekuatan:</strong> ${(profile.pos || []).join(', ')}. Kemampuan ini membuatnya sangat efektif dalam peran yang membutuhkan keahlian tersebut.\n`;
  kesimp += `\n<strong>Potensi Tantangan:</strong> ${(profile.neg || []).join(', ')}. Area ini perlu diperhatikan untuk pengembangan diri dan kerjasama tim yang lebih baik.\n`;

  // Detailed career recommendation
  let careerDetail = `Melihat profilnya yang kuat dalam ${dominant.map(([t]) => dn[t].toLowerCase()).join(' dan ')}, <strong>${esc(testState.nama)}</strong> akan sangat unggul dalam pekerjaan yang membutuhkan keahlian mendalam, ${dominant.some(([t]) => t === 'D') ? 'otonomi, dan kepemimpinan' : 'kerjasama dan ketelitian'}.\n\nBidang pekerjaan yang sangat cocok antara lain:\n\n${esc(profile.career || '-')}\n\nIa akan berkembang di lingkungan yang menghargai <strong>${(profile.pos || []).slice(0, 3).join(', ')}</strong>. Peran yang kurang cocok untuknya adalah yang ${weak.length > 0 ? 'membutuhkan ' + ddLow[weak[0][0]].replace(/<[^>]*>/g, '').substring(0, 50) : 'tidak sesuai karakternya'}.`;
  const posCount = profile.pos ? profile.pos.length : 0;
  const negCount = profile.neg ? profile.neg.length : 0;
  const kpiScore = Math.min(
    100,
    Math.max(0, 70 + Math.min(posCount * 3, 20) - Math.min(negCount * 2, 15))
  );
  const kpiGrade =
    kpiScore >= 90 ? 'A' : kpiScore >= 80 ? 'B' : kpiScore >= 70 ? 'C' : kpiScore >= 60 ? 'D' : 'E';

  document.getElementById('app').innerHTML = `
  <div style="max-width:850px;margin:0 auto">
    <div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06);text-align:center">
      <h2 style="color:var(--primary);margin-bottom:2px">D.I.S.C.</h2><h3 style="color:var(--primary);font-style:italic;margin-bottom:16px">Personality System Graph Page</h3>
      <div style="text-align:left;background:#f8f9ff;padding:12px;border-radius:8px;font-size:.85rem;margin-bottom:16px"><div style="display:grid;grid-template-columns:100px 1fr;gap:4px"><span><b>Name</b></span><span>: ${esc(testState.nama)}</span><span><b>Age</b></span><span>: ${esc(testState.usia || '-')}</span><span><b>Gender</b></span><span>: ${esc(testState.jenisKelamin || '-')}</span><span><b>Tgl. Tes</b></span><span>: ${testState.tanggalTes}</span>${testState.departemen ? `<span><b>Dept</b></span><span>: ${esc(testState.departemen)}</span>` : ''}${testState.posisi ? `<span><b>Posisi</b></span><span>: ${esc(testState.posisi)}</span>` : ''}</div></div>
      <div style="overflow-x:auto;margin-bottom:12px"><table style="width:auto;margin:0 auto;border-collapse:collapse;font-size:.8rem"><thead><tr style="background:var(--primary);color:#fff"><th style="padding:6px 10px">Line</th><th style="padding:6px 10px">D</th><th style="padding:6px 10px">I</th><th style="padding:6px 10px">S</th><th style="padding:6px 10px">C</th><th style="padding:6px 10px">tot</th></tr></thead><tbody><tr><td style="padding:5px 10px;border:1px solid #ddd;font-weight:700">1 (P)</td><td style="padding:5px 10px;border:1px solid #ddd">${rawP.D}</td><td style="padding:5px 10px;border:1px solid #ddd">${rawP.I}</td><td style="padding:5px 10px;border:1px solid #ddd">${rawP.S}</td><td style="padding:5px 10px;border:1px solid #ddd">${rawP.C}</td><td style="padding:5px 10px;border:1px solid #ddd;color:var(--danger);font-weight:700">24</td></tr><tr><td style="padding:5px 10px;border:1px solid #ddd;font-weight:700">2 (K)</td><td style="padding:5px 10px;border:1px solid #ddd">${rawK.D}</td><td style="padding:5px 10px;border:1px solid #ddd">${rawK.I}</td><td style="padding:5px 10px;border:1px solid #ddd">${rawK.S}</td><td style="padding:5px 10px;border:1px solid #ddd">${rawK.C}</td><td style="padding:5px 10px;border:1px solid #ddd;color:var(--danger);font-weight:700">24</td></tr><tr><td style="padding:5px 10px;border:1px solid #ddd;font-weight:700">3 (Δ)</td><td style="padding:5px 10px;border:1px solid #ddd">${s3.D.toFixed(1)}</td><td style="padding:5px 10px;border:1px solid #ddd">${s3.I.toFixed(1)}</td><td style="padding:5px 10px;border:1px solid #ddd">${s3.S.toFixed(1)}</td><td style="padding:5px 10px;border:1px solid #ddd">${s3.C.toFixed(1)}</td><td style="padding:5px 10px;border:1px solid #ddd"></td></tr></tbody></table></div>
      <div style="display:inline-block;padding:8px 20px;background:linear-gradient(135deg,var(--primary),#283593);color:#fff;border-radius:20px;font-size:1rem;font-weight:700">${esc(profile.name)} (${pattern})</div></div>
    <div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)"><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">${graph1}${graph2}${graph3}</div></div>
    <div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)"><h4 style="color:var(--primary);margin-bottom:12px;text-align:center">Gambaran Karakter</h4><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px"><div><h5 style="text-decoration:underline;margin-bottom:6px;font-size:.82rem">Mask Public Self</h5><div style="font-weight:700;color:var(--primary);font-size:.8rem;margin-bottom:4px">${esc(profile.name)}</div>${maskT}</div><div><h5 style="text-decoration:underline;margin-bottom:6px;font-size:.82rem">Core Private Self</h5><div style="font-weight:700;color:var(--primary);font-size:.8rem;margin-bottom:4px">${esc(profile.name)}</div>${coreT}</div><div><h5 style="text-decoration:underline;margin-bottom:6px;font-size:.82rem">Mirror Perceived Self</h5><div style="font-weight:700;color:var(--primary);font-size:.8rem;margin-bottom:4px">${esc(profile.name)}</div>${mirrorT}</div></div></div>
    <div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)"><h4 style="color:var(--primary);margin-bottom:12px">📝 Deskripsi Kepribadian</h4><div style="background:#f8f9ff;border:1px solid var(--border);border-radius:8px;padding:16px;font-size:.85rem;line-height:1.7">${esc(desc)}</div></div>
    <div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)"><h4 style="color:var(--primary);margin-bottom:12px">🔍 Analisis & Kesimpulan Karakter</h4><div style="font-size:.85rem;line-height:1.8;white-space:pre-line">${kesimp}</div></div>
    <div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)"><h4 style="color:var(--primary);margin-bottom:12px">💼 Rekomendasi Bidang Pekerjaan yang Cocok</h4><div style="font-size:.85rem;line-height:1.8;white-space:pre-line">${careerDetail}</div></div>
    <div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)"><h4 style="color:var(--primary);margin-bottom:12px">📈 Dampak KPI</h4><div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap"><div style="text-align:center;padding:16px 24px;border-radius:10px;border:2px solid ${kpiScore >= 80 ? 'var(--success)' : 'var(--warning)'}"><div style="font-size:2rem;font-weight:700;color:${kpiScore >= 80 ? 'var(--success)' : 'var(--warning)'}">${kpiScore}</div><div style="font-size:.75rem">Grade ${kpiGrade}</div></div><div style="flex:1;font-size:.82rem;line-height:1.8"><div>Kekuatan: ${posCount} poin (+${Math.min(posCount * 3, 20)})</div><div>Area Pengembangan: ${negCount} poin (-${Math.min(negCount * 2, 15)})</div></div></div></div>
    <div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06);text-align:center"><button onclick="window.print()" style="padding:10px 20px;border:none;background:var(--primary);color:#fff;border-radius:6px;font-size:.85rem;font-weight:600;cursor:pointer;margin:4px">🖨️ Cetak</button><button onclick="startMode('calon')" style="padding:10px 20px;border:none;background:var(--info);color:#fff;border-radius:6px;font-size:.85rem;font-weight:600;cursor:pointer;margin:4px">🔄 Tes Baru</button></div>
  </div>`;
}

async function renderHistory() {
  document.getElementById('app').innerHTML = `
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
  const snap = await db
    .collection('hrd_disc_results')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  window._dh = [];
  snap.forEach((d) => window._dh.push({ id: d.id, ...d.data() }));
  filterH();
}

function filterH() {
  const q = (document.getElementById('srcH')?.value || '').toLowerCase(),
    m = document.getElementById('fltM')?.value || '';
  const data = (window._dh || []).filter((r) => {
    if (q && !r.nama?.toLowerCase().includes(q)) return false;
    if (m && r.mode !== m) return false;
    return true;
  });
  let h = '';
  if (!data.length)
    h =
      '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-light)">Belum ada data</td></tr>';
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
          ? '<span style="background:#fff8e1;color:#f57f17;padding:2px 8px;border-radius:12px;font-size:.7rem;font-weight:600">Evaluasi</span>'
          : '<span style="background:#e1f5fe;color:#0277bd;padding:2px 8px;border-radius:12px;font-size:.7rem;font-weight:600">Calon</span>';
      h += `<tr><td style="padding:8px;border-bottom:1px solid #eee">${dt}</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:700">${esc(r.nama)}</td><td style="padding:8px;border-bottom:1px solid #eee">${badge}</td><td style="padding:8px;border-bottom:1px solid #eee">${esc(r.posisi || '-')}</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:700;color:var(--primary)">${esc(r.pattern || '-')}</td><td style="padding:8px;border-bottom:1px solid #eee">${esc(r.profileName || '-')}</td></tr>`;
    });
  document.getElementById('hTbl').innerHTML = h;
}
