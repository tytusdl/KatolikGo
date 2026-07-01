import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, FacebookAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, saveCredentials } from '@/config/firebase';
import type { UserData } from '@/types';

WebBrowser.maybeCompleteAuthSession();

// Google: GANTI dengan Web Client ID dari Google Cloud Console
// https://console.cloud.google.com/apis/credentials
const GOOGLE_WEB_CLIENT_ID = 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com';

// Facebook: GANTI dengan App ID dari Facebook Developer
// https://developers.facebook.com/
const FACEBOOK_APP_ID = 'YOUR_FACEBOOK_APP_ID';

export function useGoogleAuthRequest() {
  return Google.useAuthRequest({
    androidClientId: 'YOUR_ANDROID_CLIENT_ID',
    iosClientId: 'YOUR_IOS_CLIENT_ID',
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });
}

export function useFacebookAuthRequest() {
  return Facebook.useAuthRequest({
    clientId: FACEBOOK_APP_ID,
  });
}

export async function signInWithGoogle(idToken: string): Promise<UserData | null> {
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  const user = result.user;

  const existingDoc = await getDoc(doc(db, 'users', user.uid));
  if (!existingDoc.exists()) {
    const userData = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Pengguna Google',
      parishId: null,
      parishName: null,
      tokens: 10,
      isPremium: false,
      currentLevel: 1,
      totalXP: 0,
      weeklyXP: 0,
      monthlyXP: 0,
      levelProgress: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', user.uid), userData);
  }

  const snap = await getDoc(doc(db, 'users', user.uid));
  return { uid: user.uid, ...snap.data() } as UserData;
}

export async function signInWithFacebook(accessToken: string): Promise<UserData | null> {
  const credential = FacebookAuthProvider.credential(accessToken);
  const result = await signInWithCredential(auth, credential);
  const user = result.user;

  const existingDoc = await getDoc(doc(db, 'users', user.uid));
  if (!existingDoc.exists()) {
    const userData = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Pengguna Facebook',
      parishId: null,
      parishName: null,
      tokens: 10,
      isPremium: false,
      currentLevel: 1,
      totalXP: 0,
      weeklyXP: 0,
      monthlyXP: 0,
      levelProgress: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', user.uid), userData);
  }

  const snap = await getDoc(doc(db, 'users', user.uid));
  return { uid: user.uid, ...snap.data() } as UserData;
}
