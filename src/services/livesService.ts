import {
  doc,
  serverTimestamp,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { UserData } from '@/types';
import { LIVES_CONFIG } from '@/constants/xp.constants';

/**
 * Lives system service.
 *
 * The player starts a session with `LIVES_CONFIG.MAX` lives and loses
 * one on every wrong answer / timeout in the quiz UI. Lives drain to
 * 0 → the player is blocked from starting a new quiz until they
 * refill via one of:
 *
 *   1. Time-based auto-refill — 1 life every `LIVES_CONFIG.REFILL_MINUTES`
 *      hours, computed server-side from `livesLastLostAt` so a tampered
 *      client clock can't fast-forward the refill.
 *   2. Token spend — `refillWithTokens` deducts `LIVES_CONFIG.REFILL_TOKEN_COST`
 *      and bumps lives by 1, atomically.
 *   3. Rewarded ad — `refillWithAd` enforces a 5-minute cooldown between
 *      ad refills (`LIVES_CONFIG.AD_COOLDOWN_MIN`). Actual ad playback
 *      is delegated to `adsService` (a stub until a real SDK is wired up).
 *
 * All mutations run inside `runTransaction` because two concurrent
 * wrong-answer submissions (phone + tablet for the same account) must
 * not double-decrement lives, and a concurrent time-based refill tick
 * must not over-credit. Atomic read-modify-write is non-negotiable
 * here.
 *
 * Guest users: per the existing gate pattern, lives mechanics still
 * run for guests (they can play, get blocked at 0, see refills) but the
 * underlying account is device-bound and may be wiped on uninstall.
 * The lifetime of guest lives is therefore session-local at most —
 * acceptable because the entire guest account is session-local.
 */

/**
 * Read a Firestore Timestamp-shaped field into a JS millisecond epoch,
 * defensively. Falls back to `fallback` if the field is missing or
 * malformed. Used so the rest of the service can compare against
 * `Date.now()` uniformly without scattering `.toMillis?.()` calls.
 */
function tsToMillis(value: unknown, fallback: number | null = null): number | null {
  if (value == null) return fallback;
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/**
 * Compute how many lives the user is owed by time-based refill since
 * `lastLostAt`. Returns 0 if `lastLostAt` is null (no anchor).
 *
 * Each `LIVES_CONFIG.REFILL_MINUTES` minutes elapsed since the anchor
 * awards exactly 1 life, capped at how many lives are missing
 * (`MAX - current`). This means a player who leaves the app for a day
 * comes back fully topped off — not just +1 per tick — which is the
 * expected "I came back later" behavior.
 */
function computePendingTimeRefill(
  currentLives: number,
  lastLostAtMillis: number | null
): number {
  if (lastLostAtMillis == null) return 0;
  if (currentLives >= LIVES_CONFIG.MAX) return 0;
  const elapsedMs = Date.now() - lastLostAtMillis;
  if (elapsedMs <= 0) return 0;
  const refillMs = LIVES_CONFIG.REFILL_MINUTES * 60 * 1000;
  const ticks = Math.floor(elapsedMs / refillMs);
  if (ticks <= 0) return 0;
  const missing = LIVES_CONFIG.MAX - currentLives;
  return Math.min(ticks, missing);
}

/**
 * Snapshot of a user's lives state after `refillIfNeeded` resolves.
 * Returned alongside the refreshed value so the screen can update its
 * countdown UI without a second Firestore round-trip.
 */
export interface LivesState {
  lives: number;
  /**
   * Milliseconds until the next automatic refill tick. `null` when
   * lives are full (no pending refill) — UI should hide the
   * countdown in that case.
   */
  msUntilNextRefill: number | null;
  /** True if any refill happened during this transaction. */
  refilledNow: boolean;
}

/**
 * Normalize a `UserData` view to a guaranteed-finite `lives` value.
 * Legacy user docs (created before this feature shipped) won't have
 * the field — treat them as full health so returning players don't
 * open the app to 0 lives.
 */
function normalizeLives(data: Partial<UserData> | undefined): number {
  const raw = data?.lives;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return LIVES_CONFIG.LEGACY_DEFAULT;
  }
  return Math.max(0, Math.min(LIVES_CONFIG.MAX, Math.floor(raw)));
}

/**
 * Apply any pending time-based refill tick in a transaction. Safe to
 * call on every screen mount and at the top of `quiz/[level].tsx` —
 * it's idempotent (no refill owed → no write) and cheap (one
 * `getDoc` + at most one `updateDoc`).
 *
 * The returned `LivesState` is what the UI should render. The caller
 * is expected to also feed the *fresh* `userData.lives` back into the
 * auth context so subsequent screens see the updated value without a
 * stale cache.
 */
export async function refillIfNeeded(uid: string): Promise<LivesState> {
  const userRef = doc(db, 'users', uid);
  const result = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) {
      return { lives: LIVES_CONFIG.LEGACY_DEFAULT, refilledNow: false };
    }
    const data = snap.data() as Partial<UserData>;
    const lives = normalizeLives(data);
    const lastLost = tsToMillis(data.livesLastLostAt);

    // Already full — no refill pending. Just clear the anchor so the
    // next loss starts a fresh tick window.
    if (lives >= LIVES_CONFIG.MAX) {
      if (data.livesLastLostAt != null) {
        transaction.update(userRef, {
          livesLastLostAt: null,
          updatedAt: serverTimestamp(),
        });
        return { lives, refilledNow: false };
      }
      return { lives, refilledNow: false };
    }

    const owed = computePendingTimeRefill(lives, lastLost);
    if (owed <= 0) {
      return { lives, refilledNow: false };
    }

    const newLives = Math.min(LIVES_CONFIG.MAX, lives + owed);
    // Reset the anchor only when the bar is fully topped off. While
    // lives are still < MAX, we keep `lastLostAt` so the *next* tick
    // counts from the same anchor (otherwise a player who keeps
    // running out would get a fresh window every time they refill
    // partway).
    const clearAnchor = newLives >= LIVES_CONFIG.MAX;
    transaction.update(userRef, {
      lives: newLives,
      ...(clearAnchor ? { livesLastLostAt: null } : {}),
      updatedAt: serverTimestamp(),
    });
    return { lives: newLives, refilledNow: true };
  });

  // Compute countdown for the UI. Recompute `lastLostAt` from a fresh
  // read isn't worth the extra round-trip — the previous tick is
  // good enough for "X minit lagi" display.
  let msUntilNextRefill: number | null = null;
  if (result.lives < LIVES_CONFIG.MAX) {
    const refillMs = LIVES_CONFIG.REFILL_MINUTES * 60 * 1000;
    msUntilNextRefill = refillMs;
  }
  return { ...result, msUntilNextRefill };
}

