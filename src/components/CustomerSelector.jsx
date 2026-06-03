import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, X, Building } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const CustomerSelector = ({ 
  customers = [], 
  selectedCustomer = null, 
  onCustomerSelect, 
  onQuickAdd = null,
  placeholder = "{t('customer_selector.search_placeholder')}"
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filtrování zákazníků podle vyhledávání
  useEffect(() => {
    if (!searchTerm) {
      setFilteredCustomers(customers.slice(0, 10)); // Max 10 položek
    } else {
      const filtered = customers.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.ico?.includes(searchTerm)
      ).slice(0, 10);
      setFilteredCustomers(filtered);
    }
  }, [searchTerm, customers]);

  // Zavření při kliku mimo
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCustomerSelect = (customer) => {
    onCustomerSelect(customer);
    setSearchTerm(customer.name);
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    if (e.target.value === '') {
      onCustomerSelect(null);
    }
  };

  const handleQuickAdd = () => {
    if (onQuickAdd && searchTerm.trim()) {
      onQuickAdd({ name: searchTerm.trim() });
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={16} className="text-gray-400" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || t('customer_selector.search_placeholder')}
          className="w-full pl-10 pr-10 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />

        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('');
              onCustomerSelect(null);
              setIsOpen(false);
            }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <X size={16} className="text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Dropdown seznam */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filteredCustomers.length > 0 ? (
            <>
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => handleCustomerSelect(customer)}
                  className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                >
                  <Building size={16} className="text-gray-400 mr-3 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {customer.name}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {customer.city && `${customer.city} • `}
                      {customer.ico && `IČO: ${customer.ico}`}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Rychlé přidání */}
              {onQuickAdd && searchTerm && !filteredCustomers.some(c => c.name.toLowerCase() === searchTerm.toLowerCase()) && (
                <div
                  onClick={handleQuickAdd}
                  className="flex items-center p-3 hover:bg-blue-50 cursor-pointer border-t border-gray-100 text-blue-600"
                >
                  <Plus size={16} className="mr-3" />
                  <span className="font-medium">
                   {t('customer_selector.add_new', { name: searchTerm })}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="p-4 text-center text-gray-500">
              {searchTerm ? (
                <div>
                  <div className="mb-2">{t('customer_selector.no_results')}</div>
                  {onQuickAdd && (
                    <button
                      onClick={handleQuickAdd}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + {t('customer_selector.add_new', { name: searchTerm })}
                    </button>
                  )}
                </div>
                  ) : (
                    <div>{t('customer_selector.start_typing')}</div>
                  )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerSelector;
