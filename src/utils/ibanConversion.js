/**
 * Konverze českého čísla účtu na IBAN (CZ formát)
 *
 * Formát vstupu: "NNNNNN-AAAAAAAAAA/BBBB"
 *   NNNNNN    = prefix (volitelný, 1–6 číslic)
 *   AAAAAAAAAA = číslo účtu (2–10 číslic)
 *   BBBB       = kód banky (4 číslice)
 *
 * @param {string} accountString – číslo účtu ve formátu "číslo/kód" nebo "prefix-číslo/kód"
 * @returns {string} IBAN ve formátu "CZxx xxxxxxxxxxxx xxxx" nebo '' při chybě
 */
export const convertToIBAN = (accountString) => {
  if (
    !accountString ||
    !accountString.includes('/') ||
    accountString.length < 3
  ) {
    return '';
  }

  try {
    const [mainPart, bankCode] = accountString.split('/');
    const [prefix, number] = mainPart.includes('-')
      ? mainPart.split('-')
      : ['', mainPart];

    if (!number || !bankCode) return '';

    // 1. Doplnění nul na požadovanou délku
    const paddedBankCode = bankCode.trim().padStart(4, '0');
    const paddedPrefix = prefix.trim().padStart(6, '0');
    const paddedNumber = number.trim().padStart(10, '0');

    // 2. BBAN = kód banky + prefix + číslo účtu
    const bban = paddedBankCode + paddedPrefix + paddedNumber;

    // 3. Výpočet kontrolních číslic (ISO 7064, MOD 97-10)
    //    CZ = C(12) Z(35), za tím '00' → přidáme k BBAN a počítáme mod 97
    const checkString = bban + '123500'; // '1235' = CZ, '00' = placeholder číslic

    let remainder = 0;
    for (let i = 0; i < checkString.length; i++) {
      remainder = (remainder * 10 + parseInt(checkString[i], 10)) % 97;
    }

    const checkDigits = (98 - remainder).toString().padStart(2, '0');

    // 4. Finální IBAN
    return `CZ${checkDigits}${bban}`;
  } catch (error) {
    console.error('Chyba při konverzi na IBAN:', error);
    return '';
  }
};
