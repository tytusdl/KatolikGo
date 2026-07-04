import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  collection,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '@/config/firebase';
import type { UserData } from '@/types';
import { LIVES_CONFIG } from '@/constants/xp.constants';
import {
  isAdminUnlockConfigured,
  verifyAdminPassphrase,
} from '@/config/adminUnlock';

/**
 * Admin-only service.
 *
 * Every function in this file verifies `caller.isAdmin === true`
 * before touching Firestore. The intent is to make accidental
 * misuse safe — even if a stale screen reaches a wrong service,
 * the assertAdmin() guard short-circuits with `NOT_ADMIN` instead
 * of silently minting tokens.
 *
 * Scope for now: each function acts on the *caller* — there's only
 * one developer (the panel is single-tenant). If the panel ever
 * grows multi-user, an explicit `targetUid` argument pattern can
 * be layered in without changing the guard semantics.
 *
 * Security note: client-side enforcement only. Firestore rules
 * aren't deployed yet (see AGENTS.md "Firestore rules design
 * checklist"). A motivated attacker with dev tools could flip
 * `isAdmin: true` on their own doc. For an early-stage single-dev
 * app that's acceptable; proper server-side gating belongs in
 * Cloud Functions once those land.
 */

/**
 * Error code thrown when a non-admin caller tries to invoke an
 * admin function. The screen surfaces this via `Alert.alert('Akses
 * diperlukan', ...)` instead of the raw "Akses admin diperlukan"
 * text.
 */
export const NOT_ADMIN = 'NOT_ADMIN';

/**
 * Asserts the caller has `isAdmin === true`. Throws
 * `NOT_ADMIN`-coded Error otherwise. Use this at the top of every
 * admin function — keeps the gate in one place.
 *
 * `null` / `undefined` (no auth) also throws — admin functions
 * should never be callable pre-login.
 */
export function assertAdmin(caller: UserData | null | undefined): asserts caller is UserData {
  if (!caller) {
    const err = new Error('Sila log masuk sebagai admin.') as Error & { code: string };
    err.code = NOT_ADMIN;
    throw err;
  }
  if (caller.isAdmin !== true) {
    const err = new Error('Akses admin diperlukan.') as Error & { code: string };
    err.code = NOT_ADMIN;
    throw err;
  }
}

/** Maximum allowed level input. Defensive — admins shouldn't pump
 *  XP to absurd values that confuse the leaderboard. Read queries
 *  tolerate larger numbers, but the level curve
 *  (`xpRequiredForLevel(101)`) would throw — keep inputs bounded. */
const MAX_LEVEL_INPUT = 100;
// Tokens / XP have no hard caps; only the type bound. We'll
// sanitise NaN / Infinity in each helper.

// ---------- TOKENS ---------------------------------------------------------

/**
 * Add `amount` tokens to the caller's balance. Negative amounts
 * are allowed (deduction) but the post-write balance is clamped
 * to >= 0 so a misclick can't tank the user below zero. Returns
 * the new balance.
 *
 * Also records a `reward` / `spend` transaction row mirroring
 * `tokenService.awardTokens` so audit history stays consistent.
 */
export async function grantTokens(
  caller: UserData,
  amount: number
): Promise<{ tokens: number }> {
  assertAdmin(caller);
  if (!Number.isFinite(amount)) {
    throw new Error('Jumlah token mesti nombor.');
  }
  if (amount === 0) {
    throw new Error('Jumlah token tidak boleh 0.');
  }

  const userRef = doc(db, 'users', caller.uid);
  const result = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) {
      throw new Error('Dokumen akaun tidak dijumpai.');
    }
    const data = snap.data() as Partial<UserData>;
    const current = typeof data.tokens === 'number' ? data.tokens : 0;
    const next = Math.max(0, current + amount);
    transaction.update(userRef, {
      tokens: next,
      updatedAt: serverTimestamp(),
    });
    return { tokens: next };
  });

  // Best-effort transaction log entry — kept out of the transaction
  // to avoid bloating the txn payload with a fresh doc write. If
  // the log insert fails the balance already updated; not worth
  // throwing for an audit-row miss. (tokenService follows the same
  // pattern.)
  try {
    const desc =
      amount > 0
        ? `Admin grant: +${amount} token`
        : `Admin spend: ${amount} token`;
    await setDoc(doc(collection(db, 'transactions')), {
      userId: caller.uid,
      type: amount > 0 ? 'reward' : 'spend',
      amount: Math.abs(amount),
      description: desc,
      createdAt: serverTimestamp(),
    });
  } catch {
    // ignore — balance update already applied
  }

  return result;
}

