// Soubor: src/components/CreationMenu.jsx
import React, { useState } from 'react';
import { Plus, X, FileText, ListOrdered, Building, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const CreationMenu = ({ onRequestNew }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const handleActionClick = (itemType) => {
    onRequestNew(itemType);
    setIsOpen(false);
  };

  const menuItems = [
    { type: 'product', label: t('products_page.add_item'), icon: Tag },
    { type: 'invoice', label: t('invoices_page.new'), icon: FileText },
    { type: 'delivery_note', label: t('delivery_notes_page.new'), icon: ListOrdered },
    { type: 'customer', label: t('customers_page.new'), icon: Building },
  ];

  return (
    // Změna z 'fixed' na 'absolute'
    <div className="absolute bottom-6 right-6 z-40">
      {/* ... zbytek kódu zůstává stejný ... */}
    </div>
  );
};

export default CreationMenu;
