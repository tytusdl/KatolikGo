import { doc, getDoc, runTransaction, type Transaction } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { LevelProgress, UserData } from '@/types';
import { PASSING_SCORE, TOTAL_LEVELS } from '@/types';
import {
  computeXpEarned,
  computeTokensEarned,
  getLevelFromXp,
} from '@/constants/xp.constants';

/**
 * Optional per-question payload that the quiz UI can pass to make the
 * XP / token math more accurate. Without these, the functions fall back
 * to `(score / 100) * questionCount` correctCount inference.
 */
export interface LevelCompletionDetails {
  /** Number of questions in the level. Recommended. */
  questionCount?: number;
  /** Number of correctly answered questions. Optional. */
  correctCount?: number;
  /** Longest run of consecutive correct answers (combo). */
  maxCombo?: number;
  /** Tokens spent on hint powerups during the run. */
  hintsUsed?: number;
  /** Tokens spent on skip powerups during the run. */
  skipsUsed?: number;
}

export interface LevelCompletionResult {
  completed: boolean;
  tokensEarned: number;
  xpEarned: number;
  nextLevelUnlocked: boolean;
}

/**
 * Threshold for switching a fresh `submitLevelCompletion` call to a
 * tx update. Below this score the player is just practising — losing
 * a tiny amount of XP / tokens to a concurrent race isn't
 * user-visible. Above this we use the full read-modify-write
 * transaction so two devices finishing the same level at the same
 * time can't clobber each other's XP delta. AGENTS.md §"Firestore-rules
 * design checklist" lists this exact race ("phone + tablet for the
 * same account") as the canonical problem this threshold addresses.
 *
 * Tunable: 50 = at-least-half-correct AND reasonable "they really
 * tried" signal. Below 50 we accept optimistic merge (minor race
 * loss) because the player is practising, not earning meaningful
 * progress.
 */
const TX_THRESHOLD_SCORE = 50;

