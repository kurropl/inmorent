export interface OrderTotalResult {
  totalCents: number;
  totalEuros: string;
  requiresWeighingWarning: boolean;
  unweighedItems: string[];
}

export interface ParsedBarcode {
  productCode: string;
  weightGrams: number;
}
