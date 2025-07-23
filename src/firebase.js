import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAyofRBAZimtTxZFZrl4NVL1Cm5hOkF8D8",
  authDomain: "ucetnictvi-5418d.firebaseapp.com",
  projectId: "ucetnictvi-5418d",
  storageBucket: "ucetnictvi-5418d.appspot.com",
  messagingSenderId: "354571663683",
  appId: "1:354571663683:web:f19e21408fd4781b4217f6",
  measurementId: "G-7NZMSVGHTW"
};

// Inicializujeme aplikaci moderním způsobem
const app = initializeApp(firebaseConfig);

// A exportujeme služby získané z moderních funkcí
export const db = getFirestore(app);
export const storage = getStorage(app);