export async function submitLevelCompletion(
  userId: string,
  level: number,
  score: number,
  userData: UserData,
  details: LevelCompletionDetails = {}
): Promise<LevelCompletionResult> {
  const passed = score >= PASSING_SCORE;

  // Guest users can play through the quiz and see their score / pass-fail
  // result, but they don't earn XP or tokens and we don't persist
  // levelProgress. Their account is device-bound — installing the app
  // wipes the whole account, so any progress we wrote would just be
  // throwaway data on the leaderboard. Returning a clean shape lets
  // the quiz screen render a normal "result" page (showing 0 tokens)
  // instead of throwing mid-flight.
  if (userData.isGuest) {
    return {
      completed: passed,
      tokensEarned: 0,
      xpEarned: 0,
      nextLevelUnlocked: false,
    };
  }

  // `levelProgress` keys are stored as strings (see `UserData` type
  // docstring) — Firestore coerces numeric keys to strings on
  // round-trip. Coerce explicitly here so the object-literal access
  // is unambiguous.
  const existing = userData.levelProgress[String(level)];
  const newBestScore = Math.max(score, existing?.bestScore || 0);
  const currentAttempts = (existing?.attempts || 0) + 1;
  const firstClear = passed && !existing?.completed;

  const xpEarned = computeXpEarned({
    score,
    questionCount: details.questionCount ?? 5,
    correctCount: details.correctCount,
    maxCombo: details.maxCombo,
    passed,
  });
  const tokensEarned = computeTokensEarned({
    score,
    questionCount: details.questionCount ?? 5,
    correctCount: details.correctCount,
    hintsUsed: details.hintsUsed,
    skipsUsed: details.skipsUsed,
    passed,
    firstClear,
  });

  const totalXP = userData.totalXP + xpEarned;
  // Update weekly/monthly buckets in proportion to the level share. Crude
  // but matches existing client behavior — proper weekly/monthly rollover
  // belongs behind a scheduled job, which AGENTS.md notes isn't in scope.
  const weeklyDelta = xpEarned;
  const monthlyDelta = xpEarned;

  const updatedLevelProgress: Record<string, LevelProgress> = {
    ...userData.levelProgress,
    // String-keyed per `UserData.levelProgress` type — see that
    // docstring for the Firestore-round-trip rationale.
    [String(level)]: {
      completed: passed,
      bestScore: newBestScore,
      attempts: currentAttempts,
    },
  };

  let nextLevelUnlocked = false;
  let currentLevel = userData.currentLevel;

  if (passed && level >= userData.currentLevel && level < TOTAL_LEVELS) {
    currentLevel = level + 1;
    nextLevelUnlocked = true;
  }

  // Derive an XP-based level and bump currentLevel up to whichever is
  // higher. This preserves the unlock semantics while letting XP math
  // (combo / perfect bonus) accelerate level when it would otherwise
  // leave the user behind. Never decreases — `Math.max` is intentional.
  const xpLevel = getLevelFromXp(totalXP);
  if (xpLevel > currentLevel) {
    currentLevel = xpLevel;
  }

  // The payload the transaction will write. Built outside the
  // transaction so both the transactional and the merge-fallback paths
  // use the exact same shape — keeping them in lockstep means tests
  // for either path don't drift from the other.
  const writePayload = {
    levelProgress: updatedLevelProgress,
    currentLevel,
    totalXP,
    weeklyXP: (userData.weeklyXP || 0) + weeklyDelta,
    monthlyXP: (userData.monthlyXP || 0) + monthlyDelta,
    tokens: userData.tokens + tokensEarned,
    // `levelsCompleted` is a derived cache — keep in sync with the
    // levelProgress completion flag so Home/Profile UI doesn't need
    // to walk `levelProgress` at read time.
    levelsCompleted: passed
      ? Array.from(new Set([...(userData.levelsCompleted || []), level]))
      : userData.levelsCompleted || [],
    // See `types/index.ts` for the timestamp policy — `Date.now()`
    // so the read-back value matches the `number` type and
    // arithmetic against client time actually works.
    updatedAt: Date.now(),
  };

  // Transactional path — used when the score reaches the
  // meaningful-progress threshold. Inside `runTransaction` the
  // read-modify-write loop is atomic from Firestore's perspective:
  // if another client wrote to the same doc between our `get` and
  // our `set`, Firestore re-runs the callback with the freshest
  // snapshot. We re-read the doc, rebuild the deltas (so they're
  // relative to the LATEST values, not the `userData` the caller
  // passed in), and write again.
  if (score >= TX_THRESHOLD_SCORE) {
    try {
      await runTransaction(db, async (transaction: Transaction) => {
        const userRef = doc(db, 'users', userId);
        const freshSnap = await transaction.get(userRef);
        if (!freshSnap.exists()) {
          // Doc missing — caller passed us a stale `userData` shape
          // but the doc has been deleted (admin tooling, manual
          // reset, etc.). Skip silently; the screen that called us
          // will see `userData: null` on the next render and
          // route appropriately.
          return;
        }
        const fresh = freshSnap.data() as UserData;
        // Rebuild deltas against the FRESH doc — re-read is the
        // whole point of the transaction. The new `levelProgress`
        // entry is already fully built in `writePayload`, so the
        // fresh spread below + fresh-level entry below produces
        // the new state without needing to recompute it here.
        const writeNow = {
          levelProgress: {
            ...(fresh.levelProgress ?? {}),
            [String(level)]: writePayload.levelProgress[String(level)],
          },
          currentLevel: Math.max(
            writePayload.currentLevel,
            fresh.currentLevel ?? 1
          ),
          totalXP: (fresh.totalXP ?? 0) + xpEarned,
          weeklyXP: (fresh.weeklyXP ?? 0) + weeklyDelta,
          monthlyXP: (fresh.monthlyXP ?? 0) + monthlyDelta,
          tokens: (fresh.tokens ?? 0) + tokensEarned,
          levelsCompleted: passed
            ? Array.from(
                new Set([...(fresh.levelsCompleted ?? []), level])
              )
            : fresh.levelsCompleted ?? [],
          updatedAt: writePayload.updatedAt,
        };
        transaction.set(userRef, writeNow, { merge: true });
      });
    } catch (err) {
      // Transaction retry budget exceeded (Firestore aborts after 5
      // consecutive write-conflict retries) or the doc was deleted
      // during the transaction. Surface to the caller — the quiz
      // screen catches this and routes to /quiz/result with
      // tokensEarned: 0, so the player sees their score without the
      // XP bumps landing. Better than corrupting the user's doc.
      throw err;
    }
    return { completed: passed, tokensEarned, xpEarned, nextLevelUnlocked };
  }

  // Low-score path — preserve the previous merge semantics. Below the
  // threshold a concurrent race would be barely-visible; we
  // accept the rare double-merge rather than pay the round-trip
  // cost of `runTransaction` on every failed attempt.
  await import('firebase/firestore').then(({ setDoc }) =>
    setDoc(doc(db, 'users', userId), writePayload, { merge: true })
  );

  return { completed: passed, tokensEarned, xpEarned, nextLevelUnlocked };
}

export async function canAccessLevel(userData: UserData, level: number): Promise<boolean> {
  return level <= userData.currentLevel;
}

export async function getUserLevelProgress(userId: string, level: number): Promise<LevelProgress | null> {
  const snap = await getDoc(doc(db, 'users', userId));
  if (snap.exists()) {
    const data = snap.data();
    // String-keyed lookup (`UserData.levelProgress`).
    return data.levelProgress?.[String(level)] || null;
  }
  return null;
}
