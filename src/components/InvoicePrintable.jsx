import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';

// --- NOVÁ FUNKCE PRO PŘEVOD ČÍSLA ÚČTU NA IBAN ---
const convertToIBAN = (accountString) => {
  if (!accountString || !accountString.includes('/') || accountString.length < 3) {
    return ''; // Základní validace
  }

  try {
    const [mainPart, bankCode] = accountString.split('/');
    const [prefix, number] = mainPart.includes('-')
      ? mainPart.split('-')
      : ['', mainPart];

    // 1. Zformátování částí a doplnění nul
    const paddedBankCode = bankCode.trim().padStart(4, '0');
    const paddedPrefix = prefix.trim().padStart(6, '0');
    const paddedNumber = number.trim().padStart(10, '0');

    // Sestavení BBAN (základní číslo účtu pro výpočet)
    const bban = paddedBankCode + paddedPrefix + paddedNumber;

    // 2. Přidání kódu země a '00' pro výpočet kontrolních číslic
    const checkString = bban + '123500'; // CZ převedeno na čísla: C=12, Z=35

    // 3. Výpočet zbytku po dělení 97 (modulo 97)
    let remainder = 0;
    for (let i = 0; i < checkString.length; i++) {
      remainder = (remainder * 10 + parseInt(checkString[i], 10)) % 97;
    }

    // 4. Výpočet kontrolních číslic
    const checkDigits = (98 - remainder).toString().padStart(2, '0');

    // 5. Sestavení finálního IBANu
    return `CZ${checkDigits}${bban}`;
  } catch (error) {
    console.error("Chyba při konverzi na IBAN:", error);
    return ''; // V případě chyby vrátíme prázdný řetězec
  }
};

