import { Router } from 'express';
import { createOrder, getOrderById, getOpenOrders, calculateOrderTotal } from './order.service';
import { createOrderItem } from './orderItem.service';

export const orderRouter = Router();

orderRouter.get('/', async (_req, res, next) => {
  try { res.json(await getOpenOrders()); } catch (err) { next(err); }
});

orderRouter.post('/', async (req, res, next) => {
  try {
    const { tableNumber } = req.body;
    if (!tableNumber) return res.status(400).json({ error: 'tableNumber required' });
    res.status(201).json(await createOrder({ tableNumber }));
  } catch (err) { next(err); }
});

orderRouter.get('/:id', async (req, res, next) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) { next(err); }
});

orderRouter.get('/:id/total', async (req, res, next) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const total = calculateOrderTotal(order.items.map(i => ({
      ...i,
      isWeighed: i.product.isWeighed,
      productName: i.product.name,
    })));
    res.json(total);
  } catch (err) { next(err); }
});

orderRouter.post('/:id/items', async (req, res, next) => {
  try {
    const { productId, estimatedWeightGrams } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId required' });
    res.status(201).json(await createOrderItem({ orderId: req.params.id, productId, estimatedWeightGrams }));
  } catch (err) { next(err); }
});
