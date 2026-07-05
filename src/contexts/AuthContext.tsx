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
import {
  markOnboarded as persistOnboarded,
  hasOnboarded,
} from '@/utils/onboarding';
import { getRememberMe } from '@/utils/rememberMe';
import { useLivesNotification } from '@/hooks/useLivesNotification';
import type { UserData } from '@/types';
import { db as firebaseDb } from '@/config/firebase';
import { requestNotificationPermission } from '@/services/notificationService';

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
  /**
   * No-op retained for backward-compatible call-sites (`admin/index.tsx`,
   * `profile.tsx`). With the onSnapshot source-of-truth pattern the
   * listener pushes every write from this client (and any other session
   * on the same doc) automatically, so an explicit refresh is no
   * longer meaningful. Kept in the API so call-sites don't need
   * refactoring.
   */
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

function readUserFromSnapshot(
  snap: DocumentSnapshot<DocumentData>,
  uid: string
): UserData | null {
  if (!snap.exists()) return null;
  return { uid, ...(snap.data() as Omit<UserData, 'uid'>) };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userDataLoading, setUserDataLoading] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Mirror the latest user in a ref so async callbacks always see
  // fresh data without being held hostage to React's stale-closure
  // behaviour.
  const userRef = useRef<FirebaseUser | null>(null);

  // Reusable cleanup for the active userDoc subscription. Stash
  // here so each phase can tear down before the next one starts.
  const unsubSnapRef = useRef<(() => void) | null>(null);
  const firstEmitSeenRef = useRef<boolean>(false);

  // Lives-transition detector (registered users only). See
  // `useLivesNotification` for state machine details.
  const livesNotification = useLivesNotification();

  // ---------------------------------------------------------------------------
  // Auth + userDoc subscription — split into named phases.
  //
  // The big `useEffect` below drives the lifecycle, but it delegates to
  // five short helpers so each phase reads independently:
  //
  //   `tearDownSubscription()`    — clear prior snapshot + lives tracker
  //   `applyNoUser()`             — handle `firebaseUser === null`
  //   `applyRememberMeFailure()`  — handle !remember after gate
  //   `subscribeToUserDoc(user)`  — set up the onSnapshot driver
  //   `markOnboardingComplete()`  — kick markOnboarded with .catch guard
  //
  // All five close over local refs / state so the call-site stays
  // readable. Keeping them inside the provider body (not extracted to
  // module scope) is necessary so they can call `setUserData` etc.
  // directly without a context prop.
  // ---------------------------------------------------------------------------

  /** Tear down the prior userDoc snapshot (if any) and reset the lives
   *  tracker so the next account starts from a clean baseline. */
  const tearDownSubscription = useCallback(() => {
    if (unsubSnapRef.current) {
      unsubSnapRef.current();
      unsubSnapRef.current = null;
    }
    firstEmitSeenRef.current = false;
    livesNotification.reset();
  }, [livesNotification]);

  /** Handle the `firebaseUser === null` branch (signed out).
   *  Clears userData + loading flags so AuthGate routes to /login. */
  const applyNoUser = useCallback(() => {
    setUserData(null);
    setUserDataLoading(false);
    setLoading(false);
  }, []);

  /** Handle the remember-me gate failure path. Signs the restored
   *  session out and re-runs the null-branch so the next listener
   *  invocation sees `user = null`. */
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

  /** Best-effort AsyncStorage write of the onboarded flag.
   *  `.catch(console.warn)` pins a storage-write failure to a warn
   *  instead of letting an unhandled promise rejection surface. */
  const markOnboardingComplete = useCallback(async () => {
    try {
      await persistOnboarded();
    } catch (err) {
      console.warn('[Auth] persistOnboarded failed', err);
      return; // don't flip in-memory flag if storage write failed
    }
    setOnboarded(true);
  }, []);

  /** Set up the single `onSnapshot(userDocRef, cb)` that drives both
   *  `userData` state and the lives-full notification. Returns the
   *  unsubscribe function (stashed in `unsubSnapRef` so the teardown
   *  phase can reach it). */
  const subscribeToUserDoc = useCallback(
    (firebaseUser: FirebaseUser) => {
      setUserDataLoading(true);
      const userDocRef = doc(firebaseDb, 'users', firebaseUser.uid);
      const unsubscribe = onSnapshot(
        userDocRef,
        async (snap) => {
          if (!userRef.current) return; // raced with sign-out

          let nextUserData = readUserFromSnapshot(snap, firebaseUser.uid);

          // Doc missing — can happen if a Firestore write was rolled
          // back, the user doc was deleted by admin tooling, or a
          // cold-start race found a registered user with no doc yet.
          // Lazy-create via `ensureUserDocument` (mirrors the
          // previous one-shot getDoc fallback path).
          if (!nextUserData) {
            try {
              const created = await ensureUserDocument(firebaseUser);
              if (!userRef.current) return;
              nextUserData = created;
            } catch (err) {
              console.warn('[Auth] ensureUserDocument failed', err);
              setUserData(null);
              setUserDataLoading(false);
              setLoading(false);
              return;
            }
          }

          setUserData(nextUserData);

          // Drive the lives-transition detector with the freshly
          // fetched snapshot. The hook still seeds its prev-tracker
          // for guest accounts (suppresses the notify) so future
          // `linkWithCredential` upgrades start from a known baseline.
          livesNotification.checkTransition(
            nextUserData,
            firebaseUser.isAnonymous
          );

          // First emission unblocks AuthGate. Subsequent emissions
          // don't need to toggle the loading flags — by the time we
          // get here, the gate has already routed.
          if (!firstEmitSeenRef.current) {
            firstEmitSeenRef.current = true;
            setUserDataLoading(false);
            setLoading(false);
          }
        },
        (err: Error) => {
          // Snapshot errors (permission, offline). Log and let the
          // next valid emission recover. The notification we already
          // missed is the worst case and not user-visible (lives
          // full is best-effort telemetry per AGENTS.md "Lives
          // system"). Don't touch `loading` here — a transient
          // network blip shouldn't trap the user on splash; the 8s
          // safety net in `_layout.tsx` covers that.
          console.warn('[Auth] user snapshot failed', err);
        }
      );
      unsubSnapRef.current = unsubscribe;
    },
    [livesNotification]
  );

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

  // Kept in the API for backward-compatible call-sites. See `AuthContextType`
  // docstring — onSnapshot pushes every write automatically, so a manual
  // refresh is no longer meaningful.
  const refreshUserData = useCallback(async () => {
    /* no-op: onSnapshot is the source of truth */
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

  // ---------------------------------------------------------------------------
  // Auth subscription — orchestrates the phases above.
  //
  // Each auth event runs through the same five-step pipeline:
  //   1. tearDownSubscription (clear any prior snapshot)
  //   2. setUser (always)
  //   3. null-branch shortcut OR remember-me gate OR snapshot setup
  //   4. markOnboardingComplete (fire-and-forget)
  //   5. subscribeToUserDoc (if registered path)
  //
  // Cancellation guards every async step so a fast auth flip during a
  // session doesn't leave state half-applied.
  // ---------------------------------------------------------------------------
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

      // Remember-me gate. If the user opted out on their last
      // sign-in, sign the restored session out BEFORE we set up
      // any snapshot — we want AuthGate to see `user = null` and
      // route to /login instead of flashing /home with a
      // soon-to-die session.
      const remember = await getRememberMe();
      if (cancelled) return;
      if (!remember) {
        await applyRememberMeFailure();
        return;
      }

      // Any time a user is authenticated — fresh sign-in, re-login,
      // or persisted session restored on cold start — make sure the
      // onboarding flag is set so AuthGate won't loop them back to
      // the intro slides. `.catch(console.warn)` pins a write
      // failure to a warn instead of an unhandled rejection.
      void markOnboardingComplete().catch((err) => {
        console.warn('[Auth] markOnboardingComplete failed', err);
      });

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

  // Ask for notification permission once on mount. No-op if the user
  // already denied or the platform doesn't support notifs. We don't
  // gate UI on this — if denied, the rest of the app works as before
  // and notis simply don't fire. The `.catch(...)` pins any internal
  // permission-prompt failure to a warn instead of an unhandled
  // rejection.
  useEffect(() => {
    void requestNotificationPermission().catch((err) => {
      console.warn('[Auth] requestNotificationPermission failed', err);
    });
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
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
