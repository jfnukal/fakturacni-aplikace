import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Upload, Save } from 'lucide-react';

const SettingsPage = () => {
  const { currentUser } = useAuth();
  const [supplier, setSupplier] = useState({ name: '', address: '', zip: '', city: '', ico: '', dic: '', bankAccount: '', paymentMethod: 'Převodem', logoUrl: '' });
  const [vatSettings, setVatSettings] = useState({ enabled: false, rate: 21 });
  const [logoPreview, setLogoPreview] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;
    const settingsDocRef = doc(db, 'settings', currentUser.uid);
    const unsubscribe = onSnapshot(settingsDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.supplierDetails) setSupplier(data.supplierDetails);
        if (data.vatDetails) setVatSettings(data.vatDetails);
      } else {
        setSupplier({ name: currentUser.displayName || '', address: '', zip: '', city: '', ico: '', dic: '', bankAccount: '', paymentMethod: 'Převodem', logoUrl: '' });
        setVatSettings({ enabled: false, rate: 21 });
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    return () => { if (logoPreview) URL.revokeObjectURL(logoPreview); };
  }, [logoPreview]);

  const saveSettings = async () => {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'settings', currentUser.uid), {
        supplierDetails: supplier,
        vatDetails: vatSettings,
        userId: currentUser.uid,
      });
      alert('Nastavení uloženo!');
    } catch (error) {
      console.error("Chyba při ukládání nastavení: ", error);
      alert('Chyba při ukládání nastavení.');
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
      <h2 className="text-2xl font-bold">Nastavení</h2>
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-medium mb-4">Logo firmy</h3>
        <div className="flex items-center gap-4">
          {(logoPreview || supplier.logoUrl) && (
            <div className="w-20 h-20 border rounded flex items-center justify-center bg-gray-50 overflow-hidden">
              <img src={logoPreview || supplier.logoUrl} alt="Logo firmy" className="w-full h-full object-contain" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              <Upload size={16} /> Nahrát logo
            </button>
            {(supplier.logoUrl || logoPreview) && (
              <button onClick={() => { setLogoPreview(''); setSupplier({ ...supplier, logoUrl: '' }); }} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                Odstranit
              </button>
            )}
             <div className="text-xs text-gray-500">Max 2MB</div>
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
  );
};
export default SettingsPage;
