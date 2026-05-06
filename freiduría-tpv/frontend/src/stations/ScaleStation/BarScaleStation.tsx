import { useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { api } from '../../lib/api';
import { parseWeightBarcode } from '../../lib/barcodeParser';
import type { Order, OrderItem } from '../../types';

interface Props {
  orders: Order[];
  onWeightUpdate: (itemId: string, grams: number) => void;
  onRefresh: () => void;
}

type PendingItem = OrderItem & { tableNumber: number };
type BarItem = OrderItem & { tableNumber: number };

function centsToEuros(c: number) { return (c / 100).toFixed(2); }
function calcPrice(pricePerKg: number, grams: number) {
  return (Math.round((pricePerKg * grams) / 1000) / 100).toFixed(2);
}

export function BarScaleStation({ orders, onWeightUpdate, onRefresh }: Props) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeMsg, setBarcodeMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [manualGrams, setManualGrams] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  useSocket('bar', { newOrderItem: () => void onRefresh() });
  useSocket('scale', { newOrderItem: () => void onRefresh() });

  const pendingWeigh: PendingItem[] = orders.flatMap(order =>
    order.items
      .filter(i => i.product.isWeighed && i.status === 'PENDING')
      .map(i => ({ ...i, tableNumber: order.tableNumber }))
  );

  const barItems: BarItem[] = orders.flatMap(order =>
    order.items
      .filter(i => i.product.destination === 'BAR' && !i.product.isWeighed && i.status !== 'SERVED')
      .map(i => ({ ...i, tableNumber: order.tableNumber }))
  );

  async function submitWeight(itemId: string) {
    const grams = parseInt(manualGrams[itemId] ?? '0', 10);
    if (!grams || grams <= 0) return;
    setSubmitting(itemId);
    try {
      await api.updateWeight(itemId, grams);
      onWeightUpdate(itemId, grams);
      await onRefresh();
      setManualGrams(m => { const n = { ...m }; delete n[itemId]; return n; });
    } finally {
      setSubmitting(null);
    }
  }

  function handleBarcode(e: React.FormEvent) {
    e.preventDefault();
    setBarcodeMsg(null);
    const parsed = parseWeightBarcode(barcodeInput.trim());
    if (!parsed) {
      setBarcodeMsg({ text: 'Código EAN-13 no válido', ok: false });
      setBarcodeInput('');
      return;
    }
    if (pendingWeigh.length > 0) {
      setManualGrams(m => ({ ...m, [pendingWeigh[0].id]: String(parsed.weightGrams) }));
      setBarcodeMsg({ text: `${parsed.weightGrams}g cargado en el primer ítem`, ok: true });
    } else {
      setBarcodeMsg({ text: `${parsed.weightGrams}g leídos — no hay ítems pendientes de pesaje`, ok: false });
    }
    setBarcodeInput('');
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex-none bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 flex items-center gap-2">
        <span className="text-base">⚖️</span>
        <span className="font-semibold text-sm text-white">Barra + Balanza</span>
        <div className="ml-auto flex items-center gap-2">
          {pendingWeigh.length > 0 && (
            <span className="text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-2.5 py-0.5">
              {pendingWeigh.length} sin pesar
            </span>
          )}
          {barItems.length > 0 && (
            <span className="text-xs font-medium bg-sky-500/15 text-sky-400 border border-sky-500/20 rounded-full px-2.5 py-0.5">
              {barItems.length} en barra
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* EAN-13 scanner */}
        <div className="p-3 border-b border-zinc-800 bg-zinc-900/50">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Lector EAN-13 / Balanza</p>
          <form onSubmit={handleBarcode} className="flex gap-2">
            <input
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              placeholder="Escanear o escribir código EAN-13..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 placeholder-zinc-600"
            />
            <button
              type="submit"
              className="flex-none bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
            >
              Leer
            </button>
          </form>
          {barcodeMsg && (
            <p className={`text-xs mt-1.5 font-medium flex items-center gap-1 ${barcodeMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {barcodeMsg.ok ? '✓' : '✗'} {barcodeMsg.text}
            </p>
          )}
          <p className="text-xs text-zinc-700 mt-1">Demo: <span className="font-mono text-zinc-500">2012345002609</span> = 260g</p>
        </div>

        {/* Pending weighing section */}
        {pendingWeigh.length > 0 && (
          <div className="p-3 border-b border-zinc-800">
            <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>⚖️</span> Pendiente pesar ({pendingWeigh.length})
            </p>
            <div className="space-y-2">
              {pendingWeigh.map(item => {
                const grams = manualGrams[item.id];
                const previewPrice = grams && item.product.pricePerKg != null
                  ? calcPrice(item.product.pricePerKg, parseInt(grams))
                  : null;

                return (
                  <div key={item.id} className="bg-zinc-900 rounded-2xl border border-amber-500/25 p-3">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-xs font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-lg px-2 py-0.5">
                        Mesa {item.tableNumber}
                      </span>
                      <span className="font-semibold text-sm text-white">{item.product.name}</span>
                      <span className="ml-auto text-xs text-zinc-500">~{item.estimatedWeightGrams}g est.</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          placeholder="Peso real"
                          min="1"
                          value={grams ?? ''}
                          onChange={e => setManualGrams(m => ({ ...m, [item.id]: e.target.value }))}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-center font-mono text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-medium pointer-events-none">g</span>
                      </div>
                      {previewPrice && (
                        <div className="flex-none text-center min-w-[64px]">
                          <p className="text-xs text-zinc-500">Precio</p>
                          <p className="text-sm font-bold text-emerald-400">{previewPrice} €</p>
                        </div>
                      )}
                      <button
                        onClick={() => void submitWeight(item.id)}
                        disabled={!grams || parseInt(grams) <= 0 || submitting === item.id}
                        className="flex-none bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                      >
                        {submitting === item.id ? '…' : '✓ Pesar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bar items */}
        <div className="p-3">
          <p className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span>🍺</span> Barra ({barItems.length})
          </p>
          {barItems.length === 0 ? (
            <p className="text-sm text-zinc-600 py-3 text-center">Sin pedidos en barra</p>
          ) : (
            <div className="space-y-1.5">
              {barItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-zinc-900 rounded-xl px-3 py-2.5 border border-zinc-800">
                  <span className="text-xs font-bold text-orange-400 flex-none">M{item.tableNumber}</span>
                  <span className="text-sm text-white flex-1 truncate">{item.product.name}</span>
                  <span className="font-mono text-sm font-semibold text-zinc-300 flex-none">
                    {centsToEuros(item.priceFixed ?? 0)} €
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
