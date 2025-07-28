import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { Trash2, GripVertical, PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Komponenta pro jeden řádek produktu
const ProductRow = ({
  product,
  vatSettings,
  onProductChange,
  onMarkForDeletion,
  onAddNewRowBelow,
}) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto',
  };

  const getRowClass = () => {
    if (product.status === 'deleted') return 'opacity-40 bg-red-50';
    if (product.status === 'new') return 'bg-green-50';
    if (product.status === 'modified') return 'bg-yellow-50';
    return 'bg-white';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center p-3 border-b ${getRowClass()}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="p-2 cursor-grab touch-none"
        title={t('products_page.drag_handle')}
      >
        <GripVertical size={20} className="text-gray-400" />
      </div>
      <div className="flex-grow grid grid-cols-1 md:grid-cols-10 gap-3 items-center">
        {/* Zvětšený název */}
        <div className="md:col-span-5">
          <input
            type="text"
            placeholder={t('products_page.form.product_name')}
            value={product.name}
            disabled={product.status === 'deleted'}
            onChange={(e) =>
              onProductChange(product.id, 'name', e.target.value)
            }
            className="w-full p-2 border rounded bg-transparent"
          />
        </div>
        {/* Zúžená jednotka */}
        <div className="md:col-span-1">
          <input
            type="text"
            placeholder={t('products_page.form.unit')}
            value={product.unit}
            disabled={product.status === 'deleted'}
            onChange={(e) =>
              onProductChange(product.id, 'unit', e.target.value)
            }
            className="w-full p-2 border rounded bg-transparent"
          />
        </div>
        {/* Zúžená cena */}
        <div className="md:col-span-1">
          <input
            type="text"
            placeholder="0.00"
            value={product.price === 0 ? '' : product.price}
            disabled={product.status === 'deleted'}
            onChange={(e) =>
              onProductChange(
                product.id,
                'price',
                e.target.value.replace(',', '.')
              )
            }
            className="w-full p-2 border rounded text-right bg-transparent"
          />
        </div>
        {vatSettings?.enabled && (
          <div className="md:col-span-1">
            <input
              type="text"
              value={(
                parseFloat(String(product.price).replace(',', '.')) *
                  (1 + (vatSettings.rate || 0) / 100) || 0
              ).toFixed(2)}
              readOnly
              className="w-full p-2 border-none bg-gray-100 rounded text-right"
            />
          </div>
        )}
        {/* Rozšířené akce */}
        <div
          className={`md:col-span-2 flex justify-end gap-2 ${
            !vatSettings?.enabled && 'md:col-start-9'
          }`}
        >
          <button
            onClick={() => onAddNewRowBelow(product.id)}
            className="p-2 text-green-600 hover:text-green-800 rounded-md"
            title={'Přidat řádek pod'}
          >
            <PlusCircle size={20} />
          </button>
          <button
            onClick={() => onMarkForDeletion(product.id)}
            className="p-2 text-red-600 hover:text-red-800 rounded-md"
            title={t('common.delete')}
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Hlavní komponenta stránky
const ProductsPage = ({
  vatSettings,
  products: initialProducts,
  creationRequest,
  setCreationRequest,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [localProducts, setLocalProducts] = useState([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (creationRequest === 'product') {
      handleAddNew();
      setCreationRequest(null);
    }
  }, [creationRequest]);

  useEffect(() => {
    setLocalProducts(
      initialProducts.map((p) => ({ ...p, status: 'pristine' }))
    );
    setIsDirty(false);
  }, [initialProducts]);

  const handleProductChange = (id, field, value) => {
    setLocalProducts((current) =>
      current.map((p) => {
        if (p.id === id) {
          const newStatus = p.status === 'pristine' ? 'modified' : p.status;
          return { ...p, [field]: value, status: newStatus };
        }
        return p;
      })
    );
    setIsDirty(true);
  };

  const createNewProductObject = (position) => ({
    id: `new_${Date.now()}`,
    name: '',
    unit: 'ks',
    price: 0,
    userId: currentUser.uid,
    position,
    status: 'new',
  });

  const handleAddNew = () => {
    const newProduct = createNewProductObject(localProducts.length);
    setLocalProducts((current) => [...current, newProduct]);
    setIsDirty(true);
    setTimeout(
      () =>
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth',
        }),
      100
    );
  };

  // Nová funkce pro přidání řádku pod aktuální
  const onAddNewRowBelow = (currentId) => {
    const currentIndex = localProducts.findIndex((p) => p.id === currentId);
    if (currentIndex === -1) return;

    const newProduct = createNewProductObject(currentIndex + 1);
    const newProducts = [...localProducts];
    newProducts.splice(currentIndex + 1, 0, newProduct);

    setLocalProducts(newProducts);
    setIsDirty(true);
  };

  // ... zbytek funkcí (mazání, ukládání, drag-and-drop) zůstává stejný ...
  const handleMarkForDeletion = (id) => {
    if (window.confirm(t('products_page.alert.confirm_delete'))) {
      setLocalProducts((current) =>
        current
          .map((p) => {
            if (p.id === id) {
              if (p.status === 'new') return null;
              return { ...p, status: 'deleted' };
            }
            return p;
          })
          .filter(Boolean)
      );
      setIsDirty(true);
    }
  };

  const handleDiscardChanges = () => {
    setLocalProducts(
      initialProducts.map((p) => ({ ...p, status: 'pristine' }))
    );
    setIsDirty(false);
  };

  const handleBulkSave = async () => {
    const batch = writeBatch(db);

    localProducts.forEach((product, index) => {
      const productData = {
        name: product.name,
        unit: product.unit,
        price: parseFloat(String(product.price).replace(',', '.')) || 0,
        position: index,
        userId: currentUser.uid,
      };

      if (product.status === 'new') {
        const docRef = doc(collection(db, 'products'));
        batch.set(docRef, productData);
      } else if (product.status === 'modified') {
        const docRef = doc(db, 'products', product.id);
        batch.update(docRef, { ...productData });
      } else if (product.status === 'deleted') {
        const docRef = doc(db, 'products', product.id);
        batch.delete(docRef);
      } else if (product.position !== index) {
        const docRef = doc(db, 'products', product.id);
        batch.update(docRef, { position: index });
      }
    });

    try {
      await batch.commit();
      setIsDirty(false);
      alert('Změny úspěšně uloženy!');
    } catch (error) {
      console.error('Chyba při hromadném ukládání:', error);
      alert('Chyba při ukládání změn.');
    }
  };

  const sensors = useSensors(useSensor(PointerSensor));
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setLocalProducts((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      setIsDirty(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t('products_page.title')}</h2>
        {isDirty && (
          <div className="flex gap-2">
            <button
              onClick={handleDiscardChanges}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
            >
              {t('common.discard_changes')}
            </button>
            <button
              onClick={handleBulkSave}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              {t('common.save_all_changes')}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        {/* Upravená hlavička */}
        <div className="hidden md:flex items-center p-3 border-b bg-gray-50 text-sm font-semibold text-gray-600">
          <div className="w-[52px]"></div> {/* Mezera pro drag handle */}
          <div className="flex-grow grid grid-cols-10 gap-3 items-center">
            <div className="col-span-5">{t('products_page.header.name')}</div>
            <div className="col-span-1">{t('products_page.header.unit')}</div>
            <div className="col-span-1 text-right">
              {t('products_page.header.price_without_vat')}
            </div>
            {vatSettings?.enabled && (
              <div className="col-span-1 text-right">
                {t('products_page.header.price_with_vat')}
              </div>
            )}
            {/* Zarovnání doprava */}
            <div className="col-span-2 text-right pr-4">
              {t('products_page.header.actions')}
            </div>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localProducts.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {localProducts.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                vatSettings={vatSettings}
                onProductChange={handleProductChange}
                onMarkForDeletion={handleMarkForDeletion}
                onAddNewRowBelow={onAddNewRowBelow}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};

export default ProductsPage;
