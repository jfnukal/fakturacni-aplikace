import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  Plus,
  Trash2,
  Copy,
  Eye,
  Edit,
  Save,
  Download,
  Share2,
  Printer,
  X,
  PlusCircle,
  MoreVertical,
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import InvoicePrintable from '../pages/InvoicePrintable.jsx';
import ReactDOM from 'react-dom/client';
import * as ReactDOMPortal from 'react-dom';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useTranslation } from 'react-i18next';

// Lokální funkce pro generování čísel dokumentů (náhrada za Netlify funkci)
const generateNextDocumentNumber = (existingNumbers) => {
  if (!existingNumbers || existingNumbers.length === 0) {
    const year = new Date().getFullYear();
    return `${year}-001`;
  }

  const currentYear = new Date().getFullYear();
  const currentYearNumbers = existingNumbers
    .filter((num) => num && num.startsWith(currentYear.toString()))
    .map((num) => {
      const parts = num.split('-');
      return parts.length > 1 ? parseInt(parts[1], 10) : 0;
    })
    .filter((num) => !isNaN(num));

  const maxNumber =
    currentYearNumbers.length > 0 ? Math.max(...currentYearNumbers) : 0;
  const nextNumber = maxNumber + 1;

  return `${currentYear}-${nextNumber.toString().padStart(3, '0')}`;
};

// Utility funkce pro cleanup DOM elementů
const cleanupDOMElement = (element, root) => {
  try {
    if (root && typeof root.unmount === 'function') {
      root.unmount();
    }
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  } catch (error) {
    console.warn('Cleanup error:', error);
  }
};

function getNewInvoice() {
  return {
    id: Date.now(),
    number: '',
    issueDate: new Date().toLocaleDateString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    duzpDate: new Date().toLocaleDateString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    dueDate: '',
    dueDays: 14,
    currency: 'CZK',
    customer: { name: '', address: '', zip: '', city: '', ico: '', dic: '' },
    items: [
      {
        id: Date.now(),
        quantity: 1,
        unit: 'ks',
        description: '',
        pricePerUnit: 0,
        totalPrice: 0,
      },
    ],
    status: 'draft',
  };
}

