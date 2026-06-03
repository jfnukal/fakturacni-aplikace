import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Upload, Save, AlertCircle, Building } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IMaskInput } from 'react-imask';
import DeliveryNotesImportTool from '../components/DeliveryNotesImportTool';
import toast from 'react-hot-toast';
import { useAresLookup } from '../hooks/useAresLookup';
import SignaturePad from '../components/SignaturePad';

// --- Funkce pro validaci českého čísla účtu ---
const validateCzechBankAccount = (accountString) => {
  if (!accountString || accountString === '/') return true; // Povolíme prázdné pole
  if (!/^((\d{1,6})-)?(\d{2,10})\/(\d{4})$/.test(accountString)) {
    return false; // Nesplňuje základní formát
  }
  const parts = accountString.replace('-', '/').split('/');
  const [prefix, number] =
    parts.length === 3 ? [parts[0], parts[1]] : ['', parts[0]];

  const weights = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1];

  const validatePart = (numStr) => {
    if (!numStr || numStr.length === 0) return true;
    let sum = 0;
    for (let i = 0; i < numStr.length; i++) {
      sum +=
        parseInt(numStr[i], 10) * weights[weights.length - numStr.length + i];
    }
    return sum % 11 === 0;
  };

  if (!validatePart(prefix)) return false;
  if (!validatePart(number)) return false;

  return true;
};
// ----------------------------------------------------

