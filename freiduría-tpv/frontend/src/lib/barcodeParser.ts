interface ParsedBarcode { productCode: string; weightGrams: number; }

function isValidEAN13CheckDigit(barcode: string): boolean {
  const digits = barcode.split('').map(Number);
  const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

export function parseWeightBarcode(barcode: string): ParsedBarcode | null {
  if (!/^\d{13}$/.test(barcode)) return null;
  const prefix = parseInt(barcode.slice(0, 2), 10);
  if (prefix < 20 || prefix > 29) return null;
  if (!isValidEAN13CheckDigit(barcode)) return null;
  return { productCode: barcode.slice(2, 7), weightGrams: parseInt(barcode.slice(7, 12), 10) };
}
