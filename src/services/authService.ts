import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import type { UserData } from '@/types';

/**
 * Default skeleton for a brand-new user document.
 * Centralised so every sign-in path (email/password, Google, Facebook,
 * Apple, guest/anonymous) writes the same initial shape — adding a new
 * field means one edit.
 *
 * `isGuest` is auto-derived from `firebaseUser.isAnonymous` so the
 * loginAsGuest path doesn't have to remember to set it. Email/password,
 * Google, Facebook, and Apple users all have `isAnonymous === false`,
 * so they default to `isGuest: false`.
 */
function buildDefaultUserData(
  firebaseUser: FirebaseUser,
  overrides: { email?: string; displayName?: string } = {}
): Omit<UserData, 'createdAt' | 'updatedAt'> {
  return {
    uid: firebaseUser.uid,
    email: overrides.email ?? firebaseUser.email ?? '',
    displayName: overrides.displayName ?? firebaseUser.displayName ?? 'Saudara',
    parishId: null,
    parishName: null,
    tokens: 10,
    isPremium: false,
    currentLevel: 1,
    totalXP: 0,
    weeklyXP: 0,
    monthlyXP: 0,
    levelProgress: {},
    streakDays: 0,
    levelsCompleted: [],
    friendsCount: 0,
    accuracy: 0,
    quizzesThisMonth: 0,
    isGuest: firebaseUser.isAnonymous,
  };
}

/**
 * Ensures a Firestore user document exists for the given Firebase user.
 * Creates one with starter values if missing. Safe to call repeatedly
 * (idempotent — existing docs are read back, not overwritten).
 */
export async function ensureUserDocument(
  firebaseUser: FirebaseUser,
  overrides: { email?: string; displayName?: string } = {}
): Promise<UserData> {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return { uid: firebaseUser.uid, ...(snap.data() as Omit<UserData, 'uid'>) };
  }
  const data = buildDefaultUserData(firebaseUser, overrides);
  await setDoc(userRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { ...data, createdAt: Date.now(), updatedAt: Date.now() };
}

/**
 * Register a brand-new account with email + password, sync the
 * Firebase profile displayName, and create the user document.
 */
export async function registerUser(
  email: string,
  password: string,
  displayName: string
): Promise<UserData> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });
  return ensureUserDocument(credential.user, { email, displayName });
}

/**
 * Sign in with email + password. Persistence is handled natively by
 * Firebase Auth (via `initializeAuth` + AsyncStorage). No more manual
 * credential caching.
 */
export async function loginUser(
  email: string,
  password: string
): Promise<FirebaseUser> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Sign in as an anonymous (guest) user. No email/password required — the
 * user gets a real Firebase account under the hood but with no identifying
 * credentials. Used by the "Terus sebagai Tetamu" flow on the auth screen.
 *
 * Firebase Anonymous Auth must be enabled in the Firebase Console
 * (Authentication → Sign-in method → Anonymous). If it's disabled, this
 * throws `auth/operation-not-allowed` and the screen surfaces the error
 * via `friendlyAuthError`.
 *
 * The guest profile gets a generated display name so it doesn't show up
 * as an empty string in leaderboards / profile screens.
 */
export async function loginAsGuest(): Promise<UserData> {
  const credential = await signInAnonymously(auth);
  const guestName = `Tetamu ${credential.user.uid.slice(0, 4).toUpperCase()}`;
  await updateProfile(credential.user, { displayName: guestName });
  return ensureUserDocument(credential.user, { displayName: guestName });
}

export async function getUserData(uid: string): Promise<UserData | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid, ...(snap.data() as Omit<UserData, 'uid'>) };
}

export async function updateUserData(
  uid: string,
  data: Partial<UserData>
): Promise<void> {
  await setDoc(
    doc(db, 'users', uid),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * Translate Firebase Auth errors into user-friendly Malay messages.
 * Falls back to the raw error message for unknown codes.
 */
export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Format emel tidak sah.';
    case 'auth/user-disabled':
      return 'Akaun ini telah dinyahaktifkan.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Emel atau kata laluan salah.';
    case 'auth/email-already-in-use':
      return 'Emel ini sudah berdaftar. Sila log masuk.';
    case 'auth/weak-password':
      return 'Kata laluan terlalu lemah (minimum 6 aksara).';
    case 'auth/network-request-failed':
      return 'Tiada sambungan internet. Cuba lagi.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percubaan. Sila tunggu sebentar.';
    case 'auth/popup-closed-by-user':
      return 'Tetingkap log masuk ditutup sebelum selesai.';
    case 'auth/popup-blocked':
    case 'auth/cancelled-popup-request':
      return 'Log masuk dibatalkan.';
    default:
      return (err as Error)?.message ?? 'Ralat tidak dijangka. Cuba lagi.';
  }
}

/**
 * Subscribe to auth state changes. Returns an unsubscribe function.
 */
export function onAuthChange(
  callback: (user: FirebaseUser | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}
