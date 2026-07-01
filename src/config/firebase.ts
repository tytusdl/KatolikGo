import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCzq0iMJZUGjLrSGEnou66f7AA8jsBu2Jw',
  authDomain: 'katolikgo-mobile.firebaseapp.com',
  projectId: 'katolikgo-mobile',
  storageBucket: 'katolikgo-mobile.firebasestorage.app',
  messagingSenderId: '615054372997',
  appId: '1:615054372997:web:8ab4a440df706977f779ec',
  measurementId: 'G-2F43XDJRQV',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const CREDENTIALS_KEY = '@katolikgo_credentials';

export async function saveCredentials(email: string, password: string) {
  try {
    await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ email, password }));
  } catch {}
}

export async function getSavedCredentials(): Promise<{ email: string; password: string } | null> {
  try {
    const data = await AsyncStorage.getItem(CREDENTIALS_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function clearCredentials() {
  try {
    await AsyncStorage.removeItem(CREDENTIALS_KEY);
  } catch {}
}
