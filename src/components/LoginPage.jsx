import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const { login, loginWithEmail, signup } = useAuth();
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLoginView) {
        await loginWithEmail(email, password);
      } else {
        await signup(email, password);
      }
      // Přesměrování proběhne automaticky díky AuthContextu
    } catch (err) {
      // Překlad chybových hlášek z Firebase pro lepší srozumitelnost
      switch (err.code || err.message) {
        case 'auth/wrong-password':
          setError('Nesprávné heslo.');
          break;
        case 'auth/user-not-found':
          setError('Uživatel s tímto emailem neexistuje.');
          break;
        case 'auth/email-already-in-use':
          setError('Tento email je již zaregistrován.');
          break;
        case 'auth/weak-password':
          setError('Heslo musí mít alespoň 6 znaků.');
          break;
        case 'Tento email nemá oprávnění k registraci.':
           setError('Tento email nemá oprávnění k registraci.');
           break;
        default:
          setError('Nastala chyba. Zkuste to prosím znovu.');
          console.error(err);
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Vítejte</h1>
          <p className="text-gray-600">
            {isLoginView ? 'Přihlaste se ke svému účtu' : 'Vytvořte si nový účet'}
          </p>
        </div>
        
        {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block mb-2 text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block mb-2 text-sm font-medium text-gray-700"
            >
              Heslo
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
          >
            {loading ? 'Pracuji...' : (isLoginView ? 'Přihlásit se' : 'Zaregistrovat se')}
          </button>
        </form>

        <div className="relative flex items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink mx-4 text-sm text-gray-500">nebo</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        <button
          onClick={login}
          className="w-full flex justify-center items-center gap-2 px-4 py-2 font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
          Pokračovat s Google
        </button>

        <p className="text-sm text-center text-gray-600">
          {isLoginView ? 'Ještě nemáte účet?' : 'Už máte účet?'}
          <button
            onClick={() => {
              setIsLoginView(!isLoginView);
              setError('');
            }}
            className="ml-1 font-semibold text-blue-600 hover:underline"
          >
            {isLoginView ? 'Zaregistrujte se' : 'Přihlaste se'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