const SettingsPage = ({
  currentUser,
  savedCustomers,
  products,
  deliveryNotes,
}) => {
  const { t } = useTranslation();
  // const { currentUser } = useAuth();
  const [supplier, setSupplier] = useState({
    name: '',
    address: '',
    zip: '',
    city: '',
    ico: '',
    dic: '',
    bankAccount: '',
    paymentMethod: 'Převodem',
    logoUrl: '',
    financniUrad: '',
    stampUrl: '',
    signatureUrl: '',
  });
  const [vatSettings, setVatSettings] = useState({
    enabled: false,
    defaultRate: 21,
  });
  const [logoPreview, setLogoPreview] = useState('');
  const [stampPreview, setStampPreview] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState(null); // null=beze změny, 'data:...'=nový podpis
  const fileInputRef = useRef(null);
  const stampFileInputRef = useRef(null);
  const [bankAccountError, setBankAccountError] = useState('');
  const { fetchFromAres, isLoading: aresLoading } = useAresLookup();

  const handleAresLookup = async (ico) => {
    const aresData = await fetchFromAres(ico);
    if (aresData) {
      setSupplier((prev) => ({
        ...prev,
        ...aresData,
        // Zachováme registeringAuthority z předchozích dat, pokud ARES nic nový nevrátí
        registeringAuthority:
          aresData.registeringAuthority || prev.registeringAuthority || '',
      }));
      toast.success('Údaje o firmě byly úspěšně načteny z ARESu!');
    }
  };

  const [prefix, setPrefix] = useState('');
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    const fullAccount = supplier.bankAccount || '';
    const [mainPart = '', codePart = ''] = fullAccount.split('/');
    const [prefixPart = '', numberPart = ''] = mainPart.includes('-')
      ? mainPart.split('-')
      : ['', mainPart];
    setPrefix(prefixPart);
    setNumber(numberPart);
    setCode(codePart);
  }, [supplier.bankAccount]);

  useEffect(() => {
    const currentFullAccount = supplier.bankAccount || '';
    let newAccountString = '';

    if (prefix || number || code) {
      newAccountString = prefix
        ? `${prefix}-${number}/${code}`
        : `${number}/${code}`;
    }

    if (newAccountString !== currentFullAccount) {
      setSupplier((prev) => ({ ...prev, bankAccount: newAccountString }));
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
    if (
      supplier.bankAccount &&
      !validateCzechBankAccount(supplier.bankAccount)
    ) {
      setBankAccountError('Zadané číslo účtu není platné.');
      return;
    }

    if (!currentUser) return;

    // Pokud má uživatel nakreslený nový podpis, uploaduj ho do Storage
    let finalSupplier = { ...supplier };
    if (signatureDataUrl && signatureDataUrl.startsWith('data:')) {
      try {
        const response = await fetch(signatureDataUrl);
        const blob = await response.blob();
        const sRef = ref(storage, `signatures/${currentUser.uid}/signature.png`);
        await uploadBytes(sRef, blob);
        finalSupplier.signatureUrl = await getDownloadURL(sRef);
      } catch (err) {
        console.error('Chyba při nahrávání podpisu:', err);
        alert('Chyba při nahrávání podpisu.');
        return;
      }
    }

    try {
      await setDoc(doc(db, 'settings', currentUser.uid), {
        supplierDetails: finalSupplier,
        vatDetails: vatSettings,
        userId: currentUser.uid,
      });
      setSignatureDataUrl(null); // reset po uložení
      alert('Nastavení uloženo!');
      setBankAccountError('');
    } catch (error) {
      console.error('Chyba při ukládání nastavení: ', error);
      alert('Chyba při ukládání nastavení.');
    }
  };

  const handleBankAccountBlur = () => {
    if (
      supplier.bankAccount &&
      !validateCzechBankAccount(supplier.bankAccount)
    ) {
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
    const storageRef = ref(
      storage,
      `logos/${currentUser.uid}/${Date.now()}_${file.name}`
    );
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

  const handleStampUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Obrázek je příliš velký. Maximum jsou 2MB.');
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setStampPreview(localUrl);
    const storageRef = ref(
      storage,
      `stamps/${currentUser.uid}/${Date.now()}_${file.name}`
    );
    try {
      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);
      setSupplier((prev) => ({ ...prev, stampUrl: fileUrl }));
      alert('Razítko úspěšně nahráno. Nezapomeňte uložit nastavení.');
    } catch (error) {
      console.error('Chyba při nahrávání razítka:', error);
      alert('Chyba při nahrávání razítka.');
      setStampPreview('');
    }
    // Reset file input so same file can be re-selected
    event.target.value = '';
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('settingsTitle')}</h2>

      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-medium mb-4">{t('supplierDetails')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-x-6 gap-y-4">
          <div className="md:col-span-3">
            <label
              htmlFor="company-name"
              className="block text-sm font-medium text-gray-700"
            >
              {t('placeholder_companyName')}
            </label>
            <input
              type="text"
              id="company-name"
              placeholder="Firma s.r.o."
              value={supplier.name}
              onChange={(e) =>
                setSupplier({ ...supplier, name: e.target.value })
              }
              className="mt-1 w-full p-2 border rounded"
            />
          </div>
          <div className="md:col-span-3">
            <label
              htmlFor="address"
              className="block text-sm font-medium text-gray-700"
            >
              {t('placeholder_address')}
            </label>
            <input
              type="text"
              id="address"
              placeholder="Hlavní 123"
              value={supplier.address}
              onChange={(e) =>
                setSupplier({ ...supplier, address: e.target.value })
              }
              className="mt-1 w-full p-2 border rounded"
            />
          </div>
          <div className="md:col-span-2">
            <label
              htmlFor="zip"
              className="block text-sm font-medium text-gray-700"
            >
              {t('placeholder_zip')}
            </label>
            <input
              type="text"
              id="zip"
              placeholder="700 30"
              value={supplier.zip || ''}
              onChange={(e) =>
                setSupplier({ ...supplier, zip: e.target.value })
              }
              className="mt-1 w-full p-2 border rounded"
            />
          </div>
          <div className="md:col-span-4">
            <label
              htmlFor="city"
              className="block text-sm font-medium text-gray-700"
            >
              {t('placeholder_city')}
            </label>
            <input
              type="text"
              id="city"
              placeholder="Ostrava"
              value={supplier.city}
              onChange={(e) =>
                setSupplier({ ...supplier, city: e.target.value })
              }
              className="mt-1 w-full p-2 border rounded"
            />
          </div>
          <div className="md:col-span-3">
                <label htmlFor="ico" className="block text-sm font-medium text-gray-700">{t('placeholder_ico')}</label>
                <div className="flex items-center gap-2 mt-1">
                    <input 
                        type="text" 
                        id="ico" 
                        placeholder="12345678" 
                        value={supplier.ico} 
                        onChange={(e) => setSupplier({ ...supplier, ico: e.target.value })} 
                        className="w-full p-2 border rounded" 
                    />
                    <button
                        type="button"
                        onClick={() => handleAresLookup(supplier.ico)}
                        disabled={aresLoading}
                        className="p-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                        title="Načíst údaje z ARESu"
                    >
                        {aresLoading ? '…' : <Building size={20} />}
                    </button>
                </div>
            </div>
          <div className="md:col-span-3">
            <label
              htmlFor="dic"
              className="block text-sm font-medium text-gray-700"
            >
              {t('placeholder_dic')}{' '}
              <span className="text-gray-400">(nepovinné)</span>
            </label>
            <input
              type="text"
              id="dic"
              placeholder="CZ12345678"
              value={supplier.dic}
              onChange={(e) =>
                setSupplier({ ...supplier, dic: e.target.value })
              }
              className="mt-1 w-full p-2 border rounded"
            />
          </div>

          <div className="md:col-span-6">
  <label 
    htmlFor="registering-authority" 
    className="block text-sm font-medium text-gray-700"
  >
    Živnostenský úřad (doplňte, pokud ARES nenašel)
  </label>
  <input
    type="text"
    id="registering-authority"
    placeholder="např. Městský úřad Bruntál"
    value={supplier.registeringAuthority || ''}
    onChange={(e) => 
      setSupplier({ ...supplier, registeringAuthority: e.target.value })
    }
    className="mt-1 w-full p-2 border rounded"
  />
</div>

          {/* --- Nový, vizuálně sjednocený input pro bankovní účet --- */}
          <div className="md:col-span-3">
            <label
              htmlFor="bank-prefix"
              className="block text-sm font-medium text-gray-700"
            >
              {t('bankAccount')}
            </label>
            {/* Trik je v tomto vnějším divu, který se tváří jako input */}
            <div
              onBlur={handleBankAccountBlur}
              className={`flex items-center mt-1 border rounded w-full transition-colors duration-200 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 ${
                bankAccountError ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <IMaskInput
                mask={'000000'}
                value={prefix}
                onAccept={(value) => setPrefix(value)}
                placeholder="Prefix"
                className="p-2 border-0 focus:ring-0 bg-transparent text-right w-20"
              />
              <span className="px-1 text-gray-400">-</span>
              <IMaskInput
                mask={'0000000000'}
                value={number}
                onAccept={(value) => setNumber(value)}
                placeholder="Číslo účtu"
                className="p-2 border-0 focus:ring-0 bg-transparent flex-grow"
              />
              <span className="px-1 text-gray-400">/</span>
              <IMaskInput
                mask={'0000'}
                value={code}
                onAccept={(value) => setCode(value)}
                placeholder="Kód"
                className="p-2 border-0 focus:ring-0 bg-transparent w-16"
              />
            </div>
            {bankAccountError && (
              <div className="text-red-600 text-sm mt-1 flex items-center gap-1">
                <AlertCircle size={14} /> {bankAccountError}
              </div>
            )}
          </div>

          <div className="md:col-span-3 flex items-end pb-1">
            <div className="space-y-3">
              <label className="flex items-center gap-3 w-full">
                <input
                  type="checkbox"
                  checked={vatSettings.enabled}
                  onChange={(e) =>
                    setVatSettings({
                      ...vatSettings,
                      enabled: e.target.checked,
                    })
                  }
                  className="w-4 h-4"
                />
                <span>{t('vatPayer')}</span>
              </label>

              {vatSettings.enabled && (
                <div className="pl-7 space-y-2">
                  <label
                    htmlFor="default-vat"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Výchozí sazba DPH pro nové položky
                  </label>
                  <select
                    id="default-vat"
                    value={vatSettings.defaultRate || 21}
                    onChange={(e) =>
                      setVatSettings({
                        ...vatSettings,
                        defaultRate: parseInt(e.target.value, 10),
                      })
                    }
                    className="mt-1 w-full max-w-xs p-2 border rounded"
                  >
                    <option value="21">21% (základní)</option>
                    <option value="12">12% (snížená)</option>
                    <option value="0">0% (bez DPH)</option>
                  </select>
                  <div className="text-xs text-gray-500">
                    Tato sazba se automaticky předvyplní u nových položek na
                    faktuře.
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
          {(logoPreview || supplier.logoUrl) && (
            <div className="w-20 h-20 border rounded flex items-center justify-center bg-gray-50 overflow-hidden">
              <img
                src={logoPreview || supplier.logoUrl}
                alt="Logo firmy"
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Upload size={16} /> {t('uploadLogo')}
            </button>
            {(supplier.logoUrl || logoPreview) && (
              <button
                onClick={() => {
                  setLogoPreview('');
                  setSupplier({ ...supplier, logoUrl: '' });
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                {t('remove')}
              </button>
            )}
            <div className="text-xs text-gray-500">{t('maxFileSize')}</div>
          </div>
        </div>
      </div>

      {/* Razítko a podpis */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-medium mb-5">Razítko a podpis</h3>

        {/* ── Razítko ── */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-1">Razítko</h4>
          <p className="text-xs text-gray-500 mb-3">
            Nahrajte obrázek razítka. Doporučujeme PNG s průhledným pozadím.
          </p>
          <div className="flex items-center gap-4">
            {(stampPreview || supplier.stampUrl) && (
              <div className="w-24 h-24 border rounded flex items-center justify-center bg-gray-50 overflow-hidden">
                <img
                  src={stampPreview || supplier.stampUrl}
                  alt="Razítko"
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <input
                ref={stampFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleStampUpload}
                className="hidden"
              />
              <button
                onClick={() => stampFileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Upload size={16} /> Nahrát razítko
              </button>
              {(supplier.stampUrl || stampPreview) && (
                <button
                  onClick={() => {
                    setStampPreview('');
                    setSupplier((prev) => ({ ...prev, stampUrl: '' }));
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Odebrat razítko
                </button>
              )}
              <div className="text-xs text-gray-500">Maximální velikost 2 MB</div>
            </div>
          </div>
        </div>

        {/* ── Podpis ── */}
        <div className="border-t pt-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-1">Podpis</h4>
          <p className="text-xs text-gray-500 mb-3">
            Nakreslete váš podpis níže modrou propiskú. Uloží se při kliknutí na „Uložit nastavení".
          </p>
          <SignaturePad
            existingUrl={supplier.signatureUrl}
            onChange={(dataUrl) => setSignatureDataUrl(dataUrl)}
            onRemove={() => {
              setSupplier((prev) => ({ ...prev, signatureUrl: '' }));
              setSignatureDataUrl(null);
            }}
          />
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
        <button
          onClick={saveSettings}
          className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          <Save size={16} /> {t('saveSettings')}
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
