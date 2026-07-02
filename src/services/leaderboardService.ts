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

/**
 * Map a UserData doc to a LeaderboardEntry. `rank` is filled in by the
 * caller after filtering — guests are stripped before rank assignment
 * so the leaderboard reflects only registered users.
 */
function toLeaderboardEntry(data: UserData, rank: number): LeaderboardEntry {
  return {
    userId: data.uid,
    displayName: data.displayName,
    parishName: data.parishName,
    totalXP: data.totalXP,
    weeklyXP: data.weeklyXP || 0,
    monthlyXP: data.monthlyXP || 0,
    rank,
  };
}

/**
 * Strip guest rows and recompute `rank` so the leaderboard reflects only
 * registered users. Guest users (`isGuest === true`) are filtered out
 * because their data is throwaway — they're device-bound and don't
 * earn XP/tokens, so leaving them in would either crowd real players
 * down or show empty-XP ghost rows.
 */
function filterAndRank(docs: UserData[]): LeaderboardEntry[] {
  const out: LeaderboardEntry[] = [];
  let rank = 1;
  for (const data of docs) {
    if (data.isGuest) continue;
    out.push(toLeaderboardEntry(data, rank));
    rank += 1;
  }
  return out;
}

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
    const docs = snap.docs.map((doc) => doc.data() as UserData);
    callback(filterAndRank(docs));
  });
}

export async function getGlobalLeaderboard(pageSize: number = 50): Promise<LeaderboardEntry[]> {
  const q = query(
    collection(db, 'users'),
    orderBy('totalXP', 'desc'),
    limit(pageSize)
  );

  const snap = await getDocs(q);
  const docs = snap.docs.map((doc) => doc.data() as UserData);
  return filterAndRank(docs);
}

export async function getParishLeaderboard(parishId: string | null): Promise<LeaderboardEntry[]> {
  if (!parishId) return [];

  // Over-fetch so the parish filter has enough rows after we've also
  // stripped guests. 200 is a soft cap — fine while the total user
  // base is small; once this hits production scale this should switch
  // to a `where('parishId', '==', parishId) + orderBy('totalXP')`
  // composite query with a matching Firestore index.
  const q = query(
    collection(db, 'users'),
    orderBy('totalXP', 'desc'),
    limit(200)
  );

  const snap = await getDocs(q);
  const docs = snap.docs
    .map((doc) => doc.data() as UserData)
    .filter((data) => data.parishId === parishId);
  return filterAndRank(docs);
}