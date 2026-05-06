import { useState, useEffect, useCallback } from 'react';
import { StationHeader } from '../../components/StationHeader';
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
    await new Promise(r => setTimeout(r, 1200));
    setPaid(true);
    setPaying(false);
  }

  if (!order) {
    return (
      <div className="flex flex-col h-full">
        <StationHeader title="TPV / Caja" color="text-purple-400" icon="💳" />
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-zinc-500">
          <span className="text-4xl">💳</span>
          <span className="text-sm">Selecciona una mesa en el Camarero</span>
        </div>
      </div>
    );
  }

  if (paid) {
    return (
      <div className="flex flex-col h-full">
        <StationHeader title="TPV / Caja" subtitle={`Mesa ${order.tableNumber}`} color="text-purple-400" icon="💳" />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <span className="text-6xl">✅</span>
          <p className="text-xl font-bold text-green-400">¡Cobrado!</p>
          <p className="text-3xl font-mono font-bold">{total?.totalEuros} €</p>
          <p className="text-xs text-zinc-400 mt-1">Mesa {order.tableNumber} · {order.items.length} líneas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <StationHeader
        title="TPV / Caja"
        subtitle={`Mesa ${order.tableNumber} · ${order.items.length} línea${order.items.length !== 1 ? 's' : ''}`}
        color="text-purple-400"
        icon="💳"
      />

      <div className="flex-1 overflow-auto p-3 space-y-1.5">
        {order.items.map(item => {
          const isWeighed = item.product.isWeighed;
          const weightUsed = item.finalWeightGrams ?? item.estimatedWeightGrams;
          const priceCents = isWeighed && weightUsed != null && item.pricePerKg != null
            ? Math.round((item.pricePerKg * weightUsed) / 1000)
            : (item.priceFixed ?? 0);
          const isEstimated = isWeighed && item.finalWeightGrams == null;

          return (
            <div key={item.id} className={[
              'flex items-center gap-2 rounded-xl px-3 py-2',
              isEstimated ? 'bg-yellow-900/20 border border-yellow-600/30' : 'bg-brand-surface',
            ].join(' ')}>
              <div className="flex-1 min-w-0">
                <span className="text-sm truncate block">{item.product.name}</span>
                {isWeighed && (
                  <span className="text-xs">
                    {item.finalWeightGrams != null
                      ? <span className="text-green-400">{item.finalWeightGrams}g ✓</span>
                      : <span className="text-yellow-400">~{item.estimatedWeightGrams}g estimado ⚠️</span>}
                  </span>
                )}
              </div>
              <span className={`font-mono tabular-nums text-sm font-medium flex-shrink-0 ${isEstimated ? 'text-yellow-300' : 'text-white'}`}>
                {(priceCents / 100).toFixed(2)} €
              </span>
            </div>
          );
        })}
      </div>

      {total?.requiresWeighingWarning && (
        <div className="mx-3 mb-2 bg-yellow-900/30 border border-yellow-600/60 rounded-xl p-3 text-xs">
          <p className="text-yellow-300 font-medium mb-0.5">⚠️ Precio estimado — falta pesar:</p>
          <p className="text-yellow-400">{total.unweighedItems.join(', ')}</p>
        </div>
      )}

      <div className="border-t border-brand-border p-4 bg-zinc-900/50">
        <div className="flex justify-between items-baseline mb-3">
          <span className="text-zinc-400 text-sm uppercase tracking-widest">Total</span>
          <span className={`text-3xl font-bold font-mono ${total?.requiresWeighingWarning ? 'text-yellow-300' : 'text-white'}`}>
            {total ? `${total.totalEuros} €` : '—'}
          </span>
        </div>
        <button
          onClick={() => void handlePay()}
          disabled={!total || !!total.requiresWeighingWarning || paying}
          className={[
            'w-full font-bold py-3 rounded-xl text-lg transition-all',
            total?.requiresWeighingWarning
              ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-600/40 cursor-not-allowed'
              : paying
              ? 'bg-purple-700 text-white cursor-wait'
              : 'bg-purple-600 hover:bg-purple-500 active:scale-95 text-white shadow-lg',
          ].join(' ')}
        >
          {paying ? '⏳ Procesando...' : total?.requiresWeighingWarning ? '⚠️ Esperando pesaje...' : '💳 COBRAR'}
        </button>
      </div>
    </div>
  );
}
