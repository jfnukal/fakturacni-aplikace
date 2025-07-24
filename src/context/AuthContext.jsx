import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';

// ZDE SI DEFINUJ EMAILY, KTERÉ MAJÍ PŘÍSTUP
const ALLOWED_EMAILS = [
  'jarek.fuki@gmail.com', // Nahraď svým emailem
  'misaelka@gmail.com', // Nahraď emailem manželky
  'email.bratra@email.com', // Případně další
];

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
        alert('Tento Google účet nemá oprávnění k přístupu do aplikace.');
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

  const logout = () => {
    return signOut(auth);
  };

  const value = { currentUser, login, logout };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
