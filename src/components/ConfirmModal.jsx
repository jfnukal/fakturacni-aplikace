import React, { useState, useEffect } from 'react';

const ConfirmModal = ({ isOpen, config, onClose }) => {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    // Reset inputu při každém otevření
    if (isOpen) {
      setInputValue(config.initialValue || '');
    }
  }, [isOpen, config.initialValue]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{config.title}</h2>
        <p className="text-gray-600 mb-4">{config.message}</p>
        
        {config.showInput && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">{config.inputLabel}</label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full p-2 border rounded"
              autoFocus
            />
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3 mt-6 [&>button]:flex-grow sm:[&>button]:flex-grow-0">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            {config.cancelText || 'Zpět'}
          </button>
          
          {config.onSaveAnyway && (
            <button 
              onClick={config.onSaveAnyway} 
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600">
              {config.saveAnywayText || 'Přesto uložit'}
            </button>
          )}

          <button 
            onClick={() => config.onConfirm(inputValue)} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            {config.confirmText || 'Potvrdit a uložit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
