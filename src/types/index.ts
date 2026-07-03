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
  /**
   * User-chosen login handle, lowercase, unique across registered users.
   * Allows signing in with display handle (e.g. `mikael.b`) instead of
   * the underlying email. Always stored as-is (so the original case
   * style chosen by the user can be displayed back), but uniqueness
   * is enforced by querying `username_lowercase` — never `username`
   * directly. Optional for guest (anonymous) accounts — they don't
   * pick a username. Optional for legacy accounts created before
   * the username feature shipped.
   */
  username?: string;
  /**
   * Lowercase mirror of `username`, used as the Firestore query key
   * (`where('username_lowercase', '==', input)`). Kept separate so
   * users can keep their preferred case in the UI.
   */
  username_lowercase?: string;
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
  /**
   * True for Firebase anonymous ("guest") users — `loginAsGuest` flow.
   * Guest users can play quizzes for the trial experience, but services
   * gate XP / token awards, token spending, and leaderboard visibility
   * because their account is device-bound and gets wiped on uninstall.
   * UI surfaces a banner encouraging them to register / sign in.
   *
   * Defaults to `false` for email/password + Google + Apple users. The
   * field is auto-set from `firebaseUser.isAnonymous` in
   * `ensureUserDocument`, so callers don't need to pass it explicitly.
   */
  isGuest?: boolean;
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