/**
 * Replace the caller's token balance with `amount`. Clamped to
 * >= 0. Skips if the new value equals the current value (no
 * unnecessary writes).
 */
export async function setTokens(
  caller: UserData,
  amount: number
): Promise<{ tokens: number }> {
  assertAdmin(caller);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Jumlah token mesti nombor >= 0.');
  }
  const userRef = doc(db, 'users', caller.uid);
  const result = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) throw new Error('Dokumen akaun tidak dijumpai.');
    const current = (snap.data() as Partial<UserData>).tokens ?? 0;
    if (current === amount) return { tokens: amount };
    transaction.update(userRef, {
      tokens: amount,
      updatedAt: serverTimestamp(),
    });
    return { tokens: amount };
  });
  return result;
}

// ---------- XP -------------------------------------------------------------

/**
 * Add `amount` XP across all three counters (total / weekly /
 * monthly). Negative amounts work too, but the new total is
 * clamped to >= 0. Weekly/monthly are clamped separately.
 */
export async function grantXp(
  caller: UserData,
  amount: number
): Promise<{ totalXP: number; weeklyXP: number; monthlyXP: number }> {
  assertAdmin(caller);
  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error('Jumlah XP mesti nombor bukan sifar.');
  }
  const userRef = doc(db, 'users', caller.uid);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) throw new Error('Dokumen akaun tidak dijumpai.');
    const d = snap.data() as Partial<UserData>;
    const totalXP = Math.max(0, (d.totalXP ?? 0) + amount);
    const weeklyXP = Math.max(0, (d.weeklyXP ?? 0) + amount);
    const monthlyXP = Math.max(0, (d.monthlyXP ?? 0) + amount);
    transaction.update(userRef, {
      totalXP,
      weeklyXP,
      monthlyXP,
      updatedAt: serverTimestamp(),
    });
    return { totalXP, weeklyXP, monthlyXP };
  });
}

/**
 * Replace the three XP counters with explicit values. All three
 * must be supplied (no partial updates) — minimises confusion
 * about which counter was modified.
 */
export async function setXp(
  caller: UserData,
  totalXP: number,
  weeklyXP: number,
  monthlyXP: number
): Promise<{ totalXP: number; weeklyXP: number; monthlyXP: number }> {
  assertAdmin(caller);
  for (const [name, v] of [
    ['totalXP', totalXP],
    ['weeklyXP', weeklyXP],
    ['monthlyXP', monthlyXP],
  ] as const) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(`XP ${name} mesti nombor >= 0.`);
    }
  }
  const userRef = doc(db, 'users', caller.uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) throw new Error('Dokumen akaun tidak dijumpai.');
    transaction.update(userRef, {
      totalXP,
      weeklyXP,
      monthlyXP,
      updatedAt: serverTimestamp(),
    });
  });
  return { totalXP, weeklyXP, monthlyXP };
}

// ---------- LEVEL ----------------------------------------------------------

/**
 * Set the caller's currentLevel (the maximum level they can
 * access). Clamped to [1, MAX_LEVEL_INPUT]. Does NOT touch XP —
 * if you want XP-based level progression to match, use `setXp`
 * alongside. Doesn't modify `levelProgress` history either.
 */
