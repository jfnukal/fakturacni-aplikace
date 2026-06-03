import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Importujeme naše překlady
import translationCS from './locales/cs/translation.json';
import translationUK from './locales/uk/translation.json';

const resources = {
  cs: {
    translation: translationCS
  },
  ua: {
    translation: translationUK
  }
};

i18n
  // Detekce jazyka prohlížeče
  .use(LanguageDetector)
  // Propojení s Reactem
  .use(initReactI18next)
  // Inicializace
  .init({
    resources,
    fallbackLng: 'cs', // Výchozí jazyk, pokud detekce selže
    interpolation: {
      escapeValue: false // Nutné pro React
    }
  });

export default i18n;
