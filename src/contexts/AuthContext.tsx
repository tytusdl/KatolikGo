import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { type User as FirebaseUser } from 'firebase/auth';
import {
  doc,
  onSnapshot,
  type DocumentData,
  type DocumentSnapshot,
} from 'firebase/firestore';
import {
  onAuthChange,
  ensureUserDocument,
  signOut,
} from '@/services/authService';
import { markOnboarded as persistOnboarded, hasOnboarded } from '@/utils/onboarding';
import { getRememberMe } from '@/utils/rememberMe';
import { useLivesNotification } from '@/hooks/useLivesNotification';
import type { UserData } from '@/types';
import { db as firebaseDb } from '@/config/firebase';
import { requestNotificationPermission } from '@/services/notificationService';

interface AuthContextType {
  user: FirebaseUser | null;
  userData: UserData | null;
  loading: boolean;
  userDataLoading: boolean;
  onboarded: boolean;
  onboardingChecked: boolean;
  markOnboarded: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  userDataLoading: false,
  onboarded: false,
  onboardingChecked: false,
  markOnboarded: async () => {},
  refreshUserData: async () => {},
  getIdToken: async () => null,
});

function readUserFromSnapshot(
  snap: DocumentSnapshot<DocumentData>,
  uid: string
): UserData | null {
  if (!snap.exists()) return null;
  return { uid, ...(snap.data() as Omit<UserData, 'uid'>) };
}

/**
 * Returns true if a Firestore error looks like a transient offline /
 * network blip. The two codes we care about:
 *   - `unavailable` — Firestore client isn't connected (cold start
 *     before the websocket is up, or device went offline mid-session)
 *   - `internal` — sometimes thrown for socket-level network failures
 *     on iOS before the SDK maps them to `unavailable`
 *
 * For these we want to KEEP the splash up and retry, not route the
 * user to /login. Permanent errors (`permission-denied`, `not-found`
 * on a write, `unauthenticated`) still bail — those are real bugs
 * or rules rejections that retrying won't fix.
 */
function isOfflineError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  return code === 'unavailable' || code === 'internal' || code === 'deadline-exceeded';
}

