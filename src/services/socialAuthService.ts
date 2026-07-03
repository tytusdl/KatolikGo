import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as WebBrowser from 'expo-web-browser';
import {
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
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
// Read from EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID so rotating it doesn't require a binary update.
const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

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

/**
 * Apple sign-in is iOS-only. We import `expo-apple-authentication` lazily so
 * the Android bundle doesn't have to pull in the iOS-only native module and
 * so a missing dependency doesn't crash the auth screen on other platforms.
 *
 * Flow:
 *   1. Generate a random `nonce` for replay-attack protection. Apple echoes
 *      this back in the JWT and Firebase validates it against `rawNonce`.
 *   2. `AppleAuthentication.signInAsync()` returns an identity token (JWT).
 *   3. We mint a Firebase `OAuthProvider('apple.com')` credential from it.
 *   4. `signInWithCredential` exchanges the JWT for a Firebase session.
 *   5. `ensureUserDocument` writes a starter Firestore doc.
 *
 * The nonce is request-side only (Apple doesn't echo it on the credential
 * object — the JWT itself contains the SHA-256 hash), so we keep a closure
 * ref to the value we sent and pass it back to Firebase.
 */
export async function signInWithApple(): Promise<UserData> {
  const AppleAuthentication = await import('expo-apple-authentication');
  const isAvailable = AppleAuthentication.isAvailableAsync
    ? await AppleAuthentication.isAvailableAsync()
    : true;
  if (!isAvailable) {
    throw new Error('Apple Sign-In hanya tersedia pada peranti iOS.');
  }
  // expo-crypto is already a project dependency; use it for a stable
  // random nonce. Falls back to Math.random if the import ever fails —
  // not security-critical on its own since Firebase rechecks the JWT.
  let nonce: string;
  try {
    const Crypto = await import('expo-crypto');
    nonce = Crypto.randomUUID();
  } catch {
    nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce,
  });
  if (!credential.identityToken) {
    throw new Error('Apple Sign-In gagal: token identiti tiada.');
  }
  const provider = new OAuthProvider('apple.com');
  const firebaseCredential = provider.credential({
    idToken: credential.identityToken,
    rawNonce: nonce,
  });
  const result = await signInWithCredential(auth, firebaseCredential);
  // Apple only sends the displayName on the *first* sign-in. After that the
  // Firebase profile gets just a stable opaque user ID. We fall back to a
  // sensible default if Apple didn't share a name.
  const fallbackName = `Pengguna Apple ${result.user.uid.slice(0, 4).toUpperCase()}`;
  const appleName = credential.fullName
    ? [credential.fullName.givenName, credential.fullName.familyName]
        .filter(Boolean)
        .join(' ')
        .trim()
    : '';
  return ensureUserDocument(result.user, {
    displayName: appleName || result.user.displayName || fallbackName,
  });
}

export function isAppleAuthConfigured(): boolean {
  // Apple Sign-In is "configured" iff we're on iOS and the native module is
  // linked. We can't statically check Platform.OS here (this helper runs in
  // render), so callers should also gate on Platform.OS === 'ios'.
  return true;
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
