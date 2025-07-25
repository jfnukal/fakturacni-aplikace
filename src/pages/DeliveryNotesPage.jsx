import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Plus, Edit, Trash2, Save, Download, Share2, Copy } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import ReactDOM from 'react-dom/client';
import DeliveryNotePrintable from '../components/DeliveryNotePrintable.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

// --- Pomocné funkce pro práci s datem ---
const formatDateForDisplay = (date) => {
  return new Date(date).toLocaleDateString('cs-CZ');
};

const formatDateForInput = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
// -----------------------------------------

const DeliveryNotesPage = ({ supplier, savedCustomers, products, vatSettings }) => {
  const { currentUser } = useAuth();
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('list');
  const [editingNote, setEditingNote] = useState(null);
  const [currentDeliveryNote, setCurrentDeliveryNote] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'deliveryNotes'), where("userId", "==", currentUser.uid), orderBy('number', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      setDeliveryNotes(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

  const calculateDlTotal = (items) => {
    if (!items) return { totalWithoutVat: 0, totalWithVat: 0 };
    const totalWithoutVat = items.reduce((sum, item) => sum + (item.quantity * (parseFloat(String(item.price).replace(',', '.')) || 0)), 0);
    const totalWithVat = items.reduce((sum, item) => sum + (item.quantity * (parseFloat(String(item.price).replace(',', '.')) || 0) * (1 + (vatSettings?.rate / 100 || 0))), 0);
    return { totalWithoutVat, totalWithVat };
  };

  const getNewDeliveryNote = () => ({
    number: `DL2025-${String(deliveryNotes.length + 1).padStart(3, '0')}`,
    date: new Date().toISOString().split('T')[0], // Ukládáme jako YYYY-MM-DD
    customer: null,
    items: products.map(p => ({ productId: p.id, name: p.name, unit: p.unit, price: p.price, quantity: 0 })),
    userId: currentUser.uid,
    showPrices: false,
  });

  const handleAddNew = () => {
    setCurrentDeliveryNote(getNewDeliveryNote());
    setEditingNote(null);
    setCurrentView('create');
  };
  
  const handleEdit = (note) => {
    setCurrentDeliveryNote({
      ...note,
      items: products.map(p => {
        const existingItem = note.items.find(ni => ni.productId === p.id);
        return existingItem ? existingItem : { productId: p.id, name: p.name, unit: p.unit, price: p.price, quantity: 0 };
      })
    });
    setEditingNote(note);
    setCurrentView('create');
  };

  const saveDeliveryNoteFlow = async (noteData) => {
    if (!noteData.customer) {
      alert("Před uložením prosím vyberte odběratele.");
      return;
    }
    const noteToSave = { ...noteData, items: noteData.items.filter(item => item.quantity > 0) };
    const { totalWithoutVat, totalWithVat } = calculateDlTotal(noteToSave.items);
    noteToSave.totalWithoutVat = totalWithoutVat;
    noteToSave.totalWithVat = totalWithVat;
    
    try {
      if (editingNote) {
        const { id, ...dataToUpdate } = noteToSave;
        await updateDoc(doc(db, 'deliveryNotes', id), dataToUpdate);
      } else {
        delete noteToSave.id;
        await addDoc(collection(db, 'deliveryNotes'), noteToSave);
      }
      setCurrentView('list');
    } catch(error) {
      console.error("Chyba při ukládání DL: ", error);
      alert("Nastala chyba při ukládání.");
    }
  };

  const handleSave = () => {
    if (!currentDeliveryNote.number) {
      setShowConfirmModal(true);
    } else {
      saveDeliveryNoteFlow(currentDeliveryNote);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Opravdu chcete smazat tento dodací list?")) {
        await deleteDoc(doc(db, 'deliveryNotes', id));
    }
  };
  
  const handleClone = (noteToClone) => {
    const newNote = {
      ...JSON.parse(JSON.stringify(noteToClone)),
      number: `DL2025-${String(deliveryNotes.length + 1).padStart(3, '0')}`,
      date: new Date().toISOString().split('T')[0],
    };
    delete newNote.id;
    setCurrentDeliveryNote(newNote);
    setEditingNote(null);
    setCurrentView('create');
  };

  const handleDownloadPdf = (note) => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const root = ReactDOM.createRoot(element);
    root.render(
      <DeliveryNotePrintable
        note={note}
        supplier={supplier}
        showPrices={note.showPrices}
      />
    );

    setTimeout(() => {
      const opt = {
        margin: 5,
        filename: `dodaci-list-${note.number}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };
      html2pdf()
        .from(element.firstChild)
        .set(opt)
        .save()
        .then(() => {
          document.body.removeChild(element);
        });
    }, 500);
  };

  const handleShare = async (note) => {
    if (!navigator.share || !navigator.canShare) {
      alert('Sdílení není na tomto zařízení podporováno.');
      return;
    }
    const element = document.createElement('div');
    document.body.appendChild(element);
    const root = ReactDOM.createRoot(element);
    root.render(
      <DeliveryNotePrintable
        note={note}
        supplier={supplier}
        showPrices={note.showPrices}
      />
    );

    setTimeout(async () => {
      try {
        const blob = await html2pdf().from(element.firstChild).output('blob');
        const file = new File([blob], `dodaci-list-${note.number}.pdf`, {
          type: 'application/pdf',
        });
        await navigator.share({
          title: `Dodací list ${note.number}`,
          text: `Zde je dodací list ${note.number}.`,
          files: [file],
        });
      } catch (error) {
        console.error('Chyba při sdílení: ', error);
      } finally {
        document.body.removeChild(element);
      }
    }, 500);
  };

  const modalConfig = {
    title: 'Chybějící číslo dodacího listu',
    message:
      'Není vyplněno číslo dodacího listu. Můžete ho doplnit zde, nebo DL uložit bez něj.',
    showInput: true,
    inputLabel: 'Číslo dodacího listu',
    initialValue: currentDeliveryNote?.number || '',
    confirmText: 'Doplnit a uložit',
    onConfirm: (newNumber) => {
      const updatedNote = { ...currentDeliveryNote, number: newNumber };
      setCurrentDeliveryNote(updatedNote);
      saveDeliveryNoteFlow(updatedNote);
      setShowConfirmModal(false);
    },
    onSaveAnyway: () => {
      saveDeliveryNoteFlow(currentDeliveryNote);
      setShowConfirmModal(false);
    },
  };

  if (loading) {
    return <div>Načítání dodacích listů...</div>;
  }

  return (
    <div className="space-y-6">
      <ConfirmModal isOpen={showConfirmModal} config={modalConfig} onClose={() => setShowConfirmModal(false)} />
      {currentView === 'list' && (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Přehled dodacích listů</h2>
            <button onClick={handleAddNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              <Plus size={16} /> Nový dodací list
            </button>
          </div>
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="hidden md:table-header-group bg-gray-50">
                  <tr>
                      <th className="text-left p-4 font-medium">Číslo</th>
                      <th className="text-left p-4 font-medium">Odběratel</th>
                      <th className="text-left p-4 font-medium">Vystaveno dne</th>
                      <th className="text-right p-4 font-medium">Částka</th>
                      <th className="text-center p-4 font-medium">Akce</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {deliveryNotes.map(note => {
                    const { totalWithoutVat, totalWithVat } = calculateDlTotal(note.items);
                    return (
                        <tr key={note.id} className="block md:table-row p-4">
                            <td className="block md:table-cell md:p-4 md:font-medium" data-label="Číslo: ">{note.number}</td>
                            <td className="block md:table-cell md:p-4" data-label="Odběratel: ">{note.customer?.name || 'N/A'}</td>
                            <td className="block md:table-cell md:p-4" data-label="Vystaveno dne: ">{formatDateForDisplay(note.date)}</td>
                            <td className="block md:table-cell md:p-4 md:text-right" data-label="Částka: ">
                                {totalWithoutVat.toFixed(2)} Kč
                                {vatSettings?.enabled && <span className="text-xs text-gray-500 block"> (s DPH: {totalWithVat.toFixed(2)} Kč)</span>}
                            </td>
                            <td className="block md:table-cell md:p-4">
                                <div className="flex gap-2 justify-end md:justify-center mt-2 md:mt-0">
                                    <button onClick={() => handleDownloadPdf(note)} className="p-2 text-gray-600 hover:text-gray-800 rounded-md" title="Stáhnout PDF"><Download size={20} /></button>
                                    <button onClick={() => handleShare(note)} className="p-2 text-gray-600 hover:text-gray-800 rounded-md" title="Sdílet"><Share2 size={20} /></button>
                                    <button onClick={() => handleClone(note)} className="p-2 text-purple-600 hover:text-purple-800 rounded-md" title="Klonovat"><Copy size={20} /></button>
                                    <button onClick={() => handleEdit(note)} className="p-2 text-gray-600 hover:text-gray-800 rounded-md" title="Upravit"><Edit size={20} /></button>
                                    <button onClick={() => handleDelete(note.id)} className="p-2 text-red-600 hover:text-red-800 rounded-md" title="Smazat"><Trash2 size={20} /></button>
                                </div>
                            </td>
                        </tr>
                    )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
       {currentView === 'create' && currentDeliveryNote && (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => setCurrentView('list')} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                    ← Zpět na přehled
                </button>
                <h2 className="text-2xl font-bold">{editingNote ? 'Upravit dodací list' : 'Nový dodací list'}</h2>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-4 border-b pb-6">
                    <div>
                        <label className="block text-sm font-medium mb-1">Číslo dodacího listu:</label>
                        <input type="text" value={currentDeliveryNote.number} onChange={e => setCurrentDeliveryNote({...currentDeliveryNote, number: e.target.value})} className="w-full p-2 border rounded" />
                    </div>
                    <div className="text-left md:text-right">
                        <label className="block text-sm font-medium mb-1">Vystaveno dne:</label>
                        <input 
                          type="date" 
                          value={currentDeliveryNote.date} 
                          onChange={e => setCurrentDeliveryNote({...currentDeliveryNote, date: e.target.value})}
                          className="w-full p-2 border rounded text-right" 
                        />
                    </div>
                </div>
                <div>
                  <label className="block text-lg font-medium mb-3">Odběratel</label>
                  <select defaultValue={currentDeliveryNote.customer?.id || ''} onChange={(e) => setCurrentDeliveryNote({...currentDeliveryNote, customer: savedCustomers.find(c => c.id === e.target.value) || null})} className="w-full p-2 border rounded">
                      <option value="">Vybrat odběratele...</option>
                      {savedCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                <h3 className="text-lg font-medium mb-3">Položky</h3>
              <div className="space-y-3">
                <div className="hidden md:grid grid-cols-12 gap-2 text-sm font-medium text-gray-600 px-3">
                  <div className="col-span-6">Název</div>
                  <div className="col-span-3 text-right">Cena bez DPH/ks</div>
                  <div className="col-span-3 text-center">Množství</div>
                </div>
                {currentDeliveryNote.items.map((item) => (
                        <div
                        key={item.productId}
                        className="grid grid-cols-2 md:grid-cols-12 gap-3 items-center bg-white p-3 rounded border"
                      >
                    <div className="col-span-2 md:col-span-6 font-medium">
                      {item.name}
                    </div>
                    <div className="col-span-1 md:col-span-3">
                      <label className="md:hidden text-xs text-gray-500">Cena/ks</label>
                      <input
                        type="text"
                        value={`${Number(item.price).toFixed(2)} Kč`}
                        readOnly
                        className="w-full p-2 border-none bg-gray-100 rounded text-right"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-3">
                      <label className="md:hidden text-xs text-gray-500">Množství</label>
                      <input
                        type="number"
                        value={item.quantity === 0 ? '' : item.quantity}
                        placeholder="0"
                        onChange={(e) =>
                          setCurrentDeliveryNote({
                            ...currentDeliveryNote,
                            items: currentDeliveryNote.items.map((i) =>
                              i.productId === item.productId
                                ? {
                                    ...i,
                                    quantity: parseInt(e.target.value, 10) || 0,
                                  }
                                : i
                            ),
                          })
                        }
                        className="w-full p-2 border rounded text-center"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t">
                    <label className="flex items-center gap-3">
                        <input type="checkbox" checked={currentDeliveryNote.showPrices} onChange={(e) => setCurrentDeliveryNote({...currentDeliveryNote, showPrices: e.target.checked})} className="w-4 h-4" />
                        <span>Zobrazit ceny v PDF</span>
                    </label>
                    <div className="text-right">
                        <h3 className="text-lg font-bold">Celkem bez DPH: {calculateDlTotal(currentDeliveryNote.items).totalWithoutVat.toFixed(2)} Kč</h3>
                        {vatSettings?.enabled && <h4 className="text-md text-gray-600">Celkem s DPH: {calculateDlTotal(currentDeliveryNote.items).totalWithVat.toFixed(2)} Kč</h4>}
                    </div>
                </div>
            </div>
             <div className="flex gap-4">
                <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"><Save size={16}/>{editingNote ? 'Uložit změny' : 'Uložit dodací list'}</button>
             </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryNotesPage;
