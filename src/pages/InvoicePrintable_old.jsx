import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const InvoicePrintable = React.forwardRef(
  ({ invoice, supplier, vatSettings }, ref) => {
    const { t } = useTranslation();
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

    if (!invoice || !supplier || !vatSettings) {
      return null;
    }

    const calculateTotals = () => {
      const subtotal = invoice.items.reduce(
        (sum, item) => sum + (item.totalPrice || 0),
        0
      );
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

    const translateInCzech = (key, options = {}) =>
      t(key, { ...options, lng: 'cs' });

    return (
      <div
        ref={ref}
        style={{
          width: '190mm',
          padding: '5mm',
          margin: '0',
          fontFamily: 'Arial, sans-serif',
          fontSize: '9pt',
          lineHeight: '1.2',
          backgroundColor: 'white',
          color: 'black',
        }}
      >
        {/* Header jako tabulka */}
        <table
          style={{
            width: '100%',
            marginBottom: '8mm',
            borderCollapse: 'collapse',
          }}
        >
          <tbody>
            <tr>
              <td style={{ width: '20%', verticalAlign: 'top' }}>
                {supplier.logoUrl && (
                  <div style={{ width: '20mm', height: '20mm', textAlign: 'center' }}>
                    <img
                      src={supplier.logoUrl}
                      alt="Logo"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain'
                      }}
                      crossOrigin="anonymous"
                    />
                  </div>
                )}
              </td>
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                <h1
                  style={{
                    fontSize: '20pt',
                    fontWeight: 'bold',
                    margin: '0 0 2mm 0',
                    color: '#000',
                  }}
                >
                  {translateInCzech('invoice_title')}
                </h1>
                <div style={{ fontSize: '11pt' }}>
                  {translateInCzech('invoice_number')}: {invoice.number}
                </div>
              </td>
              <td style={{ width: '30%', textAlign: 'right', verticalAlign: 'top' }}>
                <div style={{ fontSize: '9pt' }}>
                  <div style={{ marginBottom: '1mm' }}>
                    <strong>{translateInCzech('issueDate')}:</strong> {invoice.issueDate}
                  </div>
                  {vatSettings?.enabled && (
                    <div style={{ marginBottom: '1mm' }}>
                      <strong>{translateInCzech('taxableDate')}:</strong> {invoice.duzpDate}
                    </div>
                  )}
                  <div>
                    <strong>{translateInCzech('dueDate')}:</strong> {invoice.issueDate}
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Dodavatel a Odběratel jako tabulka */}
        <table
          style={{
            width: '100%',
            marginBottom: '8mm',
            borderCollapse: 'collapse',
          }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  width: '50%',
                  verticalAlign: 'top',
                  paddingRight: '5mm',
                }}
              >
                <div
                  style={{
                    fontSize: '7pt',
                    color: '#666',
                    marginBottom: '2mm',
                    fontWeight: 'bold',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                  }}
                >
                  {translateInCzech('supplier')}
                </div>
                <div style={{ fontSize: '9pt', lineHeight: '1.3' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '1mm' }}>
                    {supplier.name}
                  </div>
                  <div style={{ marginBottom: '1mm' }}>{supplier.address}</div>
                  <div style={{ marginBottom: '2mm' }}>
                    {supplier.zip} {supplier.city}
                  </div>
                  <div style={{ fontSize: '8pt' }}>
                    <div style={{ marginBottom: '1mm' }}>
                      {translateInCzech('ico')}: {supplier.ico}
                    </div>
                    {supplier.dic && (
                      <div style={{ marginBottom: '1mm' }}>
                        {translateInCzech('dic')}: {supplier.dic}
                      </div>
                    )}
                    {vatSettings && !vatSettings.enabled && (
                      <div style={{ fontSize: '8pt', fontWeight: 'bold' }}>
                        {translateInCzech('notVatPayer')}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                <div
                  style={{
                    fontSize: '7pt',
                    color: '#666',
                    marginBottom: '2mm',
                    fontWeight: 'bold',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                  }}
                >
                  {translateInCzech('customer')}
                </div>
                <div style={{ fontSize: '9pt', lineHeight: '1.3' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '1mm' }}>
                    {invoice.customer.name}
                  </div>
                  <div style={{ marginBottom: '1mm' }}>
                    {invoice.customer.address}
                  </div>
                  <div style={{ marginBottom: '2mm' }}>
                    {invoice.customer.zip} {invoice.customer.city}
                  </div>
                  <div style={{ fontSize: '8pt' }}>
                    <div style={{ marginBottom: '1mm' }}>
                      {translateInCzech('ico')}: {invoice.customer.ico}
                    </div>
                    {invoice.customer.dic && (
                      <div style={{ marginBottom: '1mm' }}>
                        {translateInCzech('dic')}: {invoice.customer.dic}
                      </div>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Platební údaje jako tabulka */}
        <table
          style={{
            width: '100%',
            marginBottom: '8mm',
            borderCollapse: 'collapse',
          }}
        >
          <tbody>
            <tr>
              <td style={{ width: '50%', verticalAlign: 'top', fontSize: '8pt' }}>
                <div style={{ marginBottom: '1mm' }}>
                  <strong>{translateInCzech('bankAccount')}:</strong> {supplier.bankAccount}
                </div>
                <div style={{ marginBottom: '1mm' }}>
                  <strong>{translateInCzech('variableSymbol')}:</strong> {invoice.number.replace(/-/g, '')}
                </div>
                <div>
                  <strong>{translateInCzech('paymentMethod')}:</strong> hotově
                </div>
              </td>
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                {/* Místo pro další platební info nebo prázdné */}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Tabulka položek */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '8pt',
            border: '1px solid #000',
            marginBottom: '5mm',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th
                style={{
                  textAlign: 'left',
                  padding: '2mm',
                  border: '1px solid #000',
                  fontWeight: 'bold',
                  width: '35%',
                }}
              >
                {translateInCzech('th_description')}
              </th>
              <th
                style={{
                  textAlign: 'center',
                  padding: '2mm',
                  border: '1px solid #000',
                  fontWeight: 'bold',
                  width: '12%',
                }}
              >
                {translateInCzech('th_quantity')}
              </th>
              <th
                style={{
                  textAlign: 'center',
                  padding: '2mm',
                  border: '1px solid #000',
                  fontWeight: 'bold',
                  width: '13%',
                }}
              >
                {translateInCzech('th_unit')}
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '2mm',
                  border: '1px solid #000',
                  fontWeight: 'bold',
                  width: '20%',
                }}
              >
                {translateInCzech('th_pricePerUnit')}
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '2mm',
                  border: '1px solid #000',
                  fontWeight: 'bold',
                  width: '20%',
                }}
              >
                {translateInCzech('th_total')}
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items &&
              invoice.items.map((item, index) => (
                <tr key={item.id || index}>
                  <td
                    style={{
                      padding: '2mm',
                      border: '1px solid #000',
                      verticalAlign: 'top',
                    }}
                  >
                    {item.description}
                  </td>
                  <td
                    style={{
                      padding: '2mm',
                      border: '1px solid #000',
                      textAlign: 'center',
                      verticalAlign: 'top',
                    }}
                  >
                    {item.quantity}
                  </td>
                  <td
                    style={{
                      padding: '2mm',
                      border: '1px solid #000',
                      textAlign: 'center',
                      verticalAlign: 'top',
                    }}
                  >
                    {item.unit}
                  </td>
                  <td
                    style={{
                      padding: '2mm',
                      border: '1px solid #000',
                      textAlign: 'right',
                      verticalAlign: 'top',
                    }}
                  >
                    {Number(item.pricePerUnit || 0).toFixed(2)} {translateInCzech('currency_czk')}
                  </td>
                  <td
                    style={{
                      padding: '2mm',
                      border: '1px solid #000',
                      textAlign: 'right',
                      verticalAlign: 'top',
                    }}
                  >
                    {Number(item.totalPrice || 0).toFixed(2)} {translateInCzech('currency_czk')}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {/* Celková částka a QR kód jako tabulka */}
        <table style={{ width: '100%', marginBottom: '8mm' }}>
          <tbody>
            <tr>
              <td style={{ width: '40%', verticalAlign: 'top' }}>
                {/* QR kód jen pokud je bankovní převod a jsou všechny údaje */}
                {supplier.bankAccount && total > 0 && supplier.paymentMethod !== 'hotově' && (
                  qrCodeDataUrl ? (
                    <div>
                      <div style={{ width: '24mm', height: '24mm', border: '1px solid #ccc', padding: '1mm' }}>
                        <img
                          src={qrCodeDataUrl}
                          alt="QR platba"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      </div>
                      <div style={{ fontSize: '8pt', color: '#666', marginTop: '1mm' }}>
                        {translateInCzech('qrPayment')}
                      </div>
                    </div>
                  ) : (
                    <div style={{ width: '24mm', height: '24mm' }}></div>
                  )
                )}
              </td>
              <td style={{ width: '60%', verticalAlign: 'top' }}>
                <table style={{ width: '100%', fontSize: '9pt', marginLeft: 'auto', maxWidth: '60%' }}>
                  <tbody>
                    {vatSettings?.enabled && (
                      <tr>
                        <td style={{ padding: '0.5mm 0' }}>
                          {translateInCzech('vat_rate_display', { rate: vatSettings.rate })}:
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.5mm 0' }}>
                          {vatAmount.toFixed(2)} {translateInCzech('currency_czk')}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td
                        style={{
                          padding: '1mm 0',
                          borderTop: '1px solid #000',
                          fontWeight: 'bold',
                          fontSize: '10pt',
                        }}
                      >
                        {translateInCzech('totalToPay')}:
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          padding: '1mm 0',
                          borderTop: '1px solid #000',
                          fontWeight: 'bold',
                          fontSize: '10pt',
                        }}
                      >
                        {total.toFixed(2)} {translateInCzech('currency_czk')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
);

export default InvoicePrintable;
