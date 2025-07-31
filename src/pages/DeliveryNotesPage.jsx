import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Plus, Edit, Trash2, Save, Download, Share2, Copy, Printer } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import ReactDOM from 'react-dom/client';
import DeliveryNotePrintable from '../components/DeliveryNotePrintable.jsx';
import { generateNextDocumentNumber } from '../../netlify/functions/numbering.js';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useTranslation } from 'react-i18next';

const formatDateForDisplay = (date) => {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString('cs-CZ');
  } catch (e) {
    return date;
  }
};



const DeliveryNotesPage = ({ supplier, savedCustomers, products, vatSettings, creationRequest, setCreationRequest }) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('list');
  const [editingNote, setEditingNote] = useState(null);
  const [currentDeliveryNote, setCurrentDeliveryNote] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Přidání CSS stylů pro tisk - již není potřeba, používáme globální CSS z index.css
  // useEffect pro styly odstraněn

  useEffect(() => {
    if (creationRequest === 'delivery_note') {
      handleAddNew();
      setCreationRequest(null);
    }
  }, [creationRequest]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'deliveryNotes'), where("userId", "==", currentUser.uid), orderBy('number', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const notes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDeliveryNotes(notes);
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

  const getNewDeliveryNote = () => {
    const allNumbers = deliveryNotes.map(note => note.number);
    return {
      number: generateNextDocumentNumber(allNumbers),
      date: new Date().toISOString().split('T')[0],
      customer: null,
      items: products.map(p => ({ productId: p.id, name: p.name, unit: p.unit, price: p.price, quantity: 0 })),
      userId: currentUser.uid,
      showPrices: true, // Změna z false na true
    };
  };

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
        return existingItem ? { ...existingItem } : { productId: p.id, name: p.name, unit: p.unit, price: p.price, quantity: 0 };
      })
    });
    setEditingNote(note);
    setCurrentView('create');
  };

  // Funkce pro tisk dodacího listu
  const handlePrint = (note) => {
    if (!note.customer) {
      alert('Nelze tisknout dodací list bez vybraného odběratele.');
      return;
    }

    const printContainer = document.createElement('div');
    printContainer.id = 'print-container';
    printContainer.style.position = 'absolute';
    printContainer.style.left = '-9999px';
    document.body.appendChild(printContainer);

    const root = ReactDOM.createRoot(printContainer);

    root.render(
      <DeliveryNotePrintable
        note={note}
        supplier={supplier}
        showPrices={note.showPrices}
        vatSettings={vatSettings}
      />
    );

    setTimeout(() => {
      try {
        window.print();
      } finally {
        // Čekáme na dokončení tisku před odstraněním
        const cleanup = () => {
          root.unmount();
          if (printContainer.parentNode) {
            printContainer.parentNode.removeChild(printContainer);
          }
          window.removeEventListener('afterprint', cleanup);
        };
        
        window.addEventListener('afterprint', cleanup);
      }
    }, 1000);
  };

  const saveDeliveryNoteFlow = async (noteData) => {
    if (!noteData.customer) {
      alert(t('delivery_notes_page.alert.customer_required'));
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
      console.error(t('delivery_notes_page.alert.save_error'), error);
      alert(t('delivery_notes_page.alert.generic_save_error'));
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
    if (window.confirm(t('delivery_notes_page.alert.confirm_delete'))) {
        await deleteDoc(doc(db, 'deliveryNotes', id));
    }
  };
  
  const handleClone = (noteToClone) => {
    const allNumbers = deliveryNotes.map(note => note.number);
    const newNote = {
      ...JSON.parse(JSON.stringify(noteToClone)),
      number: generateNextDocumentNumber(allNumbers),
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
    root.render(<DeliveryNotePrintable note={note} supplier={supplier} showPrices={note.showPrices} vatSettings={vatSettings} />);
    setTimeout(() => {
      const opt = { margin: 10, filename: `dodaci-list-${note.number}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
      html2pdf().from(element.firstChild).set(opt).save().then(() => { document.body.removeChild(element); });
    }, 500);
  };

  const handleShare = async (note) => {
    if (!navigator.share || !navigator.canShare) {
      alert(t('delivery_notes_page.alert.share_not_supported'));
      return;
    }
    const element = document.createElement('div');
    document.body.appendChild(element);
    const root = ReactDOM.createRoot(element);
    root.render(<DeliveryNotePrintable note={note} supplier={supplier} showPrices={note.showPrices} vatSettings={vatSettings} />);
    setTimeout(async () => {
      try {
        const blob = await html2pdf().from(element.firstChild).output('blob');
        const file = new File([blob], `dodaci-list-${note.number}.pdf`, { type: 'application/pdf' });
        await navigator.share({ title: `Dodací list ${note.number}`, text: `Zde je dodací list ${note.number}.`, files: [file] });
      } catch (error) {
        console.error(t('delivery_notes_page.alert.share_error'), error);
      } finally {
        document.body.removeChild(element);
      }
    }, 500);
  };

  const modalConfig = {
    title: t('delivery_notes_page.modal.missing_number_title'),
    message: t('delivery_notes_page.modal.missing_number_message'),
    showInput: true,
    inputLabel: t('delivery_notes_page.modal.number_label'),
    initialValue: currentDeliveryNote?.number || '',
    confirmText: t('delivery_notes_page.modal.confirm_save'),
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
    cancelText: t('common.back'),
    saveAnywayText: t('common.save_anyway'),
  };

  if (loading) {
    return <div>{t('delivery_notes_page.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <ConfirmModal isOpen={showConfirmModal} config={modalConfig} onClose={() => setShowConfirmModal(false)} />

      {currentView === 'list' && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl sm:text-2xl font-bold">{t('delivery_notes_page.title')}</h2>
            <button
              onClick={handleAddNew}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-base w-full sm:w-auto"
            >
              <Plus size={18} />
              <span>{t('delivery_notes_page.new_title')}</span>
            </button>
          </div>
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                  <tr className="hidden md:table-row">
                      <th className="text-left p-4 font-medium">{t('delivery_notes_page.table.number')}</th>
                      <th className="text-left p-4 font-medium">{t('delivery_notes_page.table.customer')}</th>
                      <th className="text-left p-4 font-medium">{t('delivery_notes_page.table.issue_date')}</th>
                      <th className="text-right p-4 font-medium">{t('delivery_notes_page.table.amount')}</th>
                      <th className="text-center p-4 font-medium">{t('common.actions')}</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {deliveryNotes.map(note => {
                    const { totalWithoutVat, totalWithVat } = calculateDlTotal(note.items);
                    return (
                        <tr key={note.id} className="border-b border-gray-200 hover:bg-gray-50">
                            {/* Mobile Layout */}
                            <td className="block md:hidden p-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-semibold text-lg">{note.number}</div>
                                            <div className="text-gray-600 text-sm">{note.customer?.name || 'Bez odběratele'}</div>
                                            <div className="text-gray-500 text-xs">{formatDateForDisplay(note.date)}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium text-lg">{totalWithoutVat.toFixed(2)} Kč</div>
                                            {vatSettings?.enabled && (
                                                <div className="text-xs text-gray-500">
                                                    s DPH: {totalWithVat.toFixed(2)} Kč
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        <button 
                                          onClick={() => handlePrint(note)} 
                                          disabled={!note.customer}
                                          className={`flex items-center gap-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                                            !note.customer 
                                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                          }`}
                                          title={!note.customer ? 'Dodací list nemá vybraného odběratele' : t('common.print')}
                                        >
                                          <Printer size={16} />
                                          Tisk
                                        </button>
                                        <button 
                                          onClick={() => handleDownloadPdf(note)} 
                                          className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded text-sm font-medium transition-colors"
                                          title={t('common.download_pdf')}
                                        >
                                          <Download size={16} />
                                          PDF
                                        </button>
                                        <button 
                                          onClick={() => handleEdit(note)} 
                                          className="flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded text-sm font-medium transition-colors"
                                          title={t('common.edit')}
                                        >
                                          <Edit size={16} />
                                          Upravit
                                        </button>
                                        <button 
                                          onClick={() => handleClone(note)} 
                                          className="flex items-center gap-1 px-3 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded text-sm font-medium transition-colors"
                                          title={t('common.clone')}
                                        >
                                          <Copy size={16} />
                                          Kopie
                                        </button>
                                        <button 
                                          onClick={() => handleDelete(note.id)} 
                                          className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded text-sm font-medium transition-colors"
                                          title={t('common.delete')}
                                        >
                                          <Trash2 size={16} />
                                          Smazat
                                        </button>
                                    </div>
                                </div>
                            </td>
                            
                            {/* Desktop Layout */}
                            <td className="hidden md:table-cell p-4 font-medium">{note.number}</td>
                            <td className="hidden md:table-cell p-4">{note.customer?.name || 'Bez odběratele'}</td>
                            <td className="hidden md:table-cell p-4">{formatDateForDisplay(note.date)}</td>
                            <td className="hidden md:table-cell p-4 text-right">
                                <div className="font-medium">{totalWithoutVat.toFixed(2)} Kč</div>
                                {vatSettings?.enabled && (
                                    <div className="text-xs text-gray-500">
                                        s DPH: {totalWithVat.toFixed(2)} Kč
                                    </div>
                                )}
                            </td>
                            <td className="hidden md:table-cell p-4">
                                <div className="flex gap-1 justify-center">
                                    <button 
                                      onClick={() => handlePrint(note)} 
                                      disabled={!note.customer}
                                      className={`p-2 rounded transition-colors ${
                                        !note.customer 
                                          ? 'text-gray-400 cursor-not-allowed' 
                                          : 'text-blue-600 hover:bg-blue-100'
                                      }`}
                                      title={!note.customer ? 'Dodací list nemá vybraného odběratele' : t('common.print')}
                                    >
                                      <Printer size={18} />
                                    </button>
                                    <button onClick={() => handleDownloadPdf(note)} className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors" title={t('common.download_pdf')}><Download size={18} /></button>
                                    <button onClick={() => handleShare(note)} className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors" title={t('common.share')}><Share2 size={18} /></button>
                                    <button onClick={() => handleClone(note)} className="p-2 text-purple-600 hover:bg-purple-100 rounded transition-colors" title={t('common.clone')}><Copy size={18} /></button>
                                    <button onClick={() => handleEdit(note)} className="p-2 text-green-600 hover:bg-green-100 rounded transition-colors" title={t('common.edit')}><Edit size={18} /></button>
                                    <button onClick={() => handleDelete(note.id)} className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors" title={t('common.delete')}><Trash2 size={18} /></button>
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
                <button onClick={() => setCurrentView('list')} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">← {t('common.back_to_list')}</button>
                <h2 className="text-2xl font-bold">{editingNote ? t('delivery_notes_page.edit_title') : t('delivery_notes_page.new_title')}</h2>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b pb-6">
                    <div>
                        <label className="block text-sm font-medium mb-2">{t('delivery_notes_page.form.number')}</label>
                        <input type="text" value={currentDeliveryNote.number} onChange={e => setCurrentDeliveryNote({...currentDeliveryNote, number: e.target.value})} className="w-full p-3 border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">{t('delivery_notes_page.form.issue_date')}</label>
                        <input type="date" value={currentDeliveryNote.date} onChange={e => setCurrentDeliveryNote({...currentDeliveryNote, date: e.target.value})} className="w-full p-3 border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                </div>
                <div>
                  <label className="block text-base font-medium mb-3">{t('delivery_notes_page.form.customer')}</label>
                  <select defaultValue={currentDeliveryNote.customer?.id || ''} onChange={(e) => setCurrentDeliveryNote({...currentDeliveryNote, customer: savedCustomers.find(c => c.id === e.target.value) || null})} className="w-full p-3 border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">{t('delivery_notes_page.form.select_customer')}</option>
                      {savedCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                <h3 className="text-lg font-medium mb-3">{t('delivery_notes_page.form.items')}</h3>
              <div className="space-y-3">
                <div className="hidden md:grid grid-cols-12 gap-2 text-sm font-medium text-gray-600 px-3">
                  <div className="col-span-6">{t('delivery_notes_page.form.item_name')}</div>
                  <div className="col-span-3 text-right">{t('delivery_notes_page.form.item_price')}</div>
                  <div className="col-span-3 text-center">{t('delivery_notes_page.form.item_quantity')}</div>
                </div>
                {currentDeliveryNote.items.map((item) => (
                  <div key={item.productId} className="grid grid-cols-2 md:grid-cols-12 gap-3 items-center bg-white p-3 rounded border">
                    <div className="col-span-2 md:col-span-6 font-medium">{item.name}</div>
                    <div className="col-span-1 md:col-span-3">
                      <label className="md:hidden text-xs text-gray-500">{t('delivery_notes_page.form.item_price')}</label>
                      <input type="text" value={`${Number(item.price).toFixed(2)} Kč`} readOnly className="w-full p-2 border-none bg-gray-100 rounded text-right" />
                    </div>
                    <div className="col-span-1 md:col-span-3">
                      <label className="md:hidden text-xs text-gray-500">{t('delivery_notes_page.form.item_quantity')}</label>
                      <input type="number" value={item.quantity === 0 ? '' : item.quantity} placeholder="0" onChange={(e) => setCurrentDeliveryNote({ ...currentDeliveryNote, items: currentDeliveryNote.items.map((i) => i.productId === item.productId ? { ...i, quantity: parseInt(e.target.value, 10) || 0 } : i) })} className="w-full p-2 border rounded text-center" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t">
                    <label className="flex items-center gap-3">
                        <input type="checkbox" checked={currentDeliveryNote.showPrices} onChange={(e) => setCurrentDeliveryNote({...currentDeliveryNote, showPrices: e.target.checked})} className="w-5 h-5" />
                        <span className="text-sm sm:text-base">{t('delivery_notes_page.form.show_prices')}</span>
                    </label>
                    <div className="text-right w-full sm:w-auto">
                        <h3 className="text-base sm:text-lg font-bold">{t('delivery_notes_page.form.total_without_vat')} {calculateDlTotal(currentDeliveryNote.items).totalWithoutVat.toFixed(2)} Kč</h3>
                        {vatSettings?.enabled && <h4 className="text-sm sm:text-md text-gray-600">{t('delivery_notes_page.form.total_with_vat')} {calculateDlTotal(currentDeliveryNote.items).totalWithVat.toFixed(2)} Kč</h4>}
                    </div>
                </div>
            </div>
             <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={handleSave} className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-base transition-colors">
                    <Save size={18}/>
                    {editingNote ? t('common.save_changes') : t('delivery_notes_page.save')}
                </button>
                <button 
                  onClick={() => handlePrint(currentDeliveryNote)} 
                  disabled={!currentDeliveryNote.customer}
                  className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-base transition-colors ${
                    !currentDeliveryNote.customer 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-gray-600 text-white hover:bg-gray-700'
                  }`}
                  title={!currentDeliveryNote.customer ? 'Nejdříve vyberte odběratele' : t('common.print')}
                >
                  <Printer size={18}/>
                  {t('common.print')}
                </button>
                <button onClick={() => setCurrentView('list')} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-base transition-colors">
                    {t('common.cancel')}
                </button>
             </div>
        </div>
      )}
    </div>
  );
};
export default DeliveryNotesPage;
