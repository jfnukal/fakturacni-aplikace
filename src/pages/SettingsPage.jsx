import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Upload, Save, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IMaskInput } from 'react-imask';
import DeliveryNotesImportTool from '../components/DeliveryNotesImportTool';

// --- Funkce pro validaci českého čísla účtu ---
const validateCzechBankAccount = (accountString) => {
  if (!accountString || accountString === '/') return true; // Povolíme prázdné pole
  if (!/^((\d{1,6})-)?(\d{2,10})\/(\d{4})$/.test(accountString)) {
    return false; // Nesplňuje základní formát
  }
  const parts = accountString.replace('-', '/').split('/');
  const [prefix, number] = parts.length === 3 ? [parts[0], parts[1]] : ['', parts[0]];
  
  const weights = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1];

  const validatePart = (numStr) => {
    if (!numStr || numStr.length === 0) return true;
    let sum = 0;
    for (let i = 0; i < numStr.length; i++) {
      sum += parseInt(numStr[i], 10) * weights[weights.length - numStr.length + i];
    }
    return sum % 11 === 0;
  };
  
  if (!validatePart(prefix)) return false;
  if (!validatePart(number)) return false;

  return true;
};
// ----------------------------------------------------

const SettingsPage = ({ currentUser, savedCustomers, products, deliveryNotes }) => {
  const { t } = useTranslation();
  // const { currentUser } = useAuth();
  const [supplier, setSupplier] = useState({ name: '', address: '', zip: '', city: '', ico: '', dic: '', bankAccount: '', paymentMethod: 'Převodem', logoUrl: '' });
  const [vatSettings, setVatSettings] = useState({ enabled: false, rate: 21, rates: [21] });
  const [logoPreview, setLogoPreview] = useState('');
  const fileInputRef = useRef(null);
  const [bankAccountError, setBankAccountError] = useState('');

  const [prefix, setPrefix] = useState('');
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    const fullAccount = supplier.bankAccount || '';
    const [mainPart = '', codePart = ''] = fullAccount.split('/');
    const [prefixPart = '', numberPart = ''] = mainPart.includes('-') ? mainPart.split('-') : ['', mainPart];
    setPrefix(prefixPart);
    setNumber(numberPart);
    setCode(codePart);
  }, [supplier.bankAccount]);

  useEffect(() => {
    const currentFullAccount = supplier.bankAccount || '';
    let newAccountString = '';
    
    if (prefix || number || code) {
      newAccountString = prefix ? `${prefix}-${number}/${code}` : `${number}/${code}`;
    }

    if (newAccountString !== currentFullAccount) {
      setSupplier(prev => ({ ...prev, bankAccount: newAccountString }));
    }
  }, [prefix, number, code]);

  useEffect(() => {
    if (!currentUser) return;
    const settingsDocRef = doc(db, 'settings', currentUser.uid);
    const unsubscribe = onSnapshot(settingsDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.supplierDetails) setSupplier(data.supplierDetails);
        if (data.vatDetails) setVatSettings(data.vatDetails);
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  const saveSettings = async () => {
    if (supplier.bankAccount && !validateCzechBankAccount(supplier.bankAccount)) {
      setBankAccountError('Zadané číslo účtu není platné.');
      return;
    }
    
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'settings', currentUser.uid), {
        supplierDetails: supplier,
        vatDetails: vatSettings,
        userId: currentUser.uid,
      });
      alert('Nastavení uloženo!');
      setBankAccountError('');
    } catch (error) {
      console.error("Chyba při ukládání nastavení: ", error);
      alert('Chyba při ukládání nastavení.');
    }
  };
  
  const handleBankAccountBlur = () => {
    if (supplier.bankAccount && !validateCzechBankAccount(supplier.bankAccount)) {
      setBankAccountError('Zadané číslo účtu není platné.');
    } else {
      setBankAccountError('');
    }
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Obrázek je příliš velký. Maximum jsou 2MB.');
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setLogoPreview(localUrl);
    const storageRef = ref(storage, `logos/${currentUser.uid}/${Date.now()}_${file.name}`);
    try {
      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);
      setSupplier({ ...supplier, logoUrl: fileUrl });
      alert('Logo úspěšně nahráno. Nezapomeňte uložit nastavení.');
    } catch (error) {
      console.error('Chyba při nahrávání loga: ', error);
      alert('Chyba při nahrávání loga.');
      setLogoPreview('');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('settingsTitle')}</h2>

      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-medium mb-4">{t('supplierDetails')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-x-6 gap-y-4">
          <div className="md:col-span-3">
            <label htmlFor="company-name" className="block text-sm font-medium text-gray-700">{t('placeholder_companyName')}</label>
            <input type="text" id="company-name" placeholder="Firma s.r.o." value={supplier.name} onChange={(e) => setSupplier({ ...supplier, name: e.target.value })} className="mt-1 w-full p-2 border rounded" />
          </div>
          <div className="md:col-span-3">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">{t('placeholder_address')}</label>
            <input type="text" id="address" placeholder="Hlavní 123" value={supplier.address} onChange={(e) => setSupplier({ ...supplier, address: e.target.value })} className="mt-1 w-full p-2 border rounded" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="zip" className="block text-sm font-medium text-gray-700">{t('placeholder_zip')}</label>
            <input type="text" id="zip" placeholder="700 30" value={supplier.zip || ''} onChange={(e) => setSupplier({ ...supplier, zip: e.target.value })} className="mt-1 w-full p-2 border rounded" />
          </div>
          <div className="md:col-span-4">
            <label htmlFor="city" className="block text-sm font-medium text-gray-700">{t('placeholder_city')}</label>
            <input type="text" id="city" placeholder="Ostrava" value={supplier.city} onChange={(e) => setSupplier({ ...supplier, city: e.target.value })} className="mt-1 w-full p-2 border rounded" />
          </div>
          <div className="md:col-span-3">
            <label htmlFor="ico" className="block text-sm font-medium text-gray-700">{t('placeholder_ico')}</label>
            <input type="text" id="ico" placeholder="12345678" value={supplier.ico} onChange={(e) => setSupplier({ ...supplier, ico: e.target.value })} className="mt-1 w-full p-2 border rounded" />
          </div>
          <div className="md:col-span-3">
            <label htmlFor="dic" className="block text-sm font-medium text-gray-700">{t('placeholder_dic')} <span className="text-gray-400">(nepovinné)</span></label>
            <input type="text" id="dic" placeholder="CZ12345678" value={supplier.dic} onChange={(e) => setSupplier({ ...supplier, dic: e.target.value })} className="mt-1 w-full p-2 border rounded" />
          </div>
          
          {/* --- Nový, vizuálně sjednocený input pro bankovní účet --- */}
          <div className="md:col-span-3">
            <label htmlFor="bank-prefix" className="block text-sm font-medium text-gray-700">{t('bankAccount')}</label>
            {/* Trik je v tomto vnějším divu, který se tváří jako input */}
            <div 
              onBlur={handleBankAccountBlur}
              className={`flex items-center mt-1 border rounded w-full transition-colors duration-200 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 ${bankAccountError ? 'border-red-500' : 'border-gray-300'}`}
            >
              <IMaskInput mask={'000000'} value={prefix} onAccept={(value) => setPrefix(value)} placeholder="Prefix" className="p-2 border-0 focus:ring-0 bg-transparent text-right w-20" />
              <span className="px-1 text-gray-400">-</span>
              <IMaskInput mask={'0000000000'} value={number} onAccept={(value) => setNumber(value)} placeholder="Číslo účtu" className="p-2 border-0 focus:ring-0 bg-transparent flex-grow" />
              <span className="px-1 text-gray-400">/</span>
              <IMaskInput mask={'0000'} value={code} onAccept={(value) => setCode(value)} placeholder="Kód" className="p-2 border-0 focus:ring-0 bg-transparent w-16" />
            </div>
            {bankAccountError && <div className="text-red-600 text-sm mt-1 flex items-center gap-1"><AlertCircle size={14}/> {bankAccountError}</div>}
          </div>

          <div className="md:col-span-3 flex items-end pb-1">
          <div className="space-y-3">
              <label className="flex items-center gap-3 w-full">
                <input type="checkbox" checked={vatSettings.enabled} onChange={(e) => setVatSettings({ ...vatSettings, enabled: e.target.checked })} className="w-4 h-4" />
                <span>{t('vatPayer')}</span>
              </label>
              
              {vatSettings.enabled && (
                <div className="pl-7 space-y-2">
                  <div className="text-sm font-medium text-gray-700">DPH sazby:</div>
                  <div className="flex gap-2 flex-wrap">
                    {[0, 12, 21].map(rate => (
                      <label key={rate} className="flex items-center gap-1 text-sm">
                        <input 
                          type="checkbox" 
                          checked={(vatSettings.rates || [21]).includes(rate)}
                          onChange={(e) => {
                            const currentRates = vatSettings.rates || [21];
                            const newRates = e.target.checked 
                              ? [...currentRates, rate].sort((a,b) => a-b)
                              : currentRates.filter(r => r !== rate);
                            setVatSettings({ ...vatSettings, rates: newRates.length > 0 ? newRates : [21] });
                          }}
                          className="w-3 h-3" 
                        />
                        <span>{rate}%</span>
                      </label>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500">
                    Standardní sazby: 0% (bez DPH), 12% (snížená), 21% (základní)
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-medium mb-4">{t('companyLogo')}</h3>
        <div className="flex items-center gap-4">
          {(logoPreview || supplier.logoUrl) && ( <div className="w-20 h-20 border rounded flex items-center justify-center bg-gray-50 overflow-hidden"><img src={logoPreview || supplier.logoUrl} alt="Logo firmy" className="w-full h-full object-contain" /></div>)}
          <div className="flex flex-col gap-2">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"><Upload size={16} /> {t('uploadLogo')}</button>
            {(supplier.logoUrl || logoPreview) && (<button onClick={() => { setLogoPreview(''); setSupplier({ ...supplier, logoUrl: '' }); }} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">{t('remove')}</button>)}
            <div className="text-xs text-gray-500">{t('maxFileSize')}</div>
          </div>
        </div>
      </div>

      {/* Import dodacích listů */}
        <div className="mt-8">
          <DeliveryNotesImportTool 
            currentUser={currentUser}
            savedCustomers={savedCustomers || []}
            products={products || []}
            onImportComplete={(count) => {
              alert(`Úspěšně importováno ${count} dodacích listů!`);
            }}
          />
        </div>

      <div className="mt-4">
        <button onClick={saveSettings} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"><Save size={16} /> {t('saveSettings')}</button>
      </div>
    </div>
  );
};

export default SettingsPage;