export async function setCurrentLevel(
  caller: UserData,
  level: number
): Promise<{ currentLevel: number }> {
  assertAdmin(caller);
  if (!Number.isFinite(level) || level < 1) {
    throw new Error('Level mesti >= 1.');
  }
  const clamped = Math.min(MAX_LEVEL_INPUT, Math.floor(level));
  const userRef = doc(db, 'users', caller.uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) throw new Error('Dokumen akaun tidak dijumpai.');
    transaction.update(userRef, {
      currentLevel: clamped,
      updatedAt: serverTimestamp(),
    });
  });
  return { currentLevel: clamped };
}

// ---------- LIVES ----------------------------------------------------------

/**
 * Refill lives to MAX and clear both refill anchors
 * (`livesLastLostAt` + `lastAdRefillAt`). The next loss starts a
 * fresh refill tick from the new anchor time. Atomic so a refill
 * tick racing the admin call can't double-credit.
 */
export async function refillLives(caller: UserData): Promise<{
  lives: number;
  cleared: { livesLastLostAt: boolean; lastAdRefillAt: boolean };
}> {
  assertAdmin(caller);
  const userRef = doc(db, 'users', caller.uid);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) throw new Error('Dokumen akaun tidak dijumpai.');
    const data = snap.data() as Partial<UserData>;
    const hadAnchor = data.livesLastLostAt != null;
    const hadAdAnchor = data.lastAdRefillAt != null;
    transaction.update(userRef, {
      lives: LIVES_CONFIG.MAX,
      livesLastLostAt: null,
      lastAdRefillAt: null,
      updatedAt: serverTimestamp(),
    });
    return {
      lives: LIVES_CONFIG.MAX,
      cleared: { livesLastLostAt: hadAnchor, lastAdRefillAt: hadAdAnchor },
    };
  });
}

/**
 * Replace `lives` with an explicit value (clamped to
 * [0, LIVES_CONFIG.MAX]). Clears the time-based refill anchor so
 * the player gets a fresh `REFILL_MINUTES` window from now.
 */
export async function setLives(
  caller: UserData,
  value: number
): Promise<{ lives: number }> {
  assertAdmin(caller);
  if (!Number.isFinite(value)) {
    throw new Error('Nilai nyawa mesti nombor.');
  }
  const clamped = Math.max(0, Math.min(LIVES_CONFIG.MAX, Math.floor(value)));
  const userRef = doc(db, 'users', caller.uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) throw new Error('Dokumen akaun tidak dijumpai.');
    transaction.update(userRef, {
      lives: clamped,
      livesLastLostAt: null,
      updatedAt: serverTimestamp(),
    });
  });
  return { lives: clamped };
}

/**
 * Clear `livesLastLostAt` and `lastAdRefillAt` without changing
 * the current lives value. Useful when the player wants to be
 * able to retry now — the next refills will be measured from
 * scratch.
 */
export async function clearLivesCooldowns(caller: UserData): Promise<void> {
  assertAdmin(caller);
  const userRef = doc(db, 'users', caller.uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) throw new Error('Dokumen akaun tidak dijumpai.');
    transaction.update(userRef, {
      livesLastLostAt: null,
      lastAdRefillAt: null,
      updatedAt: serverTimestamp(),
    });
  });
}

// ---------- PREMIUM / ACCOUNT STATE --------------------------------------

/**
 * Set the caller's premium flag.
 */
export async function setPremium(
  caller: UserData,
  isPremium: boolean
): Promise<{ isPremium: boolean }> {
  assertAdmin(caller);
  if (typeof isPremium !== 'boolean') {
    throw new Error('isPremium mesti boolean.');
  }
  const userRef = doc(db, 'users', caller.uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) throw new Error('Dokumen akaun tidak dijumpai.');
    transaction.update(userRef, {
      isPremium,
      updatedAt: serverTimestamp(),
    });
  });
  return { isPremium };
}

