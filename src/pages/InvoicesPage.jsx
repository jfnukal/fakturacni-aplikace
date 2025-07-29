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
import { generateNextDocumentNumber } from '../../netlify/functions/numbering.js';

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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
                onAction(action.key, invoice);
                onClose();
              }}
              className={`w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 ${
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
          className="absolute top-2 right-2 p-2 bg-gray-200 rounded-full hover:bg-gray-300 z-10"
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
      className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
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
            {invoice.items.map((item) => (
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

const InvoicesPage = ({
  currentUser,
  savedCustomers,
  supplier,
  vatSettings,
  deliveryNotes,
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
  const [isSelectingDL, setIsSelectingDL] = useState(false);
  const [selectedDLs, setSelectedDLs] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

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
      setInvoices(
        querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

  const handleAddNew = (customer = null) => {
    const allNumbers = invoices.map((inv) => inv.number);
    const newInv = getNewInvoice();
    newInv.number = generateNextDocumentNumber(allNumbers);
    if (customer) {
      newInv.customer = {
        name: customer.name,
        address: customer.address,
        zip: customer.zip,
        city: customer.city,
        ico: customer.ico,
        dic: customer.dic,
      };
    }
    setCurrentInvoice(newInv);
    setEditingInvoice(null);
    setCurrentView('create');
  };

  const calculateTotals = (invoice, currentVatSettings) => {
    if (!invoice || !invoice.items)
      return { subtotal: 0, vatAmount: 0, total: 0 };
    const subtotal = invoice.items.reduce(
      (sum, item) => sum + (item.totalPrice || 0),
      0
    );
    const vatAmount =
      currentVatSettings && currentVatSettings.enabled
        ? (subtotal * currentVatSettings.rate) / 100
        : 0;
    const total = subtotal + vatAmount;
    return { subtotal, vatAmount, total };
  };

  const saveInvoiceFlow = async (invoiceData) => {
    if (!currentUser) return;
    const { total } = calculateTotals(invoiceData, vatSettings);
    const invoiceToSave = {
      ...invoiceData,
      total,
      status: 'pending',
      userId: currentUser.uid,
    };
    delete invoiceToSave.id;
    try {
      if (editingInvoice) {
        await updateDoc(doc(db, 'invoices', editingInvoice.id), invoiceToSave);
      } else {
        await addDoc(collection(db, 'invoices'), invoiceToSave);
      }
      goToList();
    } catch (error) {
      console.error('Chyba: ', error);
    }
  };

  const handleSaveInvoice = () => {
    if (!currentInvoice?.number) {
      setShowConfirmModal(true);
    } else {
      saveInvoiceFlow(currentInvoice);
    }
  };

  const cloneInvoice = (invoiceToClone) => {
    const allNumbers = invoices.map((inv) => inv.number);
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
  };

  const deleteInvoice = async (id) => {
    if (window.confirm(t('invoices_page.alert.confirm_delete'))) {
      await deleteDoc(doc(db, 'invoices', id));
    }
  };

  const createNewItem = () => ({
    id: Date.now(),
    quantity: 1,
    unit: 'ks',
    description: '',
    pricePerUnit: 0,
    totalPrice: 0,
  });

  const addItemBelow = (currentItemId) => {
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
    if (currentInvoice.items.length <= 1) return;
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
  document.body.appendChild(element);
  const root = ReactDOM.createRoot(element);
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
        document.body.removeChild(element);
      });
  }, 500);
};

  const handlePrint = (invoice) => {
    const printContainer = document.createElement('div');
    printContainer.id = 'print-container';
    document.body.appendChild(printContainer);
    const root = ReactDOM.createRoot(printContainer);
    root.render(
      <InvoicePrintable
        invoice={invoice}
        supplier={supplier}
        vatSettings={vatSettings}
      />
    );
    setTimeout(() => {
      window.print();
      document.body.removeChild(printContainer);
    }, 500);
  };

const handleShare = (invoice) => {
  if (navigator.share) {
    // Na mobilech použijeme native sharing
    navigator.share({
      title: `Faktura ${invoice.number}`,
      text: `Faktura pro ${invoice.customer.name}`,
      url: window.location.href
    });
  } else {
    // Na desktopu zkopírujeme URL do schránky
    navigator.clipboard.writeText(window.location.href).then(() => {
      alert('Odkaz zkopírován do schránky!');
    });
  }
};
  
  const handleAction = (actionKey, invoice) => {
  switch (actionKey) {
    case 'edit':
      editInvoice(invoice);
      break;
    case 'clone':
      cloneInvoice(invoice);
      break;
    case 'print':
      handlePrint(invoice);
      break;
    case 'view':
      setCurrentInvoice(invoice);
      setShowPreviewModal(true);
      break;
    case 'download':
      handleDownloadPdf(invoice);
      break;
    case 'share':
      handleShare(invoice); // Přidáme tuto funkci
      break;
    case 'delete':
      deleteInvoice(invoice.id);
      break;
    default:
      break;
  }
};
  
  const MoreActionsButton = ({ invoice }) => {
  const buttonRef = useRef(null);
  const isMenuOpen = openMenu.id === invoice.id;

  const handleMenuToggle = (e) => {
    e.stopPropagation();
    
    // Přidáme malé zpoždění, aby byl ref připravený
    setTimeout(() => {
      setOpenMenu((prev) =>
        prev.id === invoice.id
          ? { id: null, ref: null }
          : { id: invoice.id, ref: buttonRef.current } // Uložíme přímo element
      );
    }, 0);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleMenuToggle}
        className="p-2 text-gray-600 hover:bg-gray-200 rounded-md"
        title="Další akce"
      >
        <MoreVertical size={20} />
      </button>
      {isMenuOpen && (
        <ActionsMenu
          invoice={invoice}
          onAction={handleAction}
          onClose={() => setOpenMenu({ id: null, ref: null })}
          targetElement={openMenu.ref} // Použijeme uložený element
        />
      )}
    </div>
  );
};

  const modalConfig = currentInvoice
    ? {
        title: t('invoices_page.modal.missing_number_title'),
        message: t('invoices_page.modal.missing_number_message'),
        showInput: true,
        inputLabel: t('invoices_page.modal.number_label'),
        initialValue: currentInvoice.number,
        confirmText: t('invoices_page.modal.confirm_save'),
        onConfirm: (newNumber) => {
          const updatedInvoice = { ...currentInvoice, number: newNumber };
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
    return <div>{t('invoices_page.loading')}</div>;
  }

  return (
    <>
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
          </div>
          <div className="bg-white border rounded-lg overflow-visible">
            <div className="hidden md:grid grid-cols-6 p-4 bg-gray-50 font-medium">
              <div className="col-span-2">
                {t('invoices_page.table.customer')}
              </div>
              <div>{t('invoices_page.table.number')}</div>
              <div className="text-right">
                {t('invoices_page.table.amount')}
              </div>
              <div className="text-center">
                {t('invoices_page.table.status')}
              </div>
              <div className="text-right pr-4">
                {t('invoices_page.table.actions')}
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  onClick={() => editInvoice(invoice)}
                  className="md:grid md:grid-cols-6 items-center p-4 hover:bg-gray-50 cursor-pointer block"
                >
                  <div className="md:col-span-2 mb-2 md:mb-0">
                    <div className="font-bold">{invoice.customer.name}</div>
                    <div className="text-sm text-gray-500 md:hidden">
                      {invoice.number}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 hidden md:block">
                    {invoice.number}
                  </div>
                  <div className="text-right font-medium">
                    {(invoice.total || 0).toFixed(2)} {t('currency_czk')}
                  </div>
                  <div className="text-center">
                    <StatusBadge status={invoice.status} />
                  </div>
                  <div
                    className="md:text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex gap-1 justify-end mt-2 md:mt-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction('edit', invoice);
                        }}
                        className="p-2 text-blue-600 hover:bg-gray-200 rounded-md"
                        title={t('common.edit')}
                      >
                        <Edit size={20} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction('clone', invoice);
                        }}
                        className="p-2 text-purple-600 hover:bg-gray-200 rounded-md"
                        title={t('common.clone')}
                      >
                        <Copy size={20} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction('print', invoice);
                        }}
                        className="p-2 text-gray-600 hover:bg-gray-200 rounded-md"
                        title={t('common.print')}
                      >
                        <Printer size={20} />
                      </button>
                      <MoreActionsButton invoice={invoice} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {currentView === 'preview' && currentInvoice && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={goToList}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              ← {t('common.back_to_list')}
            </button>
            <h2 className="text-2xl font-bold">
              {t('invoice_title')} {currentInvoice.number}
            </h2>
            <div className="flex-grow"></div>
            <button
              onClick={() => handlePrint(currentInvoice)}
              className="p-2 text-gray-600 hover:text-gray-800"
              title={t('common.print')}
            >
              <Printer size={20} />
            </button>
            <button
              onClick={() => handleDownloadPdf(currentInvoice)}
              className="p-2 text-gray-600 hover:text-gray-800"
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
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
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
              <input
                type="text"
                placeholder={t('invoices_page.form.number')}
                value={currentInvoice.number}
                onChange={(e) =>
                  setCurrentInvoice({
                    ...currentInvoice,
                    number: e.target.value,
                  })
                }
                className="w-full p-2 border rounded"
              />
              <input
                type="text"
                placeholder={t('invoices_page.form.issue_date')}
                value={currentInvoice.issueDate}
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
                className="w-full p-2 border rounded"
              />
              <input
                type="text"
                placeholder={t('invoices_page.form.taxable_date')}
                value={currentInvoice.duzpDate}
                onChange={(e) =>
                  setCurrentInvoice({
                    ...currentInvoice,
                    duzpDate: e.target.value,
                  })
                }
                className="w-full p-2 border rounded"
              />
              <input
                type="number"
                placeholder={t('invoices_page.form.due_days')}
                value={currentInvoice.dueDays}
                onChange={(e) => {
                  const days = parseInt(e.target.value, 10) || 0;
                  setCurrentInvoice({
                    ...currentInvoice,
                    dueDays: days,
                    dueDate: calculateDueDate(currentInvoice.issueDate, days),
                  });
                }}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-medium">
                  {t('invoices_page.form.customer')}
                </h3>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      const customer = savedCustomers.find(
                        (c) => c.id === e.target.value
                      );
                      if (customer)
                        setCurrentInvoice({
                          ...currentInvoice,
                          customer: {
                            name: customer.name,
                            address: customer.address,
                            zip: customer.zip,
                            city: customer.city,
                            ico: customer.ico,
                            dic: customer.dic,
                          },
                        });
                    }
                  }}
                  className="px-3 py-1 border rounded text-sm"
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
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder={t('invoices_page.form.customer_name')}
                  value={currentInvoice.customer.name}
                  onChange={(e) =>
                    setCurrentInvoice({
                      ...currentInvoice,
                      customer: {
                        ...currentInvoice.customer,
                        name: e.target.value,
                      },
                    })
                  }
                  className="w-full p-2 border rounded"
                />
                <input
                  type="text"
                  placeholder={t('invoices_page.form.customer_address')}
                  value={currentInvoice.customer.address}
                  onChange={(e) =>
                    setCurrentInvoice({
                      ...currentInvoice,
                      customer: {
                        ...currentInvoice.customer,
                        address: e.target.value,
                      },
                    })
                  }
                  className="w-full p-2 border rounded"
                />
                <input
                  type="text"
                  placeholder={t('invoices_page.form.customer_zip')}
                  value={currentInvoice.customer.zip || ''}
                  onChange={(e) =>
                    setCurrentInvoice({
                      ...currentInvoice,
                      customer: {
                        ...currentInvoice.customer,
                        zip: e.target.value,
                      },
                    })
                  }
                  className="w-full p-2 border rounded"
                />
                <input
                  type="text"
                  placeholder={t('invoices_page.form.customer_city')}
                  value={currentInvoice.customer.city}
                  onChange={(e) =>
                    setCurrentInvoice({
                      ...currentInvoice,
                      customer: {
                        ...currentInvoice.customer,
                        city: e.target.value,
                      },
                    })
                  }
                  className="w-full p-2 border rounded"
                />
                <input
                  type="text"
                  placeholder={t('invoices_page.form.customer_ico')}
                  value={currentInvoice.customer.ico}
                  onChange={(e) =>
                    setCurrentInvoice({
                      ...currentInvoice,
                      customer: {
                        ...currentInvoice.customer,
                        ico: e.target.value,
                      },
                    })
                  }
                  className="w-full p-2 border rounded"
                />
                <input
                  type="text"
                  placeholder={t('invoices_page.form.customer_dic')}
                  value={currentInvoice.customer.dic}
                  onChange={(e) =>
                    setCurrentInvoice({
                      ...currentInvoice,
                      customer: {
                        ...currentInvoice.customer,
                        dic: e.target.value,
                      },
                    })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-3">
                {t('invoices_page.form.items')}
              </h3>
              <div className="space-y-3">
                <div className="hidden md:flex gap-2 text-sm font-medium text-gray-600 px-1">
                  <div className="flex-grow">
                    {t('invoices_page.form.item_description')}
                  </div>
                  <div className="w-20 text-center">
                    {t('invoices_page.form.item_quantity')}
                  </div>
                  <div className="w-16 text-center">
                    {t('invoices_page.form.item_unit')}
                  </div>
                  <div className="w-24 text-right">
                    {t('invoices_page.form.item_price')}
                  </div>
                  <div className="w-28 text-right">{t('th_total')}</div>
                  <div className="w-16 text-center"></div>
                </div>
                {currentInvoice.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap md:flex-nowrap gap-2 items-center bg-white p-3 rounded border"
                  >
                    <div className="w-full md:flex-grow order-1">
                      <label className="text-xs font-medium text-gray-600 md:hidden">
                        {t('invoices_page.form.item_description')}
                      </label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          updateItem(item.id, 'description', e.target.value)
                        }
                        className="w-full p-1 border rounded text-sm"
                        placeholder={t('invoices_page.form.item_description')}
                      />
                    </div>
                    <div className="w-1/3 md:w-20 order-2">
                      <label className="text-xs font-medium text-gray-600 md:hidden">
                        {t('invoices_page.form.item_quantity')}
                      </label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            'quantity',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full p-1 border rounded text-sm text-center"
                        placeholder="1"
                      />
                    </div>
                    <div className="w-1/3 md:w-16 order-3">
                      <label className="text-xs font-medium text-gray-600 md:hidden">
                        {t('invoices_page.form.item_unit')}
                      </label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) =>
                          updateItem(item.id, 'unit', e.target.value)
                        }
                        className="w-full p-1 border rounded text-sm text-center"
                        placeholder="ks"
                      />
                    </div>
                    <div className="w-1/3 md:w-24 order-4">
                      <label className="text-xs font-medium text-gray-600 md:hidden">
                        {t('invoices_page.form.item_price')}
                      </label>
                      <input
                        type="number"
                        value={item.pricePerUnit}
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            'pricePerUnit',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full p-1 border rounded text-sm text-right"
                        placeholder="0.00"
                        step="0.01"
                      />
                    </div>
                    <div className="w-1/2 md:w-28 order-5">
                      <label className="text-xs font-medium text-gray-600 md:hidden">
                        {t('th_total')}
                      </label>
                      <input
                        type="text"
                        value={Number(item.totalPrice).toFixed(2)}
                        readOnly
                        className="w-full p-1 border-none rounded text-sm text-right bg-gray-50"
                      />
                    </div>
                    <div className="w-1/2 md:w-16 flex justify-end gap-1 order-6">
                      <button
                        onClick={() => addItemBelow(item.id)}
                        className="p-1 text-green-600 hover:text-green-800"
                        title="Přidat řádek pod"
                      >
                        <PlusCircle size={18} />
                      </button>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1 text-red-600 hover:text-red-800"
                        title={t('common.delete')}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-4 pt-4">
            <button
              onClick={handleSaveInvoice}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
              className="flex items-center justify-center gap-2 px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              <Eye size={16} className="pointer-events-none" />
              <span>{t('common.preview')}</span>
            </button>
            <button
              type="button"
              onClick={() => handlePrint(currentInvoice)}
              className="flex items-center justify-center gap-2 px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              <Printer size={16} className="pointer-events-none" />
              <span>{t('common.print')}</span>
            </button>
            <button
              onClick={goToList}
              className="px-6 py-2 bg-gray-200 rounded hover:bg-gray-300"
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
