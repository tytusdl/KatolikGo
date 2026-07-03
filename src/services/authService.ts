import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, query, collection, where, limit, getDocs } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import type { UserData } from '@/types';
import { LIVES_CONFIG } from '@/constants/xp.constants';

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
  overrides: {
    email?: string;
    displayName?: string;
    username?: string;
  } = {}
): Omit<UserData, 'createdAt' | 'updatedAt'> {
  // Firestore rejects `undefined` field values — if a caller didn't
  // supply a username (guest, social sign-in, legacy), we have to
  // OMIT the field entirely rather than write `undefined`. The
  // returned type stays the same (`username?` is optional), so
  // downstream code can keep treating it as maybe-present.
  const base: Omit<
    UserData,
    'createdAt' | 'updatedAt' | 'username' | 'username_lowercase'
  > = {
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
    // Lives system — every new account starts at full health. Lives
    // and refill anchors default to "no refill pending" so the player
    // gets a fresh 5-life window on first login. Legacy docs without
    // these fields are read back as full health by `livesService`
    // (see `LIVES_CONFIG.LEGACY_DEFAULT`), but writing them on create
    // keeps the data shape consistent for new accounts.
    lives: LIVES_CONFIG.MAX,
    livesLastLostAt: null,
    lastAdRefillAt: null,
  };
  if (overrides.username !== undefined) {
    return {
      ...base,
      username: overrides.username,
      username_lowercase: overrides.username.toLowerCase().trim(),
    };
  }
  return base;
}

/**
 * Username validation + uniqueness helpers.
 *
 * Rules:
 *   - 3 to 20 characters
 *   - Letters, numbers, underscore, dot
 *   - Lowercase enforced (auto-normalized on register)
 *   - Cannot start with a digit (avoids visual clash with email-like
 *     identifiers and keeps reserved-room for future numeric IDs)
 *   - Uniqueness enforced via Firestore `username_lowercase` lookup
 *
 * Display-cased versions are kept in `username` (the original input);
 * the query key is `username_lowercase`.
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
const USERNAME_RE = /^[a-z][a-z0-9_.]*$/;

export type UsernameValidation =
  | { valid: true; normalized: string }
  | { valid: false; error: string };

export function validateUsername(input: string): UsernameValidation {
  const trimmed = input?.trim() ?? '';
  if (trimmed.length === 0) {
    return { valid: false, error: 'Nama pengguna diperlukan.' };
  }
  if (trimmed.length < USERNAME_MIN) {
    return {
      valid: false,
      error: `Nama pengguna mestilah sekurang-kurangnya ${USERNAME_MIN} aksara.`,
    };
  }
  if (trimmed.length > USERNAME_MAX) {
    return {
      valid: false,
      error: `Nama pengguna maksimum ${USERNAME_MAX} aksara.`,
    };
  }
  const lower = trimmed.toLowerCase();
  if (!USERNAME_RE.test(lower)) {
    return {
      valid: false,
      error:
        'Hanya huruf, nombor, titik dan underscore. Huruf pertama mestilah huruf.',
    };
  }
  return { valid: true, normalized: lower };
}

export function isEmailLike(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

/**
 * Returns true if another registered (non-guest) account has already
 * taken this username. Case-insensitive (compared on `username_lowercase`).
 */
export async function isUsernameTaken(username: string): Promise<boolean> {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return false;
  const q = query(
    collection(db, 'users'),
    where('username_lowercase', '==', normalized),
    where('isGuest', '==', false),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/**
 * Look up the email for a given username. Returns `null` if no
 * matching registered account exists (or if the match is a guest).
 */
export async function findEmailByUsername(username: string): Promise<string | null> {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return null;
  const q = query(
    collection(db, 'users'),
    where('username_lowercase', '==', normalized),
    where('isGuest', '==', false),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const data = snap.docs[0].data() as Partial<UserData>;
  return data.email ?? null;
}

/**
 * Ensures a Firestore user document exists for the given Firebase user.
 * Creates one with starter values if missing. Safe to call repeatedly
 * (idempotent — existing docs are read back, not overwritten).
 */
export async function ensureUserDocument(
  firebaseUser: FirebaseUser,
  overrides: {
    email?: string;
    displayName?: string;
    username?: string;
  } = {}
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
 * Firebase profile displayName, claim a unique username, and create
 * the user document.
 *
 * `username` must already be validated by `validateUsername`; this
 * function calls `isUsernameTaken` to enforce uniqueness and throws
 * `UsernameTakenError` (with a friendly Malay message) if the handle
 * is already in use.
 */
export class UsernameTakenError extends Error {
  code = 'USERNAME_TAKEN';
  constructor(public username: string) {
    super(`Nama pengguna "${username}" sudah digunakan.`);
  }
}

export async function registerUser(
  email: string,
  password: string,
  displayName: string,
  username: string
): Promise<UserData> {
  const usernameCheck = validateUsername(username);
  if (!usernameCheck.valid) {
    throw new Error(usernameCheck.error);
  }
  if (await isUsernameTaken(usernameCheck.normalized)) {
    throw new UsernameTakenError(usernameCheck.normalized);
  }
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });
  return ensureUserDocument(credential.user, {
    email,
    displayName,
    username,
  });
}

/**
 * Sign in with email + password OR username. Accepts either form —
 * presence of `@` is the heuristic (an email always has one, usernames
 * never do). Username logins resolve the email via a Firestore
 * lookup first, then sign in normally.
 *
 * Persistence is handled natively by Firebase Auth (via `initializeAuth`
 * + AsyncStorage). No more manual credential caching.
 */
export async function loginUser(
  identifier: string,
  password: string
): Promise<FirebaseUser> {
  const trimmed = identifier.trim();
  let email = trimmed;
  if (!isEmailLike(trimmed)) {
    // Treat as username. Resolve to the underlying email first.
    const resolved = await findEmailByUsername(trimmed);
    if (!resolved) {
      // Throw the same shape Firebase would for a missing user, so the
      // screen's friendlyAuthError mapping lands the right "wrong
      // credentials" message without exposing whether the username
      // was the issue.
      throw Object.assign(new Error('Invalid credentials'), {
        code: 'auth/invalid-credential',
      });
    }
    email = resolved;
  }
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