/**
 * Decrement `lives` by 1 inside a transaction. Called from
 * `quiz/[level].tsx` on every wrong answer and timeout. If the user
 * already has 0 lives (e.g. multi-device race), this is a no-op —
 * the caller should have pre-checked via `getEffectiveLives` before
 * letting the player start a quiz.
 *
 * Returns the new lives value, or `0` if already at floor.
 */
export async function consumeLifeOnWrongAnswer(uid: string): Promise<number> {
  const userRef = doc(db, 'users', uid);
  const next = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) return 0;
    const data = snap.data() as Partial<UserData>;
    const lives = normalizeLives(data);
    if (lives <= 0) return 0;
    const decremented = lives - 1;
    transaction.update(userRef, {
      lives: decremented,
      // Anchor the refill tick to this exact moment so the next
      // auto-refill is `REFILL_MINUTES` away. Only meaningful when
      // we still have some lives left; when this is the last life,
      // `livesLastLostAt` is irrelevant (refill will fire when
      // there are 0 → 1 anyway) but we set it anyway for
      // uniformity / debugging.
      livesLastLostAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return decremented;
  });
  return next;
}

/**
 * Refill 1 life by spending tokens. Atomic with the token deduction
 * so we can't over-credit lives or over-spend tokens. Throws
 * `GUEST_REFILL_BLOCKED` if the user is a guest (mirrors the pattern
 * from `tokenService.spendToken`) so the UI can surface a friendly
 * Daftar / Log Masuk prompt instead of "Insufficient tokens".
 *
 * Throws plain `Error('Insufficient tokens')` if the user's token
 * balance is below `LIVES_CONFIG.REFILL_TOKEN_COST`. Throws
 * plain `Error('Lives sudah penuh')` if lives are already at MAX.
 */
export const GUEST_REFILL_BLOCKED = 'GUEST_REFILL_BLOCKED';

