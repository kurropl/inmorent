import { Router } from 'express';
import { getActiveProducts } from './product.service';

export const productRouter = Router();

productRouter.get('/', async (_req, res, next) => {
  try {
    const products = await getActiveProducts();
    res.json(products);
  } catch (err) { next(err); }
});
