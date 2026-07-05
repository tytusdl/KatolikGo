import { useCallback, useRef } from 'react';
import type { UserData } from '@/types';
import { LIVES_CONFIG } from '@/constants/xp.constants';
import { notifyLivesFull } from '@/services/notificationService';

interface LivesNotificationApi {
  /**
   * Reset the previous-lives tracker. Call this whenever the auth
   * identity changes (sign-out + sign-in as a different user, or a
   * fresh sign-in) so the new account doesn't inherit the prior
   * account's transition state and fire a phantom lives-full
   * notification on its first snapshot emission.
   */
  reset: () => void;
  /**
   * Inspect a fresh `userData` snapshot and fire `notifyLivesFull`
   * if the `lives` field transitioned from below `MAX` to at-or-above
   * `MAX`. Guest (anonymous) accounts are skipped — the notif is
   * wasted noise on throwaway device-bound accounts. The prev
   * tracker is still seeded for them so a future
   * `linkWithCredential` (upgrade-then-merge) starts from a known
   * baseline.
   *
   * Caller responsibilities:
   *   - Invoke once per emission of the userDoc snapshot, even for
   *     guest accounts — they need the prev-tracker seeded.
   *   - Call `reset()` BEFORE handing control back to the snapshot
   *     subscription whenever the auth identity changes, otherwise
   *     the first emission of the new user might be misinterpreted.
   */
  checkTransition: (userData: UserData, isAnonymous: boolean) => void;
}

/**
 * Custom hook that owns the "lives-full" notification state machine.
 *
 * Lives are the most-frequently-mutated counter on `users/{uid}` —
 * time-based refill (every 20 min), token spend, rewarded ad, admin
 * panel adjustments all bump it. We want exactly ONE local
 * notification when the bar tops off, regardless of which path got
 * it there. Translating the raw emissions into a `prev → next`
 * transition detector doesn't fit naturally inline in
 * `AuthContext` (which already has its own complexity budget), so
 * it's parked here.
 *
 * Trade-off: the hook is called from `AuthContext`'s single
 * `onSnapshot`, not from a second subscription. So if
 * `AuthContext`'s listener is briefly disconnected (rare — only
 * during auth flip teardown), a notif might be missed. The notif
 * itself is best-effort telemetry (per AGENTS.md "Lives system"),
 * so missing one across an auth flip is acceptable.
 */
export function useLivesNotification(): LivesNotificationApi {
  // `null` = "haven't seen the first emission yet — seed only,
  // don't notify". Reset by callers on auth identity change via
  // `reset()`.
  const prevLivesRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    prevLivesRef.current = null;
  }, []);

  const checkTransition = useCallback(
    (userData: UserData, isAnonymous: boolean) => {
      // Defensive against malformed / mid-write / missing values.
      // Partial state from an in-flight write would otherwise fire a
      // bogus notification. A bogus notif is wasted battery + UX
      // noise; a MISSED notif is just a missed nudge.
      const rawLives = userData.lives;
      if (typeof rawLives !== 'number' || !Number.isFinite(rawLives)) {
        return;
      }

      if (isAnonymous) {
        // Seed the tracker without firing. Future
        // `linkWithCredential` (register-on-guest-account merge)
        // would attach the notif pathway once the snapshot
        // flips from anonymous to registered. Until then, keep
        // silent.
        prevLivesRef.current = rawLives;
        return;
      }

      const prevLives = prevLivesRef.current;
      prevLivesRef.current = rawLives;

      // Skip the initial seed emission: prev is `null` here so the
      // `prevLives !== null` guard filters it. Every subsequent
      // emission actually compares.
      if (
        prevLives !== null &&
        prevLives < LIVES_CONFIG.MAX &&
        rawLives >= LIVES_CONFIG.MAX
      ) {
        void notifyLivesFull();
      }
    },
    []
  );

  return { reset, checkTransition };
}