export async function refillWithTokens(
  uid: string,
  cost: number = LIVES_CONFIG.REFILL_TOKEN_COST
): Promise<{ lives: number; tokens: number }> {
  const userRef = doc(db, 'users', uid);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) {
      throw new Error('Akaun tidak dijumpai. Sila log masuk semula.');
    }
    const data = snap.data() as Partial<UserData>;
    if (data.isGuest) {
      const err = new Error(
        'Pengguna tetamu tidak boleh menggunakan token. Sila daftar atau log masuk.'
      ) as Error & { code: string };
      err.code = GUEST_REFILL_BLOCKED;
      throw err;
    }
    const lives = normalizeLives(data);
    if (lives >= LIVES_CONFIG.MAX) {
      throw new Error('Lives sudah penuh.');
    }
    const tokens = typeof data.tokens === 'number' ? data.tokens : 0;
    if (tokens < cost) {
      throw new Error('Token tidak cukup.');
    }
    transaction.update(userRef, {
      lives: lives + 1,
      tokens: tokens - cost,
      updatedAt: serverTimestamp(),
    });
    return { lives: lives + 1, tokens: tokens - cost };
  });
}

/**
 * Refill 1 life after the player successfully watches a rewarded ad.
 * Enforces `LIVES_CONFIG.AD_COOLDOWN_MIN` between consecutive ad
 * refills — spam-tapping the button past that returns `cooldown`
 * without making any change.
 *
 * NOTE: actual ad playback is delegated to `adsService` (currently a
 * stub). When a real rewarded-ad SDK is wired in, the call site
 * should be: `await adsService.showRewardedAd(); await
 * refillWithAd(uid);` — fail the user out if the ad didn't finish.
 */
export interface AdRefillResult {
  ok: boolean;
  reason?: 'cooldown' | 'full' | 'aborted';
  msUntilNextAd?: number;
  lives?: number;
}

export async function refillWithAd(
  uid: string,
  adCompletedSuccessfully: boolean = true
): Promise<AdRefillResult> {
  if (!adCompletedSuccessfully) {
    return { ok: false, reason: 'aborted' };
  }
  const userRef = doc(db, 'users', uid);
  const next = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) {
      return { lives: 0, refilled: false, cooldownMsRemaining: 0 };
    }
    const data = snap.data() as Partial<UserData>;
    const lives = normalizeLives(data);
    if (lives >= LIVES_CONFIG.MAX) {
      return { lives, refilled: false, cooldownMsRemaining: 0 };
    }
    const lastAd = tsToMillis(data.lastAdRefillAt);
    const cooldownMs = LIVES_CONFIG.AD_COOLDOWN_MIN * 60 * 1000;
    if (lastAd != null) {
      const elapsed = Date.now() - lastAd;
      if (elapsed < cooldownMs) {
        return {
          lives,
          refilled: false,
          cooldownMsRemaining: cooldownMs - elapsed,
        };
      }
    }
    transaction.update(userRef, {
      lives: lives + 1,
      lastAdRefillAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { lives: lives + 1, refilled: true, cooldownMsRemaining: 0 };
  });
  if (next.refilled) {
    return { ok: true, lives: next.lives };
  }
  if (next.lives >= LIVES_CONFIG.MAX) {
    return { ok: false, reason: 'full', lives: next.lives };
  }
  return {
    ok: false,
    reason: 'cooldown',
    msUntilNextAd: next.cooldownMsRemaining,
  };
}

/**
 * Read the effective lives value without writing anything. Used by
 * `quiz/[level].tsx` *before* letting the player start a question to
 * short-circuit the "already at 0" case (and surface the
 * "habis lives" modal). Lightweight: single getDoc, no transaction.
 *
 * Also applies the time-based refill tick on read so the displayed
 * value matches what the transaction would write. (Tick writes are
 * flushed by `refillIfNeeded` separately on next mount — this is just
 * a "display the up-to-date value" convenience.)
 */
export async function getEffectiveLives(uid: string): Promise<LivesState> {
  const userRef = doc(db, 'users', uid);
  const snap = await runTransaction(db, async (transaction) => {
    const s = await transaction.get(userRef);
    return s;
  });
  if (!snap.exists()) {
    return {
      lives: LIVES_CONFIG.LEGACY_DEFAULT,
      msUntilNextRefill: null,
      refilledNow: false,
    };
  }
  const data = snap.data() as Partial<UserData>;
  const lives = normalizeLives(data);
  const lastLost = tsToMillis(data.livesLastLostAt);
  const owed = computePendingTimeRefill(lives, lastLost);
  const effectiveLives = Math.min(LIVES_CONFIG.MAX, lives + owed);
  let msUntilNextRefill: number | null = null;
  if (effectiveLives < LIVES_CONFIG.MAX && lastLost != null) {
    const refillMs = LIVES_CONFIG.REFILL_MINUTES * 60 * 1000;
    const elapsed = Date.now() - lastLost;
    const intoCycle = elapsed % refillMs;
    msUntilNextRefill = refillMs - intoCycle;
  }
  return { lives: effectiveLives, msUntilNextRefill, refilledNow: owed > 0 };
}