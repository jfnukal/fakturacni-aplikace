import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-gray-200 rounded-full">
      <button
        onClick={() => changeLanguage('cs')}
        className={`px-3 py-1 text-sm rounded-full transition-colors ${
          i18n.language === 'cs' ? 'bg-white shadow' : 'hover:bg-gray-300'
        }`}
      >
        🇨🇿
      </button>
      <button
        onClick={() => changeLanguage('ua')}
        className={`px-3 py-1 text-sm rounded-full transition-colors ${
          i18n.language === 'uk' ? 'bg-white shadow' : 'hover:bg-gray-300'
        }`}
      >
        🇺🇦
      </button>
    </div>
  );
};

export default LanguageSwitcher;
//note
