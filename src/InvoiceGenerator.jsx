import React, { useState, useRef, useEffect } from 'react';
import { db, storage } from './firebase';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Plus, Trash2, Settings, Building, FileText, Copy, Upload, Eye, Edit, Save, Download, Share2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import InvoicePrintable from './InvoicePrintable.jsx';
import ReactDOM from 'react-dom/client';

// Změna 1: Funkce je definována jako 'function', aby byla přístupná dříve (hoisting)
// a nezávisí na stavu 'invoices'.
function getNewInvoice() {
  return {
    id: Date.now(),
    number: '', // Číslo se dopočítá až při kliknutí
    issueDate: new Date().toLocaleDateString('cs-CZ', {day: '2-digit', month: '2-digit', year: 'numeric'}),
    duzpDate: new Date().toLocaleDateString('cs-CZ', {day: '2-digit', month: '2-digit', year: 'numeric'}),
    dueDate: '', dueDays: 14, currency: 'CZK',
    customer: { name: '', address: '', zip: '', city: '', ico: '', dic: '' },
    items: [{ id: Date.now(), quantity: 1, unit: 'ks', description: '', pricePerUnit: 0, totalPrice: 0 }],
    status: 'draft',
  };
};

const CzechInvoiceGenerator = () => {
  // --- Stavy pro UI ---
  const [activeTab, setActiveTab] = useState('invoices');
  const [currentView, setCurrentView] = useState('list');
  const [customerView, setCustomerView] = useState('list');
  const fileInputRef = useRef(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logoPreview, setLogoPreview] = useState('');

  // --- Stavy pro data ---
  const [supplier, setSupplier] = useState({ name: '', address: '', zip: '', city: '', ico: '', dic: '', bankAccount: '', paymentMethod: 'Převodem', logoUrl: '' });
  const [vatSettings, setVatSettings] = useState({ enabled: false, rate: 21 });
  const [invoices, setInvoices] = useState([]);
  const [savedCustomers, setSavedCustomers] = useState([]);
  const [currentInvoice, setCurrentInvoice] = useState(getNewInvoice());

  // --- Načítání dat z Firebase ---
  useEffect(() => {
    const q = query(collection(db, 'invoices'), orderBy('number', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      setInvoices(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      setSavedCustomers(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const settingsDocRef = doc(db, 'settings', 'main');
    const unsubscribe = onSnapshot(settingsDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.supplierDetails) setSupplier(data.supplierDetails);
        if (data.vatDetails) setVatSettings(data.vatDetails);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    return () => { if (logoPreview) URL.revokeObjectURL(logoPreview); };
  }, [logoPreview]);

  // --- Funkce pro správu dat ---
  const saveSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'main'), {
        supplierDetails: supplier,
        vatDetails: vatSettings,
      });
      alert('Nastavení uloženo!');
    } catch (error) { 
      console.error("Chyba při ukládání nastavení: ", error);
      alert('Chyba při ukládání nastavení.');
    }
  };

  const saveInvoice = async () => {
    const { total } = calculateTotals(currentInvoice);
    const invoiceToSave = { ...currentInvoice, total, status: 'pending' };
    delete invoiceToSave.id;
    try {
      if (editingInvoice) {
        await updateDoc(doc(db, 'invoices', editingInvoice.id), invoiceToSave);
        setEditingInvoice(null);
      } else {
        await addDoc(collection(db, 'invoices'), invoiceToSave);
      }
      setCurrentView('list');
      setCurrentInvoice(getNewInvoice());
    } catch (error) { 
      console.error("Chyba při ukládání faktury: ", error);
      alert("Při ukládání faktury nastala chyba!");
    }
  };
  
  const cloneInvoice = (invoiceToClone) => {
    const newInvoice = {
      ...JSON.parse(JSON.stringify(invoiceToClone)),
      number: getNewInvoice().number,
      issueDate: getNewInvoice().issueDate,
      duzpDate: getNewInvoice().duzpDate,
      dueDate: calculateDueDate(
        getNewInvoice().issueDate,
        invoiceToClone.dueDays || 14
      ),
      status: 'draft',
    };
    delete newInvoice.id;
    setCurrentInvoice(newInvoice);
    setEditingInvoice(null);
    setCurrentView('create');
  };

  const deleteInvoice = async (id) => {
    if (window.confirm('Opravdu chcete smazat tuto fakturu?')) {
      await deleteDoc(doc(db, 'invoices', id));
    }
  };
  
  const saveCustomer = async () => {
    if (!editingCustomer || !editingCustomer.name) {
      alert('Jméno odběratele je povinné.');
      return;
    }
    const { id, ...customerData } = editingCustomer;
    try {
      if (id) {
        await updateDoc(doc(db, 'customers', id), customerData);
      } else {
        await addDoc(collection(db, 'customers'), customerData);
      }
      setCustomerView('list');
      setEditingCustomer(null);
    } catch (error) { 
      console.error("Chyba při ukládání odběratele: ", error); 
    }
  };

  const deleteCustomer = async (id) => {
    if (window.confirm('Opravdu chcete smazat tohoto odběratele?')) {
        await deleteDoc(doc(db, 'customers', id));
    }
  };

  const editCustomer = (customer) => {
    setEditingCustomer(customer);
    setCustomerView('edit');
  };

  // --- Ostatní pomocné funkce ---
  const calculateTotals = (invoice = currentInvoice) => {
    const subtotal = invoice.items.reduce(
      (sum, item) => sum + (item.totalPrice || 0),
      0
    );
    const vatAmount = vatSettings.enabled
      ? (subtotal * vatSettings.rate) / 100
      : 0;
    const total = subtotal + vatAmount;
    return { subtotal, vatAmount, total };
  };

  const addItem = () => {
    const newItem = {
      id: Date.now(),
      quantity: 1,
      unit: 'ks',
      description: '',
      pricePerUnit: 0,
      totalPrice: 0,
    };
    setCurrentInvoice({
      ...currentInvoice,
      items: [...currentInvoice.items, newItem],
    });
  };

  const removeItem = (id) => {
    setCurrentInvoice({
      ...currentInvoice,
      items: currentInvoice.items.filter((item) => item.id !== id),
    });
  };

  const updateItem = (id, field, value) => {
    setCurrentInvoice({
      ...currentInvoice,
      items: currentInvoice.items.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'pricePerUnit') {
            updatedItem.totalPrice =
              (updatedItem.quantity || 0) * (updatedItem.pricePerUnit || 0);
          }
          return updatedItem;
        }
        return item;
      }),
    });
  };

  const calculateDueDate = (issueDate, days) => {
    if (!issueDate || !days) return '';
    try {
      const dateParts = issueDate.split('.').map((part) => parseInt(part, 10));
      const date = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
      date.setDate(date.getDate() + days);
      return date.toLocaleDateString('cs-CZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (e) {
      return '';
    }
  };

  const editInvoice = (invoice) => {
    const fullInvoice = {
      ...invoice,
      dueDays: 14,
      currency: 'CZK',
      items:
        invoice.items && invoice.items.length > 0
          ? invoice.items
          : [
              {
                id: Date.now(),
                quantity: 1,
                unit: 'ks',
                description: 'Služba',
                pricePerUnit: invoice.total || 0,
                totalPrice: invoice.total || 0,
              },
            ],
    };
    setCurrentInvoice(fullInvoice);
    setEditingInvoice(invoice);
    setCurrentView('create');
  };

  const selectCustomerAndCreateInvoice = (customer) => {
    const newInvoice = getNewInvoice();
    newInvoice.customer = {
      name: customer.name,
      address: customer.address,
      zip: customer.zip,
      city: customer.city,
      ico: customer.ico,
      dic: customer.dic,
    };
    setCurrentInvoice(newInvoice);
    setActiveTab('invoices');
    setCurrentView('create');
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setLogoPreview(localUrl);
    const storageRef = ref(storage, `logos/${Date.now()}_${file.name}`);
    try {
      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);
      setSupplier({ ...supplier, logoUrl: fileUrl });
    } catch (error) {
      console.error('Chyba při nahrávání loga: ', error);
      alert('Chyba při nahrávání loga.');
    }
  };
  
  const fetchFromAres = async (ico, target) => {
    if (!ico || !/^\d{8}$/.test(ico)) {
      alert('Zadejte platné osmimístné IČO.');
      return;
    }
    
    const proxiedUrl = `/.netlify/functions/ares?ico=${ico}`;

    try {
      const response = await fetch(proxiedUrl);
      if (!response.ok) { throw new Error('Chyba při komunikaci s ARES.'); }
      const data = await response.json();
      const subject = data.ekonomickeSubjekty[0];
      if (!subject) {
        alert('Firma s daným IČO nebyla v databázi ARES nalezena.');
        return;
      }
      const aresData = {
        name: subject.obchodniJmeno,
        address: `${subject.sidlo.ulice || ''} ${subject.sidlo.cisloOrientacni ? subject.sidlo.cisloOrientacni : ''}`.trim(),
        zip: subject.sidlo.psc,
        city: subject.sidlo.nazevObce,
        ico: subject.ico,
        dic: subject.dic || '',
      };
      
      if (target === 'invoice') {
          setCurrentInvoice(prev => ({...prev, customer: { ...prev.customer, ...aresData } }));
      } else if (target === 'customer') {
          setEditingCustomer(prev => ({...prev, ...aresData }));
      }
    } catch (error) {
      console.error('Chyba při načítání z ARES: ', error);
      alert(error.message || 'Nepodařilo se načíst data z ARES.');
    }
  };

  const handleDownloadPdf = (invoice) => {
    const element = document.createElement('div');
    const invoiceComponent = <InvoicePrintable invoice={invoice} supplier={supplier} vatSettings={vatSettings} />;
  
    // Dočasně vykreslíme komponentu mimo obrazovku, abychom ji mohli převést na HTML
    const root = ReactDOM.createRoot(element);
    root.render(invoiceComponent);
  
    const opt = {
      margin:       2,
      filename:     `faktura-${invoice.number}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
  
    setTimeout(() => {
      html2pdf().from(element).set(opt).save();
    }, 500);
  };
  
  const handleShare = async (invoice) => {
    if (!navigator.share || !navigator.canShare) {
      alert('Sdílení není na tomto zařízení nebo v tomto prohlížeči podporováno. Použijte prosím stažení PDF.');
      return;
    }
  
    const element = document.createElement('div');
    const invoiceComponent = <InvoicePrintable invoice={invoice} supplier={supplier} vatSettings={vatSettings} />;
    const root = ReactDOM.createRoot(element);
    root.render(invoiceComponent);
  
    setTimeout(async () => {
      try {
        const blob = await html2pdf().from(element).output('blob');
        const file = new File([blob], `faktura-${invoice.number}.pdf`, { type: 'application/pdf' });
  
        await navigator.share({
          title: `Faktura ${invoice.number}`,
          text: `Zde je faktura ${invoice.number}.`,
          files: [file],
        });
      } catch (error) {
        console.error('Chyba při sdílení: ', error);
        handleDownloadPdf(invoice); // Jako záloha stáhneme PDF
      }
    }, 500);
  };

  // --- Pomocné komponenty pro UI ---
  const TabButton = ({ id, children, icon: Icon }) => (
    <button onClick={() => { setActiveTab(id); if (id === 'invoices') setCurrentView('list'); }} className={`flex items-center gap-2 px-4 py-2 rounded-t-lg border-b-2 transition-colors ${ activeTab === id ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-gray-50 border-transparent text-gray-600 hover:text-gray-800' }`} >
      <Icon size={16} /> {children}
    </button>
  );

  const StatusBadge = ({ status }) => {
    const styles = { draft: 'bg-gray-100 text-gray-800', pending: 'bg-yellow-100 text-yellow-800', paid: 'bg-green-100 text-green-800', overdue: 'bg-red-100 text-red-800' };
    const labels = { draft: 'Koncept', pending: 'Čeká na platbu', paid: 'Zaplaceno', overdue: 'Po splatnosti' };
    return (<span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>{labels[status]}</span>);
  };

  const InvoicePreview = ({ invoice }) => {
    const { subtotal, vatAmount, total } = calculateTotals(invoice);
    return (
      <div className="border rounded-lg p-6 bg-white" style={{ minHeight: '800px' }}>
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-4">
            {supplier.logoUrl && (
              <div className="w-20 h-20 border rounded flex items-center justify-center bg-gray-50 overflow-hidden">
                <img src={supplier.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              </div>
            )}
            <div><h1 className="text-2xl font-bold">Faktura {invoice.number}</h1></div>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-sm text-gray-600 mb-2">DODAVATEL</h3>
            <div className="space-y-1">
              <div className="font-semibold">{supplier.name}</div>
              <div>{supplier.address}</div>
              <div>{supplier.zip} {supplier.city}</div>
              <div className="mt-2 space-y-1 text-sm">
                <div>IČO: {supplier.ico}</div>
                {supplier.dic && <div>DIČ: {supplier.dic}</div>}
                {!vatSettings.enabled && <div>Neplátce DPH</div>}
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm text-gray-600 mb-2">ODBĚRATEL</h3>
            <div className="space-y-1">
              <div className="font-semibold">{invoice.customer.name}</div>
              <div>{invoice.customer.address}</div>
              <div>{invoice.customer.zip} {invoice.customer.city}</div>
              <div className="mt-2 space-y-1 text-sm">
                <div>IČO: {invoice.customer.ico}</div>
                {invoice.customer.dic && <div>DIČ: {invoice.customer.dic}</div>}
              </div>
            </div>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div className="space-y-1 text-sm">
            <div>Bankovní účet: {supplier.bankAccount}</div>
            <div>Variabilní symbol: {invoice.number.replace(/-/g, '')}</div>
            <div>Způsob platby: {supplier.paymentMethod}</div>
          </div>
          <div className="space-y-1 text-sm">
            <div>Datum vystavení: {invoice.issueDate}</div>
            <div>Datum zdan. plnění: {invoice.duzpDate}</div>
            <div>Datum splatnosti: {invoice.dueDate}</div>
          </div>
        </div>
        <div className="border rounded-lg overflow-hidden mb-8">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 text-sm font-medium w-1/2">Popis</th>
                <th className="text-center p-3 text-sm font-medium">Počet</th>
                <th className="text-center p-3 text-sm font-medium">MJ</th>
                <th className="text-right p-3 text-sm font-medium">Cena za MJ</th>
                <th className="text-right p-3 text-sm font-medium">Celkem</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-3">{item.description}</td>
                  <td className="p-3 text-center">{item.quantity}</td>
                  <td className="p-3 text-center">{item.unit}</td>
                  <td className="p-3 text-right">{Number(item.pricePerUnit).toFixed(2)} Kč</td>
                  <td className="p-3 text-right">{Number(item.totalPrice).toFixed(2)} Kč</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end mb-8">
          <div className="w-80 space-y-2">
            <div className="flex justify-between py-1">
              <span>Mezisoučet:</span>
              <span className="font-medium">{subtotal.toFixed(2)} Kč</span>
            </div>
            {vatSettings.enabled && (
              <div className="flex justify-between py-1">
                <span>DPH {vatSettings.rate}%:</span>
                <span className="font-medium">{vatAmount.toFixed(2)} Kč</span>
              </div>
            )}
            <div className="border-t pt-2">
              <div className="flex justify-between text-lg font-bold">
                <span>Celkem k úhradě:</span>
                <span>{total.toFixed(2)} Kč</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  // --- HLAVNÍ RENDER ---
  return (
    <div className="max-w-6xl mx-auto p-4 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="flex border-b bg-gray-50 overflow-x-auto">
          <TabButton id="invoices" icon={FileText}>Faktury</TabButton>
          <TabButton id="customers" icon={Building}>Odběratelé</TabButton>
          <TabButton id="settings" icon={Settings}>Nastavení</TabButton>
        </div>

        <div className="p-6">
          {activeTab === 'invoices' && (
            <>
              {currentView === 'list' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Přehled faktur</h2>
                    <button
                      onClick={() => {
                        const nextInvoiceNumber = invoices.length > 0 ? Math.max(...invoices.map(inv => parseInt(inv.number.split('-')[1], 10))) + 1 : 1;
                        const newInvoice = getNewInvoice();
                        newInvoice.number = `2025-${String(nextInvoiceNumber).padStart(3, '0')}`;
                        
                        setCurrentInvoice(newInvoice);
                        setEditingInvoice(null);
                        setCurrentView('create');
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                      <Plus size={16} /> Nová faktura
                    </button>
                  </div>
                  <div className="bg-white border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-4 font-medium">Číslo</th>
                          <th className="text-left p-4 font-medium">Odběratel</th>
                          <th className="text-left p-4 font-medium">Vystaveno</th>
                          <th className="text-right p-4 font-medium">Částka</th>
                          <th className="text-center p-4 font-medium">Stav</th>
                          <th className="text-center p-4 font-medium">Akce</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((invoice) => (
                          <tr key={invoice.id} className="border-t hover:bg-gray-50">
                            <td className="p-4 font-medium">{invoice.number}</td>
                            <td className="p-4">{invoice.customer.name}</td>
                            <td className="p-4">{invoice.issueDate}</td>
                            <td className="p-4 text-right font-medium">{invoice.total.toFixed(2)} Kč</td>
                            <td className="p-4 text-center"><StatusBadge status={invoice.status} /></td>
                            <td className="p-4">
                              <div className="flex gap-2 justify-center">
                              <button onClick={() => handleDownloadPdf(invoice)} className="p-1 text-gray-600 hover:text-gray-800" title="Stáhnout PDF"><Download size={16} /></button>
                              <button onClick={() => handleShare(invoice)} className="p-1 text-gray-600 hover:text-gray-800" title="Sdílet"><Share2 size={16} /></button>
                                <button onClick={() => cloneInvoice(invoice)} className="p-1 text-purple-600 hover:text-purple-800" title="Klonovat"><Copy size={16} /></button>
                                <button onClick={() => { setCurrentInvoice(invoice); setCurrentView('preview'); }} className="p-1 text-blue-600 hover:text-blue-800" title="Zobrazit"><Eye size={16} /></button>
                                <button onClick={() => editInvoice(invoice)} className="p-1 text-gray-600 hover:text-gray-800" title="Upravit"><Edit size={16} /></button>
                                <button onClick={() => deleteInvoice(invoice.id)} className="p-1 text-red-600 hover:text-red-800" title="Smazat"><Trash2 size={16} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {currentView === 'preview' && (
                <div className="space-y-6">
                 <div className="flex items-center gap-4">
                      <button onClick={() => setCurrentView('list')} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">← Zpět na přehled</button>
                      <h2 className="text-2xl font-bold">Faktura {currentInvoice.number}</h2>
                      <div className="flex-grow"></div> {/* Odsazení */}
                      <button onClick={() => handleDownloadPdf(currentInvoice)} className="p-2 text-gray-600 hover:text-gray-800" title="Stáhnout PDF"><Download size={20} /></button>
                      <button onClick={() => handleShare(currentInvoice)} className="p-2 text-gray-600 hover:text-gray-800" title="Sdílet"><Share2 size={20} /></button>
                    </div>
                  <InvoicePreview invoice={currentInvoice} />
                </div>
              )}
              {currentView === 'create' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentView('list')} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                      ← Zpět na přehled
                    </button>
                    <h2 className="text-2xl font-bold">{editingInvoice ? `Upravit fakturu ${editingInvoice.number}` : 'Nová faktura'}</h2>
                  </div>
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                      <div className="grid md:grid-cols-2 gap-4">
                          <input type="text" placeholder="Číslo faktury" value={currentInvoice.number} onChange={(e) => setCurrentInvoice({ ...currentInvoice, number: e.target.value })} className="w-full p-2 border rounded" />
                          <input type="text" placeholder="Datum vystavení" value={currentInvoice.issueDate} onChange={(e) => setCurrentInvoice({ ...currentInvoice, issueDate: e.target.value, dueDate: calculateDueDate(e.target.value, currentInvoice.dueDays) })} className="w-full p-2 border rounded" />
                          <input type="text" placeholder="DUZP" value={currentInvoice.duzpDate} onChange={(e) => setCurrentInvoice({ ...currentInvoice, duzpDate: e.target.value })} className="w-full p-2 border rounded" />
                          <input type="number" placeholder="Splatnost (dny)" value={currentInvoice.dueDays} onChange={(e) => { const days = parseInt(e.target.value, 10) || 0; setCurrentInvoice({ ...currentInvoice, dueDays: days, dueDate: calculateDueDate(currentInvoice.issueDate, days) }); }} className="w-full p-2 border rounded" />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="text-lg font-medium">Odběratel</h3>
                          <select onChange={(e) => { if (e.target.value) { const customer = savedCustomers.find(c => c.id === e.target.value); if (customer) setCurrentInvoice({...currentInvoice, customer: { name: customer.name, address: customer.address, zip: customer.zip, city: customer.city, ico: customer.ico, dic: customer.dic }}); } }} className="px-3 py-1 border rounded text-sm">
                            <option value="">Vybrat uloženého</option>
                            {savedCustomers.map(customer => (<option key={customer.id} value={customer.id}>{customer.name}</option>))}
                          </select>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <input type="text" placeholder="Název" value={currentInvoice.customer.name} onChange={(e) => setCurrentInvoice({ ...currentInvoice, customer: { ...currentInvoice.customer, name: e.target.value } })} className="w-full p-2 border rounded" />
                            <input type="text" placeholder="Adresa" value={currentInvoice.customer.address} onChange={(e) => setCurrentInvoice({ ...currentInvoice, customer: { ...currentInvoice.customer, address: e.target.value } })} className="w-full p-2 border rounded" />
                            <input type="text" placeholder="PSČ" value={currentInvoice.customer.zip || ''} onChange={(e) => setCurrentInvoice({ ...currentInvoice, customer: { ...currentInvoice.customer, zip: e.target.value } })} className="w-full p-2 border rounded" />
                            <input type="text" placeholder="Město" value={currentInvoice.customer.city} onChange={(e) => setCurrentInvoice({ ...currentInvoice, customer: { ...currentInvoice.customer, city: e.target.value } })} className="w-full p-2 border rounded" />
                            <div className="flex items-end gap-2">
                                <div className="flex-grow">
                                <input type="text" placeholder="IČO" value={currentInvoice.customer.ico} onChange={(e) => setCurrentInvoice({ ...currentInvoice, customer: { ...currentInvoice.customer, ico: e.target.value } })} className="w-full p-2 border rounded" />
                                </div>
                                <button type="button" onClick={() => fetchFromAres(currentInvoice.customer.ico, 'invoice')} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm h-10">ARES</button>
                            </div>
                            <input type="text" placeholder="DIČ" value={currentInvoice.customer.dic} onChange={(e) => setCurrentInvoice({ ...currentInvoice, customer: { ...currentInvoice.customer, dic: e.target.value } })} className="w-full p-2 border rounded" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium mb-3">Položky</h3>
                        <div className="space-y-3">
                          {currentInvoice.items.map((item) => (
                            <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-white p-3 rounded border">
                              <div className="col-span-4"><input type="text" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} className="w-full p-1 border rounded text-sm" placeholder="Popis" /></div>
                              <div className="col-span-2"><input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} className="w-full p-1 border rounded text-sm" placeholder="Počet" /></div>
                              <div className="col-span-1"><input type="text" value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)} className="w-full p-1 border rounded text-sm" placeholder="MJ" /></div>
                              <div className="col-span-2"><input type="number" value={item.pricePerUnit} onChange={(e) => updateItem(item.id, 'pricePerUnit', parseFloat(e.target.value) || 0)} className="w-full p-1 border rounded text-sm" placeholder="Cena" step="0.01" /></div>
                              <div className="col-span-2"><input type="text" value={Number(item.totalPrice).toFixed(2)} readOnly className="w-full p-1 border rounded text-sm bg-gray-50" /></div>
                              <div className="col-span-1 flex justify-center"><button onClick={() => removeItem(item.id)} className="p-1 text-red-600 hover:text-red-800"><Trash2 size={16} /></button></div>
                            </div>
                          ))}
                        </div>
                        <button onClick={addItem} className="mt-3 flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"><Plus size={16} /> Přidat položku</button>
                      </div>
                      <div className="flex gap-4 pt-4">
                        <button onClick={saveInvoice} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"><Save size={16} />{editingInvoice ? 'Uložit změny' : 'Vytvořit fakturu'}</button>
                        <button onClick={() => setCurrentView('list')} className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">Zrušit</button>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium mb-4">Náhled faktury</h3>
                      <InvoicePreview invoice={currentInvoice} showActions={false} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              {customerView === 'list' && (
                <>
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Přehled odběratelů</h2>
                    <button onClick={() => { setEditingCustomer({ name: '', address: '', zip: '', city: '', ico: '', dic: '', notes:'' }); setCustomerView('edit'); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                      <Plus size={16} /> Nový odběratel
                    </button>
                  </div>
                  <div className="bg-white border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-4 font-medium">Název</th>
                          <th className="text-left p-4 font-medium">IČO</th>
                          <th className="text-left p-4 font-medium">Město</th>
                          <th className="text-center p-4 font-medium">Akce</th>
                        </tr>
                      </thead>
                      <tbody>
                        {savedCustomers.map(customer => (
                          <tr key={customer.id} className="border-t hover:bg-gray-50">
                            <td className="p-4 font-medium">{customer.name}</td>
                            <td className="p-4">{customer.ico}</td>
                            <td className="p-4">{customer.city}</td>
                            <td className="p-4">
                                <div className="flex gap-2 justify-center">
                                  <button onClick={() => selectCustomerAndCreateInvoice(customer)} className="p-1 text-green-600 hover:text-green-800" title="Vytvořit fakturu"><FileText size={16} /></button>
                                  <button onClick={() => editCustomer(customer)} className="p-1 text-gray-600 hover:text-gray-800" title="Upravit"><Edit size={16} /></button>
                                  <button onClick={() => deleteCustomer(customer.id)} className="p-1 text-red-600 hover:text-red-800" title="Smazat"><Trash2 size={16} /></button>
                                </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {customerView === 'edit' && editingCustomer && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <button onClick={() => setCustomerView('list')} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                        ← Zpět na přehled
                      </button>
                      <h2 className="text-2xl font-bold">{editingCustomer.id ? `Upravit odběratele` : 'Nový odběratel'}</h2>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-6 grid md:grid-cols-2 gap-4">
                       <input type="text" placeholder="Název firmy" value={editingCustomer.name} onChange={(e) => setEditingCustomer({...editingCustomer, name: e.target.value})} className="md:col-span-2 w-full p-2 border rounded" />
                       <input type="text" placeholder="Adresa" value={editingCustomer.address} onChange={(e) => setEditingCustomer({...editingCustomer, address: e.target.value})} className="w-full p-2 border rounded" />
                       <input type="text" placeholder="PSČ" value={editingCustomer.zip || ''} onChange={(e) => setEditingCustomer({...editingCustomer, zip: e.target.value})} className="w-full p-2 border rounded" />
                       <input type="text" placeholder="Město" value={editingCustomer.city} onChange={(e) => setEditingCustomer({...editingCustomer, city: e.target.value})} className="w-full p-2 border rounded" />
                       <div className="flex items-end gap-2">
                            <div className="flex-grow">
                               <input type="text" placeholder="IČO" value={editingCustomer.ico || ''} onChange={(e) => setEditingCustomer({...editingCustomer, ico: e.target.value})} className="w-full p-2 border rounded" />
                            </div>
                            <button type="button" onClick={() => fetchFromAres(editingCustomer.ico, 'customer')} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm h-10">ARES</button>
                       </div>
                       <input type="text" placeholder="DIČ" value={editingCustomer.dic || ''} onChange={(e) => setEditingCustomer({...editingCustomer, dic: e.target.value})} className="w-full p-2 border rounded" />
                       <textarea value={editingCustomer.notes || ''} onChange={(e) => setEditingCustomer({...editingCustomer, notes: e.target.value})} placeholder="Poznámky..." rows="3" className="md:col-span-2 w-full p-2 border rounded" />
                    </div>
                    <div className="flex gap-4">
                        <button onClick={saveCustomer} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"><Save size={16}/>Uložit</button>
                        <button onClick={() => { setCustomerView('list'); setEditingCustomer(null); }} className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">Zrušit</button>
                    </div>
                  </div>
              )}
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Nastavení</h2>
              <div className="bg-white p-6 rounded-lg border">
                <h3 className="text-lg font-medium mb-4">Logo firmy</h3>
                <div className="flex items-center gap-4">
                  {(logoPreview || supplier.logoUrl) && (
                    <div className="w-20 h-20 border rounded flex items-center justify-center bg-gray-50 overflow-hidden">
                      <img src={logoPreview || supplier.logoUrl} alt="Logo firmy" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"><Upload size={16} /> Nahrát logo</button>
                    {supplier.logoUrl && (<button onClick={() => {setSupplier({ ...supplier, logoUrl: '' }); setLogoPreview('');}} className="ml-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Odstranit</button>)}
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg border">
                <h3 className="text-lg font-medium mb-4">Nastavení DPH</h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={vatSettings.enabled} onChange={(e) => setVatSettings({ ...vatSettings, enabled: e.target.checked })} className="w-4 h-4" />
                    <span>Jsem plátce DPH</span>
                  </label>
                  {vatSettings.enabled && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Sazba DPH (%)</label>
                      <input type="number" value={vatSettings.rate} onChange={(e) => setVatSettings({ ...vatSettings, rate: parseFloat(e.target.value) || 0 })} className="w-32 p-2 border rounded" />
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg border">
                <h3 className="text-lg font-medium mb-4">Údaje dodavatele</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <input type="text" placeholder="Název/Jméno" value={supplier.name} onChange={(e) => setSupplier({ ...supplier, name: e.target.value })} className="w-full p-2 border rounded" />
                  <input type="text" placeholder="Adresa" value={supplier.address} onChange={(e) => setSupplier({ ...supplier, address: e.target.value })} className="w-full p-2 border rounded" />
                  <input type="text" placeholder="PSČ" value={supplier.zip || ''} onChange={(e) => setSupplier({ ...supplier, zip: e.target.value })} className="w-full p-2 border rounded" />
                  <input type="text" placeholder="Město" value={supplier.city} onChange={(e) => setSupplier({ ...supplier, city: e.target.value })} className="w-full p-2 border rounded" />
                  <input type="text" placeholder="IČO" value={supplier.ico} onChange={(e) => setSupplier({ ...supplier, ico: e.target.value })} className="w-full p-2 border rounded" />
                  <input type="text" placeholder="DIČ" value={supplier.dic} onChange={(e) => setSupplier({ ...supplier, dic: e.target.value })} className="w-full p-2 border rounded" />
                  <input type="text" placeholder="Bankovní účet" value={supplier.bankAccount} onChange={(e) => setSupplier({ ...supplier, bankAccount: e.target.value })} className="w-full p-2 border rounded" />
                </div>
              </div>
              <div className="mt-4">
                <button onClick={saveSettings} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                  <Save size={16} /> Uložit nastavení
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CzechInvoiceGenerator;
