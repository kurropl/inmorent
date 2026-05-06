import { prisma } from '../../infrastructure/database/prisma.client';
import { emitToRoom } from '../../infrastructure/websocket/socket.emitter';

export interface CreateOrderItemInput {
  orderId: string;
  productId: string;
  estimatedWeightGrams?: number;
}

export async function createOrderItem(input: CreateOrderItemInput) {
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) throw new Error('Product not found');

  if (product.isWeighed && !input.estimatedWeightGrams) {
    throw new Error('estimatedWeightGrams required for weighed products');
  }

  const item = await prisma.orderItem.create({
    data: {
      orderId: input.orderId,
      productId: input.productId,
      pricePerKg: product.pricePerKg,
      priceFixed: product.priceFixed,
      estimatedWeightGrams: input.estimatedWeightGrams ?? null,
      finalWeightGrams: null,
    },
    include: { product: true, order: true },
  });

  const room = product.destination === 'KITCHEN' ? 'kitchen' : 'bar';
  emitToRoom(room, 'newOrderItem', { item, product, tableNumber: item.order.tableNumber });

  return item;
}

export async function updateFinalWeight(itemId: string, finalWeightGrams: number) {
  if (finalWeightGrams <= 0) throw new Error('Invalid weight: must be > 0');

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: { product: true, order: true },
  });
  if (!item) throw new Error('OrderItem not found');
  if (!item.pricePerKg) throw new Error('Item has no pricePerKg — not a weighed product');

  // Core formula: integer arithmetic only — no floats
  const finalPriceCents = Math.round((item.pricePerKg * finalWeightGrams) / 1000);

  const updated = await prisma.orderItem.update({
    where: { id: itemId },
    data: { finalWeightGrams, status: 'WEIGHED' },
    include: { product: true, order: true },
  });

  const payload = {
    itemId,
    finalWeightGrams,
    finalPriceCents,
    finalPriceEuros: (finalPriceCents / 100).toFixed(2),
    status: 'WEIGHED',
    tableNumber: item.order.tableNumber,
    productName: item.product.name,
  };

  emitToRoom('waiter', 'orderItemUpdated', payload);
  emitToRoom('tpv', 'orderItemUpdated', payload);
  emitToRoom('kitchen', 'orderItemUpdated', payload);

  return { ...updated, finalPriceCents, finalPriceEuros: payload.finalPriceEuros };
}
