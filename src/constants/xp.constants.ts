/**
 * XP, level, and token economy constants + math.
 *
 * Backported from the long-range `katolikgo-server` design doc
 * (Cloud Functions spec). The doc's per-question semantics — each correct
 * earns 20 XP, each wrong 5 XP consolation, perfect-score bonus 100 XP —
 * gives a meaningful progression curve, where the previous flat
 * `Math.round(score * 10)` heuristic over-rewarded low-% passes and
 * skipped combo / perfect-bonus entirely.
 *
 * Curve (cumulative XP to reach level N):
 *   lvl 2 = 100, lvl 3 = 250, lvl 4 = 450, lvl 5 = 700, lvl 6 = 1000,
 *   lvl 7 = 1350, lvl 8 = 1750, lvl 9 = 2200, lvl 10 = 2700, ...
 *
 * Token economy mirrors the doc's reward table. Powerup costs match
 * `src/services/tokenService.ts` constants.
 */

export const XP_REWARDS = {
  CORRECT_ANSWER: 20,
  WRONG_ANSWER: 5,
  DAILY_LOGIN: 50,
  PERFECT_SCORE_BONUS: 100,
  COMBO_MULTIPLIER: 2, // additional XP per combo step on top of base
  TIME_ATTACK_PER_CORRECT: 15,
  LEVEL_UP_BASE: 100, // XP for level 1 → 2
  LEVEL_UP_INCREMENT: 50, // each subsequent level requires 50 XP more
  MIN_LEVEL: 1,
  MAX_LEVEL: 100,
} as const;

export const TOKEN_REWARDS = {
  CORRECT_ANSWER: 5,
  DAILY_LOGIN_BASE: 50,
  HINT_COST: 10,
  SKIP_COST: 20,
  LEVEL_UNLOCK_COST: 30,
  REFERRAL_REWARD: 100,
  ACHIEVEMENT_BASE: 25,
  PERFECT_SCORE_BONUS: 50,
  FIRST_CLEAR_BONUS: 25,
} as const;

/**
 * Lives system config — the player gets 5 lives, loses one per wrong
 * answer / timeout during a quiz, and refills over time + through
 * token-spend / rewarded-ad escape hatches.
 *
 * "Lives" model: standard mobile-casual pattern (Candy Crush, Wordle,
 * Duolingo's heart system). Adds enough friction to discourage
 * brute-force guessing but doesn't permanently lock out a user — the
 * time-based refill tick keeps the trial frictionless, and the token /
 * ad escape hatches give paying / engaged players a fast path back in.
 *
 * The refill tick is *time-based*, NOT midnight-based — a player who
 * loses a life at 14:00 gets their first auto-refill at 14:20, not at
 * midnight. Smooth drip rather than a single midnight reset.
 *
 * Atomicity: every lives-changing operation runs inside a Firestore
 * `runTransaction` (see `livesService.ts`) so concurrent quiz sessions
 * (e.g. phone + tablet for the same account) can't double-decrement or
 * race the refill tick.
 */
export const LIVES_CONFIG = {
  /** Maximum lives a user can hold. Refills cap at this value. */
  MAX: 5,
  /**
   * Minutes of real-time between each automatic life refill while the
   * user has fewer than `MAX` lives. Default 20 min keeps the drip
   * short enough that an engaged player who burns all 5 lives is back
   * to full in ~1h 40m — long enough that lives still feel
   * meaningful, short enough that the player doesn't feel locked out
   * and walk away. The token / ad escape hatches sit on top for
   * players who'd rather not wait.
   *
   * Tunable: 10 = very generous, 30 = classic-casual feel,
   * 60 = Duolingo-tier harshness.
   */
  REFILL_MINUTES: 20,
  /**
   * Tokens required to refill 1 life via in-app spend. Matches the
   * token reward rate for one correct answer (5) × 10 — pricey enough
   * to discourage spam, cheap enough to feel reachable.
   */
  REFILL_TOKEN_COST: 50,
  /**
   * Minimum minutes between consecutive rewarded-ad refills. Caps ad
   * abuse (spam-tapping the button) without making the cooldown so
   * long that an engaged player feels rate-limited.
   */
  AD_COOLDOWN_MIN: 5,
  /**
   * Default lives value for legacy user docs that pre-date this field.
   * Treated as "full health" so a returning player doesn't lose
   * progress on the first session after this feature ships.
   */
  LEGACY_DEFAULT: 5,
} as const;

/**
 * Cumulative XP needed to *reach* `level` (i.e. the threshold you cross
 * to enter that level). `xpRequiredForLevel(1) === 0` — you're level 1
 * with zero XP.
 *
 * Formula: sum of (LEVEL_UP_BASE + (i - 1) * LEVEL_UP_INCREMENT) for
 * i from 1 to level - 1. Closed form would be a triangular series but
 * the linear loop is clearer for a 100-level cap and runs once per
 * level-up event.
 */