/**
 * Wait for `ms` milliseconds — wrapped so callers can `await` without
 * pulling in a Promise lib. The timeout is unref'd via the cleanup
 * callback in `subscribeToUserDoc` so a sign-out during the wait
 * doesn't leave a dangling timer.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userDataLoading, setUserDataLoading] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  const userRef = useRef<FirebaseUser | null>(null);
  const unsubSnapRef = useRef<(() => void) | null>(null);
  const firstEmitSeenRef = useRef(false);

  const livesNotification = useLivesNotification();

  const tearDownSubscription = useCallback(() => {
    unsubSnapRef.current?.();
    unsubSnapRef.current = null;
    firstEmitSeenRef.current = false;
    livesNotification.reset();
  }, [livesNotification]);

  const applyNoUser = useCallback(() => {
    setUserData(null);
    setUserDataLoading(false);
    setLoading(false);
  }, []);

  const applyRememberMeFailure = useCallback(async () => {
    try {
      await signOut();
    } catch (err) {
      console.warn('[Auth] remember-me signOut failed', err);
    }
    userRef.current = null;
    setUser(null);
    setUserData(null);
    setUserDataLoading(false);
    setLoading(false);
  }, []);

  const markOnboardingComplete = useCallback(async () => {
    try {
      await persistOnboarded();
    } catch (err) {
      console.warn('[Auth] persistOnboarded failed', err);
      return;
    }
    setOnboarded(true);
  }, []);

  const subscribeToUserDoc = useCallback(
    (firebaseUser: FirebaseUser) => {
      setUserDataLoading(true);
      const userDocRef = doc(firebaseDb, 'users', firebaseUser.uid);

      /**
       * Bounded retry for transient offline errors. If the very first
       * `ensureUserDocument` call fails because the Firestore client
       * isn't connected yet (cold start, no network), retry up to 3
       * times with a short backoff. Each retry waits INSIDE this
       * function so the splash stays up and the `onSnapshot` listener
       * stays alive — when the client reconnects, the next `getDoc`
       * inside `ensureUserDocument` will succeed and we'll set the
       * state from the resolved value. This is the only sane thing to
       * do for a freshly-installed app that hasn't seen the network
       * yet at the moment `onAuthStateChanged` fires.
       */
      const ensureUserDocWithRetry = async (
        attempt = 0
      ): Promise<UserData | null> => {
        if (!userRef.current) return null;
        try {
          return await ensureUserDocument(firebaseUser);
        } catch (err) {
          if (isOfflineError(err) && attempt < 3) {
            // 800ms → 1600ms → 2400ms backoff. Each step is well
            // under the 8s splash safety net in `_layout.tsx` so the
            // user gets one full attempt cycle before AuthGate
            // gives up and routes them to /login.
            await delay(800 + attempt * 800);
            return ensureUserDocWithRetry(attempt + 1);
          }
          throw err;
        }
      };

      const unsubscribe = onSnapshot(
        userDocRef,
        async (snap) => {
          if (!userRef.current) return;

          let nextUserData = readUserFromSnapshot(snap, firebaseUser.uid);

          if (!nextUserData) {
            try {
              const created = await ensureUserDocWithRetry();
              // The retry helper returns null when the user has
              // signed out mid-retry — bail in that case and let
              // the next subscription lifecycle handle the clean
              // teardown.
              if (!userRef.current || !created) return;
              nextUserData = created;
            } catch (err) {
              // For transient offline errors, stay in the loading
              // state — the splash is still visible and the 8s safety
              // net will route to /login if we genuinely can't
              // recover. Don't null out `userData` because the user
              // IS signed in (Firebase has a valid auth session);
              // dropping them to /login with a stale auth state just
              // because the data path blipped would be worse UX.
              if (isOfflineError(err)) {
                console.warn(
                  '[Auth] ensureUserDocument offline — keeping splash up; will retry on next snapshot'
                );
                return;
              }
              console.warn('[Auth] ensureUserDocument failed', err);
              setUserData(null);
              setUserDataLoading(false);
              setLoading(false);
              return;
            }
          }

          setUserData(nextUserData);
          livesNotification.checkTransition(nextUserData, firebaseUser.isAnonymous);

          if (!firstEmitSeenRef.current) {
            firstEmitSeenRef.current = true;
            setUserDataLoading(false);
            setLoading(false);
          }
        },
        (err: Error) => {
          console.warn('[Auth] user snapshot FAILED', err?.message ?? err);
        }
      );
      unsubSnapRef.current = unsubscribe;
    },
    [livesNotification]
  );

  // Resolve onboarding flag on cold start
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const done = await hasOnboarded();
        if (!cancelled) setOnboarded(done);
      } catch {
        if (!cancelled) setOnboarded(false);
      } finally {
        if (!cancelled) setOnboardingChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refreshUserData = useCallback(async () => {
    /* no-op: onSnapshot is the source of truth */
  }, []);

  const getIdToken = useCallback(async (forceRefresh = false) => {
    const current = userRef.current;
    if (!current) return null;
    try {
      return await current.getIdToken(forceRefresh);
    } catch {
      return null;
    }
  }, []);

  // Main auth subscription
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const unsubAuth = onAuthChange(async (firebaseUser) => {
      if (cancelled) return;
      tearDownSubscription();
      userRef.current = firebaseUser;
      setUser(firebaseUser);

      if (!firebaseUser) {
        applyNoUser();
        return;
      }

      const remember = await getRememberMe();
      if (cancelled) return;
      if (!remember) {
        await applyRememberMeFailure();
        return;
      }

      void markOnboardingComplete().catch(() => {});
      subscribeToUserDoc(firebaseUser);
    });

    return () => {
      cancelled = true;
      tearDownSubscription();
      unsubAuth();
    };
  }, [
    applyNoUser,
    applyRememberMeFailure,
    markOnboardingComplete,
    subscribeToUserDoc,
    tearDownSubscription,
  ]);

  // Request notification permission on mount
  useEffect(() => {
    void requestNotificationPermission().catch(() => {});
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      userData,
      loading,
      userDataLoading,
      onboarded,
      onboardingChecked,
      markOnboarded: markOnboardingComplete,
      refreshUserData,
      getIdToken,
    }),
    [
      user,
      userData,
      loading,
      userDataLoading,
      onboarded,
      onboardingChecked,
      markOnboardingComplete,
      refreshUserData,
      getIdToken,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
