import express from 'express';
import cors from 'cors';
import path from 'path';
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

  // En producción, sirve el frontend compilado (copiado a /app/public por el Dockerfile)
  if (process.env.NODE_ENV === 'production') {
    const publicDir = path.join(__dirname, '../../../public');
    app.use(express.static(publicDir));
    // SPA fallback: cualquier ruta no-API devuelve index.html
    app.get('*', (_req, res) => {
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

  return app;
}
