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

    // Výpočet celkové částky
    const calculateTotal = () => {
      if (!note.items || !showPrices) return 0;
      return note.items.reduce((sum, item) => {
        return (
          sum +
          item.quantity *
            (parseFloat(String(item.price).replace(',', '.')) || 0)
        );
      }, 0);
    };

    const total = calculateTotal();

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
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th
                style={{
                  textAlign: 'left',
                  padding: '2mm',
                  border: '1px solid #000',
                  fontWeight: 'bold',
                  width: showPrices ? '35%' : '50%',
                }}
              >
                Popis
              </th>
              <th
                style={{
                  textAlign: 'center',
                  padding: '2mm',
                  border: '1px solid #000',
                  fontWeight: 'bold',
                  width: showPrices ? '12%' : '25%',
                }}
              >
                Množství
              </th>
              <th
                style={{
                  textAlign: 'center',
                  padding: '2mm',
                  border: '1px solid #000',
                  fontWeight: 'bold',
                  width: showPrices ? '13%' : '25%',
                }}
              >
                Jednotka
              </th>
              {showPrices && (
                <>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '2mm',
                      border: '1px solid #000',
                      fontWeight: 'bold',
                      width: '20%',
                    }}
                  >
                    Cena/ks
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
                    Celkem
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {note.items &&
              note.items
                .filter((item) => item.quantity > 0)
                .map((item, index) => (
                  <tr key={item.productId || index}>
                    <td
                      style={{
                        padding: '2mm',
                        border: '1px solid #000',
                        verticalAlign: 'top',
                      }}
                    >
                      {item.name}
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
                    {showPrices && (
                      <>
                        <td
                          style={{
                            padding: '2mm',
                            border: '1px solid #000',
                            textAlign: 'right',
                            verticalAlign: 'top',
                          }}
                        >
                          {Number(item.price || 0).toFixed(2)} Kč
                        </td>
                        <td
                          style={{
                            padding: '2mm',
                            border: '1px solid #000',
                            textAlign: 'right',
                            verticalAlign: 'top',
                          }}
                        >
                          {(
                            item.quantity *
                            (parseFloat(String(item.price).replace(',', '.')) ||
                              0)
                          ).toFixed(2)}{' '}
                          Kč
                        </td>
                      </>
                    )}
                  </tr>
                ))}
          </tbody>
        </table>

        {/* Celková částka jako tabulka */}
        {showPrices && (
          <table style={{ width: '100%', marginBottom: '8mm' }}>
            <tbody>
              <tr>
                <td style={{ width: '40%', verticalAlign: 'top' }}>
                  {/* Prázdné místo pro eventuální QR kód nebo jiný obsah */}
                </td>
                <td style={{ width: '60%', verticalAlign: 'top' }}>
                  <table style={{ width: '100%', fontSize: '9pt', marginLeft: 'auto', maxWidth: '60%' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '0.5mm 0' }}>
                          Celkem bez DPH:
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.5mm 0' }}>
                          {total.toFixed(2)} Kč
                        </td>
                      </tr>
                      {vatSettings?.enabled && (
                        <>
                          <tr>
                            <td style={{ padding: '0.5mm 0' }}>
                              DPH {vatSettings.rate}%:
                            </td>
                            <td style={{ textAlign: 'right', padding: '0.5mm 0' }}>
                              {(total * (vatSettings.rate / 100)).toFixed(2)} Kč
                            </td>
                          </tr>
                          <tr>
                            <td
                              style={{
                                padding: '1mm 0',
                                borderTop: '1px solid #000',
                                fontWeight: 'bold',
                                fontSize: '10pt',
                              }}
                            >
                              Celkem s DPH:
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
                              {(total * (1 + vatSettings.rate / 100)).toFixed(2)} Kč
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Podpisy jako tabulka */}
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
