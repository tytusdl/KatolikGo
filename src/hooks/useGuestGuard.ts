import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Routes } from '@/constants/routes';

export interface GuestGuardResult {
  isGuest: boolean;
  guard: (action: () => void | Promise<void>, label?: string) => boolean;
}

export function useGuestGuard(): GuestGuardResult {
  const { user, userData } = useAuth();
  const router = useRouter();

  const isGuest = user?.isAnonymous === true || userData?.isGuest === true;

  const guard = useCallback(
    (action: () => void | Promise<void>, label?: string) => {
      if (!isGuest) {
        void action();
        return true;
      }
      Alert.alert(
        'Daftar diperlukan',
        label
          ? `${label} hanya tersedia untuk pengguna berdaftar. Sila daftar atau log masuk.`
          : 'Tindakan ini hanya tersedia untuk pengguna berdaftar.',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Daftar', onPress: () => router.push(Routes.REGISTER) },
          { text: 'Log Masuk', onPress: () => router.push(Routes.LOGIN) },
        ]
      );
      return false;
    },
    [isGuest, router]
  );

  return useMemo(() => ({ isGuest, guard }), [isGuest, guard]);
}

export function friendlyGuestError(
  err: unknown,
  router: ReturnType<typeof useRouter>
): void {
  const code = (err as { code?: string })?.code ?? '';
  const message = (err as Error)?.message ?? '';
  if (code !== 'GUEST_SPEND_BLOCKED' && !/tetamu/i.test(message)) return;
  Alert.alert(
    'Daftar diperlukan',
    'Token hanya boleh digunakan oleh pengguna berdaftar.',
    [
      { text: 'Batal', style: 'cancel' },
      { text: 'Daftar', onPress: () => router.push(Routes.REGISTER) },
      { text: 'Log Masuk', onPress: () => router.push(Routes.LOGIN) },
    ]
  );
}
