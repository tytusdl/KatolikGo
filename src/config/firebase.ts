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
  apiKey: 'AIzaSyCzq0iMJZUGjLrSGEnou66f7AA8jsBu2Jw',
  authDomain: 'katolikgo-mobile.firebaseapp.com',
  projectId: 'katolikgo-mobile',
  storageBucket: 'katolikgo-mobile.firebasestorage.app',
  messagingSenderId: '615054372997',
  appId: '1:615054372997:web:8ab4a440df706977f779ec',
  measurementId: 'G-2F43XDJRQV',
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
