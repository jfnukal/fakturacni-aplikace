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
    { type: 'invoice', label: t('invoices_page.new'), icon: FileText },
    { type: 'delivery_note', label: t('delivery_notes_page.new'), icon: ListOrdered },
    { type: 'customer', label: t('customers_page.new'), icon: Building },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {/* Menu s položkami, které se zobrazí po kliknutí */}
      <div
        className={`flex flex-col items-end gap-3 transition-all duration-300 ${
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {menuItems.map((item) => (
          <button
            key={item.type}
            onClick={() => handleActionClick(item.type)}
            className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
          >
            <span className="font-medium text-gray-700">{item.label}</span>
            <item.icon size={20} className="text-gray-600" />
          </button>
        ))}
      </div>

      {/* Hlavní plovoucí tlačítko */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-16 h-16 mt-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-transform hover:scale-110 focus:outline-none"
        aria-label="Vytvořit nový dokument"
      >
        <Plus
          className={`transition-transform duration-300 ${isOpen ? 'rotate-45 scale-0' : 'rotate-0 scale-100'}`}
          size={32}
        />
        <X
          className={`absolute transition-transform duration-300 ${isOpen ? 'rotate-0 scale-100' : '-rotate-45 scale-0'}`}
          size={32}
        />
      </button>
    </div>
  );
};

export default CreationMenu;
