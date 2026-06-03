import React, { createContext, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  createUserWithEmailAndPassword, // <-- Nový import
  signInWithEmailAndPassword, // <-- Nový import
} from 'firebase/auth';

// Povolené emaily jsou v .env.local (lokálně) a v Netlify Environment Variables (produkce).
// Proměnná: VITE_ALLOWED_EMAILS=email1@example.com,email2@example.com
// NIKDY neskladovat emaily přímo v kódu – jsou pak viditelné v git historii.
const ALLOWED_EMAILS = (import.meta.env.VITE_ALLOWED_EMAILS || '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && ALLOWED_EMAILS.includes(user.email)) {
        // Pokud je uživatel přihlášen A JEHO EMAIL JE V SEZNAMU, pustíme ho dál
        setCurrentUser(user);
      } else if (user) {
        // Pokud je přihlášen, ale email není v seznamu, odhlásíme ho
        toast.error('Tento účet nemá oprávnění k přístupu.');
        signOut(auth);
        setCurrentUser(null);
      } else {
        // Pokud není nikdo přihlášen
        setCurrentUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [auth]);

  const login = () => {
    return signInWithPopup(auth, new GoogleAuthProvider());
  };

  // --- Nová funkce pro přihlášení emailem ---
  const loginWithEmail = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  // --- Nová funkce pro registraci emailem ---
  const signup = (email, password) => {
    // Klíčová kontrola: Povolíme registraci jen pro emaily z našeho seznamu
    if (!ALLOWED_EMAILS.includes(email)) {
      // Místo vytvoření účtu rovnou vrátíme chybu
      return Promise.reject(
        new Error('Tento email nemá oprávnění k registraci.')
      );
    }
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    return signOut(auth);
  };

  const value = { currentUser, login, logout, signup, loginWithEmail };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
