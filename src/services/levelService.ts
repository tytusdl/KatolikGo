import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { LevelProgress, UserData } from '@/types';
import { PASSING_SCORE, TOTAL_LEVELS } from '@/types';

export async function submitLevelCompletion(
  userId: string,
  level: number,
  score: number,
  userData: UserData
): Promise<{ completed: boolean; tokensEarned: number; nextLevelUnlocked: boolean }> {
  const passed = score >= PASSING_SCORE;
  const newBestScore = Math.max(score, userData.levelProgress[level]?.bestScore || 0);
  const currentAttempts = (userData.levelProgress[level]?.attempts || 0) + 1;

  const xpEarned = passed ? Math.round(score * 10) : Math.round(score * 5);
  const totalXP = userData.totalXP + xpEarned;
  let tokensEarned = 0;

  if (passed && !userData.levelProgress[level]?.completed) {
    tokensEarned = 5;
  }

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

  await setDoc(doc(db, 'users', userId), {
    levelProgress: updatedLevelProgress,
    currentLevel,
    totalXP,
    tokens: userData.tokens + tokensEarned,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return { completed: passed, tokensEarned, nextLevelUnlocked };
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
