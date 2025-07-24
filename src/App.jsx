import React from 'react';
import { useAuth } from './context/AuthContext';
import LoginPage from './components/LoginPage.jsx';
import InvoiceGenerator from './components/InvoiceGenerator.jsx';
import './index.css';

function App() {
  const { currentUser } = useAuth();

  return currentUser ? <InvoiceGenerator /> : <LoginPage />;
}

export default App;
