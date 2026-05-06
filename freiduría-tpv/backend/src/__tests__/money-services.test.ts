import { describe, it, expect } from 'vitest';
import { calculateOrderTotal } from '../domains/orders/order.service';

const makeItem = (overrides: Partial<any> = {}) => ({
  id: 'item-1', productId: 'p1', productName: 'Chocos',
  destination: 'KITCHEN', isWeighed: true,
  pricePerKg: 1400, priceFixed: null,
  estimatedWeightGrams: 250, finalWeightGrams: null,
  status: 'PENDING',
  ...overrides,
});

describe('calculateOrderTotal', () => {
  it('uses finalWeightGrams when available', () => {
    const result = calculateOrderTotal([makeItem({ finalWeightGrams: 260 })]);
    expect(result.totalCents).toBe(364); // (1400 * 260) / 1000
    expect(result.requiresWeighingWarning).toBe(false);
  });

  it('falls back to estimatedWeightGrams with warning when not weighed', () => {
    const result = calculateOrderTotal([makeItem({ finalWeightGrams: null })]);
    expect(result.totalCents).toBe(350); // (1400 * 250) / 1000
    expect(result.requiresWeighingWarning).toBe(true);
    expect(result.unweighedItems).toContain('Chocos');
  });

  it('sums fixed-price items directly', () => {
    const fixedItem = makeItem({ isWeighed: false, pricePerKg: null, priceFixed: 180, estimatedWeightGrams: null, finalWeightGrams: null });
    expect(calculateOrderTotal([fixedItem]).totalCents).toBe(180);
  });

  it('sums mixed items correctly', () => {
    const weighed = makeItem({ finalWeightGrams: 260 });   // 364
    const fixed = makeItem({ isWeighed: false, pricePerKg: null, priceFixed: 180, estimatedWeightGrams: null, finalWeightGrams: null }); // 180
    expect(calculateOrderTotal([weighed, fixed]).totalCents).toBe(544);
  });

  it('returns totalEuros formatted', () => {
    const result = calculateOrderTotal([makeItem({ finalWeightGrams: 260 })]);
    expect(result.totalEuros).toBe('3.64');
  });
});
