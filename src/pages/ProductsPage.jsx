// Soubor: src/pages/ProductsPage.jsx
import React from 'react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Plus, Trash2, Save, ArrowUp, ArrowDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ProductsPage = ({ vatSettings, products, setProducts }) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();

  const handleAddNew = () => {
    const newProduct = {
      id: `new_${Date.now()}`,
      name: '',
      unit: 'ks',
      price: 0,
      userId: currentUser.uid,
      position: products.length,
      isNew: true,
    };
    setProducts([...products, newProduct]);
  };

  const handleProductChange = (id, field, value) => {
    setProducts((currentProducts) =>
      currentProducts.map((p) => {
        if (p.id === id) {
          if (field === 'price') {
            const normalizedValue = typeof value === 'string' ? value.replace(',', '.') : value;
            return { ...p, [field]: normalizedValue };
          }
          return { ...p, [field]: value };
        }
        return p;
      })
    );
  };

  const handleSave = async (productToSave) => {
    const { id, isNew, ...productData } = productToSave;
    if (!productData.name) {
      alert(t('products_page.alert.name_required'));
      return;
    }
    productData.price = parseFloat(String(productData.price).replace(',', '.')) || 0;
    try {
      if (isNew) {
        await addDoc(collection(db, 'products'), productData);
      } else {
        await updateDoc(doc(db, 'products', id), productData);
      }
    } catch (error) {
      console.error('Chyba při ukládání produktu:', error);
    }
  };

  const handleDelete = async (id, isNew) => {
    if (isNew) {
      setProducts(products.filter((p) => p.id !== id));
      return;
    }
    if (window.confirm(t('products_page.alert.confirm_delete'))) {
      await deleteDoc(doc(db, 'products', id));
    }
  };

  const handleMove = async (index, direction) => {
    alert(t('products_page.alert.move_wip'));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t('products_page.title')}</h2>
        <button onClick={handleAddNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          <Plus size={16} /> {t('products_page.add_item')}
        </button>
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="divide-y divide-gray-200">
          <div className="hidden md:grid grid-cols-12 gap-3 items-center p-3 bg-gray-50 font-medium text-sm text-gray-600">
            <div className="col-span-4">{t('products_page.table.name')}</div>
            <div className="col-span-2">{t('products_page.table.unit')}</div>
            <div className="col-span-2 text-right">{t('products_page.table.price_without_vat')}</div>
            {vatSettings?.enabled && <div className="col-span-2 text-right">{t('products_page.table.price_with_vat')}</div>}
            <div className="col-span-2 text-center">{t('products_page.table.actions')}</div>
          </div>
          {products.map((product, index) => (
            <div key={product.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-4 md:p-3 hover:bg-gray-50">
              <div className="col-span-12 md:col-span-4">
                <input type="text" placeholder={t('products_page.form.product_name')} value={product.name} onChange={(e) => handleProductChange(product.id, 'name', e.target.value)} className="w-full p-2 border rounded" />
              </div>
              <div className="col-span-6 md:col-span-2">
                <input type="text" placeholder={t('products_page.form.unit')} value={product.unit} onChange={(e) => handleProductChange(product.id, 'unit', e.target.value)} className="w-full p-2 border rounded" />
              </div>
              <div className="col-span-6 md:col-span-2">
                <input type="text" placeholder={t('products_page.form.price_without_vat')} value={product.price} onChange={(e) => handleProductChange(product.id, 'price', e.target.value)} className="w-full p-2 border rounded text-right" />
              </div>
              {vatSettings?.enabled && (
                <div className="col-span-6 md:col-span-2">
                  <input type="text" value={(parseFloat(String(product.price).replace(',', '.')) * (1 + (vatSettings.rate || 0) / 100)).toFixed(2)} readOnly className="w-full p-2 border-none bg-gray-100 rounded text-right" />
                </div>
              )}
              <div className={`col-span-12 md:col-span-2 flex justify-start md:justify-end gap-4 md:gap-2 ${!vatSettings?.enabled && 'md:col-start-11'}`}>
                <button onClick={() => handleMove(index, -1)} disabled={index === 0} className="p-2 text-gray-500 hover:text-gray-800 disabled:opacity-25"><ArrowUp size={20} /></button>
                <button onClick={() => handleMove(index, 1)} disabled={index === products.length - 1} className="p-2 text-gray-500 hover:text-gray-800 disabled:opacity-25"><ArrowDown size={20} /></button>
                <button onClick={() => handleSave(product)} className="p-2 text-green-600 hover:text-green-800 rounded-md" title={t('common.save')}><Save size={20} /></button>
                <button onClick={() => handleDelete(product.id, product.isNew)} className="p-2 text-red-600 hover:text-red-800 rounded-md" title={t('common.delete')}><Trash2 size={20} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default ProductsPage;
