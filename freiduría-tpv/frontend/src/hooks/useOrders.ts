import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { Order, Product } from '../types';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [o, p] = await Promise.all([api.getOrders(), api.getProducts()]);
    setOrders(o);
    setProducts(p);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const updateItemWeight = useCallback((itemId: string, finalWeightGrams: number) => {
    setOrders(prev =>
      prev.map(order => ({
        ...order,
        items: order.items.map(item =>
          item.id === itemId
            ? { ...item, finalWeightGrams, status: 'WEIGHED' as const }
            : item
        ),
      }))
    );
  }, []);

  return { orders, products, loading, refresh, updateItemWeight };
}
