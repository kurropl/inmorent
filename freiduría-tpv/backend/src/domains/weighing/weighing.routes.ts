import { Router } from 'express';
import { updateFinalWeight } from '../orders/orderItem.service';
import { parseWeightBarcode } from './barcode.parser';

export const weighingRouter = Router();

weighingRouter.patch('/items/:itemId/weight', async (req, res, next) => {
  try {
    const { finalWeightGrams } = req.body;
    if (!finalWeightGrams || finalWeightGrams <= 0)
      return res.status(400).json({ error: 'finalWeightGrams must be > 0' });
    res.json(await updateFinalWeight(req.params.itemId, finalWeightGrams));
  } catch (err) { next(err); }
});

weighingRouter.post('/barcode', (req, res) => {
  const { barcode } = req.body;
  if (!barcode) return res.status(400).json({ error: 'barcode required' });
  const parsed = parseWeightBarcode(barcode);
  if (!parsed) return res.status(422).json({ error: 'Invalid variable-weight EAN-13 barcode' });
  res.json(parsed);
});
