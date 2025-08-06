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

// Funkce pro navigaci mezi políčky množství
const handleQuantityKeyDown = (e, currentIndex) => {
  const quantityInputs = document.querySelectorAll('input[data-quantity-input]');
  
  if (e.key === 'Tab' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    
    let nextIndex;
    if (e.key === 'Tab' && !e.shiftKey || e.key === 'ArrowDown') {
      // Tab nebo šipka dolů = další políčko
      nextIndex = currentIndex + 1;
      if (nextIndex >= quantityInputs.length) {
        nextIndex = 0; // Na konci skoč na začátek
      }
    } else if (e.key === 'Tab' && e.shiftKey || e.key === 'ArrowUp') {
      // Shift+Tab nebo šipka nahoru = předchozí políčko
      nextIndex = currentIndex - 1;
      if (nextIndex < 0) {
        nextIndex = quantityInputs.length - 1; // Na začátku skoč na konec
      }
    }
    
    if (quantityInputs[nextIndex]) {
      quantityInputs[nextIndex].focus();
      quantityInputs[nextIndex].select(); // Označ text pro snadnější přepis
    }
  }
  
  // Enter také skočí na další políčko
  if (e.key === 'Enter') {
    e.preventDefault();
    let nextIndex = currentIndex + 1;
    if (nextIndex >= quantityInputs.length) {
      nextIndex = 0;
    }
    if (quantityInputs[nextIndex]) {
      quantityInputs[nextIndex].focus();
      quantityInputs[nextIndex].select();
    }
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

  // Nová funkce, která umí pracovat s různými sazbami DPH u jednotlivých položek
  const calculateTotals = (items) => {
    if (!items) return { totalWithoutVat: 0, totalWithVat: 0, vatBreakdown: {} };

    let totalWithoutVat = 0;
    const vatBreakdown = {}; // Zde budeme ukládat rozpad DPH podle sazeb

    items.forEach(item => {
      const itemTotal = (item.quantity || 0) * (parseFloat(String(item.price).replace(',', '.')) || 0);
      totalWithoutVat += itemTotal;
      
      const itemVatRate = item.vatRate ?? 0;

      if (!vatBreakdown[itemVatRate]) {
        vatBreakdown[itemVatRate] = { base: 0, amount: 0 };
      }
      vatBreakdown[itemVatRate].base += itemTotal;
      vatBreakdown[itemVatRate].amount += itemTotal * (itemVatRate / 100);
    });
    
    const totalVatAmount = Object.values(vatBreakdown).reduce((sum, { amount }) => sum + amount, 0);
    const totalWithVat = totalWithoutVat + totalVatAmount;

    return { totalWithoutVat, totalWithVat, vatBreakdown };
  };

  // Funkce pro výpočet následujícího pracovního dne
const getNextBusinessDay = () => {
  const today = new Date();
  const nextDay = new Date(today);
  nextDay.setDate(today.getDate() + 1);
  
  // Pokud je následující den sobota (6) nebo neděle (0), posuň na pondělí
  const dayOfWeek = nextDay.getDay();
  if (dayOfWeek === 6) { // Sobota - přidej 2 dny (pondělí)
    nextDay.setDate(nextDay.getDate() + 2);
  } else if (dayOfWeek === 0) { // Neděle - přidej 1 den (pondělí)  
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay.toISOString().split('T')[0];
};

  const getNewDeliveryNote = () => {
    const allNumbers = deliveryNotes.map(note => note.number);
    
    // Zjistíme, jestli je v nastavení jen jedna sazba DPH, kterou můžeme předvolit
    let defaultVatRate = null;
    if (vatSettings.enabled && vatSettings.rates?.length === 1) {
        defaultVatRate = vatSettings.rates[0];
    }

    return {
      number: generateNextDocumentNumber(allNumbers),
      date: getNextBusinessDay(),
      customer: null,
      items: products.map(p => ({ 
          productId: p.id, 
          name: p.name, 
          unit: p.unit, 
          price: p.price, 
          quantity: 0,
          // Nastavíme DPH: buď z produktu, nebo globální výchozí, nebo základní 21%
          vatRate: p.defaultVatRate ?? defaultVatRate ?? (vatSettings.rates?.includes(21) ? 21 : (vatSettings.rates ? vatSettings.rates[0] : 21)),
      })),
      userId: currentUser.uid,
      showPrices: true,
      // Toto je KLÍČOVÉ: Uložíme si kopii nastavení DPH platnou v momentě vytvoření dokladu.
      vatSnapshot: {
          enabled: vatSettings.enabled,
          rates: vatSettings.rates || [21],
      },
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
      // Pokud starý doklad nemá uložený "snímek" DPH, vytvoříme mu ho z aktuálního nastavení.
      vatSnapshot: note.vatSnapshot || { enabled: vatSettings.enabled, rates: vatSettings.rates || [21] },
      items: products.map(p => {
        const existingItem = note.items.find(ni => ni.productId === p.id);
        
        if (existingItem) {
          // Zajistíme, že i stará položka má pole vatRate
          return { ...existingItem, vatRate: existingItem.vatRate ?? (vatSettings.rates?.includes(21) ? 21 : (vatSettings.rates ? vatSettings.rates[0] : 21)) };
        } else {
          // Nová položka přidaná do existujícího DL
          return { 
            productId: p.id, 
            name: p.name, 
            unit: p.unit, 
            price: p.price, 
            quantity: 0, 
            vatRate: p.defaultVatRate ?? (vatSettings.rates?.includes(21) ? 21 : (vatSettings.rates ? vatSettings.rates[0] : 21)) 
          };
        }
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
        vatSettings={note.vatSnapshot || {enabled: false}}
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
    const { totalWithoutVat, totalWithVat, vatBreakdown } = calculateTotals(noteToSave.items);
    noteToSave.totalWithoutVat = totalWithoutVat;
    noteToSave.totalWithVat = totalWithVat;
    noteToSave.vatBreakdown = vatBreakdown; 
    
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
                      <th className="text-center p-4 font-medium">{t('delivery_notes_page.table.actions')}</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
              {deliveryNotes.map(note => {
                    // Použijeme naši novou, chytřejší funkci pro výpočet
                    const { totalWithoutVat, totalWithVat } = calculateTotals(note.items);
                    return (
                        <tr key={note.id} onClick={() => handleEdit(note)} className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer">
                            {/* Mobile Layout */}
                            <td onClick={() => handleEdit(note)} className="block md:hidden p-4 cursor-pointer">
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
                                    <div className="flex flex-wrap gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
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
                                          {t('common.print')}
                                        </button>
                                        <button 
                                          onClick={() => handleDownloadPdf(note)} 
                                          className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded text-sm font-medium transition-colors"
                                          title={t('common.download_pdf')}
                                        >
                                          <Download size={16} />
                                          {t('common.download_pdf')}
                                        </button>
                                        <button 
                                          onClick={() => handleEdit(note)} 
                                          className="flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded text-sm font-medium transition-colors"
                                          title={t('common.edit')}
                                        >
                                          <Edit size={16} />
                                          {t('common.edit')}
                                        </button>
                                        <button 
                                          onClick={() => handleClone(note)} 
                                          className="flex items-center gap-1 px-3 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded text-sm font-medium transition-colors"
                                          title={t('common.clone')}
                                        >
                                          <Copy size={16} />
                                          {t('common.clone')}
                                        </button>
                                        <button 
                                          onClick={() => handleDelete(note.id)} 
                                          className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded text-sm font-medium transition-colors"
                                          title={t('common.delete')}
                                        >
                                          <Trash2 size={16} />
                                          {t('common.delete')}
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
                                      onClick={(e) => { e.stopPropagation(); handlePrint(note); }}  
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
                                    <button onClick={(e) => { e.stopPropagation(); handleDownloadPdf(note); }} className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors" title={t('common.download_pdf')}><Download size={18} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleShare(note); }} className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors" title={t('common.share')}><Share2 size={18} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleClone(note); }} className="p-2 text-purple-600 hover:bg-purple-100 rounded transition-colors" title={t('common.clone')}><Copy size={18} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(note); }} className="p-2 text-green-600 hover:bg-green-100 rounded transition-colors" title={t('common.edit')}><Edit size={18} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }} className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors" title={t('common.delete')}><Trash2 size={18} /></button>
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
              <div className="hidden md:grid grid-cols-12 gap-3 text-sm font-medium text-gray-600 px-3">
                  <div className="col-span-5">{t('products_page.header.name')}</div>
                  <div className="col-span-2 text-right">{t('products_page.header.price_without_vat')}</div>
                  {currentDeliveryNote.vatSnapshot?.enabled && (
                    <div className="col-span-2 text-center">{t('vatRate')}</div>
                  )}
                  <div className="col-span-3 text-center">{t('products_page.header.unit')} / Množství</div>
                </div>
                {currentDeliveryNote.items.map((item, index) => (
                  <div key={item.productId} className="grid grid-cols-2 md:grid-cols-12 gap-3 items-center bg-white p-3 rounded border">
                    {/* NÁZEV POLOŽKY */}
                    <div className="col-span-2 md:col-span-5 font-medium">{item.name}</div>
                    
                    {/* CENA POLOŽKY */}
                    <div className="col-span-1 md:col-span-2">
                      <label className="md:hidden text-xs text-gray-500">Cena/jednotka</label>
                      <input type="text" value={`${Number(item.price).toFixed(2)}`} readOnly tabIndex="-1" className="w-full p-2 border-none bg-gray-100 rounded text-right" />
                    </div>
                    
                    {/* VÝBĚR SAZBY DPH */}
                    {currentDeliveryNote.vatSnapshot?.enabled && (
                      <div className="col-span-1 md:col-span-2">
                          <label className="md:hidden text-xs text-gray-500">Sazba DPH</label>
                          <select
                              value={item.vatRate}
                              tabIndex="-1"
                              onChange={(e) => setCurrentDeliveryNote({ 
                                  ...currentDeliveryNote, 
                                  items: currentDeliveryNote.items.map(i => 
                                      i.productId === item.productId ? { ...i, vatRate: parseInt(e.target.value, 10) } : i
                                  ) 
                              })}
                              className="w-full p-2 border rounded text-center"
                          >
                              {currentDeliveryNote.vatSnapshot.rates.map(rate => (
                                  <option key={rate} value={rate}>{rate}%</option>
                              ))}
                          </select>
                      </div>
                    )}
                    
                    {/* MNOŽSTVÍ */}
                    <div className={`col-span-2 md:col-span-3`}>
                      <label className="md:hidden text-xs text-gray-500">{item.unit} / Množství</label>
                      <div className="flex items-center">
                        <span className="pr-2 text-gray-500 text-sm hidden md:inline">{item.unit}</span>
                        <input 
                          type="number" 
                          value={item.quantity === 0 ? '' : item.quantity} 
                          placeholder="0"
                          data-quantity-input="true"
                          onKeyDown={(e) => handleQuantityKeyDown(e, index)}
                          onChange={(e) => setCurrentDeliveryNote({ 
                            ...currentDeliveryNote, 
                            items: currentDeliveryNote.items.map((i) => 
                              i.productId === item.productId ? { ...i, quantity: parseInt(e.target.value, 10) || 0 } : i
                            ) 
                          })} 
                          className="w-full p-2 border rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        />
                      </div>
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
                        <h3 className="text-base sm:text-lg font-bold">{t('delivery_notes_page.form.total_without_vat')} {calculateTotals(currentDeliveryNote.items).totalWithoutVat.toFixed(2)} Kč</h3>
                        {currentDeliveryNote.vatSnapshot?.enabled && <h4 className="text-sm sm:text-md text-gray-600">{t('delivery_notes_page.form.total_with_vat')} {calculateTotals(currentDeliveryNote.items).totalWithVat.toFixed(2)} Kč</h4>}
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
