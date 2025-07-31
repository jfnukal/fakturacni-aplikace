import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Check, X, AlertCircle, Save, Settings, ArrowRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

const ConfigurableImportTool = ({ onImportComplete, currentUser, savedCustomers, products }) => {
  const [file, setFile] = useState(null);
  const [rawData, setRawData] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [previewData, setPreviewData] = useState([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState('upload'); // upload, mapping, preview, importing, complete

  // Mapování názvů produktů z XLS na názvy v aplikaci
  const productNameMapping = {
    'Pletýnka': 'Pletýnka',
    'Smaženka': 'Smaženka', 
    'Hamburger': 'Hamburger',
    'Obložené vejce': 'Obložené vejce',
    'Vajíčkový sálát': 'Vajíčkový salát',
    'Bageta kuřecí': 'Bageta - kuřecí',
    'Bageta šunková': 'Bageta - šunková',
    'Bageta mozzarella': 'Bageta - mozzarella',
    'Croissant obložený': 'Croissant - obložený',
    'Croissant mozzarella': 'Croissant - mozzarella',
    'Chlebíček sýr': 'Chlebíček - sýrový',
    'Chlebíček salám': 'Chlebíček - salámový', 
    'Chlebíček šunka': 'Chlebíček - šunkový',
    'Chlebíček vejce': 'Chlebíček - s vejcem',
    'Pařížský salát': 'Pařížský salát',
    'Pochoutkový salát': 'Pochoutkový salát',
    'Rumcajs salát': 'Rumcajs salát'
  };

  // Funkce pro mapování názvu produktu
  const mapProductName = (xlsName) => {
    if (!xlsName) return null;
    
    const trimmedName = xlsName.toString().trim();
    
    // Přesná shoda
    if (productNameMapping[trimmedName]) {
      return productNameMapping[trimmedName];
    }
    
    // Pokus o částečnou shodu (case insensitive)
    const lowerXlsName = trimmedName.toLowerCase();
    for (const [xlsKey, appName] of Object.entries(productNameMapping)) {
      if (xlsKey.toLowerCase() === lowerXlsName) {
        return appName;
      }
    }
    
    // Pokus o obsahovou shodu
    for (const [xlsKey, appName] of Object.entries(productNameMapping)) {
      if (lowerXlsName.includes(xlsKey.toLowerCase()) || xlsKey.toLowerCase().includes(lowerXlsName)) {
        return appName;
      }
    }
    
    return trimmedName; // Vrátí původní název, pokud nenajde mapping
  };

  // Možné typy sloupců
  const columnTypes = [
    { key: 'ignore', label: 'Ignorovat', color: 'gray' },
    { key: 'number', label: 'Číslo DL', color: 'blue' },
    { key: 'date', label: 'Datum', color: 'green' },
    { key: 'customer', label: 'Zákazník', color: 'purple' },
    { key: 'product', label: 'Produkt', color: 'orange' },
    { key: 'quantity', label: 'Množství', color: 'red' },
    { key: 'price', label: 'Cena', color: 'yellow' },
  ];

  // Načtení XLS souboru - specialně pro vaší formát
  const handleFileUpload = async (event) => {
    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    
    try {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Vaše specifická struktura:
      // B7 = číslo DL
      // B8 = datum vystavení  
      // Řádek 9 = hlavička (A9=Název, C9=počet, D9=Cena, F9=Celkem)
      // Řádek 10+ = data položek
      
      const deliveryNumber = worksheet['B7'] ? worksheet['B7'].v : '';
      const deliveryDate = worksheet['B8'] ? worksheet['B8'].v : '';
      
      // Načtu položky od řádku 9 (index 8 v 0-based) - tam je Pletýnka!
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // OPRAVA: Pletýnka je v A9 (index 8), takže začínáme od indexu 8!
      const itemRows = [];
      for (let i = 8; i < jsonData.length; i++) { // Začínáme od indexu 8 (A9 = Pletýnka!)
        const row = jsonData[i];
        
        if (row && row[0] && row[0].toString().trim()) { // Pokud má název v sloupci A a není prázdný
          const xlsProductName = row[0].toString().trim();
          
          // Přeskočíme řádky, které nejsou produkty (např. "CELKEM K ÚHRADĚ")
          if (xlsProductName.toUpperCase().includes('CELKEM') || 
              xlsProductName.toUpperCase().includes('ÚHRADĚ') ||
              xlsProductName.toUpperCase().includes('TOTAL')) {
            continue;
          }
          
          const mappedProductName = mapProductName(xlsProductName);
          
          // Najdi produkt v aplikaci podle mapovaného názvu
          const appProduct = products?.find(p => 
            p.name.toLowerCase() === mappedProductName.toLowerCase()
          );
          
          const quantity = parseFloat(row[2]) || 0;    // C - Počet
          const pricePerUnit = parseFloat(row[3]) || 0; // D - Cena bez DPH/ks
          const total = parseFloat(row[5]) || 0;        // F - Celkem
          
          itemRows.push({
            xlsName: xlsProductName,        // Původní název z XLS
            name: mappedProductName,        // Mapovaný název
            appProduct: appProduct,         // Nalezený produkt v aplikaci
            quantity: quantity,
            pricePerUnit: pricePerUnit,
            total: total,
            excelRow: i + 1  // Pro debugging
          });
        }
      }
      
      // Vytvořím strukturu pro zpracování - filtruj jen položky s množstvím > 0
      const validItems = itemRows.filter(item => item.name && item.quantity > 0);
      
      // Najdi Jakuba Hradila v seznamu zákazníků
      const jakubHradil = savedCustomers?.find(customer => 
        customer.name.toLowerCase().includes('jakub hradil') ||
        customer.name.toLowerCase().includes('hradil')
      );
      
      const processedData = [{
        id: 'import_1',
        number: deliveryNumber.toString().trim(),
        date: parseDate(deliveryDate),
        customer: jakubHradil || { 
          name: 'Jakub Hradil',
          address: '33',
          zip: '79201',
          city: 'Bruntál',
          ico: '06246800',
          dic: 'CZ9108135300'
        },
        matchedCustomer: !!jakubHradil,
        items: validItems, // Používáme filtrované položky
        showPrices: true,
        userId: currentUser.uid,
        rawData: { deliveryNumber, deliveryDate, itemRows, validItems }
      }];
      
      setRawData(jsonData);
      setPreviewData(processedData.map(item => ({ ...item, approved: true })));
      setStep('preview'); // Přeskočíme mapování, máme fixní strukturu
      
    } catch (error) {
      console.error('Chyba při čtení souboru:', error);
      alert('Chyba při čtení XLS souboru. Zkontrolujte formát.');
    }
  };

  // Změna mapování sloupce
  const updateColumnMapping = (columnIndex, type) => {
    setColumnMapping(prev => ({
      ...prev,
      [columnIndex]: type
    }));
  };

  // Zpracování dat podle mapování
  const processDataWithMapping = () => {
    const processed = [];
    const headers = rawData[0] || [];
    
    // Najdi indexy důležitých sloupců
    const numberCol = Object.keys(columnMapping).find(key => columnMapping[key] === 'number');
    const dateCol = Object.keys(columnMapping).find(key => columnMapping[key] === 'date');
    const customerCol = Object.keys(columnMapping).find(key => columnMapping[key] === 'customer');
    
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;
      
      const deliveryNote = {
        id: `import_${i}`,
        number: numberCol ? row[numberCol]?.toString().trim() : `DL-${i}`,
        date: dateCol ? parseDate(row[dateCol]) : new Date().toISOString().split('T')[0],
        customerName: customerCol ? row[customerCol]?.toString().trim() : 'Neznámý zákazník',
        items: [],
        showPrices: false,
        userId: currentUser.uid
      };
      
      // Najdi zákazníka
      const customer = savedCustomers?.find(c => 
        c.name.toLowerCase().includes(deliveryNote.customerName.toLowerCase()) ||
        deliveryNote.customerName.toLowerCase().includes(c.name.toLowerCase())
      );
      
      deliveryNote.customer = customer || { name: deliveryNote.customerName };
      deliveryNote.matchedCustomer = !!customer;
      
      // Zpracuj produkty
      const productCols = Object.keys(columnMapping).filter(key => columnMapping[key] === 'product');
      const quantityCols = Object.keys(columnMapping).filter(key => columnMapping[key] === 'quantity');
      const priceCols = Object.keys(columnMapping).filter(key => columnMapping[key] === 'price');
      
      // Jednoduchý způsob - předpokládáme, že produkty, množství a ceny jsou ve stejném pořadí
      productCols.forEach((productCol, index) => {
        const productName = row[productCol]?.toString().trim();
        const quantity = quantityCols[index] ? parseFloat(row[quantityCols[index]]) || 0 : 1;
        const price = priceCols[index] ? parseFloat(row[priceCols[index]]) || 0 : 0;
        
        if (productName && quantity > 0) {
          const product = products?.find(p => 
            p.name.toLowerCase().includes(productName.toLowerCase()) ||
            productName.toLowerCase().includes(p.name.toLowerCase())
          );
          
          deliveryNote.items.push({
            productId: product?.id || `new_${Date.now()}_${index}`,
            name: product?.name || productName,
            unit: product?.unit || 'ks',
            price: product?.price || price,
            quantity: quantity
          });
        }
      });
      
      if (deliveryNote.items.length > 0 || deliveryNote.number) {
        processed.push(deliveryNote);
      }
    }
    
    return processed;
  };

  // Pokračovat na preview
  const proceedToPreview = () => {
    const processedData = processDataWithMapping();
    setPreviewData(processedData.map(item => ({ ...item, approved: true })));
    setStep('preview');
  };

  // Parsování data
  const parseDate = (dateValue) => {
    if (!dateValue) return null;
    
    if (typeof dateValue === 'number') {
      // Excel datum
      const date = new Date((dateValue - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    
    const str = dateValue.toString().trim();
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    return null;
  };

  // Skutečný import do Firebase - upravený pro vaši strukturu
  const handleActualImport = async () => {
    setImporting(true);
    setStep('importing');
    
    const approvedItems = previewData.filter(item => item.approved);
    let successCount = 0;
    
    try {
      for (const item of approvedItems) {
        // Zpracuj položky pro Firebase
        const processedItems = item.items.map((rawItem, index) => {
          // Použij mapovaný název a data z aplikace, pokud je produkt nalezen
          const useAppProduct = rawItem.appProduct;
          
          return {
            productId: useAppProduct?.id || `imported_${Date.now()}_${index}`,
            name: rawItem.name, // Už mapovaný název
            unit: useAppProduct?.unit || 'ks',
            price: useAppProduct?.price || rawItem.pricePerUnit, // Preferuj cenu z aplikace
            quantity: rawItem.quantity
          };
        });
        
        // Najdi nebo použij Jakuba Hradila
        const customer = item.customer || savedCustomers?.find(c => 
          c.name.toLowerCase().includes('jakub hradil') ||
          c.name.toLowerCase().includes('hradil')
        ) || { 
          name: 'Jakub Hradil',
          address: '33',
          zip: '79201', 
          city: 'Bruntál',
          ico: '06246800',
          dic: 'CZ9108135300'
        };
        
        const deliveryNoteData = {
          number: item.number,
          date: item.date,
          customer: customer,
          items: processedItems,
          showPrices: item.showPrices,
          userId: currentUser.uid,
          createdAt: new Date(),
          totalWithoutVat: processedItems.reduce((sum, i) => sum + (i.quantity * i.price), 0),
          totalWithVat: processedItems.reduce((sum, i) => sum + (i.quantity * i.price), 0), // Zjednodušeno
          importedFrom: 'XLS',
          importedAt: new Date()
        };
        
        await addDoc(collection(db, 'deliveryNotes'), deliveryNoteData);
        successCount++;
      }
      
      setStep('complete');
      
      if (onImportComplete) {
        onImportComplete(successCount);
      }
      
    } catch (error) {
      console.error('Chyba při importu:', error);
      alert(`Chyba při importu: ${error.message}`);
      setImporting(false);
      setStep('preview');
    }
  };

  // Toggle approval
  const toggleApproval = (id) => {
    setPreviewData(prev => 
      prev.map(item => 
        item.id === id ? { ...item, approved: !item.approved } : item
      )
    );
  };

  // Reset
  const handleReset = () => {
    setFile(null);
    setRawData([]);
    setColumnMapping({});
    setPreviewData([]);
    setStep('upload');
  };

  const getColumnTypeColor = (type) => {
    const colorMap = {
      ignore: 'bg-gray-100 text-gray-700',
      number: 'bg-blue-100 text-blue-700',
      date: 'bg-green-100 text-green-700',
      customer: 'bg-purple-100 text-purple-700',
      product: 'bg-orange-100 text-orange-700',
      quantity: 'bg-red-100 text-red-700',
      price: 'bg-yellow-100 text-yellow-700',
    };
    return colorMap[type] || colorMap.ignore;
  };

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <FileSpreadsheet className="text-green-600" size={24} />
        <h3 className="text-lg font-bold">Konfigurovatelný import dodacích listů</h3>
      </div>

      {step === 'upload' && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-green-600 mt-0.5" size={16} />
              <div className="text-sm text-green-800">
                <div className="font-medium mb-1">Optimalizováno pro váš formát:</div>
                <ul className="text-xs space-y-1">
                  <li>• <strong>B7:</strong> Číslo dodacího listu</li>
                  <li>• <strong>B8:</strong> Datum vystavení</li>
                  <li>• <strong>A10+:</strong> Název položky</li>
                  <li>• <strong>C10+:</strong> Množství (ks)</li>
                  <li>• <strong>D10+:</strong> Cena bez DPH/ks</li>
                  <li>• <strong>F10+:</strong> Celkem</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload className="mx-auto text-gray-400 mb-4" size={48} />
            <div className="mb-4">
              <label className="cursor-pointer">
                <span className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
                  Nahrát dodací list XLS
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-sm text-gray-500">
              Podporuje váš specifický formát XLS dodacích listů
            </p>
          </div>
        </div>
      )}

      {step === 'mapping' && rawData.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Nakonfigurujte mapování sloupců</h4>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                Zrušit
              </button>
              <button
                onClick={proceedToPreview}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Pokračovat <ArrowRight size={16} className="inline ml-1" />
              </button>
            </div>
          </div>

          <div className="bg-gray-50 rounded p-4">
            <div className="text-sm text-gray-600 mb-3">
              Vyberte, co každý sloupec obsahuje:
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Sloupec</th>
                    <th className="text-left p-2">Ukázka dat</th>
                    <th className="text-left p-2">Typ obsahu</th>
                  </tr>
                </thead>
                <tbody>
                  {(rawData[0] || []).map((header, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2 font-medium">
                        {header || `Sloupec ${index + 1}`}
                      </td>
                      <td className="p-2 text-gray-600">
                        {rawData.slice(1, 4).map(row => row[index]).filter(Boolean).join(', ').substring(0, 50)}...
                      </td>
                      <td className="p-2">
                        <select
                          value={columnMapping[index] || 'ignore'}
                          onChange={(e) => updateColumnMapping(index, e.target.value)}
                          className={`px-2 py-1 rounded text-xs border ${getColumnTypeColor(columnMapping[index] || 'ignore')}`}
                        >
                          {columnTypes.map(type => (
                            <option key={type.key} value={type.key}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">
              Nalezeno {previewData.length} dodacích listů
            </h4>
            <div className="flex gap-2">
              <button
                onClick={() => setStep('mapping')}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                Zpět
              </button>
              <button
                onClick={handleActualImport}
                disabled={!previewData.some(item => item.approved)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 transition-colors"
              >
                Skutečně importovat ({previewData.filter(item => item.approved).length})
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto border rounded">
            {previewData.map((item, index) => (
              <div
                key={item.id}
                className={`p-4 border-b flex items-start gap-4 ${
                  item.approved ? 'bg-green-50' : 'bg-gray-50'
                }`}
              >
                <button
                  onClick={() => toggleApproval(item.id)}
                  className={`p-1 rounded ${
                    item.approved 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {item.approved ? <Check size={16} /> : <X size={16} />}
                </button>

                <div className="flex-grow">
                  <div className="flex items-center gap-4 mb-2">
                    <span className="font-medium">{item.number}</span>
                    <span className="text-sm text-gray-600">{item.date}</span>
                    <span className={`text-sm px-2 py-1 rounded ${
                      item.matchedCustomer 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {item.customer.name} {item.matchedCustomer ? '(nalezen v adresáři)' : '(výchozí Jakub Hradil)'}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    {item.items.map((i, index) => (
                      <div key={index} className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${i.appProduct ? 'bg-green-500' : 'bg-orange-500'}`}></span>
                        <span>{i.name} ({i.quantity}ks à {Number(i.pricePerUnit).toFixed(2)}Kč)</span>
                        {i.xlsName !== i.name && (
                          <span className="text-xs text-gray-400">← "{i.xlsName}"</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    XLS celkem: {item.items.reduce((sum, i) => sum + i.total, 0).toFixed(2)} Kč
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    ✅ Vypočítaný celkem: {item.items.filter(i => i.appProduct).reduce((sum, i) => sum + (i.quantity * (i.appProduct?.price || i.pricePerUnit)), 0).toFixed(2)} Kč
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    ✅ Nalezeno: {item.items.filter(i => i.appProduct).length}/{item.items.length} produktů v aplikaci
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Skutečně importuji do Firebase...</p>
        </div>
      )}

      {step === 'complete' && (
        <div className="text-center py-8">
          <Check className="mx-auto text-green-600 mb-4" size={48} />
          <h4 className="text-lg font-bold mb-2">Import dokončen!</h4>
          <p className="text-gray-600 mb-4">
            Úspěšně importováno {previewData.filter(item => item.approved).length} dodacích listů do Firebase.
          </p>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Importovat další soubor
          </button>
        </div>
      )}
    </div>
  );
};

export default ConfigurableImportTool;
