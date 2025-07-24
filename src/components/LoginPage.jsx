import React from 'react';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const { login } = useAuth();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">Vítejte ve fakturaci</h1>
        <p className="text-gray-600 mb-6">
          Pro pokračování se prosím přihlaste.
        </p>
        <button
          onClick={login}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          Přihlásit se přes Google
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
