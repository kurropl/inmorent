import { describe, it, expect } from 'vitest';
import { parseWeightBarcode } from '../domains/weighing/barcode.parser';

describe('parseWeightBarcode', () => {
  // EAN-13: "20" + "12345" + "00260" + check digit
  // Calculate check: digits=2,0,1,2,3,4,5,0,0,2,6,0 alternating *1,*3
  // 2*1+0*3+1*1+2*3+3*1+4*3+5*1+0*3+0*1+2*3+6*1+0*3 = 2+0+1+6+3+12+5+0+0+6+6+0 = 41
  // (10 - 41%10) % 10 = (10-1)%10 = 9
  const VALID_BARCODE = '2012345002609';

  it('parses a valid variable-weight EAN-13', () => {
    const result = parseWeightBarcode(VALID_BARCODE);
    expect(result).not.toBeNull();
    expect(result?.productCode).toBe('12345');
    expect(result?.weightGrams).toBe(260);
  });

  it('returns null for non-13-digit strings', () => {
    expect(parseWeightBarcode('123')).toBeNull();
    expect(parseWeightBarcode('12345678901234')).toBeNull();
  });

  it('returns null for barcodes not starting with 2X prefix', () => {
    expect(parseWeightBarcode('1012345002607')).toBeNull();
  });

  it('returns null for non-digit strings', () => {
    expect(parseWeightBarcode('201234500260A')).toBeNull();
  });

  it('returns null for invalid EAN-13 check digit', () => {
    expect(parseWeightBarcode('2012345002600')).toBeNull();
  });
});
