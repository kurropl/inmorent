import type { ParsedBarcode } from '../../shared/types';

/**
 * Validates and parses a variable-weight EAN-13 barcode.
 * Format: 2X PPPPP WWWWW C
 *   Digits 0-1: "2X" prefix (20-29 = variable weight)
 *   Digits 2-6: 5-digit product reference
 *   Digits 7-11: 5-digit weight in GRAMS (00260 = 260g)
 *   Digit 12: EAN-13 check digit
 */
export function parseWeightBarcode(barcode: string): ParsedBarcode | null {
  if (!/^\d{13}$/.test(barcode)) return null;

  const prefixValue = parseInt(barcode.slice(0, 2), 10);
  if (prefixValue < 20 || prefixValue > 29) return null;

  if (!isValidEAN13CheckDigit(barcode)) return null;

  return {
    productCode: barcode.slice(2, 7),
    weightGrams: parseInt(barcode.slice(7, 12), 10),
  };
}

function isValidEAN13CheckDigit(barcode: string): boolean {
  const digits = barcode.split('').map(Number);
  const sum = digits.slice(0, 12).reduce((acc, digit, index) => {
    return acc + digit * (index % 2 === 0 ? 1 : 3);
  }, 0);
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === digits[12];
}
