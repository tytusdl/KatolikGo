#!/usr/bin/env node
/**
 * Admin CLI for one-off Firestore / Firebase Auth operations. Bypasses
 * client-side rules (uses firebase-admin) so it can do things the app
 * can't, like deleting a user document.
 *
 * Setup (one-time):
 *   1. Firebase Console → Project Settings → Service Accounts
 *      → "Generate new private key" → save as `serviceAccountKey.json`
 *      at project root (already in `.gitignore`).
 *   2. Run any subcommand below.
 *
 * Subcommands:
 *
 *   find-user <query>
 *     Search the users collection by uid, email, displayName, or username
 *     (case-insensitive substring). Prints full doc + matching Auth user.
 *
 *   delete-user <uid>
 *     Delete a user: drops the Firestore doc at `users/{uid}` AND removes
 *     the Firebase Auth account. Refuses to run without `--yes`. Use
 *     `--dry-run` to preview without changing anything.
 *
 *   dump-leaderboard [--limit N]
 *     Print the top N users by totalXP (default 50), with the same
 *     filterAndRank logic the app uses. Includes guest rows in a
 *     separate section for awareness.
 *
 * Examples:
 *   node scripts/admin.mjs find-user "Tetamu PCC6"
 *   node scripts/admin.mjs find-user PCc6sW5nGzSixZ7qytI5anjQQX53
 *   node scripts/admin.mjs delete-user PCc6sW5nGzSixZ7qytI5anjQQX53 --dry-run
 *   node scripts/admin.mjs delete-user PCc6sW5nGzSixZ7qytI5anjQQX53 --yes
 *   node scripts/admin.mjs dump-leaderboard --limit 20
 */

import { getDb, getAuth, getProjectId } from './lib/admin-firebase.mjs';

// ---------- arg parsing ----------------------------------------------------

const argv = process.argv.slice(2);
const flags = new Set();
const positional = [];
for (const arg of argv) {
  if (arg.startsWith('--')) flags.add(arg);
  else positional.push(arg);
}

function flag(name) {
  return flags.has(name);
}

function usage() {
  console.log(
    [
      'Usage: node scripts/admin.mjs <subcommand> [args] [flags]',
      '',
      'Subcommands:',
      '  find-user <query>               Search users by uid / email / name / username',
      '  delete-user <uid> [--yes] [--dry-run]',
      '                                  Delete Firestore doc + Auth user',
      '  dump-leaderboard [--limit N]    Top N by totalXP (default 50)',
      '',
      'Flags:',
      '  --yes                           Confirm destructive action (delete-user)',
      '  --dry-run                       Show what would happen without changing data',
      '  --limit N                       Limit results (dump-leaderboard)',
    ].join('\n')
  );
  process.exit(1);
}

// ---------- helpers -------------------------------------------------------

function fmt(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object' && v._seconds !== undefined) {
    // Firestore Timestamp serialised over admin SDK
    return new Date(v._seconds * 1000).toISOString();
  }
  return String(v);
}

function summariseUser(data, uid) {
  return {
    uid,
    email: data.email || '(empty)',
    displayName: data.displayName || '(empty)',
    username: data.username || '(none)',
    isGuest: !!data.isGuest,
    isAnonymous: !!data.isAnonymous,
    currentLevel: data.currentLevel ?? 1,
    totalXP: data.totalXP ?? 0,
    tokens: data.tokens ?? 0,
    createdAt: fmt(data.createdAt),
    updatedAt: fmt(data.updatedAt),
  };
}

async function fetchAuthUser(authInstance, uid) {
  try {
    const u = await authInstance.getUser(uid);
    return {
      uid: u.uid,
      email: u.email || '(empty)',
      displayName: u.displayName || '(empty)',
      providerData: u.providerData.map((p) => p.providerId),
      metadata: {
        creationTime: u.metadata.creationTime,
        lastSignInTime: u.metadata.lastSignInTime,
      },
    };
  } catch (e) {
    if (e.code === 'auth/user-not-found') return null;
    throw e;
  }
}

// ---------- subcommands ---------------------------------------------------

async function findUser(query) {
  const db = getDb();
  const auth = getAuth();
  const q = query.trim().toLowerCase();
  if (!q) usage();

  // 1. Direct doc lookup if query looks like a uid (28 alnum chars typical for Firebase)
  if (/^[a-zA-Z0-9]{20,}$/.test(query)) {
    const doc = await db.collection('users').doc(query).get();
    if (doc.exists) {
      const authUser = await fetchAuthUser(auth, query);
      console.log('\n--- Firestore users/{uid} ---');
      console.log(JSON.stringify(summariseUser(doc.data(), query), null, 2));
      if (authUser) {
        console.log('\n--- Firebase Auth user ---');
        console.log(JSON.stringify(authUser, null, 2));
      } else {
        console.log('\n--- Firebase Auth user ---');
        console.log('(not found)');
      }
      return;
    }
  }

  // 2. Fallback: scan top 200 by totalXP and substring-match on key fields.
  //    Cheap while user base is small; switch to indexed composite queries
  //    when this scales past a few hundred users.
  const snap = await db.collection('users').orderBy('totalXP', 'desc').limit(200).get();
  const matches = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => {
      const haystack = [
        d.uid,
        d.email,
        d.displayName,
        d.username,
        d.username_lowercase,
        d.parishName,
      ]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase());
      return haystack.some((s) => s.includes(q));
    });

  if (matches.length === 0) {
    console.log(`(tiada padanan untuk "${query}")`);
    return;
  }

  console.log(`\nDapat ${matches.length} padanan untuk "${query}":\n`);
  for (const m of matches) {
    console.log(JSON.stringify(summariseUser(m, m.uid), null, 2));
    console.log('');
  }
}

