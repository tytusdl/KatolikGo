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
  /**
   * Per-level progress — keyed by level as a **string** because
   * Firestore stores every document field key as a string. Storing
   * numeric keys would coerce them to `"1"` / `"2"` on round-trip
   * regardless of how we declared the type, so the type now matches
   * reality. Lookup helpers (`getLevelProgress`, the quiz screen)
   * coerce with `String(level)` on write and read keys directly
   * (`Object.keys(...).map(k => levelProgress[k]?....)`) — no
   * `Number(k)` round-trip needed.
   */
  levelProgress: Record<string, LevelProgress>;
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
  /**
   * Developer admin flag — unlocks the in-app `/admin` panel for the
   * current user. Promoted via the `node scripts/admin.mjs
   * grant-admin <uid>` CLI subcommand (Firebase Admin SDK) so it
   * doesn't need to live in source code as a hardcoded UID list.
   *
   * Client-side enforcement only — Firestore rules aren't deployed
   * yet (per AGENTS.md "Firestore rules design checklist"). Proper
   * server-side gating belongs behind Cloud Functions when those
   * land. Until then, treat this as a developer convenience, NOT a
   * security boundary.
   */
  isAdmin?: boolean;
  /**
   * Current remaining lives. Decrements by 1 on every wrong answer /
   * timeout in `quiz/[level].tsx` via `livesService.consumeLife`. Bounded
   * to [0, LIVES_MAX] by `livesService.refillIfNeeded`. Reaching 0
   * blocks further quiz starts until the player refills via token
   * spend, rewarded ad, or time-based auto-refill.
   *
   * Optional in the type because legacy user documents (created before
   * this feature shipped) won't have the field — services treat a
   * missing `lives` value as full health (5) and lazily backfill.
   */
  lives?: number;
  // -------------------------------------------------------------------------
  // Timestamp policy (consistent across all writers, see commit 2026-07-06):
  //
  // All timestamp-style fields on `UserData` are written with
  // `Date.now()` (a JS `number` of ms since epoch) and read back as a
  // `number` from Firestore. The previous design used
  // `serverTimestamp()` which writes a Firestore `Timestamp` object —
  // the type said `number` but the actual value was a `Timestamp`, so
  // any arithmetic like `Date.now() - userData.createdAt` returned
  // `NaN`. Every writer (authService, livesService, tokenService,
  // levelService, adminService, quizService) now stamps with the
  // client clock; readers can safely do ms-arithmetic directly.
  //
  // Trade-off: the client clock can be skewed. Until Firestore rules
  // / Cloud Functions land (AGENTS.md "Firestore rules design
  // checklist"), the worst case is a player with a tampered clock
  // spoofing the time-based lives refill — which is already
  // best-effort and surface-level.
  //
  // `null` means "never set" / "no pending refill" / "no prior ad
  // refill"; `number` means "ms since epoch".
  // -------------------------------------------------------------------------
  /**
   * Client time (ms epoch) recording the most recent moment a life
   * was lost — the anchor for the time-based auto-refill tick (1 life
   * per `LIVES_CONFIG.REFILL_MINUTES` after this timestamp).
   * `null` = never lost a life = no pending refill. Cleared (set to
   * `null`) on full-refill events (e.g. enough pending ticks
   * accumulated to top the bar up).
   */
  livesLastLostAt?: number | null;
  /**
   * Client time (ms epoch) recording the last rewarded-ad life
   * refill. Used to enforce `LIVES_AD_COOLDOWN_MIN` between consecutive
   * ad refills — prevents abuse from spam-pressing the "Tonton iklan"
   * button.
   */
  lastAdRefillAt?: number | null;
  /**
   * Client time (ms epoch) when the user document was created.
   * Always a JS `number` — written with `Date.now()` on `users` create
   * and read back as-is from Firestore.
   */
  createdAt: number;
  /** Client time (ms epoch) of the most recent write. */
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

/**
 * Token ledger entries (audit log of every token movement). Written
 * from `tokenService.{award,spend,unlockLevel}Token` — same timestamp
 * policy as `UserData`: `Date.now()` → `number` ms epoch.
 */
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
  ccc: 'Katekismus Gereja Katolik',
  sacraments: 'Sakramen',
  liturgy: 'Liturgi',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Mudah',
  medium: 'Sederhana',
  hard: 'Sukar',
};

export const TOTAL_LEVELS = 100;
export const PASSING_SCORE = 80;
