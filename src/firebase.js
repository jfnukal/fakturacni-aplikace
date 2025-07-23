import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyAyofRBAZimtTxZFZrl4NVL1Cm5hOkF8D8',
  authDomain: 'ucetnictvi-5418d.firebaseapp.com',
  projectId: 'ucetnictvi-5418d',
  storageBucket: 'ucetnictvi-5418d.firebasestorage.app',
  messagingSenderId: '354571663683',
  appId: '1:354571663683:web:f19e21408fd4781b4217f6',
  measurementId: 'G-7NZMSVGHTW',
};

// Nejprve inicializujeme aplikaci
const app = firebase.initializeApp(firebaseConfig);

// Až z inicializované aplikace exportujeme databázi a storage
export const db = app.firestore();
export const storage = app.storage();
