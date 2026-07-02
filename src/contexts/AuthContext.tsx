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
import { markOnboarded } from '@/utils/onboarding';
import type { UserData } from '@/types';

interface AuthContextType {
  user: FirebaseUser | null;
  userData: UserData | null;
  /** True while the very first auth event is being resolved on cold start. */
  loading: boolean;
  /** True while userData is being (re)fetched after a sign-in / explicit refresh. */
  userDataLoading: boolean;
  refreshUserData: () => Promise<void>;
  /** Fetches the current Firebase ID token (auto-refreshed by SDK). */
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  userDataLoading: false,
  refreshUserData: async () => {},
  getIdToken: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userDataLoading, setUserDataLoading] = useState(false);

  // Mirror the latest user in a ref so async callbacks (and refreshUserData)
  // always see fresh data without being held hostage to React's stale-closure
  // behaviour.
  const userRef = useRef<FirebaseUser | null>(null);

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
        // Idempotent and tolerant of storage failures.
        void markOnboarded();

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
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      userData,
      loading,
      userDataLoading,
      refreshUserData,
      getIdToken,
    }),
    [user, userData, loading, userDataLoading, refreshUserData, getIdToken]
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
