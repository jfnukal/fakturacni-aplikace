// Soubor: src/pages/CustomersPage.jsx
import React, { useState } from 'react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  collection,
} from 'firebase/firestore';
import { Plus, FileText, Edit, Trash2, Save } from 'lucide-react';

const CustomersPage = ({ savedCustomers, setActiveTab, selectCustomerForNewInvoice }) => {
  const { currentUser } = useAuth();
  const [customerView, setCustomerView] = useState('list');
  const [editingCustomer, setEditingCustomer] = useState(null);

  const fetchFromAres = async (ico) => {
    if (!ico || !/^\d{8}$/.test(ico)) {
      alert('Zadejte platné osmimístné IČO.');
      return;
    }
    const proxiedUrl = `/.netlify/functions/ares?ico=${ico}`;
    try {
      const response = await fetch(proxiedUrl);
      if (!response.ok) throw new Error('Chyba při komunikaci s ARES.');
      const data = await response.json();
      const subject = data.ekonomickeSubjekty[0];
      if (!subject) {
        alert('Firma s daným IČO nebyla nalezena.');
        return;
      }
      const aresData = {
        name: subject.obchodniJmeno,
        address: `${subject.sidlo.ulice || ''} ${
          subject.sidlo.cisloOrientacni || ''
        }`.trim(),
        zip: subject.sidlo.psc,
        city: subject.sidlo.nazevObce,
        ico: subject.ico,
        dic: subject.dic || '',
      };
      setEditingCustomer((prev) => ({ ...prev, ...aresData }));
    } catch (error) {
      alert(error.message || 'Nepodařilo se načíst data z ARES.');
    }
  };

  const saveCustomer = async () => {
    if (!editingCustomer || !editingCustomer.name) {
      alert('Jméno odběratele je povinné.');
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
    if (window.confirm('Opravdu chcete smazat tohoto odběratele?')) {
      await deleteDoc(doc(db, 'customers', id));
    }
  };

  const editCustomer = (customer) => {
    setEditingCustomer(customer);
    setCustomerView('edit');
  };

  const handleCreateInvoice = (customer) => {
    selectCustomerForNewInvoice(customer);
    setActiveTab('invoices');
  };

  return (
    <div className="space-y-6">
      {customerView === 'list' && (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Přehled odběratelů</h2>
            <button
              onClick={() => {
                setEditingCustomer({
                  name: '',
                  address: '',
                  zip: '',
                  city: '',
                  ico: '',
                  dic: '',
                  notes: '',
                });
                setCustomerView('edit');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Plus size={16} /> Nový odběratel
            </button>
          </div>
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="hidden md:table-header-group bg-gray-50">
                <tr>
                  <th className="text-left p-4 font-medium">Název</th>
                  <th className="text-left p-4 font-medium">IČO</th>
                  <th className="text-left p-4 font-medium">Město</th>
                  <th className="text-center p-4 font-medium">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
               {(savedCustomers || []).map((customer) => (
                  <tr key={customer.id} className="block md:table-row p-4">
                    <td
                      className="block md:table-cell md:p-4 md:font-medium"
                      data-label="Název: "
                    >
                      {customer.name}
                    </td>
                    <td
                      className="block md:table-cell md:p-4"
                      data-label="IČO: "
                    >
                      {customer.ico}
                    </td>
                    <td
                      className="block md:table-cell md:p-4"
                      data-label="Město: "
                    >
                      {customer.city}
                    </td>
                    <td className="block md:table-cell md:p-4">
                      <div className="flex gap-2 justify-end md:justify-center mt-2 md:mt-0">
                        <button
                          onClick={() => handleCreateInvoice(customer)}
                          className="p-2 text-green-600 hover:text-green-800 rounded-md"
                          title="Vytvořit fakturu"
                        >
                          <FileText size={20} />
                        </button>
                        <button
                          onClick={() => editCustomer(customer)}
                          className="p-2 text-gray-600 hover:text-gray-800 rounded-md"
                          title="Upravit"
                        >
                          <Edit size={20} />
                        </button>
                        <button
                          onClick={() => deleteCustomer(customer.id)}
                          className="p-2 text-red-600 hover:text-red-800 rounded-md"
                          title="Smazat"
                        >
                          <Trash2 size={20} />
                        </button>
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
            <button
              onClick={() => setCustomerView('list')}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              ← Zpět na přehled
            </button>
            <h2 className="text-2xl font-bold">
              {editingCustomer.id ? `Upravit odběratele` : 'Nový odběratel'}
            </h2>
          </div>
          <div className="bg-gray-50 rounded-lg p-6 grid md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Název firmy"
              value={editingCustomer.name}
              onChange={(e) =>
                setEditingCustomer({ ...editingCustomer, name: e.target.value })
              }
              className="md:col-span-2 w-full p-2 border rounded"
            />
            <input
              type="text"
              placeholder="Adresa"
              value={editingCustomer.address}
              onChange={(e) =>
                setEditingCustomer({
                  ...editingCustomer,
                  address: e.target.value,
                })
              }
              className="w-full p-2 border rounded"
            />
            <input
              type="text"
              placeholder="PSČ"
              value={editingCustomer.zip || ''}
              onChange={(e) =>
                setEditingCustomer({ ...editingCustomer, zip: e.target.value })
              }
              className="w-full p-2 border rounded"
            />
            <input
              type="text"
              placeholder="Město"
              value={editingCustomer.city}
              onChange={(e) =>
                setEditingCustomer({ ...editingCustomer, city: e.target.value })
              }
              className="w-full p-2 border rounded"
            />
            <div className="flex items-end gap-2">
              <div className="flex-grow">
                <input
                  type="text"
                  placeholder="IČO"
                  value={editingCustomer.ico || ''}
                  onChange={(e) =>
                    setEditingCustomer({
                      ...editingCustomer,
                      ico: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>
              <button
                type="button"
                onClick={() => fetchFromAres(editingCustomer.ico)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm h-10"
              >
                ARES
              </button>
            </div>
            <input
              type="text"
              placeholder="DIČ"
              value={editingCustomer.dic || ''}
              onChange={(e) =>
                setEditingCustomer({ ...editingCustomer, dic: e.target.value })
              }
              className="w-full p-2 border rounded"
            />
            <textarea
              value={editingCustomer.notes || ''}
              onChange={(e) =>
                setEditingCustomer({
                  ...editingCustomer,
                  notes: e.target.value,
                })
              }
              placeholder="Poznámky..."
              rows="3"
              className="md:col-span-2 w-full p-2 border rounded"
            />
          </div>
          <div className="flex gap-4">
            <button
              onClick={saveCustomer}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Save size={16} />
              Uložit
            </button>
            <button
              onClick={() => {
                setCustomerView('list');
                setEditingCustomer(null);
              }}
              className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Zrušit
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default CustomersPage;
