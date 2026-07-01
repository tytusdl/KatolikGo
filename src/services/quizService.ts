import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Quiz, QuizQuestion, Difficulty, QuizCategory } from '@/types';

export async function getQuizByLevel(level: number): Promise<Quiz | null> {
  const snap = await getDoc(doc(db, 'quizzes', `level_${level}`));
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as Quiz;
  }
  return null;
}

export async function getAllQuizLevels(): Promise<{ level: number; category: string; difficulty: string }[]> {
  const snap = await getDocs(collection(db, 'quizzes'));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      level: data.level,
      category: data.category,
      difficulty: data.difficulty,
    };
  });
}

export async function saveQuiz(
  level: number,
  category: QuizCategory,
  difficulty: Difficulty,
  questions: QuizQuestion[],
  passingScore: number = 80
) {
  await setDoc(doc(db, 'quizzes', `level_${level}`), {
    level,
    category,
    difficulty,
    questions,
    passingScore,
    updatedAt: serverTimestamp(),
  });
}

export const SAMPLE_QUESTIONS: Record<number, QuizQuestion[]> = {
  1: [
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
  2: [
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
      options: ['Rumah', 'Mazbah', 'Kota','Menara'],
      correctAnswer: 1,
      explanation: 'Nuh membina sebuah mazbah (mezbah) untuk Tuhan (Kejadian 8:20).',
    },
  ],
  3: [
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
};
