import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const InvoicePrintable = React.forwardRef(
  ({ invoice, supplier, vatSettings }, ref) => {
    const { t } = useTranslation();
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

    // --- ZDE JE KLÍČOVÁ OPRAVA ---
    // Pokud chybí klíčová data, komponenta nic nevykreslí a zabrání pádu aplikace.
    if (!invoice || !supplier || !vatSettings) {
      return null;
    }

    const calculateTotals = () => {
      const subtotal = invoice.items.reduce(
        (sum, item) => sum + (item.totalPrice || 0),
        0
      );
      // Nyní je jisté, že vatSettings není null
      const vatAmount = vatSettings.enabled
        ? (subtotal * vatSettings.rate) / 100
        : 0;
      const total = subtotal + vatAmount;
      return { subtotal, vatAmount, total };
    };

    const { subtotal, vatAmount, total } = calculateTotals();

    useEffect(() => {
      const generateQrCodeAsDataUrl = async () => {
        const amount = total.toFixed(2);
        const vs = invoice.number.replace(/\D/g, '');
        const bankAccount = supplier.bankAccount || '';
        if (!bankAccount || !amount || !vs || total <= 0) {
          setQrCodeDataUrl('');
          return;
        }

        const paymentString = `SPD*1.0*ACC:${bankAccount.replace(
          '/',
          '-'
        )}*AM:${amount}*CC:CZK*MSG:Faktura ${invoice.number}*X-VS:${vs}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
          paymentString
        )}`;

        try {
          const response = await fetch(qrUrl);
          const imageBlob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            setQrCodeDataUrl(reader.result);
          };
          reader.readAsDataURL(imageBlob);
        } catch (error) {
          console.error('Chyba při stahování QR kódu:', error);
          setQrCodeDataUrl('');
        }
      };

      generateQrCodeAsDataUrl();
    }, [invoice, supplier, total]);

    const translateInCzech = (key, options = {}) => t(key, { ...options, lng: 'cs' });

    return (
      <div
        ref={ref}
        className="p-8 bg-white text-black"
        style={{ width: '210mm', fontFamily: 'sans-serif', fontSize: '10pt' }}
      >
        {/* Zbytek kódu zůstává stejný jako v minulé funkční verzi */}
        <div className="flex justify-between items-start mb-10">
          <div className="flex items-center gap-4">
            {supplier.logoUrl && (
              <div className="w-24 h-24 flex items-center justify-center">
                <img
                  src={supplier.logoUrl}
                  alt="Logo"
                  className="max-w-full max-h-full object-contain"
                  crossOrigin="anonymous"
                />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold">{translateInCzech('invoice_title')}</h1>
              <div className="text-lg">{translateInCzech('invoice_number')}: {invoice.number}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-10">
          <div>
            <h3 className="text-xs text-gray-600 mb-2 font-bold tracking-wider">{translateInCzech('supplier')}</h3>
            <div className="space-y-1">
              <div className="font-semibold">{supplier.name}</div>
              <div>{supplier.address}</div>
              <div>{supplier.zip} {supplier.city}</div>
              <div className="mt-2 space-y-1">
                <div>{translateInCzech('ico')}: {supplier.ico}</div>
                {supplier.dic && <div>{translateInCzech('dic')}: {supplier.dic}</div>}
                {vatSettings && !vatSettings.enabled && <div>{translateInCzech('notVatPayer')}</div>}
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-xs text-gray-600 mb-2 font-bold tracking-wider">{translateInCzech('customer')}</h3>
            <div className="space-y-1">
              <div className="font-semibold">{invoice.customer.name}</div>
              <div>{invoice.customer.address}</div>
              <div>{invoice.customer.zip} {invoice.customer.city}</div>
              <div className="mt-2 space-y-1">
                <div>{translateInCzech('ico')}: {invoice.customer.ico}</div>
                {invoice.customer.dic && <div>{translateInCzech('dic')}: {invoice.customer.dic}</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-10">
          <div className="space-y-1">
            <div><span className="font-semibold">{translateInCzech('bankAccount')}:</span> {supplier.bankAccount}</div>
            <div><span className="font-semibold">{translateInCzech('variableSymbol')}:</span> {invoice.number.replace(/-/g, '')}</div>
            <div><span className="font-semibold">{translateInCzech('paymentMethod')}:</span> {supplier.paymentMethod}</div>
          </div>
          <div className="space-y-1">
            <div><span className="font-semibold">{translateInCzech('issueDate')}:</span> {invoice.issueDate}</div>
            <div><span className="font-semibold">{translateInCzech('taxableDate')}:</span> {invoice.duzpDate}</div>
            <div><span className="font-semibold">{translateInCzech('dueDate')}:</span> {invoice.dueDate}</div>
          </div>
        </div>

        <table className="w-full mb-10">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2 font-semibold w-1/2">{translateInCzech('th_description')}</th>
              <th className="text-center p-2 font-semibold">{translateInCzech('th_quantity')}</th>
              <th className="text-center p-2 font-semibold">{translateInCzech('th_unit')}</th>
              <th className="text-right p-2 font-semibold">{translateInCzech('th_pricePerUnit')}</th>
              <th className="text-right p-2 font-semibold">{translateInCzech('th_total')}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="p-2 align-top">{item.description}</td>
                <td className="p-2 text-center align-top">{item.quantity}</td>
                <td className="p-2 text-center align-top">{item.unit}</td>
                <td className="p-2 text-right align-top">{Number(item.pricePerUnit).toFixed(2)} {translateInCzech('currency_czk')}</td>
                <td className="p-2 text-right align-top">{Number(item.totalPrice).toFixed(2)} {translateInCzech('currency_czk')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-between items-end">
          <div className="flex flex-col items-start">
            {qrCodeDataUrl ? (
              <>
                <div className="w-24 h-24 border border-gray-300 bg-white p-1">
                  <img src={qrCodeDataUrl} alt="QR platba" className="w-full h-full object-contain" />
                </div>
                <div className="text-xs text-gray-600 mt-1">{translateInCzech('qrPayment')}</div>
              </>
            ) : (<div className="w-24 h-24 text-xs flex items-center justify-center bg-gray-50"></div>)}
          </div>
          <div className="w-64 space-y-2">
            <div className="flex justify-between">
              <span>{translateInCzech('subtotal')}:</span>
              <span>{subtotal.toFixed(2)} {translateInCzech('currency_czk')}</span>
            </div>
            {vatSettings.enabled && (
              <div className="flex justify-between">
                <span>{translateInCzech('vat_rate_display', { rate: vatSettings.rate })}:</span>
                <span>{vatAmount.toFixed(2)} {translateInCzech('currency_czk')}</span>
              </div>
            )}
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between font-bold text-lg">
                <span>{translateInCzech('totalToPay')}:</span>
                <span>{total.toFixed(2)} {translateInCzech('currency_czk')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default InvoicePrintable;
