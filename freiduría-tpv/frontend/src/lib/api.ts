import type { Order, OrderItem, OrderTotal, Product } from '../types';

// En dev: '' + '/api' = '/api' (proxy de Vite lo redirige a localhost:3001)
// En prod: '/fryshop' + '/api' = '/fryshop/api' (Caddy strip → /api en backend)
const BASE_PATH = import.meta.env.VITE_BASE_PATH ?? '';
const BASE = `${BASE_PATH}/api`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  getProducts: () => request<Product[]>('/products'),
  getOrders: () => request<Order[]>('/orders'),
  createOrder: (tableNumber: number) =>
    request<Order>('/orders', { method: 'POST', body: JSON.stringify({ tableNumber }) }),
  addItem: (orderId: string, productId: string, estimatedWeightGrams?: number) =>
    request<OrderItem>(`/orders/${orderId}/items`, {
      method: 'POST',
      body: JSON.stringify({ productId, estimatedWeightGrams }),
    }),
  getOrderTotal: (orderId: string) => request<OrderTotal>(`/orders/${orderId}/total`),
  updateWeight: (itemId: string, finalWeightGrams: number) =>
    request(`/weighing/items/${itemId}/weight`, {
      method: 'PATCH',
      body: JSON.stringify({ finalWeightGrams }),
    }),
};
