import React from 'react';

const DeliveryNotePrintable = React.forwardRef(
  ({ note, supplier, showPrices, vatSettings }, ref) => {
    if (!note || !supplier || !vatSettings) {
      return null;
    }

    // Funkce pro formátování data do českého formátu
    const formatDate = (dateString) => {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('cs-CZ', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      } catch (e) {
        return dateString;
      }
    };



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
                  Dodací list
                </h1>
                <div style={{ fontSize: '11pt' }}>
                  Číslo: {note.number}
                </div>
              </td>
              <td style={{ width: '30%', textAlign: 'right', verticalAlign: 'top' }}>
                <div style={{ fontSize: '9pt' }}>
                  <div style={{ marginBottom: '1mm' }}>
                    <strong>Datum vystavení:</strong> {formatDate(note.date)}
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
                  DODAVATEL
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
                      IČO: {supplier.ico}
                    </div>
                    {supplier.dic && (
                      <div style={{ marginBottom: '1mm' }}>
                        DIČ: {supplier.dic}
                      </div>
                    )}
                    {vatSettings && !vatSettings.enabled && (
                      <div style={{ fontSize: '8pt', fontWeight: 'bold' }}>
                        Neplátce DPH
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
                  ODBĚRATEL
                </div>
                <div style={{ fontSize: '9pt', lineHeight: '1.3' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '1mm' }}>
                    {note.customer?.name}
                  </div>
                  <div style={{ marginBottom: '1mm' }}>
                    {note.customer?.address}
                  </div>
                  <div style={{ marginBottom: '2mm' }}>
                    {note.customer?.zip} {note.customer?.city}
                  </div>
                  <div style={{ fontSize: '8pt' }}>
                    <div style={{ marginBottom: '1mm' }}>
                      IČO: {note.customer?.ico}
                    </div>
                    {note.customer?.dic && (
                      <div style={{ marginBottom: '1mm' }}>
                        DIČ: {note.customer?.dic}
                      </div>
                    )}
                  </div>
                </div>
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
         {/* --- ZAČÁTEK ZMĚNY: NOVÁ HLAVIČKA TABULKY --- */}
         <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ textAlign: 'left', padding: '2mm', border: '1px solid #000', fontWeight: 'bold' }}>
                Popis
              </th>
              <th style={{ textAlign: 'center', padding: '2mm', border: '1px solid #000', fontWeight: 'bold' }}>
                Množství
              </th>
              <th style={{ textAlign: 'center', padding: '2mm', border: '1px solid #000', fontWeight: 'bold' }}>
                Jednotka
              </th>
              {showPrices && (
                <>
                  <th style={{ textAlign: 'right', padding: '2mm', border: '1px solid #000', fontWeight: 'bold' }}>
                    Cena bez DPH/ks
                  </th>
                  {vatSettings.enabled && (
                    <>
                      <th style={{ textAlign: 'center', padding: '2mm', border: '1px solid #000', fontWeight: 'bold' }}>
                        Sazba DPH
                      </th>
                      <th style={{ textAlign: 'right', padding: '2mm', border: '1px solid #000', fontWeight: 'bold' }}>
                        Cena s DPH/ks
                      </th>
                    </>
                  )}
                  <th style={{ textAlign: 'right', padding: '2mm', border: '1px solid #000', fontWeight: 'bold' }}>
                    Celkem bez DPH
                  </th>
                </>
              )}
            </tr>
          </thead>

         <tbody>
            {note.items &&
              note.items
                .filter((item) => item.quantity > 0)
                .map((item, index) => {
                  const priceWithoutVat = Number(item.price) || 0;
                  const vatRate = vatSettings.enabled ? (Number(item.vatRate) || 0) : 0;
                  const priceWithVat = priceWithoutVat * (1 + vatRate / 100);
                  const totalForRowWithoutVat = item.quantity * priceWithoutVat;

                  return (
                    <tr key={item.productId || index}>
                      <td style={{ padding: '2mm', border: '1px solid #000', verticalAlign: 'top' }}>
                        {item.name}
                      </td>
                      <td style={{ padding: '2mm', border: '1px solid #000', textAlign: 'center', verticalAlign: 'top' }}>
                        {item.quantity}
                      </td>
                      <td style={{ padding: '2mm', border: '1px solid #000', textAlign: 'center', verticalAlign: 'top' }}>
                        {item.unit}
                      </td>
                      {showPrices && (
                        <>
                          <td style={{ padding: '2mm', border: '1px solid #000', textAlign: 'right', verticalAlign: 'top' }}>
                            {priceWithoutVat.toFixed(2)} Kč
                          </td>
                          {vatSettings.enabled && (
                            <>
                              <td style={{ padding: '2mm', border: '1px solid #000', textAlign: 'center', verticalAlign: 'top' }}>
                                {vatRate}%
                              </td>
                              <td style={{ padding: '2mm', border: '1px solid #000', textAlign: 'right', verticalAlign: 'top' }}>
                                {priceWithVat.toFixed(2)} Kč
                              </td>
                            </>
                          )}
                          <td style={{ padding: '2mm', border: '1px solid #000', textAlign: 'right', verticalAlign: 'top' }}>
                            {totalForRowWithoutVat.toFixed(2)} Kč
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
          </tbody>
        </table>

       {/* --- ZAČÁTEK ZMĚNY: NOVÝ SOUHRN CEN --- */}
       {showPrices && (
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                {/* Prázdná buňka vlevo */}
                <td style={{ width: '50%' }}></td>
                {/* Tabulka s cenami vpravo */}
                <td style={{ width: '50%', verticalAlign: 'top' }}>
                  <table style={{ width: '100%', fontSize: '9pt' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '1mm' }}>Celkem bez DPH</td>
                        <td style={{ padding: '1mm', textAlign: 'right' }}>
                          {Number(note.totalWithoutVat || 0).toFixed(2)} Kč
                        </td>
                      </tr>
                      
                      {/* Dynamický rozpis DPH podle sazeb */}
                      {vatSettings.enabled && note.vatBreakdown && Object.keys(note.vatBreakdown).sort((a,b) => a-b).map(rate => (
                        <tr key={rate}>
                          <td style={{ padding: '1mm' }}>DPH {rate}%</td>
                          <td style={{ padding: '1mm', textAlign: 'right' }}>
                            {Number(note.vatBreakdown[rate].amount || 0).toFixed(2)} Kč
                          </td>
                        </tr>
                      ))}

                      {/* Celková částka s DPH */}
                      {vatSettings.enabled && (
                        <tr >
                          <td style={{ padding: '2mm 1mm', borderTop: '1px solid #000', fontWeight: 'bold', fontSize: '11pt' }}>
                            Celkem s DPH
                          </td>
                          <td style={{ padding: '2mm 1mm', borderTop: '1px solid #000', fontWeight: 'bold', fontSize: '11pt', textAlign: 'right' }}>
                            {Number(note.totalWithVat || 0).toFixed(2)} Kč
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        )}
        {/* Podpisy jako tabulka */}
        <div style={{ clear: 'both', paddingTop: '10mm' }}>
          {vatSettings.enabled && (
            <p style={{ fontSize: '8pt', textAlign: 'center' }}>
              Jsme plátce DPH.
            </p>
          )}
        </div>
        <table style={{ width: '100%', marginTop: '15mm' }}>
          <tbody>
            <tr>
              <td
                style={{
                  width: '50%',
                  textAlign: 'center',
                  paddingRight: '10mm',
                }}
              >
                <div
                  style={{
                    borderTop: '1px solid #000',
                    paddingTop: '3mm',
                    marginTop: '10mm',
                  }}
                >
                  <div style={{ fontSize: '8pt', fontWeight: 'bold' }}>
                    Podpis dodavatele
                  </div>
                </div>
              </td>
              <td
                style={{ width: '50%', textAlign: 'center', paddingLeft: '10mm' }}
              >
                <div
                  style={{
                    borderTop: '1px solid #000',
                    paddingTop: '3mm',
                    marginTop: '10mm',
                  }}
                >
                  <div style={{ fontSize: '8pt', fontWeight: 'bold' }}>
                    Podpis odběratele
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
);

export default DeliveryNotePrintable;
