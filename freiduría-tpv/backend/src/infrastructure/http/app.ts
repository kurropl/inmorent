import express from 'express';
import cors from 'cors';
import { productRouter } from '../../domains/products/product.routes';
import { orderRouter } from '../../domains/orders/order.routes';
import { weighingRouter } from '../../domains/weighing/weighing.routes';

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'freiduria-tpv' }));
  app.use('/api/products', productRouter);
  app.use('/api/orders', orderRouter);
  app.use('/api/weighing', weighingRouter);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

  return app;
}
