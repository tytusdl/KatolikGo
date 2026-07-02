export type Difficulty = 'easy' | 'medium' | 'hard';

export type QuizCategory =
  | 'old_testament'
  | 'new_testament'
  | 'ccc'
  | 'sacraments'
  | 'liturgy';

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  level: number;
  category: QuizCategory;
  difficulty: Difficulty;
  questions: QuizQuestion[];
  passingScore: number;
}

export interface LevelProgress {
  completed: boolean;
  bestScore: number;
  attempts: number;
}

export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  parishId: string | null;
  parishName: string | null;
  tokens: number;
  isPremium: boolean;
  currentLevel: number;
  totalXP: number;
  weeklyXP: number;
  monthlyXP: number;
  levelProgress: Record<number, LevelProgress>;
  // Engagement / gamification counters surfaced in the UI.
  streakDays: number;
  levelsCompleted: number[];
  friendsCount: number;
  /** 0–100 percentage. */
  accuracy: number;
  quizzesThisMonth: number;
  createdAt: number;
  updatedAt: number;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  parishName: string | null;
  totalXP: number;
  weeklyXP: number;
  monthlyXP: number;
  rank: number;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'purchase' | 'reward' | 'spend';
  amount: number;
  description: string;
  createdAt: number;
}

export const CATEGORY_LABELS: Record<QuizCategory, string> = {
  old_testament: 'Perjanjian Lama',
  new_testament: 'Perjanjian Baru',
  ccc: 'Katekisus Gereja Katolik',
  sacraments: 'Sakramen',
  liturgy: 'Liturgi',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Mudah',
  medium: 'Sederhana',
  hard: 'Keras',
};

export const TOTAL_LEVELS = 100;
export const PASSING_SCORE = 80;
