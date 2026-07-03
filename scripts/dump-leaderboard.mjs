/**
 * One-off leaderboard dump. Uses the Firebase client SDK + anonymous sign-in
 * (Firestore rules allow `read: if request.auth != null` on `users`) to
 * mirror what `subscribeToGlobalLeaderboard` does in the app, but as a
 * standalone Node script for inspection.
 *
 * Mirrors `filterAndRank` from `src/services/leaderboardService.ts` — strips
 * guest rows and recomputes rank so the printed leaderboard reflects only
 * registered users.
 *
 * Run:  node scripts/dump-leaderboard.mjs
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCzq0iMJZUGjLrSGEnou66f7AA8jsBu2Jw',
  authDomain: 'katolikgo-mobile.firebaseapp.com',
  projectId: 'katolikgo-mobile',
  storageBucket: 'katolikgo-mobile.firebasestorage.app',
  messagingSenderId: '615054372997',
  appId: '1:615054372997:web:8ab4a440df706977f779ec',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

function fmt(n) {
  return n === undefined || n === null ? '—' : String(n);
}

function fmtParish(name) {
  return name && name.trim().length > 0 ? name : '(tiada parish)';
}

function summarise(rows, label) {
  const totalXP = rows.reduce((acc, r) => acc + (r.totalXP || 0), 0);
  const withLevel = rows.filter((r) => (r.currentLevel || 1) > 1).length;
  const withCompleted = rows.filter((r) => {
    const lp = r.levelProgress || {};
    return Object.values(lp).some((v) => v && v.completed);
  }).length;
  console.log(`\n— ${label} —`);
  console.log(`  Bilangan    : ${rows.length}`);
  console.log(`  Jumlah XP   : ${totalXP}`);
  console.log(`  Level > 1   : ${withLevel}`);
  console.log(`  Ada progress: ${withCompleted}`);
}

async function main() {
  console.log('Signing in anonymously…');
  await signInAnonymously(auth);

  // Pull the full top-50 by totalXP — same query the app uses.
  // We then split registered vs guest in JS (mirrors filterAndRank).
  const snap = await getDocs(
    query(collection(db, 'users'), orderBy('totalXP', 'desc'), limit(50))
  );
  const allRows = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));

  const registered = allRows
    .filter((r) => !r.isGuest)
    .map((r, i) => ({ rank: i + 1, ...r }));
  const guestsInTop50 = allRows.filter((r) => r.isGuest);

  console.log('\n================ LEADERBOARD (registered, top 50) ================');
  console.log(
    'Rank | Display Name        | Username       | Parish         | Level | XP         | Weekly   | Monthly'
  );
  console.log(
    '-----+---------------------+----------------+----------------+-------+------------+----------+---------'
  );
  if (registered.length === 0) {
    console.log('   (tiada pengguna berdaftar dalam top 50)');
  } else {
    for (const r of registered) {
      console.log(
        [
          String(r.rank).padStart(4),
          (r.displayName || '').slice(0, 19).padEnd(19),
          (r.username || '—').slice(0, 14).padEnd(14),
          fmtParish(r.parishName).slice(0, 14).padEnd(14),
          String(r.currentLevel ?? 1).padStart(5),
          fmt(r.totalXP).padStart(10),
          fmt(r.weeklyXP).padStart(8),
          fmt(r.monthlyXP).padStart(7),
        ].join(' | ')
      );
    }
  }

  if (guestsInTop50.length > 0) {
    console.log(
      `\n— ${guestsInTop50.length} guest row(s) hadir dalam top 50 (ditapis dalam app, dipaparkan sini untuk info) —`
    );
    for (const r of guestsInTop50) {
      console.log(
        `  ${(r.displayName || '(anonymous)').slice(0, 24).padEnd(24)}  uid=${r.uid}  xp=${r.totalXP ?? 0}`
      );
    }
  }

  // Summary stats across the top 50 fetched
  summarise(allRows, 'Ringkasan top 50 fetched (termasuk guest)');
  summarise(registered, 'Ringkasan leaderboard sebenar (registered only)');

  // Total user count via a cheap aggregation: limit 50 only returns 50,
  // so we can't get an exact "total users" without an extra query. Skip
  // exact total unless asked — this script is a quick inspection.

  console.log('\nSelesai.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Dump gagal:', err);
  process.exit(1);
});