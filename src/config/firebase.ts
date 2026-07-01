import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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