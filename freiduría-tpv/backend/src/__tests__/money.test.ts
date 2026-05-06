import { describe, it, expect } from 'vitest';
import { calcWeightPrice, centsToEuros, eurosToCents } from '../shared/utils/money';

describe('calcWeightPrice', () => {
  it('calculates 260g at 14.00/kg correctly', () => {
    expect(calcWeightPrice(1400, 260)).toBe(364);
  });

  it('calculates 250g at 12.00/kg correctly', () => {
    expect(calcWeightPrice(1200, 250)).toBe(300);
  });

  it('rounds half-up on fractional cents', () => {
    expect(calcWeightPrice(1300, 123)).toBe(160);
  });

  it('returns 0 for 0 grams', () => {
    expect(calcWeightPrice(1400, 0)).toBe(0);
  });

  it('throws on negative price', () => {
    expect(() => calcWeightPrice(-100, 200)).toThrow();
  });
});

describe('centsToEuros', () => {
  it('converts 364 cents to "3.64"', () => {
    expect(centsToEuros(364)).toBe('3.64');
  });

  it('pads single-cent values', () => {
    expect(centsToEuros(5)).toBe('0.05');
  });
});

describe('eurosToCents', () => {
  it('converts "3.64" to 364', () => {
    expect(eurosToCents('3.64')).toBe(364);
  });
});
