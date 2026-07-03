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

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '',
};

// Guard against double initialization on fast-refresh / Hermes.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const { initializeAuth, getAuth } = firebaseAuth;

export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

export const db = getFirestore(app);
