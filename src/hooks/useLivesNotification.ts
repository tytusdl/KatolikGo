import { useCallback, useMemo, useRef } from 'react';
import type { UserData } from '@/types';
import { LIVES_CONFIG } from '@/constants/xp.constants';
import { notifyLivesFull } from '@/services/notificationService';

interface LivesNotificationApi {
  reset: () => void;
  checkTransition: (userData: UserData, isAnonymous: boolean) => void;
}

export function useLivesNotification(): LivesNotificationApi {
  const prevLivesRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    prevLivesRef.current = null;
  }, []);

  const checkTransition = useCallback(
    (userData: UserData, isAnonymous: boolean) => {
      const rawLives = userData.lives;
      if (typeof rawLives !== 'number' || !Number.isFinite(rawLives)) return;

      if (isAnonymous) {
        prevLivesRef.current = rawLives;
        return;
      }

      const prevLives = prevLivesRef.current;
      prevLivesRef.current = rawLives;

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

  return useMemo(() => ({ reset, checkTransition }), [reset, checkTransition]);
}
