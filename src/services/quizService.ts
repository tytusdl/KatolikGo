import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Quiz, QuizQuestion, Difficulty, QuizCategory } from '@/types';

// Import questions from JSON
import questionsData from '@/data/all_questions.json';

// Separate by game mode
const CLASSIC_QUESTIONS = questionsData
  .filter((q: any) => q.gameMode === 'classic')
  .reduce((acc: Record<number, QuizQuestion[]>, q: any) => {
    const level = q.level || 1;
    if (!acc[level]) acc[level] = [];
    acc[level].push({
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    });
    return acc;
  }, {} as Record<number, QuizQuestion[]>);

const TEKA_GAMBAR_QUESTIONS = questionsData
  .filter((q: any) => q.gameMode === 'teka-gambar')
  .map((q: any) => ({
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
  }));

export { CLASSIC_QUESTIONS, TEKA_GAMBAR_QUESTIONS };

export async function getQuizByLevel(level: number): Promise<Quiz | null> {
  // Try Firebase first
  const snap = await getDoc(doc(db, 'quizzes', `level_${level}`));
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as Quiz;
  }
  
  // Fallback to local
  const questions = CLASSIC_QUESTIONS[level];
  if (questions) {
    return {
      id: `level_${level}`,
      level,
      category: level <= 33 ? 'old_testament' : level <= 66 ? 'new_testament' : 'ccc',
      difficulty: level <= 33 ? 'easy' : level <= 66 ? 'medium' : 'hard',
      questions,
      passingScore: 80,
    };
  }
  
  return null;
}

export async function getTekaGambarQuiz(level: number = 1): Promise<QuizQuestion[] | null> {
  // Get 10 questions for this level
  const startIdx = (level - 1) * 10;
  const questions = TEKA_GAMBAR_QUESTIONS.slice(startIdx, startIdx + 10);
  return questions.length >= 5 ? questions : null;
}

export async function getAllQuizLevels(): Promise<{ level: number; category: string; difficulty: string }[]> {
  // Try Firebase first
  const snap = await getDocs(collection(db, 'quizzes'));
  if (snap.docs.length > 0) {
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        level: data.level,
        category: data.category,
        difficulty: data.difficulty,
      };
    });
  }
  
  // Fallback to local
  return Object.keys(CLASSIC_QUESTIONS).map((level) => {
    const lvl = parseInt(level);
    return {
      level: lvl,
      category: lvl <= 33 ? 'old_testament' : lvl <= 66 ? 'new_testament' : 'ccc',
      difficulty: lvl <= 33 ? 'easy' : lvl <= 66 ? 'medium' : 'hard',
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
    // See `types/index.ts` for the timestamp policy.
    updatedAt: Date.now(),
  });
}

// Stats
export const QUESTIONS_STATS = {
  totalClassic: Object.values(CLASSIC_QUESTIONS).flat().length,
  totalTekaGambar: TEKA_GAMBAR_QUESTIONS.length,
  classicLevels: Object.keys(CLASSIC_QUESTIONS).length,
};
