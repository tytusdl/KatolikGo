import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as WebBrowser from 'expo-web-browser';
import {
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { auth } from '@/config/firebase';
import {
  ensureUserDocument,
  friendlyAuthError,
} from '@/services/authService';
import type { UserData } from '@/types';

WebBrowser.maybeCompleteAuthSession();

// Google: Web Client ID from Google Cloud Console.
// https://console.cloud.google.com/apis/credentials
const GOOGLE_WEB_CLIENT_ID =
  '615054372997-mrprnf461bkdfbq2guh5lb8ossas1972.apps.googleusercontent.com';

// Facebook App ID. Read from EXPO_PUBLIC_FACEBOOK_APP_ID so the placeholder
// never ships to prod. Leave empty to disable Facebook entirely.
const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID ?? '';

// TODO before enabling Android & iOS Google sign-in:
//   1. Create Android & iOS OAuth clients in Google Cloud Console.
//   2. Add expo-reverse-proxy URIs for the dev client.
//   3. Replace these placeholders with real client IDs.
const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

export function isGoogleAuthConfigured(): boolean {
  return (
    !!GOOGLE_ANDROID_CLIENT_ID || !!GOOGLE_IOS_CLIENT_ID || !!GOOGLE_WEB_CLIENT_ID
  );
}

export function isFacebookAuthConfigured(): boolean {
  return !!FACEBOOK_APP_ID;
}

export function useGoogleAuthRequest() {
  return Google.useAuthRequest({
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });
}

export function useFacebookAuthRequest() {
  return Facebook.useAuthRequest({
    clientId: FACEBOOK_APP_ID,
  });
}

export async function signInWithGoogle(idToken: string): Promise<UserData> {
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  return ensureUserDocument(result.user, {
    displayName: result.user.displayName ?? 'Pengguna Google',
  });
}

export async function signInWithFacebook(accessToken: string): Promise<UserData> {
  if (!isFacebookAuthConfigured()) {
    throw new Error(
      'Facebook login belum dikonfigurasikan. Sila hubungi pembangun.'
    );
  }
  const credential = FacebookAuthProvider.credential(accessToken);
  const result = await signInWithCredential(auth, credential);
  return ensureUserDocument(result.user, {
    displayName: result.user.displayName ?? 'Pengguna Facebook',
  });
}

export { friendlyAuthError };
