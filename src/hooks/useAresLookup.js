/**
 * useAresLookup – sdílený hook pro vyhledávání v ARES
 *
 * Netlify funkce /.netlify/functions/ares vrací předzpracovaná data:
 *   { ico, obchodniJmeno, dic, address, zip, city, zivnostenskyUrad, financniUrad }
 *
 * Hook abstrahuje fetch, validaci a normalizaci odpovědi.
 * Použití:
 *   const { fetchFromAres, isLoading } = useAresLookup();
 *   const data = await fetchFromAres('12345678');
 *   if (data) setCustomer(prev => ({ ...prev, ...data }));
 */

import { useState } from 'react';

export function useAresLookup() {
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Načte data z ARES pro zadané IČO.
   * @param {string} ico – osmimístné IČO
   * @returns {{ name, address, zip, city, ico, dic, registeringAuthority?, financniUrad? } | null}
   */
  const fetchFromAres = async (ico) => {
    if (!ico || !/^\d{8}$/.test(ico)) {
      alert('Zadejte platné osmimístné IČO.');
      return null;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/.netlify/functions/ares?ico=${ico}`);

      if (!response.ok) {
        if (response.status === 404) {
          alert('Firma s daným IČO nebyla v databázi ARES nalezena.');
        } else {
          alert('Chyba při komunikaci s ARES. Zkuste to prosím znovu.');
        }
        return null;
      }

      const data = await response.json();

      if (!data || !data.obchodniJmeno) {
        alert('Firma s daným IČO nebyla v databázi ARES nalezena.');
        return null;
      }

      // Netlify funkce vrací předzpracovaná pole (address, zip, city)
      return {
        name: data.obchodniJmeno,
        address: data.address || '',
        zip: data.zip || '',
        city: data.city || '',
        ico: data.ico,
        dic: data.dic || '',
        // Volitelná pole – vyplní se jen pokud je ARES zná
        ...(data.zivnostenskyUrad?.nazev && {
          registeringAuthority: data.zivnostenskyUrad.nazev,
        }),
        ...(data.financniUrad?.nazev && {
          financniUrad: data.financniUrad.nazev,
        }),
      };
    } catch (error) {
      console.error('[useAresLookup] Chyba:', error);
      alert('Nepodařilo se načíst data z ARES. Zkontrolujte připojení k internetu.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { fetchFromAres, isLoading };
}
