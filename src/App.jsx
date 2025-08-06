import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { db } from './firebase';
import { collection, query, where, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage.jsx';
import InvoicesPage from './pages/InvoicesPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import DeliveryNotesPage from './pages/DeliveryNotesPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import CreationMenu from './components/CreationMenu.jsx';
import { FileText, Building, Settings, ListOrdered, LogOut, Tag } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './components/LanguageSwitcher.jsx';

const App = () => {
  const { currentUser, logout } = useAuth();
  const { t } = useTranslation();
  const [savedCustomers, setSavedCustomers] = useState([]);
  const [supplier, setSupplier] = useState(null);
  const [vatSettings, setVatSettings] = useState(null);
  const [products, setProducts] = useState([]);
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [creationRequest, setCreationRequest] = useState(null);
  const [appLoading, setAppLoading] = useState(true);
  const [customerForNewInvoice, setCustomerForNewInvoice] = useState(null);

  const handleSelectCustomerForNewInvoice = (customer) => {
    setCustomerForNewInvoice(customer); // Zapamatuje si zákazníka
    setActiveTab('invoices');           // Přepne na faktury
  };

  useEffect(() => {
    if (!currentUser) {
      setAppLoading(false);
      return;
    };
    const settingsDocRef = doc(db, 'settings', currentUser.uid);
    const unsubSettings = onSnapshot(settingsDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSupplier(data.supplierDetails || {});
        setVatSettings(data.vatDetails || { enabled: false, rate: 21 });
      } else {
        setSupplier({});
        setVatSettings({ enabled: false, rate: 21 });
      }
      setAppLoading(false);
    });
    const qCustomers = query(collection(db, 'customers'), where('userId', '==', currentUser.uid), orderBy('name'));
    const unsubCustomers = onSnapshot(qCustomers, (snap) => setSavedCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const qProducts = query(collection(db, 'products'), where('userId', '==', currentUser.uid), orderBy('position'));
    const unsubProducts = onSnapshot(qProducts, (snap) => setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const qDeliveryNotes = query(collection(db, 'deliveryNotes'), where('userId', '==', currentUser.uid), orderBy('number', 'desc'));
    const unsubDeliveryNotes = onSnapshot(qDeliveryNotes, (snap) => setDeliveryNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { unsubSettings(); unsubCustomers(); unsubProducts(); unsubDeliveryNotes(); };
  }, [currentUser]);

  const NavButton = ({ to, children, icon: Icon }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 px-4 py-2 rounded-t-lg border-b-2 transition-colors ${
          isActive
            ? 'bg-blue-50 border-blue-500 text-blue-700' // Styl pro aktivní odkaz
            : 'bg-gray-50 border-transparent text-gray-600 hover:text-gray-800' // Styl pro neaktivní odkaz
        }`
      }
    >
      <Icon size={16} /> <span className="hidden sm:inline">{children}</span>
    </NavLink>
  );

  const handleRequestNew = (itemType) => {
    const tabMap = { invoice: 'invoices', delivery_note: 'delivery_notes', customer: 'customers', product: 'products' };
    setActiveTab(tabMap[itemType]);
    setCreationRequest(itemType);
  };

  if (!currentUser) {
    return <LoginPage />;
  }

  if (appLoading) {
    return <div className="flex items-center justify-center h-screen">Načítání dat...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 bg-gray-50 min-h-screen relative">
      <Toaster position="top-center" />
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm">{t('loggedInAs')} <strong>{currentUser.email}</strong></div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <button onClick={logout} className="flex items-center gap-2 px-3 py-1 bg-gray-200 rounded text-sm"><LogOut size={14} /> <span className="hidden sm:inline">{t('logout')}</span></button>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="flex border-b bg-gray-50 overflow-x-auto">           
        <NavButton to="/faktury" icon={FileText}>{t('invoices')}</NavButton>
        <NavButton to="/dodaci-listy" icon={ListOrdered}>{t('delivery_notes')}</NavButton>
        <NavButton to="/zakaznici" icon={Building}>{t('customers')}</NavButton>
        <NavButton to="/produkty" icon={Tag}>{t('products')}</NavButton>
        <NavButton to="/nastaveni" icon={Settings}>{t('settings')}</NavButton>
      </div>
        {/* ZDE JE ZMĚNA: Větší spodní padding, aby se nic nepřekrývalo */}
        <div className="p-3 md:p-6 pb-32">
          <Routes>
            <Route path="/faktury" element={<InvoicesPage creationRequest={creationRequest} setCreationRequest={setCreationRequest} currentUser={currentUser} savedCustomers={savedCustomers} supplier={supplier} vatSettings={vatSettings} deliveryNotes={deliveryNotes} />} />
            <Route path="/dodaci-listy" element={<DeliveryNotesPage creationRequest={creationRequest} setCreationRequest={setCreationRequest} currentUser={currentUser} supplier={supplier} savedCustomers={savedCustomers} products={products} vatSettings={vatSettings} />} />
            <Route path="/zakaznici" element={<CustomersPage creationRequest={creationRequest} setCreationRequest={setCreationRequest} savedCustomers={savedCustomers} />} />
            <Route path="/produkty" element={<ProductsPage creationRequest={creationRequest} setCreationRequest={setCreationRequest} vatSettings={vatSettings} products={products} />} />
            <Route path="/nastaveni" element={<SettingsPage currentUser={currentUser} savedCustomers={savedCustomers} products={products} deliveryNotes={deliveryNotes} />} />

            {/* Tento řádek přesměruje uživatele na faktury, když zadá jen hlavní adresu */}
            <Route path="*" element={<Navigate to="/faktury" />} />
          </Routes>
        </div>
      </div>
      <CreationMenu onRequestNew={handleRequestNew} />
    </div>
  );
};
export default App;
