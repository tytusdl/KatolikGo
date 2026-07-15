import { initializeApp, getApps, getApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// `getReactNativePersistence` ships in firebase's React-Native bundle but
// isn't surfaced in the generic `firebase/auth` typings (TypeScript's
// customConditions don't propagate through the barrel re-export). At
// runtime the symbol is present when bundling for `react-native` AND
// absent on `web` (Firebase web uses IndexedDB natively — there is no
// "react-native persistence" shim to install). Calling it on web throws
// `TypeError: getReactNativePersistence is not a function`, which the
// catch in the auth-init IIFE below swallows and falls back to
// `getAuth(app)` — but the symptom is a noisy red-screen-y warning on
// every web bundle and (worse) `initializeAuth` returning the wrong
// auth instance, which silently disables the `rememberMe` gate on web.
//
// We platform-gate the shim: on web, `usePersistence` is `null` and
// `initializeAuth` is skipped entirely in favour of the default
// `getAuth(app)` call (which is IndexedDB-backed on web — exactly what
// we want there). On iOS / Android the RN-shim path is preserved as
// before.
//
// Pluck via a typed accessor rather than a top-level import so the
// Metro bundle per-platform still pulls in the right
// `getReactNativePersistence` symbol when one is present.
const usePersistence: typeof AsyncStorage | null =
  Platform.OS === 'web'
    ? null
    : ((firebaseAuth as any).getReactNativePersistence as (
        storage: typeof AsyncStorage
      ) => Parameters<typeof firebaseAuth.initializeAuth>[1] extends infer D
        ? D extends { persistence?: infer P }
          ? P
          : never
        : never) != null
    ? AsyncStorage
    : null;

// ----------------------------------------------------------------------------
// Required Firebase runtime config.
//
// `process.env.EXPO_PUBLIC_*` access MUST stay static (literal string key
// per read) — Expo's bundler extracts these at build time via
// `expo/no-dynamic-env-var`. A helper that takes the key as a parameter
// (e.g. `readEnv(name)`) breaks that static analysis silently, so we read
// each var explicitly here.
//
// We validate non-empty values UP FRONT and throw with a single,
// consolidated error message listing every missing key. The previous
// fallback to empty string ('') made Firebase fail later inside its
// internal `Configuration required` code with an opaque error — fail-fast
// at module load is much easier to diagnose.
// ----------------------------------------------------------------------------

const EXPO_PUBLIC_FIREBASE_API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '';
const EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN =
  process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '';
const EXPO_PUBLIC_FIREBASE_PROJECT_ID =
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '';
const EXPO_PUBLIC_FIREBASE_APP_ID = process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '';
const EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET =
  process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '';
const EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID =
  process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '';
const EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID =
  process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '';

const REQUIRED_FIELDS: readonly {
  fieldName: keyof typeof firebaseConfig;
  envKey: string;
}[] = [
  { fieldName: 'apiKey', envKey: 'EXPO_PUBLIC_FIREBASE_API_KEY' },
  { fieldName: 'authDomain', envKey: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN' },
  { fieldName: 'projectId', envKey: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID' },
  { fieldName: 'appId', envKey: 'EXPO_PUBLIC_FIREBASE_APP_ID' },
];

const firebaseConfig = {
  apiKey: EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: EXPO_PUBLIC_FIREBASE_APP_ID,
  storageBucket: EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Fail-fast at module load: any empty required var throws with a single
// consolidated message listing all missing env var names so the dev can
// copy-paste the missing keys straight into their `.env`. Optional fields
// (storageBucket, messagingSenderId, measurementId) accept empty strings
// because Firebase tolerates them and the corresponding features
// (storage, analytics) just don't activate.
const missing = REQUIRED_FIELDS.filter(
  ({ fieldName }) =>
    typeof firebaseConfig[fieldName] !== 'string' ||
    (firebaseConfig[fieldName] as string).trim().length === 0
).map(({ envKey }) => envKey);
if (missing.length > 0) {
  throw new Error(
    `[Firebase] Missing required environment variable(s): ${missing.join(
      ', '
    )}. ` +
      `Add them to your .env file (see .env.example) and restart Expo ` +
      `with \`expo start --clear\` so the new public env vars are ` +
      `re-bundled into the JS.`
  );
}

// Guard against double initialization on fast-refresh / Hermes.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const { initializeAuth, getAuth } = firebaseAuth;

export const auth = (() => {
  // Firebase v11 requires `initializeAuth(app)` before `getAuth(app)` can
  // be used. `getAuth()` no longer auto-initializes — calling it without
  // prior `initializeAuth()` throws "Component auth has not been registered
  // yet".
  //
  // Web: Firebase Auth uses IndexedDB natively; no persistence shim.
  if (Platform.OS === 'web' || usePersistence === null) {
    return initializeAuth(app);
  }

  // iOS / Android: install the AsyncStorage-backed React Native
  // persistence shim so auth state survives cold starts.
  try {
    return initializeAuth(app, {
      persistence: (firebaseAuth as any).getReactNativePersistence(
        usePersistence
      ),
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'auth/already-initialized') {
      console.warn(
        '[Firebase] Auth already initialized — returning existing instance.',
        err
      );
      return getAuth(app);
    }
    throw err;
  }
})();

// `experimentalForceLongPolling: true` sidesteps the firebase 11.10.0
// WebChannel transport regression that drops the persistent Listen /
// Write streams on iOS simulators (produces `WebChannelConnection RPC
// 'Listen' stream 0x... transport errored. Name: undefined Message:
// undefined` warnings every few seconds and breaks `onSnapshot`).
// Long-polling uses a one-shot HTTP RPC per change instead of the
// gRPC-Web long-lived stream, which is more resilient on flaky
// simulators and corporate proxies. Trade-off: slightly more network
// chatter on cold subscribers, but real-user devices don't hit this.
// See agent memory note "Firebase 11.10.0 WebChannel transport
// regression (2026-07-14)".
const firestoreInit: Firestore = (() => {
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
  } catch {
    // `initializeFirestore` throws if Firestore was already
    // initialized on a hot-reload — fall back to the default getter
    // which returns the same singleton.
    return getFirestore(app);
  }
})();

export const db = firestoreInit;
