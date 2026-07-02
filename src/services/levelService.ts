import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
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

  const existing = userData.levelProgress[level];
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

  const updatedLevelProgress: Record<number, LevelProgress> = {
    ...userData.levelProgress,
    [level]: {
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

  await setDoc(
    doc(db, 'users', userId),
    {
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
      updatedAt: serverTimestamp(),
    },
    { merge: true }
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
    return data.levelProgress?.[level] || null;
  }
  return null;
}