export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += XP_REWARDS.LEVEL_UP_BASE + (i - 1) * XP_REWARDS.LEVEL_UP_INCREMENT;
  }
  return total;
}

/**
 * Derive the level a player has earned from total accumulated XP.
 * Clamps to [MIN_LEVEL, MAX_LEVEL] so e.g. negative XP doesn't crash.
 */
export function getLevelFromXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return XP_REWARDS.MIN_LEVEL;
  let level = XP_REWARDS.MIN_LEVEL;
  while (
    level < XP_REWARDS.MAX_LEVEL &&
    xp >= xpRequiredForLevel(level + 1)
  ) {
    level++;
  }
  return level;
}

export interface XpProgress {
  level: number;
  /** XP earned since entering `level`. */
  current: number;
  /** XP required to leave `level` for the next one. */
  required: number;
  /** 0–100 percentage toward next level. 100 if at MAX_LEVEL. */
  percentage: number;
}

/**
 * XP progress breakdown for UI: current level, XP into this level,
 * XP needed for the next, and a 0-100 percentage. At MAX_LEVEL the
 * required/percentage are pinned at the last level's span and 100.
 */
export function getXpProgress(xp: number): XpProgress {
  const level = getLevelFromXp(xp);
  const currentLevelXp = xpRequiredForLevel(level);
  const nextLevelXp =
    level >= XP_REWARDS.MAX_LEVEL
      ? currentLevelXp
      : xpRequiredForLevel(level + 1);
  const current = xp - currentLevelXp;
  const required = Math.max(1, nextLevelXp - currentLevelXp);
  const percentage =
    level >= XP_REWARDS.MAX_LEVEL
      ? 100
      : Math.min(100, Math.max(0, (current / required) * 100));
  return { level, current, required, percentage };
}

/**
 * Compute XP earned on a finished level.
 *
 * `score` is a 0–100 percentage (matches `types/index.ts → PASSING_SCORE`
 * convention; doc's per-correct semantics are approximated via
 * `questionCount`). `correctCount` and `maxCombo` are both optional —
 * omit them if the quiz UI didn't track them.
 *
 * Combo bonus: if `maxCombo >= 2`, add `maxCombo * COMBO_MULTIPLIER` on
 * top of base. Perfect-score bonus is +100.
 */
export function computeXpEarned(opts: {
  score: number;
  questionCount: number;
  correctCount?: number;
  maxCombo?: number;
  passed?: boolean;
}): number {
  const {
    score,
    questionCount,
    correctCount,
    maxCombo = 0,
    passed = false,
  } = opts;
  const inferredCorrect =
    typeof correctCount === 'number'
      ? Math.max(0, correctCount)
      : Math.round((Math.max(0, Math.min(100, score)) / 100) * questionCount);
  const wrongCount = Math.max(0, questionCount - inferredCorrect);

  const base =
    inferredCorrect * XP_REWARDS.CORRECT_ANSWER +
    wrongCount * XP_REWARDS.WRONG_ANSWER;
  const combo = maxCombo >= 2 ? maxCombo * XP_REWARDS.COMBO_MULTIPLIER : 0;
  const perfect = passed && score >= 100 ? XP_REWARDS.PERFECT_SCORE_BONUS : 0;
  return Math.max(0, Math.round(base + combo + perfect));
}

/**
 * Compute tokens earned on a finished level.
 * `firstClear` is true if this is the player's first ever passing
 * attempt at this level — preserves the original "first completion
 * bonus" behavior the previous flat formula had.
 */
export function computeTokensEarned(opts: {
  score: number;
  questionCount: number;
  correctCount?: number;
  hintsUsed?: number;
  skipsUsed?: number;
  passed?: boolean;
  firstClear?: boolean;
}): number {
  const {
    score,
    questionCount,
    correctCount,
    hintsUsed = 0,
    skipsUsed = 0,
    passed = false,
    firstClear = false,
  } = opts;
  const inferredCorrect =
    typeof correctCount === 'number'
      ? Math.max(0, correctCount)
      : Math.round((Math.max(0, Math.min(100, score)) / 100) * questionCount);
  const gross = inferredCorrect * TOKEN_REWARDS.CORRECT_ANSWER;
  const powerupCost =
    hintsUsed * TOKEN_REWARDS.HINT_COST +
    skipsUsed * TOKEN_REWARDS.SKIP_COST;
  const net = Math.max(0, gross - powerupCost);
  const perfect = passed && score >= 100 ? TOKEN_REWARDS.PERFECT_SCORE_BONUS : 0;
  const firstClearBonus = passed && firstClear ? TOKEN_REWARDS.FIRST_CLEAR_BONUS : 0;
  return Math.round(net + perfect + firstClearBonus);
}
