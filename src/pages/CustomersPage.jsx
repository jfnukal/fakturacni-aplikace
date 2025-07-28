// Soubor: src/pages/CustomersPage.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { addDoc, doc, updateDoc, deleteDoc, collection } from 'firebase/firestore';
import { Plus, FileText, Edit, Trash2, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const CustomersPage = ({ savedCustomers, setActiveTab, creationRequest, setCreationRequest, selectCustomerForNewInvoice }) => {
  // ZDE JE KLÍČOVÁ KONTROLA: Musí zde být { t }, aby se z objektu vytáhla překladová funkce.
  const { t } = useTranslation(); 
  const { currentUser } = useAuth();
  const [customerView, setCustomerView] = useState('list');
  const [editingCustomer, setEditingCustomer] = useState(null);

  useEffect(() => {
    if (creationRequest === 'customer') {
      setEditingCustomer({ name: '', address: '', zip: '', city: '', ico: '', dic: '', notes: '' });
      setCustomerView('edit');
      setCreationRequest(null);
    }
  }, [creationRequest, setCreationRequest]);

  const fetchFromAres = async (ico) => {
    if (!ico || !/^\d{8}$/.test(ico)) {
      alert(t('customers_page.alert.invalid_ico'));
      return;
    }
    const proxiedUrl = `/.netlify/functions/ares?ico=${ico}`;
    try {
      const response = await fetch(proxiedUrl);
      if (!response.ok) {
        if (response.status === 404) {
          alert(t('customers_page.alert.company_not_found'));
        } else {
          throw new Error(t('customers_page.alert.ares_error'));
        }
        return;
      }
      const data = await response.json();
      const subject = data;
      if (!subject || !subject.obchodniJmeno) {
        alert(t('customers_page.alert.company_not_found'));
        return;
      }
      const aresData = {
        name: subject.obchodniJmeno,
        address: `${subject.sidlo?.ulice || ''} ${subject.sidlo?.cisloOrientacni || ''}`.trim(),
        zip: subject.sidlo?.psc || '',
        city: subject.sidlo?.nazevObce || '',
        ico: subject.ico,
        dic: subject.dic || '',
      };
      setEditingCustomer((prev) => ({ ...prev, ...aresData }));
    } catch (error) {
      alert(error.message || t('customers_page.alert.ares_fetch_failed'));
    }
  };

  const saveCustomer = async () => {
    if (!editingCustomer || !editingCustomer.name) {
      alert(t('customers_page.alert.name_required'));
      return;
    }
    const { id, ...customerData } = editingCustomer;
    const customerToSave = { ...customerData, userId: currentUser.uid };
    try {
      if (id) {
        await updateDoc(doc(db, 'customers', id), customerToSave);
      } else {
        await addDoc(collection(db, 'customers'), customerToSave);
      }
      setCustomerView('list');
      setEditingCustomer(null);
    } catch (error) {
      console.error('Chyba: ', error);
    }
  };

  const deleteCustomer = async (id) => {
    if (window.confirm(t('customers_page.alert.confirm_delete'))) {
      await deleteDoc(doc(db, 'customers', id));
    }
  };

  const editCustomer = (customer) => {
    setEditingCustomer(customer);
    setCustomerView('edit');
  };

  const handleCreateInvoice = (customer) => {
    if (selectCustomerForNewInvoice) {
      selectCustomerForNewInvoice(customer);
    }
    setActiveTab('invoices');
  };

  return (
    <div className="space-y-6">
      {customerView === 'list' && (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">{t('customers_page.title')}</h2>
          </div>
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="hidden md:table-header-group bg-gray-50">
                <tr>
                  <th className="text-left p-4 font-medium">{t('customers_page.table.name')}</th>
                  <th className="text-left p-4 font-medium">{t('customers_page.table.ico')}</th>
                  <th className="text-left p-4 font-medium">{t('customers_page.table.city')}</th>
                  <th className="text-center p-4 font-medium">{t('customers_page.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
               {(savedCustomers || []).map((customer) => (
                  <tr key={customer.id} className="block md:table-row p-4">
                    <td className="block md:table-cell md:p-4 md:font-medium" data-label={`${t('customers_page.table.name')}: `}>{customer.name}</td>
                    <td className="block md:table-cell md:p-4" data-label={`${t('customers_page.table.ico')}: `}>{customer.ico}</td>
                    <td className="block md:table-cell md:p-4" data-label={`${t('customers_page.table.city')}: `}>{customer.city}</td>
                    <td className="block md:table-cell md:p-4">
                      <div className="flex gap-2 justify-end md:justify-center mt-2 md:mt-0">
                        <button onClick={() => handleCreateInvoice(customer)} className="p-2 text-green-600 hover:text-green-800 rounded-md" title={t('customers_page.action.create_invoice')}><FileText size={20} /></button>
                        <button onClick={() => editCustomer(customer)} className="p-2 text-gray-600 hover:text-gray-800 rounded-md" title={t('common.edit')}><Edit size={20} /></button>
                        <button onClick={() => deleteCustomer(customer.id)} className="p-2 text-red-600 hover:text-red-800 rounded-md" title={t('common.delete')}><Trash2 size={20} /></button>
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
            <button onClick={() => setCustomerView('list')} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">← {t('common.back_to_list')}</button>
            <h2 className="text-2xl font-bold">{editingCustomer.id ? t('customers_page.edit_title') : t('customers_page.new_title')}</h2>
          </div>
          <div className="bg-gray-50 rounded-lg p-6 grid md:grid-cols-2 gap-4">
            <input type="text" placeholder={t('customers_page.form.company_name')} value={editingCustomer.name} onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })} className="md:col-span-2 w-full p-2 border rounded" />
            <input type="text" placeholder={t('customers_page.form.address')} value={editingCustomer.address} onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })} className="w-full p-2 border rounded" />
            <input type="text" placeholder={t('customers_page.form.zip')} value={editingCustomer.zip || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, zip: e.target.value })} className="w-full p-2 border rounded" />
            <input type="text" placeholder={t('customers_page.form.city')} value={editingCustomer.city} onChange={(e) => setEditingCustomer({ ...editingCustomer, city: e.target.value })} className="w-full p-2 border rounded" />
            <div className="flex items-end gap-2">
              <div className="flex-grow">
                <input type="text" placeholder={t('customers_page.form.ico')} value={editingCustomer.ico || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, ico: e.target.value })} className="w-full p-2 border rounded" />
              </div>
              <button type="button" onClick={() => fetchFromAres(editingCustomer.ico)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm h-10">{t('customers_page.form.ares')}</button>
            </div>
            <input type="text" placeholder={t('customers_page.form.dic')} value={editingCustomer.dic || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, dic: e.target.value })} className="w-full p-2 border rounded" />
            <textarea value={editingCustomer.notes || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })} placeholder={t('customers_page.form.notes')} rows="3" className="md:col-span-2 w-full p-2 border rounded" />
          </div>
          <div className="flex gap-4">
            <button onClick={saveCustomer} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"><Save size={16} />{t('common.save')}</button>
            <button onClick={() => { setCustomerView('list'); setEditingCustomer(null); }} className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
};
export default CustomersPage;
