// Soubor: src/components/DeliveryNotePrintable.jsx
import React from 'react';

const DeliveryNotePrintable = React.forwardRef(({ note, supplier, showPrices }, ref) => {
  return (
    <div ref={ref} className="p-8 bg-white text-black" style={{ width: '210mm', fontFamily: 'sans-serif', fontSize: '10pt' }}>
      <div className="flex justify-between items-start mb-10">
        <div>
          <h1 className="text-3xl font-bold">Dodací list</h1>
          <div className="text-lg">Číslo: {note.number}</div>
        </div>
        <div className="text-right">
            <div><span className="font-semibold">Datum vystavení:</span> {note.date}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 mb-10">
        <div>
          <h3 className="text-xs text-gray-600 mb-2 font-bold tracking-wider">DODAVATEL</h3>
          <div className="space-y-1">
            <div className="font-semibold">{supplier.name}</div>
            <div>{supplier.address}</div>
            <div>{supplier.zip} {supplier.city}</div>
            <div className="mt-2 space-y-1"><div>IČO: {supplier.ico}</div></div>
          </div>
        </div>
        <div>
          <h3 className="text-xs text-gray-600 mb-2 font-bold tracking-wider">ODBĚRATEL</h3>
          <div className="space-y-1">
            <div className="font-semibold">{note.customer.name}</div>
            <div>{note.customer.address}</div>
            <div>{note.customer.zip} {note.customer.city}</div>
            <div className="mt-2 space-y-1"><div>IČO: {note.customer.ico}</div></div>
          </div>
        </div>
      </div>
      <table className="w-full mb-10">
        <thead className="bg-gray-100">
          <tr>
            <th className="text-left p-2 font-semibold w-1/2">Popis</th>
            <th className="text-center p-2 font-semibold">Množství</th>
            <th className="text-center p-2 font-semibold">Jednotka</th>
            {showPrices && <th className="text-right p-2 font-semibold">Celkem bez DPH</th>}
          </tr>
        </thead>
        <tbody>
          {note.items.map((item) => (
            <tr key={item.productId} className="border-b">
              <td className="p-2 align-top">{item.name}</td>
              <td className="p-2 text-center align-top">{item.quantity}</td>
              <td className="p-2 text-center align-top">{item.unit}</td>
              {showPrices && <td className="p-2 text-right align-top">{(item.quantity * item.price).toFixed(2)} Kč</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
export default DeliveryNotePrintable;
