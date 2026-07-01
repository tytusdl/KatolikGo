import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  type QuerySnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { LeaderboardEntry, UserData } from '@/types';

export function subscribeToGlobalLeaderboard(
  callback: (entries: LeaderboardEntry[]) => void,
  pageSize: number = 50
) {
  const q = query(
    collection(db, 'users'),
    orderBy('totalXP', 'desc'),
    limit(pageSize)
  );

  return onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
    const entries: LeaderboardEntry[] = snap.docs.map((doc, index) => {
      const data = doc.data() as UserData;
      return {
        userId: data.uid,
        displayName: data.displayName,
        parishName: data.parishName,
        totalXP: data.totalXP,
        weeklyXP: data.weeklyXP || 0,
        monthlyXP: data.monthlyXP || 0,
        rank: index + 1,
      };
    });
    callback(entries);
  });
}

export async function getGlobalLeaderboard(pageSize: number = 50): Promise<LeaderboardEntry[]> {
  const q = query(
    collection(db, 'users'),
    orderBy('totalXP', 'desc'),
    limit(pageSize)
  );

  const snap = await getDocs(q);
  return snap.docs.map((doc, index) => {
    const data = doc.data() as UserData;
    return {
      userId: data.uid,
      displayName: data.displayName,
      parishName: data.parishName,
      totalXP: data.totalXP,
      weeklyXP: data.weeklyXP || 0,
      monthlyXP: data.monthlyXP || 0,
      rank: index + 1,
    };
  });
}

export async function getParishLeaderboard(parishId: string | null): Promise<LeaderboardEntry[]> {
  if (!parishId) return [];

  const q = query(
    collection(db, 'users'),
    orderBy('totalXP', 'desc'),
    limit(50)
  );

  const snap = await getDocs(q);
  return snap.docs
    .map((doc, index) => {
      const data = doc.data() as UserData;
      if (data.parishId !== parishId) return null;
      return {
        userId: data.uid,
        displayName: data.displayName,
        parishName: data.parishName,
        totalXP: data.totalXP,
        weeklyXP: data.weeklyXP || 0,
        monthlyXP: data.monthlyXP || 0,
        rank: index + 1,
      } as LeaderboardEntry;
    })
    .filter((e): e is LeaderboardEntry => e !== null);
}