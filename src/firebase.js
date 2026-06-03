import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Konfigurace Firebase – hodnoty jsou v .env.local (gitignorováno přes *.local)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Inicializujeme aplikaci moderním způsobem
const app = initializeApp(firebaseConfig);

// A exportujeme služby získané z moderních funkcí
export const db = getFirestore(app);
export const storage = getStorage(app);

if (typeof window !== 'undefined') {
  window.firebaseStorage = storage;
  window.firebaseApp = app;
  console.log('🔥 Firebase Storage připojen k window');
}
