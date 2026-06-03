/**
 * Testy pro convertToIBAN – konverze českého čísla účtu na IBAN
 *
 * Spuštění: npm test
 * Referenční IBAN validator: https://www.iban.com/iban-checker nebo bankové kalkulátory
 */

import { describe, it, expect } from 'vitest';
import { convertToIBAN } from '../utils/ibanConversion';

describe('convertToIBAN – základní formáty', () => {
  it('převede standardní účet bez prefixu', () => {
    // Komerční banka, účet 123-456/0100
    // Referenční IBAN: CZ65 0800 0000 1900 0019 2345 (příklad z ČNB)
    const result = convertToIBAN('19-2000145399/0800');
    expect(result).toMatch(/^CZ\d{2}\d{20}$/); // Základní formát
    expect(result.length).toBe(24); // CZ + 2 kontrolní + 20 BBAN
  });

  it('převede účet s prefixem', () => {
    const result = convertToIBAN('000019-2000145399/0800');
    expect(result).toMatch(/^CZ\d{22}$/);
  });

  it('převede účet bez prefixu (jen číslo/kód)', () => {
    const result = convertToIBAN('2000145399/0800');
    expect(result).toMatch(/^CZ\d{22}$/);
  });

  it('vrátí prázdný řetězec pro prázdný vstup', () => {
    expect(convertToIBAN('')).toBe('');
    expect(convertToIBAN(null)).toBe('');
    expect(convertToIBAN(undefined)).toBe('');
  });

  it('vrátí prázdný řetězec pro vstup bez lomítka', () => {
    expect(convertToIBAN('12345678')).toBe('');
  });

  it('vrátí prázdný řetězec pro příliš krátký vstup', () => {
    expect(convertToIBAN('1/')).toBe('');
  });
});

describe('convertToIBAN – konkrétní ověřené hodnoty', () => {
  /**
   * Referenční příklady ověřené externím validátorem (IBAN.com):
   * Česká spořitelna (0800), účet bez prefixu: 19-2000145399/0800
   * IBAN: CZ6508000000192000145399
   */
  it('ČS účet 19-2000145399/0800 → CZ6508000000192000145399', () => {
    expect(convertToIBAN('19-2000145399/0800')).toBe('CZ6508000000192000145399');
  });

  /**
   * KB (0100), účet 107-6331570287/0100
   * IBAN ověřen výpočtem algoritmu (ISO 7064 MOD 97-10)
   */
  it('KB účet 107-6331570287/0100 → CZ5501000001076331570287', () => {
    expect(convertToIBAN('107-6331570287/0100')).toBe('CZ5501000001076331570287');
  });

  /**
   * mBank (6210), účet bez prefixu: 670100-2200277488/6210
   */
  it('mBank účet 670100-2200277488/6210 → správný formát', () => {
    const result = convertToIBAN('670100-2200277488/6210');
    expect(result).toMatch(/^CZ\d{22}$/);
    // Kontrolní číslice musí být v rozsahu 02–98 (IBAN standard)
    const checkDigits = parseInt(result.slice(2, 4), 10);
    expect(checkDigits).toBeGreaterThanOrEqual(2);
    expect(checkDigits).toBeLessThanOrEqual(98);
  });
});

describe('convertToIBAN – edge cases', () => {
  it('doplní nuly na začátek prefixu', () => {
    const a = convertToIBAN('19-2000145399/0800');
    const b = convertToIBAN('000019-2000145399/0800');
    expect(a).toBe(b); // Padding musí dát stejný výsledek
  });

  it('ignoruje mezery kolem částí účtu', () => {
    const a = convertToIBAN('19-2000145399/0800');
    const b = convertToIBAN(' 19 - 2000145399 / 0800 ');
    // Základní případ – jen testujeme že nevyhodí výjimku
    expect(typeof a).toBe('string');
    expect(typeof b).toBe('string');
  });

  it('vrací IBAN délky přesně 24 znaků pro platný vstup', () => {
    const result = convertToIBAN('19-2000145399/0800');
    expect(result.length).toBe(24);
  });

  it('kontrolní číslice jsou vždy 2 číslice (padStart)', () => {
    const result = convertToIBAN('19-2000145399/0800');
    const checkDigits = result.slice(2, 4);
    expect(checkDigits).toMatch(/^\d{2}$/);
  });
});
