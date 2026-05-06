import { prisma } from '../../infrastructure/database/prisma.client';
import { calcWeightPrice, centsToEuros } from '../../shared/utils/money';
import type { OrderTotalResult } from '../../shared/types';
import type { CreateOrderInput } from './order.types';

const ORDER_WITH_ITEMS = {
  include: {
    items: {
      include: { product: true },
      orderBy: { createdAt: 'asc' as const },
    },
  },
};

export async function createOrder(input: CreateOrderInput) {
  return prisma.order.create({
    data: { tableNumber: input.tableNumber },
    ...ORDER_WITH_ITEMS,
  });
}

export async function getOrderById(id: string) {
  return prisma.order.findUnique({ where: { id }, ...ORDER_WITH_ITEMS });
}

export async function getOpenOrders() {
  return prisma.order.findMany({
    where: { status: 'OPEN' },
    ...ORDER_WITH_ITEMS,
    orderBy: { createdAt: 'asc' },
  });
}

export function calculateOrderTotal(items: any[]): OrderTotalResult {
  let totalCents = 0;
  let requiresWeighingWarning = false;
  const unweighedItems: string[] = [];

  for (const item of items) {
    if (item.isWeighed) {
      const weightToUse = item.finalWeightGrams ?? item.estimatedWeightGrams ?? 0;
      totalCents += calcWeightPrice(item.pricePerKg!, weightToUse);
      if (item.finalWeightGrams === null) {
        requiresWeighingWarning = true;
        unweighedItems.push(item.productName ?? item.product?.name ?? item.productId);
      }
    } else {
      totalCents += item.priceFixed ?? 0;
    }
  }

  return { totalCents, totalEuros: centsToEuros(totalCents), requiresWeighingWarning, unweighedItems };
}
