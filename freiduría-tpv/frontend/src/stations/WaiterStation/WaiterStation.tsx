import { useState } from 'react';
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

const CATEGORY_EMOJI: Record<string, string> = {
  Freiduras: '🐟',
  Mariscos: '🦐',
  Raciones: '🍽️',
  Bebidas: '🍺',
};

function centsToEuros(c: number) {
  return (c / 100).toFixed(2);
}

export function WaiterStation({ orders, products, activeOrderId, onSelectOrder, onRefresh }: Props) {
  const [weightInput, setWeightInput] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = [...new Set(products.map(p => p.category))];
  const activeOrder = orders.find(o => o.id === activeOrderId);
  const displayCategory = activeCategory ?? categories[0] ?? null;
  const visibleProducts = products.filter(p => p.category === displayCategory);

  async function openTable(tableNumber: number) {
    const existing = orders.find(o => o.tableNumber === tableNumber && o.status === 'OPEN');
    if (existing) { onSelectOrder(existing.id); return; }
    const order = await api.createOrder(tableNumber);
    await onRefresh();
    onSelectOrder(order.id);
  }

  async function addItem(product: Product) {
    if (!activeOrderId) return;
    const grams = product.isWeighed ? parseInt(weightInput[product.id] ?? '250', 10) : undefined;
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
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Panel header */}
      <div className="flex-none bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 flex items-center gap-2">
        <span className="text-base">🧑‍🍳</span>
        <span className="font-semibold text-sm text-white">Camarero</span>
        {activeOrder && (
          <span className="ml-auto text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-full px-2.5 py-0.5">
            Mesa {activeOrder.tableNumber}
          </span>
        )}
      </div>

      {/* Table grid */}
      <div className="flex-none p-3 border-b border-zinc-800">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Mesas</p>
        <div className="grid grid-cols-5 gap-1.5">
          {TABLES.map(n => {
            const order = orders.find(o => o.tableNumber === n && o.status === 'OPEN');
            const isActive = activeOrder?.tableNumber === n;
            const isOpen = !!order;
            const itemCount = order?.items.length ?? 0;

            return (
              <button
                key={n}
                onClick={() => openTable(n)}
                className={[
                  'relative rounded-xl py-2.5 text-sm font-bold transition-all active:scale-95',
                  isActive
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                    : isOpen
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/40 hover:bg-amber-500/20'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-zinc-700/50',
                ].join(' ')}
              >
                {n}
                {isOpen && itemCount > 0 && (
                  <span className={`absolute -top-1 -right-1 text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold text-[10px] ${
                    isActive ? 'bg-white text-orange-600' : 'bg-amber-500 text-white'
                  }`}>
                    {itemCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Catalog */}
      {activeOrderId ? (
        <>
          {/* Category tabs */}
          <div className="flex-none flex gap-1 px-3 py-2 border-b border-zinc-800 overflow-x-auto">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={[
                  'flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
                  (activeCategory ?? categories[0]) === cat
                    ? 'bg-orange-500 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white',
                ].join(' ')}
              >
                <span>{CATEGORY_EMOJI[cat] ?? '🍴'}</span>
                {cat}
              </button>
            ))}
          </div>

          {/* Product list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {visibleProducts.map(product => (
              <div
                key={product.id}
                className="flex items-center gap-2.5 bg-zinc-900 hover:bg-zinc-800 rounded-xl px-3 py-2.5 transition-colors border border-zinc-800 hover:border-zinc-700"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{product.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                      product.destination === 'KITCHEN'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                        : 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                    }`}>
                      {product.destination === 'KITCHEN' ? '🔥 Cocina' : '🍺 Barra'}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-400 mt-0.5 block">
                    {product.isWeighed
                      ? <span className="text-emerald-400 font-medium">{centsToEuros(product.pricePerKg!)} €/kg</span>
                      : <span className="text-zinc-300 font-medium">{centsToEuros(product.priceFixed!)} €</span>
                    }
                  </span>
                </div>

                {product.isWeighed && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="250"
                      min="1"
                      value={weightInput[product.id] ?? ''}
                      onChange={e => setWeightInput(w => ({ ...w, [product.id]: e.target.value }))}
                      className="w-14 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-center font-mono text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30"
                    />
                    <span className="text-xs text-zinc-500 font-medium">g</span>
                  </div>
                )}

                <button
                  onClick={() => void addItem(product)}
                  disabled={adding === product.id}
                  className="flex-none bg-orange-500 hover:bg-orange-400 active:bg-orange-600 disabled:opacity-40 text-white rounded-xl w-9 h-9 flex items-center justify-center text-lg font-bold transition-all active:scale-95 shadow-sm"
                >
                  {adding === product.id ? '·' : '+'}
                </button>
              </div>
            ))}
          </div>

          {/* Order summary */}
          {activeOrder && activeOrder.items.length > 0 && (
            <div className="flex-none border-t border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
                <span className="text-orange-400">▼</span>
                Mesa {activeOrder.tableNumber} · {activeOrder.items.length} línea{activeOrder.items.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {activeOrder.items.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-xs py-0.5">
                    <span className="text-zinc-300 truncate flex-1 mr-2">{item.product.name}</span>
                    <span className={`font-mono font-medium flex-none ${
                      item.status === 'WEIGHED' ? 'text-emerald-400' :
                      item.product.isWeighed ? 'text-amber-400' : 'text-zinc-300'
                    }`}>
                      {item.product.isWeighed
                        ? item.finalWeightGrams ? `${item.finalWeightGrams}g ✓` : `~${item.estimatedWeightGrams}g`
                        : `${centsToEuros(item.priceFixed ?? 0)} €`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-600 p-6">
          <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center text-2xl">👆</div>
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-400">Selecciona una mesa</p>
            <p className="text-xs text-zinc-600 mt-1">o toca una libre para abrir nueva comanda</p>
          </div>
        </div>
      )}
    </div>
  );
}
