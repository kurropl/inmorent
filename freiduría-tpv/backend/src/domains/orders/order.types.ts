import type { OrderStatus, OrderItemStatus, ProductDestination } from '@prisma/client';

export interface OrderItemView {
  id: string;
  productId: string;
  productName: string;
  destination: ProductDestination;
  isWeighed: boolean;
  pricePerKg: number | null;
  priceFixed: number | null;
  estimatedWeightGrams: number | null;
  finalWeightGrams: number | null;
  status: OrderItemStatus;
}

export interface OrderView {
  id: string;
  tableNumber: number;
  status: OrderStatus;
  items: OrderItemView[];
  createdAt: Date;
}

export interface CreateOrderInput {
  tableNumber: number;
}
