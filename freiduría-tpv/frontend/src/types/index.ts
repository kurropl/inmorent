export type ProductDestination = 'BAR' | 'KITCHEN';
export type OrderItemStatus = 'PENDING' | 'WEIGHED' | 'SERVED';
export type OrderStatus = 'OPEN' | 'CLOSED' | 'PAID';

export interface Product {
  id: string;
  name: string;
  category: string;
  destination: ProductDestination;
  isWeighed: boolean;
  pricePerKg: number | null;
  priceFixed: number | null;
  imageUrl: string | null;
}

export interface OrderItem {
  id: string;
  productId: string;
  product: Product;
  pricePerKg: number | null;
  priceFixed: number | null;
  estimatedWeightGrams: number | null;
  finalWeightGrams: number | null;
  status: OrderItemStatus;
  createdAt: string;
}

export interface Order {
  id: string;
  tableNumber: number;
  status: OrderStatus;
  items: OrderItem[];
  createdAt: string;
}

export interface OrderTotal {
  totalCents: number;
  totalEuros: string;
  requiresWeighingWarning: boolean;
  unweighedItems: string[];
}