const InvoicePrintable = React.forwardRef(
  ({ invoice, supplier, vatSettings }, ref) => {
    const { t } = useTranslation();
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

    if (!invoice || !supplier || !vatSettings) {
      return null;
    }
console.log("Supplier data v tiskové šabloně:", supplier);
    // --- KLÍČOVÁ ZMĚNA: Přepracovaná funkce pro výpočet DPH ---
    const calculateTotals = () => {
      if (!invoice.items || !Array.isArray(invoice.items)) {
        return { subtotal: 0, total: 0, vatBreakdown: {} };
      }

      const subtotal = invoice.items.reduce(
        (sum, item) => sum + (Number(item.totalPrice) || 0),
        0
      );

      const vatBreakdown = {};

      if (vatSettings.enabled) {
        invoice.items.forEach((item) => {
          const itemTotal = Number(item.totalPrice) || 0;
          // Použije sazbu z položky, jinak výchozí z nastavení (nebo 21)
          const itemVatRate = item.vatRate ?? vatSettings.rate ?? 21;

          if (!vatBreakdown[itemVatRate]) {
            vatBreakdown[itemVatRate] = { base: 0, amount: 0 };
          }

          vatBreakdown[itemVatRate].base += itemTotal;
          vatBreakdown[itemVatRate].amount += (itemTotal * itemVatRate) / 100;
        });
      }

      const totalVatAmount = Object.values(vatBreakdown).reduce(
        (sum, rate) => sum + rate.amount,
        0
      );

      const total = subtotal + totalVatAmount;

      return { subtotal, total, vatBreakdown };
    };

    const { subtotal, total, vatBreakdown } = calculateTotals();

    useEffect(() => {
      const generateQrCode = async () => {
        const { total } = calculateTotals();
        const amount = total.toFixed(2);
        const vs = invoice.number.replace(/\D/g, '');
    
        // --- ZAČÁTEK NOVÉ ROBUSTNÍ LOGIKY ---
        const bbanAccount = (supplier.bankAccount || '').trim();
const ibanAccount = convertToIBAN(bbanAccount);

if (!ibanAccount || !amount || !vs || total <= 0 || (invoice.paymentMethod === 'Hotově')) {
  setQrCodeDataUrl('');
  return;
}

const paymentString = `SPD*1.0*ACC:${ibanAccount}*AM:${amount}*CC:CZK*MSG:Faktura ${invoice.number}*X-VS:${vs}`;
    
        try {
          const dataUrl = await QRCode.toDataURL(paymentString, { errorCorrectionLevel: 'M', width: 200 });
          setQrCodeDataUrl(dataUrl);
        } catch (err) {
          console.error('Chyba při generování QR kódu:', err);
          setQrCodeDataUrl('');
        }
      };
    
      if (invoice && supplier) {
        generateQrCode();
      }
    }, [invoice, supplier, vatSettings, calculateTotals]);

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
                  <div
                    style={{
                      width: '20mm',
                      height: '20mm',
                      textAlign: 'center',
                    }}
                  >
                    <img
                      src={supplier.logoUrl}
                      alt="Logo"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
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
              <td
                style={{
                  width: '30%',
                  textAlign: 'right',
                  verticalAlign: 'top',
                }}
              >
                <div style={{ fontSize: '9pt' }}>
                  <div style={{ marginBottom: '1mm' }}>
                    <strong>{translateInCzech('issueDate')}:</strong>{' '}
                    {invoice.issueDate}
                  </div>
                  {vatSettings?.enabled && (
                    <div style={{ marginBottom: '1mm' }}>
                      <strong>{translateInCzech('taxableDate')}:</strong>{' '}
                      {invoice.duzpDate}
                    </div>
                  )}
                  <div>
                    <strong>{translateInCzech('dueDate')}:</strong>{' '}
                    {invoice.dueDate}
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
                    {supplier.registeringAuthority && (
                        <div style={{ marginTop: '2mm', fontSize: '8pt' }}>
                          {`Fyzická osoba zapsaná v živnostenském rejstříku vedeném u ${supplier.registeringAuthority}`}
                        </div>
                      )}
                  
                    {/* --- PŘIDANÝ KÓD PRO ZOBRAZENÍ FINANČNÍHO ÚŘADU --- */}
                    {/* --- ZOBRAZENÍ FINANČNÍHO ÚŘADU V NASTAVENÍ --- */}
                      {supplier.financniUrad && (
                        <div className="md:col-span-6">
                          <label className="block text-sm font-medium text-gray-700">Příslušný finanční úřad (načteno z ARESu)</label>
                          <input 
                            type="text" 
                            readOnly 
                            value={supplier.financniUrad}
                            className="mt-1 w-full p-2 border rounded bg-gray-100 cursor-not-allowed" 
                          />
                        </div>
                      )}
                    {/* --- KONEC PŘIDANÉHO KÓDU --- */}
                  
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
              <td
                style={{ width: '50%', verticalAlign: 'top', fontSize: '8pt' }}
              >
                <div style={{ marginBottom: '1mm' }}>
                  <strong>{translateInCzech('bankAccount')}:</strong>{' '}
                  {supplier.bankAccount}
                </div>
                <div style={{ marginBottom: '1mm' }}>
                  <strong>{translateInCzech('variableSymbol')}:</strong>{' '}
                  {invoice.number.replace(/-/g, '')}
                </div>
                <div>
                  <strong>{translateInCzech('payment_methods.label')}:</strong> {invoice.paymentMethod === 'Hotově' ? translateInCzech('payment_methods.cash') : translateInCzech('payment_methods.transfer')}
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
                  width: '40%',
                }}
              >
                {translateInCzech('th_description')}
              </th>
              {vatSettings.enabled && (
                <th
                  style={{
                    textAlign: 'center',
                    padding: '2mm',
                    border: '1px solid #000',
                    fontWeight: 'bold',
                    width: '10%',
                  }}
                >
                  % DPH
                </th>
              )}
              <th
                style={{
                  textAlign: 'center',
                  padding: '2mm',
                  border: '1px solid #000',
                  fontWeight: 'bold',
                  width: '10%',
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
                  width: '10%',
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
                  width: '15%',
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
                  width: '15%',
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
                  {vatSettings.enabled && (
                    <td
                      style={{
                        padding: '2mm',
                        border: '1px solid #000',
                        textAlign: 'center',
                        verticalAlign: 'top',
                      }}
                    >
                      {item.vatRate ?? vatSettings.rate ?? 21}%
                    </td>
                  )}
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
                    {Number(item.pricePerUnit || 0).toFixed(2)}{' '}
                    {translateInCzech('currency_czk')}
                  </td>
                  <td
                    style={{
                      padding: '2mm',
                      border: '1px solid #000',
                      textAlign: 'right',
                      verticalAlign: 'top',
                    }}
                  >
                    {Number(item.totalPrice || 0).toFixed(2)}{' '}
                    {translateInCzech('currency_czk')}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {/* Celková částka a QR kód jako tabulka */}
        <table style={{ width: '100%', marginBottom: '8mm' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                {supplier.bankAccount &&
                  total > 0 &&
                  (!invoice.paymentMethod ||
                    invoice.paymentMethod !== 'hotově') &&
                  (qrCodeDataUrl ? (
                    <div>
                      <div
                        style={{
                          width: '24mm',
                          height: '24mm',
                          border: '1px solid #ccc',
                          padding: '1mm',
                        }}
                      >
                        <img
                          src={qrCodeDataUrl}
                          alt="QR platba"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: '8pt',
                          color: '#666',
                          marginTop: '1mm',
                        }}
                      >
                        {translateInCzech('qrPayment')}
                      </div>
                    </div>
                  ) : (
                    <div style={{ width: '24mm', height: '24mm' }}></div>
                  ))}
              </td>
              <td style={{ width: '50%', verticalAlign: 'bottom' }}>
                {/* --- KLÍČOVÁ ZMĚNA: Nová tabulka pro rozpis DPH a celkovou částku --- */}
                <table
                  style={{
                    width: '100%',
                    fontSize: '9pt',
                    borderCollapse: 'collapse',
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: '0.5mm 0' }}>
                        {translateInCzech('subtotal')}:
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.5mm 0' }}>
                        {subtotal.toFixed(2)} {translateInCzech('currency_czk')}
                      </td>
                    </tr>

                    {vatSettings.enabled &&
                      Object.keys(vatBreakdown).length > 0 && (
                        <tr>
                          <td colSpan="2" style={{ paddingTop: '2mm' }}>
                            <table
                              style={{
                                width: '100%',
                                fontSize: '8pt',
                                borderCollapse: 'collapse',
                              }}
                            >
                              <thead>
                                <tr style={{ fontWeight: 'bold' }}>
                                  <td style={{ paddingBottom: '1mm' }}>
                                    Rekapitulace DPH
                                  </td>
                                  <td
                                    style={{
                                      textAlign: 'right',
                                      paddingBottom: '1mm',
                                    }}
                                  >
                                    Základ daně
                                  </td>
                                  <td
                                    style={{
                                      textAlign: 'right',
                                      paddingBottom: '1mm',
                                    }}
                                  >
                                    DPH
                                  </td>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(vatBreakdown)
                                  .sort(
                                    ([rateA], [rateB]) =>
                                      Number(rateA) - Number(rateB)
                                  )
                                  .map(([rate, data]) => (
                                    <tr key={rate}>
                                      <td>Sazba {rate}%</td>
                                      <td style={{ textAlign: 'right' }}>
                                        {data.base.toFixed(2)}{' '}
                                        {translateInCzech('currency_czk')}
                                      </td>
                                      <td style={{ textAlign: 'right' }}>
                                        {data.amount.toFixed(2)}{' '}
                                        {translateInCzech('currency_czk')}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}

                    <tr>
                      <td
                        style={{
                          padding: '2mm 0 1mm 0',
                          borderTop: '1px solid #000',
                          fontWeight: 'bold',
                          fontSize: '11pt',
                        }}
                      >
                        {translateInCzech('totalToPay')}:
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          padding: '2mm 0 1mm 0',
                          borderTop: '1px solid #000',
                          fontWeight: 'bold',
                          fontSize: '11pt',
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
