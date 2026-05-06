import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { api } from '../../lib/api';
import type { Order, OrderTotal } from '../../types';

interface Props { order: Order | null; onRefresh: () => void; }

export function CashRegister({ order, onRefresh }: Props) {
  const [total, setTotal] = useState<OrderTotal | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  const fetchTotal = useCallback(async (orderId: string) => {
    const t = await api.getOrderTotal(orderId);
    setTotal(t);
  }, []);

  useSocket('tpv', {
    orderItemUpdated: () => {
      if (order) void fetchTotal(order.id);
      void onRefresh();
    },
  });

  useEffect(() => {
    setPaid(false);
    if (order) void fetchTotal(order.id);
    else setTotal(null);
  }, [order?.id, order?.items.length, fetchTotal]);

  async function handlePay() {
    if (!order || total?.requiresWeighingWarning) return;
    setPaying(true);
    await new Promise(r => setTimeout(r, 1000));
    setPaid(true);
    setPaying(false);
  }

  // No order selected
  if (!order) {
    return (
      <div className="flex flex-col h-full bg-zinc-950">
        <div className="flex-none bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 flex items-center gap-2">
          <span className="text-base">💳</span>
          <span className="font-semibold text-sm text-white">TPV / Caja</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
          <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center text-3xl">💳</div>
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-400">Selecciona una mesa</p>
            <p className="text-xs text-zinc-600 mt-1">en el panel Camarero para ver la cuenta</p>
          </div>
        </div>
      </div>
    );
  }

  // Paid success
  if (paid) {
    return (
      <div className="flex flex-col h-full bg-zinc-950">
        <div className="flex-none bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 flex items-center gap-2">
          <span className="text-base">💳</span>
          <span className="font-semibold text-sm text-white">TPV / Caja</span>
          <span className="ml-auto text-xs text-emerald-400 font-medium">Mesa {order.tableNumber}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 bg-emerald-950/20">
          <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/30 rounded-3xl flex items-center justify-center text-4xl">
            ✅
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-emerald-400">¡Cobrado!</p>
            <p className="text-4xl font-black font-mono mt-2 text-white">{total?.totalEuros} €</p>
            <p className="text-xs text-zinc-500 mt-2">Mesa {order.tableNumber} · {order.items.length} líneas</p>
          </div>
        </div>
      </div>
    );
  }

  const canPay = total && !total.requiresWeighingWarning && !paying;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex-none bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 flex items-center gap-2">
        <span className="text-base">💳</span>
        <span className="font-semibold text-sm text-white">TPV / Caja</span>
        <span className="ml-auto text-xs font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-full px-2.5 py-0.5">
          Mesa {order.tableNumber}
        </span>
      </div>

      {/* Line items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {order.items.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-zinc-600 text-sm">
            Añade productos desde el Camarero
          </div>
        ) : (
          order.items.map(item => {
            const isWeighed = item.product.isWeighed;
            const weightUsed = item.finalWeightGrams ?? item.estimatedWeightGrams;
            const priceCents = isWeighed && weightUsed != null && item.pricePerKg != null
              ? Math.round((item.pricePerKg * weightUsed) / 1000)
              : (item.priceFixed ?? 0);
            const isEstimated = isWeighed && item.finalWeightGrams == null;

            return (
              <div
                key={item.id}
                className={[
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 border',
                  isEstimated
                    ? 'bg-amber-500/5 border-amber-500/25'
                    : 'bg-zinc-900 border-zinc-800',
                ].join(' ')}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{item.product.name}</p>
                  {isWeighed && (
                    <p className="text-xs mt-0.5">
                      {item.finalWeightGrams != null
                        ? <span className="text-emerald-400 font-medium">{item.finalWeightGrams}g pesado ✓</span>
                        : <span className="text-amber-400 font-medium">~{item.estimatedWeightGrams}g estimado ⚠️</span>
                      }
                    </p>
                  )}
                </div>
                <span className={`font-mono text-sm font-bold flex-none ${isEstimated ? 'text-amber-300' : 'text-white'}`}>
                  {(priceCents / 100).toFixed(2)} €
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Warning banner */}
      {total?.requiresWeighingWarning && (
        <div className="flex-none mx-3 mb-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
          <p className="text-xs font-bold text-amber-300 mb-1">⚠️ Falta pesaje definitivo</p>
          <p className="text-xs text-amber-400/70">{total.unweighedItems.join(' · ')}</p>
        </div>
      )}

      {/* Total + Pay button */}
      <div className="flex-none border-t border-zinc-800 bg-zinc-900 p-4">
        <div className="flex justify-between items-baseline mb-4">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Total</span>
          <span className={`text-4xl font-black font-mono ${
            total?.requiresWeighingWarning ? 'text-amber-300' : 'text-white'
          }`}>
            {total ? `${total.totalEuros} €` : '—'}
          </span>
        </div>

        <button
          onClick={() => void handlePay()}
          disabled={!canPay}
          className={[
            'w-full py-4 rounded-2xl text-base font-black transition-all tracking-wide uppercase',
            canPay
              ? 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 active:scale-95'
              : total?.requiresWeighingWarning
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 cursor-not-allowed'
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
          ].join(' ')}
        >
          {paying
            ? '⏳ Procesando...'
            : total?.requiresWeighingWarning
            ? '⚠️ Esperando pesaje'
            : '💳 Cobrar'}
        </button>
      </div>
    </div>
  );
}
