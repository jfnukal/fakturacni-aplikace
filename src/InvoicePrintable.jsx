import React from 'react';

const InvoicePrintable = React.forwardRef(
  ({ invoice, supplier, vatSettings }, ref) => {
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

    return (
      <div
        ref={ref}
        className="p-8 bg-white text-black"
        style={{
          width: '210mm',
          minHeight: '297mm',
          fontFamily: 'sans-serif',
          fontSize: '10pt',
        }}
      >
        <div className="flex justify-between items-start mb-10">
          <div className="flex items-center gap-4">
            {supplier.logoUrl && (
              <div className="w-24 h-24 flex items-center justify-center">
                <img
                  src={supplier.logoUrl}
                  alt="Logo"
                  className="max-w-full max-h-full object-contain"
                  crossOrigin="anonymous"
                  style={{ maxWidth: '96px', maxHeight: '96px' }}
                  onLoad={() => console.log('Logo načteno do PDF úspěšně')}
                  onError={(e) => {
                    console.error(
                      'Logo se nepodařilo načíst pro PDF:',
                      supplier.logoUrl
                    );
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold">Faktura</h1>
              <div className="text-lg">Číslo: {invoice.number}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-10">
          <div>
            <h3 className="text-xs text-gray-600 mb-2 font-bold tracking-wider">
              DODAVATEL
            </h3>
            <div className="space-y-1">
              <div className="font-semibold">{supplier.name}</div>
              <div>{supplier.address}</div>
              <div>
                {supplier.zip} {supplier.city}
              </div>
              <div className="mt-2 space-y-1">
                <div>IČO: {supplier.ico}</div>
                {supplier.dic && <div>DIČ: {supplier.dic}</div>}
                {!vatSettings.enabled && <div>Neplátce DPH</div>}
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-xs text-gray-600 mb-2 font-bold tracking-wider">
              ODBĚRATEL
            </h3>
            <div className="space-y-1">
              <div className="font-semibold">{invoice.customer.name}</div>
              <div>{invoice.customer.address}</div>
              <div>
                {invoice.customer.zip} {invoice.customer.city}
              </div>
              <div className="mt-2 space-y-1">
                <div>IČO: {invoice.customer.ico}</div>
                {invoice.customer.dic && <div>DIČ: {invoice.customer.dic}</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-10">
          <div className="space-y-1">
            <div>
              <span className="font-semibold">Bankovní účet:</span>{' '}
              {supplier.bankAccount}
            </div>
            <div>
              <span className="font-semibold">Variabilní symbol:</span>{' '}
              {invoice.number.replace(/-/g, '')}
            </div>
            <div>
              <span className="font-semibold">Způsob platby:</span>{' '}
              {supplier.paymentMethod}
            </div>
          </div>
          <div className="space-y-1">
            <div>
              <span className="font-semibold">Datum vystavení:</span>{' '}
              {invoice.issueDate}
            </div>
            <div>
              <span className="font-semibold">Datum zdan. plnění:</span>{' '}
              {invoice.duzpDate}
            </div>
            <div>
              <span className="font-semibold">Datum splatnosti:</span>{' '}
              {invoice.dueDate}
            </div>
          </div>
        </div>

        <table className="w-full mb-10">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2 font-semibold w-1/2">Popis</th>
              <th className="text-center p-2 font-semibold">Počet</th>
              <th className="text-center p-2 font-semibold">MJ</th>
              <th className="text-right p-2 font-semibold">Cena za MJ</th>
              <th className="text-right p-2 font-semibold">Celkem</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="p-2 align-top">{item.description}</td>
                <td className="p-2 text-center align-top">{item.quantity}</td>
                <td className="p-2 text-center align-top">{item.unit}</td>
                <td className="p-2 text-right align-top">
                  {Number(item.pricePerUnit).toFixed(2)} Kč
                </td>
                <td className="p-2 text-right align-top">
                  {Number(item.totalPrice).toFixed(2)} Kč
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between">
              <span>Mezisoučet:</span>
              <span>{subtotal.toFixed(2)} Kč</span>
            </div>
            {vatSettings.enabled && (
              <div className="flex justify-between">
                <span>DPH {vatSettings.rate}%:</span>
                <span>{vatAmount.toFixed(2)} Kč</span>
              </div>
            )}
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between font-bold text-lg">
                <span>Celkem k úhradě:</span>
                <span>{total.toFixed(2)} Kč</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default InvoicePrintable;
