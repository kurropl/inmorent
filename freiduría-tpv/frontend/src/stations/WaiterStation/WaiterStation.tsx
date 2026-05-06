import { useState } from 'react';
import { StationHeader } from '../../components/StationHeader';
import { PriceTag } from '../../components/PriceTag';
import { api } from '../../lib/api';
import type { Order, Product } from '../../types';

interface Props {
  orders: Order[];
  products: Product[];
  activeOrderId: string | null;
  onSelectOrder: (id: string) => void;
  onRefresh: () => void;
}

const TABLES = Array.from({ length: 10 }, (_, i) => i + 1);

export function WaiterStation({ orders, products, activeOrderId, onSelectOrder, onRefresh }: Props) {
  const [weightInput, setWeightInput] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<string | null>(null);

  const categories = [...new Set(products.map(p => p.category))];
  const activeOrder = orders.find(o => o.id === activeOrderId);

  async function openTable(tableNumber: number) {
    const existing = orders.find(o => o.tableNumber === tableNumber && o.status === 'OPEN');
    if (existing) { onSelectOrder(existing.id); return; }
    const order = await api.createOrder(tableNumber);
    await onRefresh();
    onSelectOrder(order.id);
  }

  async function addItem(product: Product) {
    if (!activeOrderId) return;
    const grams = product.isWeighed
      ? parseInt(weightInput[product.id] ?? '250', 10)
      : undefined;
    if (product.isWeighed && (!grams || grams <= 0)) return;
    setAdding(product.id);
    try {
      await api.addItem(activeOrderId, product.id, grams);
      await onRefresh();
      if (product.isWeighed) setWeightInput(w => ({ ...w, [product.id]: '' }));
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <StationHeader title="Camarero" subtitle="Selecciona mesa → añade productos" icon="🧑‍🍳" />

      {/* Table grid */}
      <div className="p-3 border-b border-brand-border">
        <p className="text-xs text-zinc-400 mb-2 uppercase tracking-widest">Mesas</p>
        <div className="grid grid-cols-5 gap-1.5">
          {TABLES.map(n => {
            const isOpen = orders.some(o => o.tableNumber === n && o.status === 'OPEN');
            const isActive = activeOrder?.tableNumber === n;
            return (
              <button
                key={n}
                onClick={() => openTable(n)}
                className={[
                  'rounded-lg py-2.5 text-sm font-bold transition-all',
                  isActive
                    ? 'bg-orange-500 text-white shadow-lg scale-105'
                    : isOpen
                    ? 'bg-yellow-900/40 text-yellow-300 border border-yellow-600/60 hover:bg-yellow-900/60'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white',
                ].join(' ')}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* Product catalog */}
      {activeOrderId ? (
        <div className="flex-1 overflow-auto p-3 space-y-5">
          {categories.map(cat => (
            <div key={cat}>
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2 font-semibold">
                {cat}
              </p>
              <div className="space-y-1.5">
                {products.filter(p => p.category === cat).map(product => (
                  <div
                    key={product.id}
                    className="flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2 hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{product.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          product.destination === 'KITCHEN'
                            ? 'bg-red-900/40 text-red-300'
                            : 'bg-blue-900/40 text-blue-300'
                        }`}>
                          {product.destination === 'KITCHEN' ? 'Cocina' : 'Barra'}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {product.isWeighed ? (
                          <PriceTag cents={product.pricePerKg!} suffix="/kg" className="text-green-400" />
                        ) : (
                          <PriceTag cents={product.priceFixed!} className="text-zinc-300" />
                        )}
                      </div>
                    </div>

                    {product.isWeighed && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          placeholder="g"
                          min="1"
                          value={weightInput[product.id] ?? ''}
                          onChange={e => setWeightInput(w => ({ ...w, [product.id]: e.target.value }))}
                          className="w-16 bg-zinc-700 border border-zinc-600 rounded-lg px-2 py-1 text-sm text-center font-mono focus:outline-none focus:border-orange-500"
                        />
                        <span className="text-xs text-zinc-500">g</span>
                      </div>
                    )}

                    <button
                      onClick={() => addItem(product)}
                      disabled={adding === product.id}
                      className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-sm font-bold transition-colors min-w-[36px]"
                    >
                      {adding === product.id ? '…' : '+'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-zinc-500">
          <span className="text-3xl">👆</span>
          <span className="text-sm">Selecciona una mesa para comenzar</span>
        </div>
      )}

      {/* Current order summary */}
      {activeOrder && activeOrder.items.length > 0 && (
        <div className="border-t border-brand-border p-3 bg-zinc-900/50">
          <p className="text-xs text-zinc-400 mb-2">
            Mesa {activeOrder.tableNumber} · {activeOrder.items.length} línea{activeOrder.items.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-1 max-h-28 overflow-auto">
            {activeOrder.items.map(item => (
              <div key={item.id} className="flex justify-between items-center text-xs">
                <span className="text-zinc-300 truncate flex-1">{item.product.name}</span>
                <span className={`font-mono ml-2 ${
                  item.status === 'WEIGHED' ? 'text-green-400' :
                  item.status === 'SERVED' ? 'text-zinc-500' : 'text-yellow-400'
                }`}>
                  {item.product.isWeighed
                    ? item.finalWeightGrams
                      ? `${item.finalWeightGrams}g ✓`
                      : `~${item.estimatedWeightGrams}g`
                    : `${((item.priceFixed ?? 0) / 100).toFixed(2)}€`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
