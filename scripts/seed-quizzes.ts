import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCzq0iMJZUGjLrSGEnou66f7AA8jsBu2Jw',
  authDomain: 'katolikgo-mobile.firebaseapp.com',
  projectId: 'katolikgo-mobile',
  storageBucket: 'katolikgo-mobile.firebasestorage.app',
  messagingSenderId: '615054372997',
  appId: '1:615054372997:web:8ab4a440df706977f779ec',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const quizzes = [
  {
    level: 1,
    category: 'old_testament',
    difficulty: 'easy',
    passingScore: 80,
    questions: [
      {
        question: 'Siapakah yang menciptakan dunia menurut Kitab Kejadian?',
        options: ['Adam', 'Allah', 'Malaikat', 'Nuh'],
        correctAnswer: 1,
        explanation: 'Menurut Kejadian 1:1, "Pada mulanya Allah menciptakan langit dan bumi."',
      },
      {
        question: 'Berapa hari Allah menciptakan dunia?',
        options: ['5 hari', '6 hari', '7 hari', '8 hari'],
        correctAnswer: 1,
        explanation: 'Allah menciptakan dunia dalam 6 hari dan beristirahat pada hari ke-7 (Kejadian 1).',
      },
      {
        question: 'Siapakah manusia pertama yang diciptakan Allah?',
        options: ['Adam', 'Abraham', 'Musa', 'Daud'],
        correctAnswer: 0,
        explanation: 'Adam adalah manusia pertama yang diciptakan Allah (Kejadian 2:7).',
      },
      {
        question: 'Siapakah isteri Adam?',
        options: ['Sarah', 'Rahel', 'Hawa', 'Rebekah'],
        correctAnswer: 2,
        explanation: 'Hawa diciptakan Allah dari rusuk Adam (Kejadian 2:22).',
      },
      {
        question: 'Di mana Adam dan Hawa tinggal mula-mula?',
        options: ['Sion', 'Taman Eden', 'Babel', 'Mesir'],
        correctAnswer: 1,
        explanation: 'Adam dan Hawa ditempatkan di Taman Eden (Kejadian 2:15).',
      },
    ],
  },
  {
    level: 2,
    category: 'old_testament',
    difficulty: 'easy',
    passingScore: 80,
    questions: [
      {
        question: 'Siapakah yang membinakan bahtera untuk menyelamatkan diri dari air bah?',
        options: ['Musa', 'Nuh', 'Abraham', 'Ibrahim'],
        correctAnswer: 1,
        explanation: 'Nuh membinakan bahtera mengikut perintah Allah (Kejadian 6:14).',
      },
      {
        question: 'Berapa lama hujan turun semasa air bah?',
        options: ['7 hari', '14 hari', '40 hari 40 malam', '100 hari'],
        correctAnswer: 2,
        explanation: 'Hujan turun selama 40 hari dan 40 malam (Kejadian 7:12).',
      },
      {
        question: 'Siapakah anak Nuh yang tidak ikut dalam bahtera?',
        options: ['Sem', 'Ham', 'Yafet', 'Tiada - semua ikut'],
        correctAnswer: 3,
        explanation: 'Semua anak Nuh (Sem, Ham, Yafet) beserta isteri mereka ikut dalam bahtera (Kejadian 7:13).',
      },
      {
        question: 'Apakah tanda perjanjian Allah dengan Nuh selepas air bah?',
        options: ['Bintang', 'Pelangi', 'Bulan', 'Matahari'],
        correctAnswer: 1,
        explanation: 'Pelangi adalah tanda perjanjian Allah tidak akan lagi membinasakan bumi dengan air bah (Kejadian 9:13).',
      },
      {
        question: 'Apakah yang Nuh bina selepas air bah surut?',
        options: ['Rumah', 'Mazbah', 'Kota', 'Menara'],
        correctAnswer: 1,
        explanation: 'Nuh membina sebuah mazbah (mezbah) untuk Tuhan (Kejadian 8:20).',
      },
    ],
  },
  {
    level: 3,
    category: 'old_testament',
    difficulty: 'easy',
    passingScore: 80,
    questions: [
      {
        question: 'Siapakah bapa segala orang beriman?',
        options: ['Musa', 'Daud', 'Abraham', 'Yusuf'],
        correctAnswer: 2,
        explanation: 'Abraham dipanggil "bapa segala orang beriman" (Kejadian 15:6, Roma 4:11).',
      },
      {
        question: 'Apakah nama isteri Abraham?',
        options: ['Hawa', 'Sarah', 'Rebekah', 'Hagar'],
        correctAnswer: 1,
        explanation: 'Sarah (pada mulanya Sarai) adalah isteri Abraham (Kejadian 17:15).',
      },
      {
        question: 'Apakah nama anak Abraham dan Sarah yang lahir ketika mereka sudah lanjut usia?',
        options: ['Ismail', 'Ishak', 'Yakub', 'Esau'],
        correctAnswer: 1,
        explanation: 'Ishak dilahirkan ketika Abraham berusia 100 tahun dan Sarah 90 tahun (Kejadian 21:2-5).',
      },
      {
        question: 'Allah berjanji memberi Abraham keturunan sebanyak apa?',
        options: ['Pasir di pantai', 'Bintang di langit', 'Kedua-duanya', 'Daun di pokok'],
        correctAnswer: 2,
        explanation: 'Allah berjanji keturunan Abraham sebanyak bintang di langit dan pasir di pantai (Kejadian 22:17).',
      },
      {
        question: 'Apakah ujian terbesar Abraham dari Allah?',
        options: ['Meninggalkan negara', 'Menyerahkan Ishak', 'Berkorban binatang', 'Berpuasa 40 hari'],
        correctAnswer: 1,
        explanation: 'Allah menguji Abraham untuk menyerahkan Ishak sebagai korban, tetapi Allah menyediakan kambing sebagai ganti (Kejadian 22).',
      },
    ],
  },
  {
    level: 4,
    category: 'new_testament',
    difficulty: 'easy',
    passingScore: 80,
    questions: [
      {
        question: 'Siapakah penulis Injil Matius?',
        options: ['Yohanes', 'Matius', 'Lukas', 'Markus'],
        correctAnswer: 1,
        explanation: 'Matius (Levi) adalah salah seorang daripada 12 Rasul dan penulis Injil Matius.',
      },
      {
        question: 'Di mana Yesus dilahirkan?',
        options: ['Nazareth', 'Betlehem', 'Yerusalem', 'Galilea'],
        correctAnswer: 1,
        explanation: 'Yesus dilahirkan di Betlehem, seperti yang dinubuatkan dalam Mikha 5:2 (Matius 2:1).',
      },
      {
        question: 'Siapakah yang membaptiskan Yesus?',
        options: ['Petrus', 'Paulus', 'Yohanes Pembaptis', 'Andreas'],
        correctAnswer: 2,
        explanation: 'Yohanes Pembaptis membaptiskan Yesus di Sungai Yordan (Matius 3:13-17).',
      },
      {
        question: 'Berapa orang rasul Yesus?',
        options: ['10', '11', '12', '13'],
        correctAnswer: 2,
        explanation: 'Yesus memilih 12 rasul (Matius 10:1-4).',
      },
      {
        question: 'Apakah mukjizat pertama Yesus?',
        options: ['Menyembuhkan buta', 'Menukarkan air kepada anggur', 'Memberi makan 5000', 'Berjalan di atas air'],
        correctAnswer: 1,
        explanation: 'Mukjizat pertama Yesus ialah menukarkan air kepada anggur di majlis kahwin di Kana (Yohanes 2:1-11).',
      },
    ],
  },
  {
    level: 5,
    category: 'new_testament',
    difficulty: 'easy',
    passingScore: 80,
    questions: [
      {
        question: 'Apakah Sacrament Pertama?',
        options: ['Baptismin', 'Penguatan', 'Ekaristi', 'Taubat'],
        correctAnswer: 0,
        explanation: 'Baptismin adalah Sacrament Pertama yang menerima kita ke dalam Gereja.',
      },
      {
        question: 'Siapakah yang menulis Surat kepada Jemaah di Roma?',
        options: ['Petras', 'Paulus', 'Yohanes', 'Yakobus'],
        correctAnswer: 1,
        explanation: 'Rasul Paulus menulis Surat kepada Jemaah di Roma.',
      },
      {
        question: 'Apakah yang berlaku pada malam Paskah?',
        options: ['Yesus lahir', 'Yesus mati', 'Yesus berdoa di Getsemani', 'Yesus naik ke syurga'],
        correctAnswer: 2,
        explanation: 'Pada malam Paskah, Yesus berdoa di Taman Getsemani sebelum ditangkap.',
      },
      {
        question: 'Siapakah yang mengkhianati Yesus?',
        options: ['Petrus', 'Yudas', 'Thomas', 'Filipus'],
        correctAnswer: 1,
        explanation: 'Yudas Iskariot mengkhianati Yesus dengan mencium-Nya sebagai tanda penyerahan.',
      },
      {
        question: 'Di mana Yesus disalibkan?',
        options: ['Galilea', 'Nazareth', 'Golgota', 'Kapernaum'],
        correctAnswer: 2,
        explanation: 'Yesus disalibkan di Bukit Golgota (Kalvari), luar tembok Yerusalem.',
      },
    ],
  },
];

async function seedQuizzes() {
  console.log('Mula menanam soalan kuiz ke Firestore...');
  await signInAnonymously(auth);
  console.log('Berjaya sign in anonymous');

  for (const quiz of quizzes) {
    const quizId = `level_${quiz.level}`;
    await setDoc(doc(db, 'quizzes', quizId), {
      ...quiz,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log(`✓ Tahap ${quiz.level} berjaya ditambah`);
  }

  console.log('Selesai! Semua soalan kuiz telah ditambah ke Firestore.');
  process.exit(0);
}

seedQuizzes().catch((err) => {
  console.error('Seed gagal:', err);
  process.exit(1);
});