// Modální okno pro výběr dodacích listů
const DeliveryNotesSelectionModal = ({
  isOpen,
  onClose,
  deliveryNotes,
  onCreateInvoice,
  calculateDlTotal,
  t,
}) => {
  const [selectedDLs, setSelectedDLs] = useState([]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedDLs([]);
    }
  }, [isOpen]);

  const handleCreateInvoice = () => {
    if (selectedDLs.length === 0) {
      alert('Prosím, vyberte alespoň jeden dodací list.');
      return;
    }

    const notesToProcess = deliveryNotes.filter((note) =>
      selectedDLs.includes(note.id)
    );

    if (notesToProcess.length === 0) return;

    const firstCustomer = notesToProcess[0].customer;

    if (
      !notesToProcess.every((note) => note.customer?.id === firstCustomer?.id)
    ) {
      alert('Nelze vytvořit fakturu z dodacích listů pro různé odběratele.');
      return;
    }

    onCreateInvoice(notesToProcess);
    onClose();
  };

  const unInvoicedNotes = deliveryNotes.filter((note) => !note.invoiced);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold">Vybrat dodací listy k fakturaci</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {unInvoicedNotes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="mb-2">Žádné nefakturované dodací listy</div>
              <div className="text-sm">
                Všechny dodací listy již byly vyfakturovány
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-white text-xs">i</span>
                  </div>
                  <div className="text-sm text-blue-800">
                    <div className="font-medium mb-1">Jak to funguje:</div>
                    <ul className="space-y-1 text-xs">
                      <li>• Vyberte dodací listy, které chcete vyfakturovat</li>
                      <li>
                        • Všechny vybrané dodací listy musí patřit stejnému
                        zákazníkovi
                      </li>
                      <li>
                        • Z každého dodacího listu se vytvoří jedna položka
                        faktury
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg max-h-96 overflow-y-auto">
                <div className="bg-gray-50 px-4 py-3 border-b font-medium text-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-6"></div>
                    <div className="w-32">Číslo DL</div>
                    <div className="flex-1">Zákazník</div>
                    <div className="w-24 text-right">Částka</div>
                    <div className="w-20 text-center">Datum</div>
                  </div>
                </div>

                <div className="divide-y divide-gray-200">
                  {deliveryNotes
                    .filter((note) => !note.invoiced)
                    .map((note) => {
                      const { totalWithoutVat } = calculateDlTotal(note.items);
                      const isSelected = selectedDLs.includes(note.id);

                      return (
                        <div
                          key={note.id}
                          className={`px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 border-l-4 border-l-blue-500'
                              : ''
                          }`}
                          onClick={() => {
                            setSelectedDLs((prev) =>
                              prev.includes(note.id)
                                ? prev.filter((id) => id !== note.id)
                                : [...prev, note.id]
                            );
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <div className="w-32 font-medium">
                              {note.number}
                            </div>
                            <div className="flex-1 text-gray-700">
                              {note.customer?.name}
                            </div>
                            <div className="w-24 text-right font-medium">
                              {totalWithoutVat.toFixed(2)} Kč
                            </div>
                            <div className="w-20 text-center text-sm text-gray-500">
                              {note.date}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {selectedDLs.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium">Vybráno:</span>{' '}
                      {selectedDLs.length} dodací
                      {selectedDLs.length === 1
                        ? ' list'
                        : selectedDLs.length < 5
                        ? ' listy'
                        : ' listů'}
                    </div>
                    <div className="text-sm font-medium">
                      Celkem:{' '}
                      {deliveryNotes
                        .filter(
                          (note) =>
                            selectedDLs.includes(note.id) && !note.invoiced
                        )
                        .reduce(
                          (sum, note) =>
                            sum + calculateDlTotal(note.items).totalWithoutVat,
                          0
                        )
                        .toFixed(2)}{' '}
                      Kč
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <table
          style={{
            width: '100%',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
          }}
        >
          <tr>
            <td style={{ padding: '24px', textAlign: 'right' }}>
              <button
                onClick={onClose}
                style={{
                  marginRight: '12px',
                  padding: '8px 16px',
                  color: '#374151',
                  backgroundColor: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Zrušit
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={selectedDLs.length === 0}
                style={{
                  padding: '8px 24px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: selectedDLs.length === 0 ? 'not-allowed' : 'pointer',
                  backgroundColor:
                    selectedDLs.length === 0 ? '#d1d5db' : '#2563eb',
                  color: selectedDLs.length === 0 ? '#6b7280' : 'white',
                }}
              >
                Vytvořit fakturu z vybraných
              </button>
            </td>
          </tr>
        </table>
      </div>
    </div>
  );
};

// --- Komponenta pro "..." menu s využitím Portálu ---
const ActionsMenu = ({ invoice, onAction, onClose, targetElement }) => {
  const { t } = useTranslation();
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const actions = [
    { key: 'view', label: t('common.view'), icon: Eye },
    { key: 'download', label: t('common.download_pdf'), icon: Download },
    { key: 'share', label: t('common.share'), icon: Share2 },
    {
      key: 'delete',
      label: t('common.delete'),
      icon: Trash2,
      className: 'text-red-600',
    },
  ];

  if (!targetElement) return null;

  const rect = targetElement.getBoundingClientRect();
  const menuWidth = 192; // w-48 = 192px
  const windowWidth = window.innerWidth;

  // Vypočítáme pozici s ochranou před vytečením z obrazovky
  let leftPosition = rect.left + window.scrollX - 150;

  // Pokud by menu vyteklo vlevo, posuneme ho doprava
  if (leftPosition < 10) {
    leftPosition = 10;
  }

  // Pokud by menu vyteklo vpravo, posuneme ho vlevo
  if (leftPosition + menuWidth > windowWidth - 10) {
    leftPosition = windowWidth - menuWidth - 10;
  }

  const position = {
    top: rect.bottom + window.scrollY + 5,
    left: leftPosition,
  };

  return ReactDOMPortal.createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 99999,
      }}
      className="bg-white shadow-lg rounded-md border w-48"
    >
      <ul className="py-1">
        {actions.map((action) => (
          <li key={action.key}>
            <button
              onClick={() => {
                console.log('🎯 Menu item clicked:', action.key, action.label); // DEBUG
                console.log('🎯 onAction function:', typeof onAction); // DEBUG
                console.log('🎯 invoice:', invoice?.id); // DEBUG
                
                onAction(action.key, invoice);
                onClose();
              }}
  className={`w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 transition-colors ${
    action.className || ''
  }`}
  >
    <action.icon size={16} />
    <span>{action.label}</span>
  </button>
            </li>
          ))}
        </ul>
      </div>,
      document.body
    );
  };

const PreviewModal = ({ isOpen, onClose, children }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg w-full max-w-4xl h-[90vh] overflow-y-auto relative"
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-2 bg-gray-200 rounded-full hover:bg-gray-300 z-10 transition-colors"
        >
          <X size={20} />
        </button>
        <div className="p-1">{children}</div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const { t } = useTranslation();
  const styles = {
    draft: 'bg-gray-100 text-gray-800',
    pending: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
  };
  const labels = {
    draft: t('invoices_page.status.draft'),
    pending: t('invoices_page.status.pending'),
    paid: t('invoices_page.status.paid'),
    overdue: t('invoices_page.status.overdue'),
  };
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${
        styles[status] || styles.draft
      }`}
    >
      {labels[status] || labels.draft}
    </span>
  );
};
const InvoicePreview = ({
  invoice,
  supplier,
  vatSettings,
  calculateTotals,
}) => {
  const { t } = useTranslation();

  if (!supplier || !vatSettings || !invoice) {
    return (
      <div className="text-center p-10">
        {t('invoices_page.preview.loading')}
      </div>
    );
  }


  const { subtotal, vatAmount, total } = calculateTotals(invoice, vatSettings);

  const generatePaymentQR = (invoice, supplier) => {
    const amount = total.toFixed(2);
    const vs = invoice.number.replace(/\D/g, '');
    const bankAccount = supplier.bankAccount || '';

    if (!bankAccount || !amount || !vs) return null;

    const paymentString = `SPD*1.0*ACC:${bankAccount.replace(
      '/',
      '-'
    )}*AM:${amount}*CC:CZK*MSG:Faktura ${invoice.number}*X-VS:${vs}`;

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
      paymentString
    )}`;

    return (
      <div className="flex flex-col items-start">
        <div className="w-24 h-24 border border-gray-300 bg-white p-1">
          <img
            src={qrUrl}
            alt="QR platba"
            className="w-full h-full object-contain"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
        <div className="text-xs text-gray-600 mt-1">{t('qrPayment')}</div>
      </div>
    );
  };

  return (
    <div
      className="border rounded-lg p-6 bg-white"
      style={{ minHeight: '800px' }}
    >
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-4">
          {supplier.logoUrl && (
            <div className="w-20 h-20 border rounded flex items-center justify-center bg-gray-50 overflow-hidden">
              <img
                src={supplier.logoUrl}
                alt="Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">
              {t('invoice_title')} {invoice.number}
            </h1>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-sm text-gray-600 mb-2">{t('supplier')}</h3>
          <div className="space-y-1">
            <div className="font-semibold">{supplier.name}</div>
            <div>{supplier.address}</div>
            <div>
              {supplier.zip} {supplier.city}
            </div>
            <div className="mt-2 space-y-1 text-sm">
              <div>
                {t('ico')}: {supplier.ico}
              </div>
              {supplier.dic && (
                <div>
                  {t('dic')}: {supplier.dic}
                </div>
              )}
              {vatSettings && !vatSettings.enabled && (
                <div>{t('notVatPayer')}</div>
              )}
            </div>
          </div>
        </div>
        <div>
          <h3 className="text-sm text-gray-600 mb-2">{t('customer')}</h3>
          <div className="space-y-1">
            <div className="font-semibold">{invoice.customer.name}</div>
            <div>{invoice.customer.address}</div>
            <div>
              {invoice.customer.zip} {invoice.customer.city}
            </div>
            <div className="mt-2 space-y-1 text-sm">
              <div>
                {t('ico')}: {invoice.customer.ico}
              </div>
              {invoice.customer.dic && (
                <div>
                  {t('dic')}: {invoice.customer.dic}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <div className="space-y-1 text-sm">
          <div>
            {t('bankAccount')}: {supplier.bankAccount}
          </div>
          <div>
            {t('variableSymbol')}: {invoice.number.replace(/-/g, '')}
          </div>
          <div>
            {t('paymentMethod')}: {supplier.paymentMethod}
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <div>
            {t('issueDate')}: {invoice.issueDate}
          </div>
          <div>
            {t('taxableDate')}: {invoice.duzpDate}
          </div>
          <div>
            {t('dueDate')}: {invoice.dueDate}
          </div>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden mb-8">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 text-sm font-medium w-1/2">
                {t('th_description')}
              </th>
              <th className="text-center p-3 text-sm font-medium">
                {t('th_quantity')}
              </th>
              <th className="text-center p-3 text-sm font-medium">
                {t('th_unit')}
              </th>
              <th className="text-right p-3 text-sm font-medium">
                {t('th_pricePerUnit')}
              </th>
              <th className="text-right p-3 text-sm font-medium">
                {t('th_total')}
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items &&
              invoice.items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-3">{item.description}</td>
                  <td className="p-3 text-center">{item.quantity}</td>
                  <td className="p-3 text-center">{item.unit}</td>
                  <td className="p-3 text-right">
                    {Number(item.pricePerUnit).toFixed(2)} {t('currency_czk')}
                  </td>
                  <td className="p-3 text-right">
                    {Number(item.totalPrice).toFixed(2)} {t('currency_czk')}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col-reverse md:flex-row justify-between items-start md:items-end gap-8 mt-8">
        <div>{generatePaymentQR(invoice, supplier)}</div>
        <div className="w-full md:w-80 space-y-1">
          <div className="grid grid-cols-2 gap-4 py-1">
            <span>{t('subtotal')}:</span>
            <span className="text-right font-medium">
              {subtotal.toFixed(2)} {t('currency_czk')}
            </span>
          </div>
          {vatSettings.enabled && (
            <div className="grid grid-cols-2 gap-4 py-1">
              <span>{t('vat_rate_display', { rate: vatSettings.rate })}:</span>
              <span className="text-right font-medium">
                {vatAmount.toFixed(2)} {t('currency_czk')}
              </span>
            </div>
          )}
          <div className="border-t pt-2 mt-2">
            <div className="grid grid-cols-2 gap-4 text-lg font-bold">
              <span>{t('totalToPay')}:</span>
              <span className="text-right">
                {total.toFixed(2)} {t('currency_czk')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
const InvoicesPage = ({
  currentUser,
  savedCustomers = [],
  supplier,
  vatSettings,
  deliveryNotes = [],
  creationRequest,
  setCreationRequest,
}) => {
  const { t } = useTranslation();
  const [currentView, setCurrentView] = useState('list');
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [openMenu, setOpenMenu] = useState({ id: null, ref: null });
  const [showDLModal, setShowDLModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Refs pro cleanup
  const pdfRootRef = useRef(null);
  const printRootRef = useRef(null);

  const goToList = () => {
    setCurrentView('list');
    setEditingInvoice(null);
    setCurrentInvoice(null);
  };

  useEffect(() => {
    if (creationRequest === 'invoice') {
      handleAddNew();
      setCreationRequest(null);
    }
  }, [creationRequest, setCreationRequest]);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'invoices'),
      where('userId', '==', currentUser.uid),
      orderBy('number', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      try {
        const invoicesData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setInvoices(invoicesData);
        setLoading(false);
      } catch (error) {
        console.error('Error loading invoices:', error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleAddNew = (customer = null) => {
    try {
      const allNumbers = invoices.map((inv) => inv.number).filter(Boolean);
      const newInv = getNewInvoice();
      newInv.number = generateNextDocumentNumber(allNumbers);

      if (customer) {
        newInv.customer = {
          name: customer.name || '',
          address: customer.address || '',
          zip: customer.zip || '',
          city: customer.city || '',
          ico: customer.ico || '',
          dic: customer.dic || '',
        };
      }

      setCurrentInvoice(newInv);
      setEditingInvoice(null);
      setCurrentView('create');
    } catch (error) {
      console.error('Error creating new invoice:', error);
    }
  };

  const calculateDlTotal = (items) => {
    if (!items) return { totalWithoutVat: 0 };
    return {
      totalWithoutVat: items.reduce(
        (sum, item) =>
          sum +
          item.quantity *
            (parseFloat(String(item.price).replace(',', '.')) || 0),
        0
      ),
    };
  };

  const calculateTotals = (invoice, currentVatSettings) => {
    if (!invoice || !invoice.items || !Array.isArray(invoice.items)) {
      return { subtotal: 0, vatAmount: 0, total: 0 };
    }

    const subtotal = invoice.items.reduce(
      (sum, item) => sum + (Number(item.totalPrice) || 0),
      0
    );

    let vatAmount = 0;
    if (currentVatSettings?.enabled) {
      vatAmount = invoice.items.reduce((sum, item) => {
        const itemTotal = Number(item.totalPrice) || 0;
        const itemVatRate = item.vatRate || 21;
        return sum + (itemTotal * itemVatRate) / 100;
      }, 0);
    }

    const total = subtotal + vatAmount;

    return { subtotal, vatAmount, total };
  };

  const saveInvoiceFlow = async (invoiceData) => {
    if (!currentUser) {
      console.error('No current user');
      return;
    }

    try {
      const { total } = calculateTotals(invoiceData, vatSettings);
      const invoiceToSave = {
        ...invoiceData,
        total,
        status: 'pending',
        userId: currentUser.uid,
        updatedAt: new Date(),
      };

      delete invoiceToSave.id;

      if (editingInvoice) {
        await updateDoc(doc(db, 'invoices', editingInvoice.id), invoiceToSave);
      } else {
        invoiceToSave.createdAt = new Date();
        await addDoc(collection(db, 'invoices'), invoiceToSave);
      }

      goToList();
    } catch (error) {
      console.error('Error saving invoice:', error);
    }
  };

  const handleSaveInvoice = () => {
    if (!currentInvoice?.number?.trim()) {
      setShowConfirmModal(true);
    } else {
      saveInvoiceFlow(currentInvoice);
    }
  };

    // Nová funkce pro vytvoření faktury z dodacích listů - OPRAVENO
  const handleCreateInvoiceFromDL = (selectedDeliveryNotes) => {
    try {
      const firstCustomer = selectedDeliveryNotes[0].customer;

      const newItems = selectedDeliveryNotes.map((note) => {
        const { totalWithoutVat } = calculateDlTotal(note.items);
        return {
          id: Date.now() + Math.random(),
          description: `Dodací list č. ${note.number}`,
          quantity: 1,
          unit: 'ks',
          pricePerUnit: totalWithoutVat,
          totalPrice: totalWithoutVat,
          vatRate: vatSettings?.rates?.[vatSettings.rates.length - 1] || 21,
        };
      });

      const allNumbers = invoices.map((inv) => inv.number).filter(Boolean);
      const newInvoice = getNewInvoice();
      newInvoice.number = generateNextDocumentNumber(allNumbers);
      newInvoice.customer = firstCustomer;
      newInvoice.items = newItems;
      newInvoice.dueDate = calculateDueDate(
        newInvoice.issueDate,
        newInvoice.dueDays || 14
      );

      setCurrentInvoice(newInvoice);
      setEditingInvoice(null);
      setCurrentView('create');
      setShowPreviewModal(false); // Zajistí, že se nezobrazí preview modal
    } catch (error) {
      console.error('Error creating invoice from delivery notes:', error);
    }
  };

  

  const cloneInvoice = (invoiceToClone) => {
    try {
      const allNumbers = invoices.map((inv) => inv.number).filter(Boolean);
      const newInvoice = {
        ...JSON.parse(JSON.stringify(invoiceToClone)),
        number: generateNextDocumentNumber(allNumbers),
        issueDate: new Date().toLocaleDateString('cs-CZ', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        duzpDate: new Date().toLocaleDateString('cs-CZ', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        dueDate: calculateDueDate(
          new Date().toLocaleDateString('cs-CZ'),
          invoiceToClone.dueDays || 14
        ),
        status: 'draft',
      };

      delete newInvoice.id;
      setCurrentInvoice(newInvoice);
      setEditingInvoice(null);
      setCurrentView('create');
    } catch (error) {
      console.error('Error cloning invoice:', error);
    }
  };

  const deleteInvoice = async (id) => {
    if (window.confirm(t('invoices_page.alert.confirm_delete'))) {
      try {
        await deleteDoc(doc(db, 'invoices', id));
      } catch (error) {
        console.error('Error deleting invoice:', error);
      }
    }
  };

  const createNewItem = () => ({
    id: Date.now() + Math.random(),
    quantity: 1,
    unit: 'ks',
    description: '',
    pricePerUnit: 0,
    totalPrice: 0,
    vatRate: vatSettings?.rates?.[vatSettings.rates.length - 1] || 21, // nejvyšší dostupná sazba jako default
  });

  const addItemBelow = (currentItemId) => {
    if (!currentInvoice) return;

    const newItems = [];
    currentInvoice.items.forEach((item) => {
      newItems.push(item);
      if (item.id === currentItemId) {
        newItems.push(createNewItem());
      }
    });
    setCurrentInvoice((prev) => ({ ...prev, items: newItems }));
  };

  const removeItem = (id) => {
    if (!currentInvoice || currentInvoice.items.length <= 1) return;

    setCurrentInvoice({
      ...currentInvoice,
      items: currentInvoice.items.filter((item) => item.id !== id),
    });
  };

  const updateItem = (id, field, value) => {
    if (!currentInvoice) return;

    setCurrentInvoice({
      ...currentInvoice,
      items: currentInvoice.items.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'pricePerUnit') {
            updatedItem.totalPrice =
              (parseFloat(updatedItem.quantity) || 0) *
              (parseFloat(updatedItem.pricePerUnit) || 0);
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
      if (dateParts.length !== 3) return '';

      const date = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
      if (isNaN(date.getTime())) return '';

      date.setDate(date.getDate() + parseInt(days, 10));

      return date.toLocaleDateString('cs-CZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (e) {
      console.error('Error calculating due date:', e);
      return '';
    }
  };

  const editInvoice = (invoice) => {
    const fullInvoice = {
      ...invoice,
      dueDays: invoice.dueDays || 14,
      items:
        invoice.items && invoice.items.length > 0
          ? invoice.items
          : [createNewItem()],
    };
    setCurrentInvoice(fullInvoice);
    setEditingInvoice(invoice);
    setCurrentView('create');
  };

  const handleDownloadPdf = (invoice) => {
    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    document.body.appendChild(element);

    const root = ReactDOM.createRoot(element);
    pdfRootRef.current = root;

    root.render(
      <InvoicePrintable
        invoice={invoice}
        supplier={supplier}
        vatSettings={vatSettings}
      />
    );

    setTimeout(() => {
      const opt = {
        margin: 10,
        filename: `faktura-${invoice.number}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      html2pdf()
        .from(element.firstChild)
        .set(opt)
        .save()
        .then(() => {
          cleanupDOMElement(element, pdfRootRef.current);
          pdfRootRef.current = null;
        })
        .catch((error) => {
          console.error('PDF generation error:', error);
          cleanupDOMElement(element, pdfRootRef.current);
          pdfRootRef.current = null;
        });
    }, 500);
  };

  const handlePrint = (invoice) => {
    const printContainer = document.createElement('div');
    printContainer.id = 'print-container';
    printContainer.style.position = 'absolute';
    printContainer.style.left = '-9999px';
    document.body.appendChild(printContainer);

    const root = ReactDOM.createRoot(printContainer);
    printRootRef.current = root;

    root.render(
      <InvoicePrintable
        invoice={invoice}
        supplier={supplier}
        vatSettings={vatSettings}
      />
    );

    setTimeout(() => {
      try {
        window.print();
      } finally {
        // Čekáme na dokončení tisku před odstraněním
        const cleanup = () => {
          if (printRootRef.current) {
            printRootRef.current.unmount();
            printRootRef.current = null;
          }
          if (printContainer.parentNode) {
            printContainer.parentNode.removeChild(printContainer);
          }
          window.removeEventListener('afterprint', cleanup);
        };

        window.addEventListener('afterprint', cleanup);
      }
    }, 1000);
  };

  const handleShare = async (invoice) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Faktura ${invoice.number}`,
          text: `Faktura pro ${invoice.customer.name}`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Odkaz zkopírován do schránky!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleAction = (actionKey, invoice) => {
    console.log('🔥 handleAction CALLED:', actionKey, invoice?.id); // DEBUG
    
    switch (actionKey) {
      case 'edit':
        console.log('📝 Calling editInvoice'); // DEBUG
        editInvoice(invoice);
        break;
      case 'view':
        console.log('👁️ Calling setCurrentInvoice'); // DEBUG
        setCurrentInvoice(invoice);
        setShowPreviewModal(true);
        break;
        case 'print':
          console.log('🖨️ Calling handlePrint');
          handlePrint(invoice);
          break;
      case 'download':
        console.log('💾 Calling handleDownloadPdf'); // DEBUG
        handleDownloadPdf(invoice);
        break;
      case 'share':     // ← PŘIDAT TUTO AKCI
        console.log('📤 Calling handleShare'); // DEBUG
        handleShare(invoice);
        break;
      case 'delete':
        console.log('🗑️ Calling deleteInvoice'); // DEBUG
        deleteInvoice(invoice.id);
        break;      
        default:
        console.warn('❌ Unknown action:', actionKey);
        break;
    }
  };

  const MoreActionsButton = ({ invoice }) => {
    const buttonRef = useRef(null);
    const isMenuOpen = openMenu.id === invoice.id;

    const handleMenuToggle = (e) => {
      e.preventDefault();
      e.stopPropagation();
    
      console.log('🔘 Menu toggle, buttonRef:', buttonRef.current); // DEBUG
    
      setTimeout(() => {
        setOpenMenu((prev) => {
          const newState = prev.id === invoice.id
            ? { id: null, ref: null }
            : { id: invoice.id, ref: buttonRef.current };
          
          console.log('📝 Setting openMenu:', newState); // DEBUG
          return newState;
        });
      }, 0);
    };

    return (
      <div className="relative">
        <button
  ref={buttonRef}
  onTouchStart={(e) => e.stopPropagation()}
  onClick={(e) => {
    console.log('🔘 Button ... clicked!'); // DEBUG - mělo by se vypsat
    handleMenuToggle(e);
  }}
  className="p-2 text-gray-600 hover:bg-gray-200 rounded-md active:bg-gray-300 transition-colors"
  title="Další akce"
>
  <MoreVertical size={20} />
</button>
        {isMenuOpen && (
          <ActionsMenu
            invoice={invoice}
            onAction={handleAction}
            onClose={() => setOpenMenu({ id: null, ref: null })}
            targetElement={openMenu.ref}
          />
        )}
      </div>
    );
  };

  // Cleanup při unmount
  useEffect(() => {
    return () => {
      if (pdfRootRef.current) {
        cleanupDOMElement(null, pdfRootRef.current);
      }
      if (printRootRef.current) {
        cleanupDOMElement(null, printRootRef.current);
      }
    };
  }, []);

  const modalConfig = currentInvoice
    ? {
        title: t('invoices_page.modal.missing_number_title'),
        message: t('invoices_page.modal.missing_number_message'),
        showInput: true,
        inputLabel: t('invoices_page.modal.number_label'),
        initialValue: currentInvoice.number,
        confirmText: t('invoices_page.modal.confirm_save'),
        onConfirm: (newNumber) => {
          if (!newNumber?.trim()) {
            alert('Číslo faktury nemůže být prázdné');
            return;
          }
          const updatedInvoice = {
            ...currentInvoice,
            number: newNumber.trim(),
          };
          setCurrentInvoice(updatedInvoice);
          saveInvoiceFlow(updatedInvoice);
          setShowConfirmModal(false);
        },
        onSaveAnyway: () => {
          saveInvoiceFlow(currentInvoice);
          setShowConfirmModal(false);
        },
      }
    : {};

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-lg">{t('invoices_page.loading')}</div>
      </div>
    );
  }

  return (
    <>
      <DeliveryNotesSelectionModal
        isOpen={showDLModal}
        onClose={() => setShowDLModal(false)}
        deliveryNotes={deliveryNotes}
        onCreateInvoice={handleCreateInvoiceFromDL}
        calculateDlTotal={calculateDlTotal}
        t={t}
      />

      <ConfirmModal
        isOpen={showConfirmModal}
        config={modalConfig}
        onClose={() => setShowConfirmModal(false)}
      />

      {currentInvoice && (
        <PreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
        >
          <InvoicePreview
            invoice={currentInvoice}
            supplier={supplier}
            vatSettings={vatSettings}
            calculateTotals={calculateTotals}
          />
        </PreviewModal>
      )}

      {currentView === 'list' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">{t('invoices_page.title')}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDLModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                <Plus size={16} />
                <span>Vytvořit z DL</span>
              </button>
              <button
                onClick={() => handleAddNew()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                <span>{t('invoices_page.new_title')}</span>
              </button>
            </div>
          </div>

          <div className="bg-white border rounded-lg">
            <div className="hidden md:grid grid-cols-5 p-4 bg-gray-50 font-medium">
              <div className="col-span-2">
                {t('invoices_page.table.customer')}
              </div>
              <div className="text-center">
                {t('invoices_page.table.number')}
              </div>
              <div className="text-right">
                {t('invoices_page.table.amount')}
              </div>
              <div className="text-right pr-4">
                {t('invoices_page.table.actions')}
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {invoices.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="mb-4">
                    <Edit size={48} className="mx-auto text-gray-300" />
                  </div>
                  <div className="text-lg font-medium mb-2">
                    {t('invoices_page.empty.title')}
                  </div>
                  <div className="text-sm">
                    {t('invoices_page.empty.subtitle')}
                  </div>
                  <button
                    onClick={() => handleAddNew()}
                    className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={16} />
                    <span>{t('invoices_page.new_title')}</span>
                  </button>
                </div>
              ) : (
                invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="border-b border-gray-200 hover:bg-gray-50"
                  >
                    {/* Mobile Layout */}
                    <div className="block md:hidden p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold text-lg">
                              {invoice.number}
                            </div>
                            <div className="text-gray-600 text-sm">
                              {invoice.customer?.name || 'Bez odběratele'}
                            </div>
                            <div className="text-gray-500 text-xs">
                              {invoice.issueDate} | Splatnost: {invoice.dueDate}
                            </div>
                          </div>
                          <div className="text-right">
                            {(() => {
                              const { subtotal, total } = calculateTotals(
                                invoice,
                                vatSettings
                              );
                              return (
                                <>
                                  <div className="font-medium text-lg">
                                    {subtotal.toFixed(2)} Kč
                                  </div>
                                  {vatSettings?.enabled && (
                                    <div className="text-xs text-gray-500">
                                      s DPH: {total.toFixed(2)} Kč
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAction('print', invoice);
                            }}
                            className="flex items-center gap-1 px-3 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-sm font-medium transition-colors"
                            title={t('common.print')}
                          >
                            <Printer size={16} />
                            Tisk
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAction('download', invoice);
                            }}
                            className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded text-sm font-medium transition-colors"
                            title={t('common.download_pdf')}
                          >
                            <Download size={16} />
                            PDF
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAction('edit', invoice);
                            }}
                            className="flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded text-sm font-medium transition-colors"
                            title={t('common.edit')}
                          >
                            <Edit size={16} />
                            Upravit
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAction('clone', invoice);
                            }}
                            className="flex items-center gap-1 px-3 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded text-sm font-medium transition-colors"
                            title={t('common.clone')}
                          >
                            <Copy size={16} />
                            Kopie
                          </button>
                          {/* <MoreActionsButton invoice={invoice} /> */}
                        </div>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div
                      onClick={() => editInvoice(invoice)}
                      className="hidden md:grid md:grid-cols-5 items-center p-4 cursor-pointer transition-colors"
                    >
                      <div className="md:col-span-2">
                        <div className="font-bold">{invoice.customer.name}</div>
                      </div>
                      <div className="text-sm text-gray-500 text-center">
                        {invoice.number}
                      </div>
                      <div className="text-right font-medium">
                        {(() => {
                          const { subtotal, total } = calculateTotals(
                            invoice,
                            vatSettings
                          );
                          return (
                            <>
                              {subtotal.toFixed(2)} {t('currency_czk')}
                              {vatSettings?.enabled && (
                                <div className="text-xs text-gray-500">
                                  {t('delivery_notes_page.table.with_vat', {
                                    amount: total.toFixed(2),
                                  })}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <div
                        className="text-right"
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAction('print', invoice);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title={t('common.print')}
                          >
                            <Printer size={18} />
                          </button>
                          {/* <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAction('download', invoice);
                }}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title={t('common.download_pdf')}
              >
                <Download size={18} />
              </button> */}
                          {/* <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAction('view', invoice);
                }}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title={t('common.view')}
              >
                <Eye size={18} />
              </button> */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAction('clone', invoice);
                            }}
                            className="p-2 text-purple-600 hover:bg-purple-100 rounded transition-colors"
                            title={t('common.clone')}
                          >
                            <Copy size={18} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAction('edit', invoice);
                            }}
                            className="p-2 text-green-600 hover:bg-green-100 rounded transition-colors"
                            title={t('common.edit')}
                          >
                            <Edit size={18} />
                          </button>
                          <MoreActionsButton invoice={invoice} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>{' '}
          </div>
        </div>
      )}

      {currentView === 'preview' && currentInvoice && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={goToList}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              ← {t('common.back_to_list')}
            </button>
            <h2 className="text-2xl font-bold">
              {t('invoice_title')} {currentInvoice.number}
            </h2>
            <div className="flex-grow"></div>
            <button
              onClick={() => handlePrint(currentInvoice)}
              className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
              title={t('common.print')}
            >
              <Printer size={20} />
            </button>
            <button
              onClick={() => handleDownloadPdf(currentInvoice)}
              className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
              title={t('common.download_pdf')}
            >
              <Download size={20} />
            </button>
          </div>
          <InvoicePreview
            invoice={currentInvoice}
            supplier={supplier}
            vatSettings={vatSettings}
            calculateTotals={calculateTotals}
          />
        </div>
      )}

      {currentView === 'create' && currentInvoice && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={goToList}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              ← {t('common.back_to_list')}
            </button>
            <h2 className="text-2xl font-bold">
              {editingInvoice
                ? t('invoices_page.edit_title', {
                    number: editingInvoice?.number,
                  })
                : t('invoices_page.new_title')}
            </h2>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('invoices_page.form.number')}
                </label>
                <input
                  type="text"
                  placeholder="např. 2025-001"
                  value={currentInvoice.number || ''}
                  onChange={(e) =>
                    setCurrentInvoice({
                      ...currentInvoice,
                      number: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('invoices_page.form.issue_date')}
                </label>
                <input
                  type="text"
                  placeholder="dd.mm.rrrr"
                  value={currentInvoice.issueDate || ''}
                  onChange={(e) =>
                    setCurrentInvoice({
                      ...currentInvoice,
                      issueDate: e.target.value,
                      dueDate: calculateDueDate(
                        e.target.value,
                        currentInvoice.dueDays
                      ),
                    })
                  }
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('invoices_page.form.taxable_date')}
                </label>
                <input
                  type="text"
                  placeholder="dd.mm.rrrr"
                  value={currentInvoice.duzpDate || ''}
                  onChange={(e) =>
                    setCurrentInvoice({
                      ...currentInvoice,
                      duzpDate: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Splatnost (dny) - automaticky se vypočítá datum splatnosti
                </label>
                <input
                  type="number"
                  placeholder="14"
                  value={currentInvoice.dueDays || ''}
                  onChange={(e) => {
                    const days = parseInt(e.target.value, 10) || 0;
                    setCurrentInvoice({
                      ...currentInvoice,
                      dueDays: days,
                      dueDate: calculateDueDate(currentInvoice.issueDate, days),
                    });
                  }}
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-medium">
                  {t('invoices_page.form.customer')}
                </h3>
                {savedCustomers && savedCustomers.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        const customer = savedCustomers.find(
                          (c) => c.id === e.target.value
                        );
                        if (customer) {
                          setCurrentInvoice({
                            ...currentInvoice,
                            customer: {
                              name: customer.name || '',
                              address: customer.address || '',
                              zip: customer.zip || '',
                              city: customer.city || '',
                              ico: customer.ico || '',
                              dic: customer.dic || '',
                            },
                          });
                        }
                      }
                    }}
                    className="px-3 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">
                      {t('invoices_page.form.select_saved')}
                    </option>
                    {savedCustomers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('invoices_page.form.customer_name')}
                  </label>
                  <input
                    type="text"
                    placeholder="Název firmy nebo jméno"
                    value={currentInvoice.customer?.name || ''}
                    onChange={(e) =>
                      setCurrentInvoice({
                        ...currentInvoice,
                        customer: {
                          ...currentInvoice.customer,
                          name: e.target.value,
                        },
                      })
                    }
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('invoices_page.form.customer_address')}
                  </label>
                  <input
                    type="text"
                    placeholder="Ulice a číslo popisné"
                    value={currentInvoice.customer?.address || ''}
                    onChange={(e) =>
                      setCurrentInvoice({
                        ...currentInvoice,
                        customer: {
                          ...currentInvoice.customer,
                          address: e.target.value,
                        },
                      })
                    }
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('invoices_page.form.customer_zip')}
                  </label>
                  <input
                    type="text"
                    placeholder="PSČ"
                    value={currentInvoice.customer?.zip || ''}
                    onChange={(e) =>
                      setCurrentInvoice({
                        ...currentInvoice,
                        customer: {
                          ...currentInvoice.customer,
                          zip: e.target.value,
                        },
                      })
                    }
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('invoices_page.form.customer_city')}
                  </label>
                  <input
                    type="text"
                    placeholder="Město"
                    value={currentInvoice.customer?.city || ''}
                    onChange={(e) =>
                      setCurrentInvoice({
                        ...currentInvoice,
                        customer: {
                          ...currentInvoice.customer,
                          city: e.target.value,
                        },
                      })
                    }
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('invoices_page.form.customer_ico')}
                  </label>
                  <input
                    type="text"
                    placeholder="IČO"
                    value={currentInvoice.customer?.ico || ''}
                    onChange={(e) =>
                      setCurrentInvoice({
                        ...currentInvoice,
                        customer: {
                          ...currentInvoice.customer,
                          ico: e.target.value,
                        },
                      })
                    }
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('invoices_page.form.customer_dic')}
                  </label>
                  <input
                    type="text"
                    placeholder="DIČ (volitelné)"
                    value={currentInvoice.customer?.dic || ''}
                    onChange={(e) =>
                      setCurrentInvoice({
                        ...currentInvoice,
                        customer: {
                          ...currentInvoice.customer,
                          dic: e.target.value,
                        },
                      })
                    }
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-3">
                {t('invoices_page.form.items')}
              </h3>
              <div className="space-y-3">
                <div
                  className="hidden md:grid gap-2 text-sm font-medium text-gray-600 px-1"
                  style={{
                    gridTemplateColumns: vatSettings?.enabled
                      ? '60px 1fr 80px 60px 100px 120px 80px'
                      : '1fr 80px 60px 100px 120px 80px',
                  }}
                >
                  {vatSettings?.enabled && (
                    <div className="text-center">DPH %</div>
                  )}
                  <div className="text-left">
                    {t('invoices_page.form.item_description')}
                  </div>
                  <div className="text-center">
                    {t('invoices_page.form.item_quantity')}
                  </div>
                  <div className="text-center">
                    {t('invoices_page.form.item_unit')}
                  </div>
                  <div className="text-right">
                    {t('invoices_page.form.item_price')}
                  </div>
                  <div className="text-right">{t('th_total')}</div>
                  <div className="text-center"></div>
                </div>

                {currentInvoice.items &&
                  currentInvoice.items.map((item) => (
                    <div
                      key={item.id}
                      className="md:grid md:gap-2 md:items-center bg-white p-3 rounded border flex flex-wrap gap-2"
                      style={{
                        gridTemplateColumns: vatSettings?.enabled
                          ? '60px 1fr 80px 60px 100px 120px 80px'
                          : '1fr 80px 60px 100px 120px 80px',
                      }}
                    >
                      {vatSettings?.enabled && (
                        <div className="w-1/4 md:w-auto order-1">
                          <label className="text-xs font-medium text-gray-600 md:hidden block mb-1">
                            DPH
                          </label>
                          <select
                            value={item.vatRate || 21}
                            onChange={(e) =>
                              updateItem(
                                item.id,
                                'vatRate',
                                parseInt(e.target.value)
                              )
                            }
                            className="w-full px-2 py-1 border rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {(vatSettings.rates || [21]).map((rate) => (
                              <option key={rate} value={rate}>
                                {rate}%
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="w-full md:w-auto order-2">
                        <label className="text-xs font-medium text-gray-600 md:hidden block mb-1">
                          {t('invoices_page.form.item_description')}
                        </label>
                        <input
                          type="text"
                          value={item.description || ''}
                          onChange={(e) =>
                            updateItem(item.id, 'description', e.target.value)
                          }
                          className="w-full p-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder={t('invoices_page.form.item_description')}
                        />
                      </div>
                      <div className="w-1/3 md:w-auto order-3">
                        <label className="text-xs font-medium text-gray-600 md:hidden block mb-1">
                          {t('invoices_page.form.item_quantity')}
                        </label>
                        <input
                          type="number"
                          value={item.quantity || ''}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              'quantity',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full p-1 border rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="1"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div className="w-1/3 md:w-auto order-4">
                        <label className="text-xs font-medium text-gray-600 md:hidden block mb-1">
                          {t('invoices_page.form.item_unit')}
                        </label>
                        <input
                          type="text"
                          value={item.unit || ''}
                          onChange={(e) =>
                            updateItem(item.id, 'unit', e.target.value)
                          }
                          className="w-full p-1 border rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="ks"
                        />
                      </div>
                      <div className="w-1/3 md:w-auto order-5">
                        <label className="text-xs font-medium text-gray-600 md:hidden block mb-1">
                          {t('invoices_page.form.item_price')}
                        </label>
                        <input
                          type="number"
                          value={item.pricePerUnit || ''}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              'pricePerUnit',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full p-1 border rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div className="w-1/2 md:w-auto order-6">
                        <label className="text-xs font-medium text-gray-600 md:hidden block mb-1">
                          {t('th_total')}
                        </label>
                        <input
                          type="text"
                          value={Number(item.totalPrice || 0).toFixed(2)}
                          readOnly
                          className="w-full p-1 border-none rounded text-sm text-right bg-gray-50"
                        />
                      </div>
                      <div className="w-1/2 md:w-auto flex justify-end gap-1 order-7">
                        <button
                          onClick={() => addItemBelow(item.id)}
                          className="p-1 text-green-600 hover:text-green-800 transition-colors"
                          title="Přidat řádek pod"
                        >
                          <PlusCircle size={18} />
                        </button>
                        {currentInvoice.items.length > 1 && (
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-1 text-red-600 hover:text-red-800 transition-colors"
                            title={t('common.delete')}
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-4 pt-4">
            <button
              onClick={handleSaveInvoice}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Save size={16} />
              <span>
                {editingInvoice
                  ? t('common.save_changes')
                  : t('invoices_page.create')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="flex items-center justify-center gap-2 px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              <Eye size={16} className="pointer-events-none" />
              <span>{t('common.preview')}</span>
            </button>
            <button
              type="button"
              onClick={() => handlePrint(currentInvoice)}
              className="flex items-center justify-center gap-2 px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              <Printer size={16} className="pointer-events-none" />
              <span>{t('common.print')}</span>
            </button>
            <button
              onClick={goToList}
              className="px-6 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default InvoicesPage;
