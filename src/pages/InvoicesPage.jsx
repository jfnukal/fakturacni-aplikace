import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import InvoicePrintable from '../pages/InvoicePrintable.jsx';
import ReactDOM from 'react-dom/client';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useTranslation } from 'react-i18next';
import { generateNextDocumentNumber } from '../../netlify/functions/numbering.js';

// Komponenta pro modální okno náhledu na mobilu
const PreviewModal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[90vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="sticky top-2 right-2 p-2 bg-gray-200 rounded-full hover:bg-gray-300 z-10"
        >
          <X size={20} />
        </button>
        <div className="p-1">{children}</div>
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
  selectCustomerForNewInvoice,
}) => {
  const { t } = useTranslation();
  const [currentView, setCurrentView] = useState('list');
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [currentInvoice, setCurrentInvoice] = useState(getNewInvoice());
  const [isSelectingDL, setIsSelectingDL] = useState(false);
  const [selectedDLs, setSelectedDLs] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showHoverPreview, setShowHoverPreview] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    if (creationRequest === 'invoice') {
      handleAddNew();
      setCreationRequest(null);
    }
  }, [creationRequest]);

  useEffect(() => {
    if (selectCustomerForNewInvoice) {
      handleAddNew(selectCustomerForNewInvoice);
    }
  }, [selectCustomerForNewInvoice]);

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
      newInv.customer = customer;
    }
    setCurrentInvoice(newInv);
    setEditingInvoice(null);
    setCurrentView('create');
  };

  const calculateTotals = (invoice, currentVatSettings) => {
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
        setEditingInvoice(null);
      } else {
        await addDoc(collection(db, 'invoices'), invoiceToSave);
      }
      setCurrentView('list');
      setCurrentInvoice(getNewInvoice());
    } catch (error) {
      console.error('Chyba: ', error);
    }
  };

  const handleSaveInvoice = () => {
    if (!currentInvoice.number) {
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

  const addItem = () => {
    const newItem = {
      id: Date.now(),
      quantity: 1,
      unit: 'ks',
      description: '',
      pricePerUnit: 0,
      totalPrice: 0,
    };
    setCurrentInvoice({
      ...currentInvoice,
      items: [...currentInvoice.items, newItem],
    });
  };

  const removeItem = (id) => {
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
              (updatedItem.quantity || 0) * (updatedItem.pricePerUnit || 0);
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
      dueDays: 14,
      currency: 'CZK',
      items:
        invoice.items && invoice.items.length > 0
          ? invoice.items
          : [
              {
                id: Date.now(),
                quantity: 1,
                unit: 'ks',
                description: 'Služba',
                pricePerUnit: invoice.total || 0,
                totalPrice: invoice.total || 0,
              },
            ],
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

  const handleShare = async (invoice) => {
    if (!navigator.share || !navigator.canShare) {
      alert(t('delivery_notes_page.alert.share_not_supported'));
      return;
    }
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
    setTimeout(async () => {
      try {
        const blob = await html2pdf().from(element.firstChild).output('blob');
        const file = new File([blob], `faktura-${invoice.number}.pdf`, {
          type: 'application/pdf',
        });
        await navigator.share({
          title: `Faktura ${invoice.number}`,
          text: `Zde je faktura ${invoice.number}.`,
          files: [file],
        });
      } catch (error) {
        console.error('Chyba při sdílení: ', error);
      } finally {
        document.body.removeChild(element);
      }
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

  const StatusBadge = ({ status }) => {
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

  const InvoicePreview = ({ invoice, supplier, vatSettings }) => {
    if (!supplier || !vatSettings) {
      return (
        <div className="text-center p-10">
          {t('invoices_page.preview.loading')}
        </div>
      );
    }
    const { subtotal, vatAmount, total } = calculateTotals(
      invoice,
      vatSettings
    );
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
                <span>
                  {t('vat_rate_display', { rate: vatSettings.rate })}:
                </span>
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

  const modalConfig = {
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
  };

  if (loading) {
    return <div>{t('invoices_page.loading')}</div>;
  }

  if (isSelectingDL) {
    const handleDlSelectionChange = (dlId) => {
      setSelectedDLs((prev) =>
        prev.includes(dlId) ? prev.filter((id) => id !== dlId) : [...prev, dlId]
      );
    };
    const handleCreateInvoiceFromDLs = () => {
      if (selectedDLs.length === 0) {
        alert(t('invoices_page.dl_select.alert.no_selection'));
        return;
      }
      const notesToProcess = deliveryNotes.filter((note) =>
        selectedDLs.includes(note.id)
      );
      if (notesToProcess.length === 0) return;
      const firstCustomer = notesToProcess[0].customer;
      if (
        !notesToProcess.every((note) => note.customer.id === firstCustomer.id)
      ) {
        alert(t('invoices_page.dl_select.alert.multiple_customers'));
        return;
      }
      const allNumbers = invoices.map((inv) => inv.number);
      const newItems = notesToProcess.map((note) => {
        const { totalWithoutVat } = calculateDlTotal(note.items);
        return {
          id: Date.now() + Math.random(),
          description: `Dodací list č. ${note.number}`,
          quantity: 1,
          unit: 'ks',
          pricePerUnit: totalWithoutVat,
          totalPrice: totalWithoutVat,
        };
      });
      const newInvoice = getNewInvoice();
      newInvoice.number = generateNextDocumentNumber(allNumbers);
      newInvoice.customer = firstCustomer;
      newInvoice.items = newItems;
      setCurrentInvoice(newInvoice);
      setEditingInvoice(null);
      setIsSelectingDL(false);
      setCurrentView('create');
    };
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">
          {t('invoices_page.dl_select.title')}
        </h2>
        <div className="bg-gray-50 p-4 rounded-lg border max-h-96 overflow-y-auto">
          {deliveryNotes
            .filter((note) => !note.invoiced)
            .map((note) => (
              <div key={note.id} className="flex items-center p-2 border-b">
                <input
                  type="checkbox"
                  checked={selectedDLs.includes(note.id)}
                  onChange={() => handleDlSelectionChange(note.id)}
                  className="w-5 h-5 mr-4"
                />
                <div className="flex-grow">
                  <span className="font-medium">{note.number}</span>
                  <span className="text-gray-600 mx-2">-</span>
                  <span>{note.customer.name}</span>
                </div>
                <div className="text-sm text-gray-500">{note.date}</div>
              </div>
            ))}
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleCreateInvoiceFromDLs}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {t('invoices_page.dl_select.create_from_selected')}
          </button>
          <button
            onClick={() => setIsSelectingDL(false)}
            className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <ConfirmModal
        isOpen={showConfirmModal}
        config={modalConfig}
        onClose={() => setShowConfirmModal(false)}
      />
      {currentView === 'list' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">{t('invoices_page.title')}</h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setIsSelectingDL(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                <Plus size={16} />{' '}
                <span>{t('invoices_page.create_from_dl')}</span>
              </button>
              <button
                onClick={() => handleAddNew()}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Plus size={16} /> {t('invoices_page.new')}
              </button>
            </div>
          </div>
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="hidden md:table-header-group bg-gray-50">
                <tr>
                  <th className="text-left p-4 font-medium">
                    {t('invoices_page.table.number')}
                  </th>
                  <th className="text-left p-4 font-medium">
                    {t('invoices_page.table.customer')}
                  </th>
                  <th className="text-left p-4 font-medium">
                    {t('invoices_page.table.issued')}
                  </th>
                  <th className="text-right p-4 font-medium">
                    {t('invoices_page.table.amount')}
                  </th>
                  <th className="text-center p-4 font-medium">
                    {t('invoices_page.table.status')}
                  </th>
                  <th className="text-center p-4 font-medium">
                    {t('invoices_page.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="block md:table-row p-4 md:p-0"
                  >
                    <td
                      className="block md:table-cell md:p-4 md:font-medium"
                      data-label={`${t('invoices_page.table.number')}: `}
                    >
                      {invoice.number}
                    </td>
                    <td
                      className="block md:table-cell md:p-4"
                      data-label={`${t('invoices_page.table.customer')}: `}
                    >
                      {invoice.customer.name}
                    </td>
                    <td
                      className="block md:table-cell md:p-4"
                      data-label={`${t('invoices_page.table.issued')}: `}
                    >
                      {invoice.issueDate}
                    </td>
                    <td
                      className="block md:table-cell md:p-4 md:text-right md:font-medium"
                      data-label={`${t('invoices_page.table.amount')}: `}
                    >
                      {(invoice.total || 0).toFixed(2)} {t('currency_czk')}
                    </td>
                    <td
                      className="block md:table-cell md:p-4 md:text-center"
                      data-label={`${t('invoices_page.table.status')}: `}
                    >
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="block md:table-cell md:p-4">
                      <div className="flex gap-2 justify-end md:justify-center mt-2 md:mt-0">
                        <button
                          onClick={() => handlePrint(invoice)}
                          className="p-2 text-gray-600 hover:text-gray-800 rounded-md"
                          title={t('Tisk')}
                        >
                          <Printer size={20} />
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(invoice)}
                          className="p-2 text-gray-600 hover:text-gray-800 rounded-md"
                          title={t('common.download_pdf')}
                        >
                          <Download size={20} />
                        </button>
                        <button
                          onClick={() => handleShare(invoice)}
                          className="p-2 text-gray-600 hover:text-gray-800 rounded-md"
                          title={t('common.share')}
                        >
                          <Share2 size={20} />
                        </button>
                        <button
                          onClick={() => cloneInvoice(invoice)}
                          className="p-2 text-purple-600 hover:text-purple-800 rounded-md"
                          title={t('common.clone')}
                        >
                          <Copy size={20} />
                        </button>
                        <button
                          onClick={() => {
                            setCurrentInvoice(invoice);
                            setCurrentView('preview');
                          }}
                          className="p-2 text-blue-600 hover:text-blue-800 rounded-md"
                          title={t('common.view')}
                        >
                          <Eye size={20} />
                        </button>
                        <button
                          onClick={() => editInvoice(invoice)}
                          className="p-2 text-gray-600 hover:text-gray-800 rounded-md"
                          title={t('common.edit')}
                        >
                          <Edit size={20} />
                        </button>
                        <button
                          onClick={() => deleteInvoice(invoice.id)}
                          className="p-2 text-red-600 hover:text-red-800 rounded-md"
                          title={t('common.delete')}
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
        </div>
      )}
      {currentView === 'preview' && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentView('list')}
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
              title={t('Tisk')}
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
            <button
              onClick={() => handleShare(currentInvoice)}
              className="p-2 text-gray-600 hover:text-gray-800"
              title={t('common.share')}
            >
              <Share2 size={20} />
            </button>
          </div>
          <InvoicePreview
            invoice={currentInvoice}
            supplier={supplier}
            vatSettings={vatSettings}
          />
        </div>
      )}
      {currentView === 'create' && (
        <div className="space-y-6 relative">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentView('list')}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              ← {t('common.back_to_list')}
            </button>
            <h2 className="text-2xl font-bold">
              {editingInvoice
                ? t('invoices_page.edit_title', {
                    number: editingInvoice.number,
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
                {currentInvoice.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap gap-2 items-end bg-white p-3 rounded border"
                  >
                    <div className="w-full md:flex-1">
                      <label className="text-xs font-medium text-gray-600">
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
                    <div className="w-1/3 grow md:w-auto md:grow-0">
                      <label className="text-xs font-medium text-gray-600">
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
                        className="w-full p-1 border rounded text-sm"
                        placeholder={t('invoices_page.form.item_quantity')}
                      />
                    </div>
                    <div className="w-1/3 grow md:w-auto md:grow-0">
                      <label className="text-xs font-medium text-gray-600">
                        {t('invoices_page.form.item_unit')}
                      </label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) =>
                          updateItem(item.id, 'unit', e.target.value)
                        }
                        className="w-full p-1 border rounded text-sm"
                        placeholder={t('invoices_page.form.item_unit')}
                      />
                    </div>
                    <div className="w-1/3 grow md:w-auto md:grow-0">
                      <label className="text-xs font-medium text-gray-600">
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
                        className="w-full p-1 border rounded text-sm"
                        placeholder={t('invoices_page.form.item_price')}
                        step="0.01"
                      />
                    </div>
                    <div className="w-1/2 grow md:w-auto md:grow-0">
                      <label className="text-xs font-medium text-gray-600">
                        {t('th_total')}
                      </label>
                      <input
                        type="text"
                        value={Number(item.totalPrice).toFixed(2)}
                        readOnly
                        className="w-full p-1 border rounded text-sm bg-gray-50"
                      />
                    </div>
                    <div className="self-center">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1 text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={addItem}
                className="mt-3 flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                <Plus size={16} /> {t('invoices_page.form.add_item')}
              </button>
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button
              onClick={handleSaveInvoice}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Save size={16} />
              {editingInvoice
                ? t('common.save_changes')
                : t('invoices_page.create')}
            </button>
            <div
              onMouseEnter={() => setShowHoverPreview(true)}
              onMouseLeave={() => setShowHoverPreview(false)}
              className="hidden md:block"
            >
              <button
                type="button"
                className="flex items-center gap-2 px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                <Eye size={16} /> Náhled
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="md:hidden flex items-center gap-2 px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              <Eye size={16} /> Náhled
            </button>
            <button
              onClick={() => setCurrentView('list')}
              className="px-6 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              {t('common.cancel')}
            </button>
          </div>
          {showHoverPreview && (
            <div className="hidden md:block absolute top-0 left-[105%] w-[800px] h-auto bg-white shadow-2xl rounded-lg border z-20">
              <InvoicePreview
                invoice={currentInvoice}
                supplier={supplier}
                vatSettings={vatSettings}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
};
export default InvoicesPage;
