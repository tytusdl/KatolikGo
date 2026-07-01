import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, saveCredentials, getSavedCredentials, clearCredentials } from '@/config/firebase';
import type { UserData } from '@/types';

export async function registerUser(email: string, password: string, displayName: string): Promise<UserData> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });

  const userData: Omit<UserData, 'createdAt' | 'updatedAt'> = {
    uid: credential.user.uid,
    email,
    displayName,
    parishId: null,
    parishName: null,
    tokens: 10,
    isPremium: false,
    currentLevel: 1,
    totalXP: 0,
    weeklyXP: 0,
    monthlyXP: 0,
    levelProgress: {},
  };

  await setDoc(doc(db, 'users', credential.user.uid), {
    ...userData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await saveCredentials(email, password);

  return { ...userData, createdAt: Date.now(), updatedAt: Date.now() };
}

export async function loginUser(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email, password);
  await saveCredentials(email, password);
}

export async function signOut() {
  await firebaseSignOut(auth);
  await clearCredentials();
}

export async function autoLogin(): Promise<boolean> {
  const creds = await getSavedCredentials();
  if (!creds) return false;
  try {
    await signInWithEmailAndPassword(auth, creds.email, creds.password);
    return true;
  } catch {
    await clearCredentials();
    return false;
  }
}

export async function getUserData(uid: string): Promise<UserData | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as UserData;
}

export async function updateUserData(uid: string, data: Partial<UserData>) {
  await setDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}