/**
 * Set the caller's own `isAdmin` flag. Used by the panel's
 * "remove own admin access" danger-zone button — flipping it
 * back to false means the panel disappears on next render and
 * re-promotion requires the CLI. Useful for testing the gate
 * without involving another dev.
 */
export async function setOwnAdmin(
  caller: UserData,
  isAdmin: boolean
): Promise<{ isAdmin: boolean }> {
  assertAdmin(caller);
  if (typeof isAdmin !== 'boolean') {
    throw new Error('isAdmin mesti boolean.');
  }
  const userRef = doc(db, 'users', caller.uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) throw new Error('Dokumen akaun tidak dijumpai.');
    transaction.update(userRef, {
      isAdmin,
      updatedAt: serverTimestamp(),
    });
  });
  return { isAdmin };
}

/**
 * Error code thrown by `grantAdminByPassphrase` when the supplied
 * passphrase doesn't match the env-configured one. The screen
 * surfaces this via Alert ("Frasa laluan salah") without a hint
 * that distinguishes "wrong" vs "not configured" — both return
 * the same code so a probe can't enumerate which state the env
 * is in.
 */
export const BAD_PASSPHRASE = 'BAD_PASSPHRASE';

/**
 * Grant `isAdmin: true` to the *currently signed-in* Firebase user
 * by verifying the env-configured admin passphrase. This is the
 * in-app equivalent of `node scripts/admin.mjs grant-admin <uid>`
 * — meant for the solo developer who wants the self-service flow
 * without opening a terminal every time.
 *
 * No `assertAdmin()` guard — the *whole point* of this function
 * is that callers aren't admin yet. We do check:
 *   1. The env var is configured (otherwise throw — the surface
 *      shouldn't have rendered).
 *   2. The input passphrase matches (constant-time, via
 *      `verifyAdminPassphrase`).
 *   3. The caller isn't anonymous (guest accounts get wiped on
 *      uninstall, so granting them admin would be useless and
 *      also pollutes the user list).
 *   4. The user document actually exists.
 *
 * Atomic transaction so concurrent passphrase attempts can't race
 * the flip.
 */
export async function grantAdminByPassphrase(
  caller: FirebaseUser | null,
  passphrase: string
): Promise<{ isAdmin: boolean }> {
  if (!caller) {
    throw new Error('Sila log masuk (atau daftar) dulu, kemudian cuba lagi.');
  }
  if (caller.isAnonymous) {
    throw new Error(
      'Akaun tetamu tidak boleh menjadi admin. Sila daftar akaun penuh dulu.'
    );
  }
  if (!isAdminUnlockConfigured()) {
    // Should never happen if the surface calls
    // isAdminUnlockConfigured() before showing the modal — but if
    // it does, don't leak the env-var state, just refuse cleanly.
    const err = new Error('Frasa laluan admin tidak dikonfigurasikan.') as Error & {
      code: string;
    };
    err.code = BAD_PASSPHRASE;
    throw err;
  }
  if (!verifyAdminPassphrase(passphrase)) {
    const err = new Error('Frasa laluan admin salah.') as Error & { code: string };
    err.code = BAD_PASSPHRASE;
    throw err;
  }

  const userRef = doc(db, 'users', caller.uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) throw new Error('Dokumen akaun tidak dijumpai.');
    transaction.update(userRef, {
      isAdmin: true,
      updatedAt: serverTimestamp(),
    });
  });
  return { isAdmin: true };
}

// ---------- SNAPSHOT -------------------------------------------------------

/**
 * Fetch a fresh snapshot of the caller's user doc. Mirrors what
 * `getUserData` does in `authService` but with admin guard.
 * Useful for the "Refresh" button on the panel after a mutation.
 */
export async function fetchSnapshot(caller: UserData): Promise<UserData> {
  assertAdmin(caller);
  const userRef = doc(db, 'users', caller.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    throw new Error('Dokumen akaun tidak dijumpai.');
  }
  return { uid: caller.uid, ...(snap.data() as Omit<UserData, 'uid'>) };
}
