import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export interface GuestGuardResult {
  /**
   * True iff the current user is a Firebase anonymous ("Tetamu") user.
   * Use this for UI gating (disable buttons, swap icons, etc.).
   */
  isGuest: boolean;
  /**
   * Wraps an action so guest users get a friendly "Daftar / Log Masuk"
   * prompt instead of running the action. Returns `true` if the action
   * should run (caller is NOT a guest or already upgraded), `false`
   * otherwise.
   *
   * Usage:
   *   const guard = useGuestGuard();
   *   const handleUseHint = guard(() => { /* real hint logic *\/ });
   */
  guard: (action: () => void | Promise<void>, label?: string) => boolean;
}

/**
 * Hook for screens that have actions reserved for registered users
 * (token powerups, profile editing, parish change, etc.). The hook
 * exposes `isGuest` for rendering-time decisions and `guard` for
 * wrapping handlers so guest users see a clear Daftar / Log Masuk
 * prompt instead of hitting an opaque backend error.
 *
 * For anonymous users, we surface a 3-button Alert with Daftar /
 * Log Masuk / Batal so they can convert with one tap. The `Alert`
 * approach matches the rest of the codebase (`Alert.alert(err.message)`
 * already used in quiz/[level].tsx for powerup errors) and keeps
 * the surface area minimal — no new Modal component to maintain.
 */
export function useGuestGuard(): GuestGuardResult {
  const { user, userData } = useAuth();
  const router = useRouter();

  // `user.isAnonymous` is the source of truth from Firebase; `userData.isGuest`
  // mirrors it on the Firestore side. Either being true counts.
  const isGuest = user?.isAnonymous === true || userData?.isGuest === true;

  const guard = useCallback(
    (action: () => void | Promise<void>, label?: string) => {
      if (!isGuest) {
        // Non-guest — run the action directly.
        void action();
        return true;
      }
      const title = label ? `Daftar diperlukan` : 'Akaun diperlukan';
      const message = label
        ? `${label} hanya tersedia untuk pengguna berdaftar. Sila daftar atau log masuk untuk teruskan.`
        : 'Tindakan ini hanya tersedia untuk pengguna berdaftar. Sila daftar atau log masuk untuk teruskan.';
      Alert.alert(title, message, [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Daftar',
          onPress: () => router.push('/(auth)/register'),
        },
        {
          text: 'Log Masuk',
          onPress: () => router.push('/(auth)/login'),
        },
      ]);
      return false;
    },
    [isGuest, router]
  );

  return { isGuest, guard };
}

/**
 * Helper for catching `GUEST_SPEND_BLOCKED` (or any guest-shaped error)
 * from a powerup call and converting it into the same Daftar / Log Masuk
 * Alert that `useGuestGuard.guard` produces. Use this when you'd rather
 * let the service throw and translate, instead of pre-checking with
 * `guard`.
 */
export function friendlyGuestError(
  err: unknown,
  router: ReturnType<typeof useRouter>
): void {
  const code = (err as { code?: string })?.code ?? '';
  const message = (err as Error)?.message ?? '';
  if (code !== 'GUEST_SPEND_BLOCKED' && !/tetamu/i.test(message)) {
    return;
  }
  Alert.alert(
    'Daftar diperlukan',
    'Token hanya boleh digunakan oleh pengguna berdaftar. Sila daftar atau log masuk untuk menyimpan progress anda.',
    [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Daftar',
        onPress: () => router.push('/(auth)/register'),
      },
      {
        text: 'Log Masuk',
        onPress: () => router.push('/(auth)/login'),
      },
    ]
  );
}