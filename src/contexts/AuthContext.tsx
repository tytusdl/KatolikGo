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
  onAuthChange,
  getUserData,
  ensureUserDocument,
} from '@/services/authService';
import {
  markOnboarded as persistOnboarded,
  hasOnboarded,
} from '@/utils/onboarding';
import type { UserData } from '@/types';

interface AuthContextType {
  user: FirebaseUser | null;
  userData: UserData | null;
  /** True while the very first auth event is being resolved on cold start. */
  loading: boolean;
  /** True while userData is being (re)fetched after a sign-in / explicit refresh. */
  userDataLoading: boolean;
  /**
   * True if the user has finished the onboarding flow at any point in this
   * install (in-memory). Stays in sync with AsyncStorage via
   * `markOnboarded()` — every successful auth event and every last-slide
   * tap on `/onboarding` flips this to `true` synchronously after the
   * storage write resolves, so a hot logout can't loop the user back into
   * the intro slides.
   */
  onboarded: boolean;
  /** True while hasOnboarded() is resolving on cold start. */
  onboardingChecked: boolean;
  /**
   * Persist the onboarded flag (AsyncStorage) and flip the in-memory
   * `onboarded` to `true`. Idempotent — safe to call repeatedly.
   */
  markOnboarded: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  /** Fetches the current Firebase ID token (auto-refreshed by SDK). */
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userDataLoading, setUserDataLoading] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Mirror the latest user in a ref so async callbacks (and refreshUserData)
  // always see fresh data without being held hostage to React's stale-closure
  // behaviour.
  const userRef = useRef<FirebaseUser | null>(null);

  // Resolve the onboarding flag exactly once on cold start. We keep the
  // value both in AsyncStorage (so it survives app restarts) AND in React
  // state (so AuthGate doesn't loop the user back into the intro slides on
  // a hot logout).
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
    return () => {
      cancelled = true;
    };
  }, []);

  // Single entry point that mirrors `markOnboarded` in `utils/onboarding.ts`
  // but also synchronously flips the in-memory flag. AuthGate reads
  // `onboarded` from context, so updating here immediately changes routing.
  const markOnboardedAction = useCallback(async () => {
    await persistOnboarded();
    setOnboarded(true);
  }, []);

  const refreshUserData = useCallback(async () => {
    const current = userRef.current;
    if (!current) {
      setUserData(null);
      return;
    }
    setUserDataLoading(true);
    try {
      let data = await getUserData(current.uid);
      if (!data) {
        data = await ensureUserDocument(current);
      }
      setUserData(data);
    } catch (err) {
      console.warn('[Auth] failed to load user data', err);
      setUserData(null);
    } finally {
      setUserDataLoading(false);
    }
  }, []);

  const getIdToken = useCallback(async (forceRefresh = false) => {
    const current = userRef.current;
    if (!current) return null;
    try {
      return await current.getIdToken(forceRefresh);
    } catch (err) {
      console.warn('[Auth] getIdToken failed', err);
      return null;
    }
  }, []);

  // Subscribe exactly once, with proper synchronous cleanup so we don't
  // leak listeners on hot-reload / StrictMode / unmount.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const unsub = onAuthChange(async (firebaseUser) => {
      if (cancelled) return;
      userRef.current = firebaseUser;
      setUser(firebaseUser);

      if (firebaseUser) {
        // Any time a user is authenticated — fresh sign-in, re-login, or
        // persisted session restored on cold start — make sure the onboarding
        // flag is set so AuthGate won't loop them back to the intro slides.
        // Goes through the context action so the in-memory `onboarded`
        // state stays in sync with AsyncStorage.
        void markOnboardedAction();

        setUserDataLoading(true);
        try {
          let data = await getUserData(firebaseUser.uid);
          if (!data) data = await ensureUserDocument(firebaseUser);
          if (cancelled) return;
          setUserData(data);
        } catch (err) {
          console.warn('[Auth] failed to load user data', err);
          if (!cancelled) setUserData(null);
        } finally {
          if (cancelled) return;
          setUserDataLoading(false);
          setLoading(false);
        }
      } else {
        setUserData(null);
        setUserDataLoading(false);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [markOnboardedAction]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      userData,
      loading,
      userDataLoading,
      onboarded,
      onboardingChecked,
      markOnboarded: markOnboardedAction,
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
      markOnboardedAction,
      refreshUserData,
      getIdToken,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
