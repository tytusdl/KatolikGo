import { initializeApp, getApps, getApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// `getReactNativePersistence` ships in firebase's React-Native bundle but
// isn't surfaced in the generic `firebase/auth` typings (TypeScript's
// customConditions don't propagate through the barrel re-export). At
// runtime the symbol is present when bundling for `react-native`, so we
// pluck it off the runtime module via a typed accessor.
const getReactNativePersistence = (firebaseAuth as any)
  .getReactNativePersistence as (
  storage: typeof AsyncStorage
) => Parameters<typeof firebaseAuth.initializeAuth>[1] extends infer D
  ? D extends { persistence?: infer P }
    ? P
    : never
  : never;

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
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (err) {
    // Auth may already be initialized on fast-refresh / re-import. Use
    // console.warn (not console.error) so we don't trigger red-screen
    // overlays in dev — the fallback below returns the existing
    // instance, so the app continues to function. Production telemetry
    // can monitor this warn frequency to spot misconfigured
    // environments.
    console.warn(
      '[Firebase] initializeAuth failed — falling back to getAuth(). ' +
        'This usually means Auth was already initialized (e.g. fast ' +
        'refresh / hot reload).',
      err
    );
    return getAuth(app);
  }
})();

export const db = getFirestore(app);
