import { doc, setDoc, serverTimestamp, collection, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { UserData } from '@/types';
import { TOTAL_LEVELS, PASSING_SCORE } from '@/types';

/**
 * Error code thrown by spendToken when a guest (Firebase anonymous) user
 * tries to use a powerup. The screen surfaces this through
 * `friendlyGuestError` so the user sees a Malay "Sila daftar atau log
 * masuk" prompt instead of a raw `Error`.
 */
export const GUEST_SPEND_BLOCKED = 'GUEST_SPEND_BLOCKED';

export async function spendToken(
  userId: string,
  amount: number,
  description: string
): Promise<boolean> {
  const userRef = doc(db, 'users', userId);

  await runTransaction(db, async (transaction) => {
    const freshSnap = await transaction.get(userRef);
    const freshData = freshSnap.data() as UserData;

    if (!freshData) {
      throw new Error('Akaun tidak dijumpai. Sila log masuk semula.');
    }

    // Guest users get no tokens (levelService.submitLevelCompletion
    // skips the reward for them) and shouldn't be able to spend any
    // either — the whole point of the gate is to push them toward
    // registering. Block at the source so the UI can prompt with
    // Daftar / Log Masuk buttons instead of an "Insufficient tokens"
    // error that wouldn't make sense.
    if (freshData.isGuest) {
      const err = new Error(
        'Pengguna tetamu tidak boleh menggunakan token. Sila daftar atau log masuk.'
      ) as Error & { code: string };
      err.code = GUEST_SPEND_BLOCKED;
      throw err;
    }

    if (freshData.tokens < amount) {
      throw new Error('Insufficient tokens');
    }

    transaction.update(userRef, {
      tokens: freshData.tokens - amount,
      updatedAt: serverTimestamp(),
    });

    transaction.set(doc(collection(db, 'transactions')), {
      userId,
      type: 'spend',
      amount,
      description,
      createdAt: serverTimestamp(),
    });
  });

  return true;
}

export async function awardTokens(
  userId: string,
  amount: number,
  description: string
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  const currentTokens = userSnap.exists() ? (userSnap.data() as UserData).tokens : 0;

  await setDoc(userRef, {
    tokens: currentTokens + amount,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await setDoc(doc(collection(db, 'transactions')), {
    userId,
    type: 'reward',
    amount,
    description,
    createdAt: serverTimestamp(),
  });
}

export async function unlockLevelWithToken(
  userId: string,
  targetLevel: number,
  userData: UserData
): Promise<{ success: boolean; newLevel: number }> {
  if (userData.isGuest) {
    return { success: false, newLevel: userData.currentLevel };
  }

  if (targetLevel > TOTAL_LEVELS) {
    return { success: false, newLevel: userData.currentLevel };
  }

  if (userData.tokens < 10) {
    return { success: false, newLevel: userData.currentLevel };
  }

  const userRef = doc(db, 'users', userId);
  const newLevelProgress = { ...userData.levelProgress };
  for (let i = userData.currentLevel; i < targetLevel; i++) {
    newLevelProgress[i] = { completed: true, bestScore: PASSING_SCORE, attempts: 1 };
  }

  await setDoc(userRef, {
    levelProgress: newLevelProgress,
    currentLevel: targetLevel + 1,
    tokens: userData.tokens - 10,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await setDoc(doc(collection(db, 'transactions')), {
    userId,
    type: 'spend',
    amount: 10,
    description: `Unlock until level ${targetLevel}`,
    createdAt: serverTimestamp(),
  });

  return { success: true, newLevel: targetLevel + 1 };
}
