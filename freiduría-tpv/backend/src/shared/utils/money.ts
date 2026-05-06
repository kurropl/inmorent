/**
 * Calculates price of a weighed item in cents.
 * Formula: Math.round((pricePerKg * weightGrams) / 1000)
 * All integer arithmetic — no floats. Division by 1000 converts grams to kg.
 * Example: 1400 cents/kg × 260g → (1400 * 260) / 1000 = 364 cents = 3.64€
 */
export function calcWeightPrice(pricePerKgCents: number, weightGrams: number): number {
  if (pricePerKgCents < 0 || weightGrams < 0) {
    throw new Error('Price and weight must be non-negative');
  }
  return Math.round((pricePerKgCents * weightGrams) / 1000);
}

export function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function eurosToCents(euros: string): number {
  return Math.round(parseFloat(euros) * 100);
}