async function deleteUser(uid) {
  if (!uid) usage();

  const db = getDb();
  const auth = getAuth();
  console.log(`Project : ${getProjectId()}`);
  console.log(`Target  : ${uid}\n`);

  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  const authUser = await fetchAuthUser(auth, uid);

  if (!userDoc.exists && !authUser) {
    console.log('Tiada Firestore doc DAN tiada Auth user untuk UID ni — dah takde.');
    return;
  }

  if (userDoc.exists) {
    console.log('--- Firestore users/{uid} (akan dipadam) ---');
    console.log(JSON.stringify(summariseUser(userDoc.data(), uid), null, 2));
  } else {
    console.log('--- Firestore users/{uid} ---');
    console.log('(tiada dokumen)');
  }

  if (authUser) {
    console.log('\n--- Firebase Auth user (akan dipadam) ---');
    console.log(JSON.stringify(authUser, null, 2));
  } else {
    console.log('\n--- Firebase Auth user ---');
    console.log('(tiada akaun Auth — mungkin anonymous UID lama atau sudah dipadam)');
  }

  if (flag('--dry-run')) {
    console.log('\n--dry-run set: Tiada data diubah.');
    return;
  }

  if (!flag('--yes')) {
    console.log(
      '\nUntuk sahkan pemadaman, run semula dengan --yes:\n' +
        `  node scripts/admin.mjs delete-user ${uid} --yes`
    );
    return;
  }

  // Order: delete Firestore first (so app logic that re-fetches on next
  // session doesn't see a partially-deleted state), then Auth. If Auth
  // delete fails, we still consider Firestore gone — orphan Auth users
  // are inert and can be cleaned up later.
  if (userDoc.exists) {
    await userRef.delete();
    console.log('\n✓ Firestore users/{uid} dipadam.');
  }

  if (authUser) {
    try {
      await auth.deleteUser(uid);
      console.log('✓ Firebase Auth user dipadam.');
    } catch (e) {
      console.error('⚠ Gagal padam Auth user (Firestore dah dipadam):', e.message);
    }
  }

  // Verify
  const verifyDoc = await userRef.get();
  const verifyAuth = await fetchAuthUser(auth, uid);
  console.log('\n--- Verify ---');
  console.log('Firestore doc exists :', verifyDoc.exists);
  console.log('Auth user exists     :', !!verifyAuth);
}

async function dumpLeaderboard(limitArg) {
  const db = getDb();
  const n = Number.parseInt(limitArg, 10) || 50;
  const snap = await db
    .collection('users')
    .orderBy('totalXP', 'desc')
    .limit(n)
    .get();

  const allRows = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  const registered = allRows.filter((r) => !r.isGuest);
  const guests = allRows.filter((r) => r.isGuest);

  console.log(`\n================ LEADERBOARD (registered, top ${n}) ================`);
  console.log(
    'Rank | Display Name        | Username       | Parish         | Level | XP         | Weekly   | Monthly'
  );
  console.log(
    '-----+---------------------+----------------+----------------+-------+------------+----------+---------'
  );

  if (registered.length === 0) {
    console.log('   (tiada pengguna berdaftar dalam top ' + n + ')');
  } else {
    registered.forEach((r, i) => {
      const parish = r.parishName && r.parishName.trim() ? r.parishName : '(tiada parish)';
      console.log(
        [
          String(i + 1).padStart(4),
          (r.displayName || '').slice(0, 19).padEnd(19),
          (r.username || '—').slice(0, 14).padEnd(14),
          parish.slice(0, 14).padEnd(14),
          String(r.currentLevel ?? 1).padStart(5),
          String(r.totalXP ?? 0).padStart(10),
          String(r.weeklyXP ?? 0).padStart(8),
          String(r.monthlyXP ?? 0).padStart(7),
        ].join(' | ')
      );
    });
  }

  if (guests.length > 0) {
    console.log(
      `\n— ${guests.length} guest row(s) dalam top ${n} (ditapis dalam app, dipaparkan untuk awareness) —`
    );
    for (const g of guests) {
      console.log(
        `  ${(g.displayName || '(anonymous)').slice(0, 24).padEnd(24)}  uid=${g.uid}  xp=${g.totalXP ?? 0}`
      );
    }
  }

  const summarise = (rows, label) => {
    const totalXP = rows.reduce((acc, r) => acc + (r.totalXP || 0), 0);
    const withLevel = rows.filter((r) => (r.currentLevel || 1) > 1).length;
    const withProgress = rows.filter((r) => {
      const lp = r.levelProgress || {};
      return Object.values(lp).some((v) => v && v.completed);
    }).length;
    console.log(`\n— ${label} —`);
    console.log(`  Bilangan    : ${rows.length}`);
    console.log(`  Jumlah XP   : ${totalXP}`);
    console.log(`  Level > 1   : ${withLevel}`);
    console.log(`  Ada progress: ${withProgress}`);
  };
  summarise(allRows, `Ringkasan top ${n} fetched (termasuk guest)`);
  summarise(registered, 'Ringkasan leaderboard sebenar (registered only)');

  console.log('\nSelesai.');
}

// ---------- main ---------------------------------------------------------

const [sub, ...rest] = positional;
const limitFlag = argv.includes('--limit') ? argv[argv.indexOf('--limit') + 1] : undefined;

try {
  switch (sub) {
    case 'find-user':
      await findUser(rest.join(' '));
      break;
    case 'delete-user':
      await deleteUser(rest[0]);
      break;
    case 'dump-leaderboard':
      await dumpLeaderboard(limitFlag);
      break;
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      usage();
      break;
    default:
      console.error(`Subcommand tidak dikenali: ${sub}\n`);
      usage();
  }
  process.exit(0);
} catch (err) {
  console.error('\n' + (err.message || err));
  process.exit(1);
}