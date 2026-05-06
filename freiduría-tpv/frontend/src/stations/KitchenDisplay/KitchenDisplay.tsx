import { useEffect, useState } from 'react';
import { StationHeader } from '../../components/StationHeader';
import { useSocket } from '../../hooks/useSocket';
import type { Order, OrderItem } from '../../types';

interface Props { orders: Order[]; onRefresh: () => void; }
type TicketItem = OrderItem & { tableNumber: number; orderId: string };

function ElapsedTimer({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(since).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const urgent = elapsed > 300;
  const warning = elapsed > 120;

  return (
    <span className={`font-mono text-xs tabular-nums px-1.5 py-0.5 rounded ${
      urgent ? 'bg-red-900/50 text-red-300' :
      warning ? 'bg-yellow-900/50 text-yellow-300' :
      'bg-zinc-700 text-zinc-400'
    }`}>
      {mins}:{secs.toString().padStart(2, '0')}
    </span>
  );
}

export function KitchenDisplay({ orders, onRefresh }: Props) {
  useSocket('kitchen', {
    newOrderItem: () => onRefresh(),
    orderItemUpdated: () => onRefresh(),
  });

  const tickets: TicketItem[] = orders.flatMap(order =>
    order.items
      .filter(i => i.product.destination === 'KITCHEN' && i.status !== 'SERVED')
      .map(i => ({ ...i, tableNumber: order.tableNumber, orderId: order.id }))
  ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const pending = tickets.filter(t => t.status === 'PENDING').length;

  return (
    <div className="flex flex-col h-full">
      <StationHeader
        title="Cocina"
        subtitle={pending > 0 ? `${pending} pendiente${pending !== 1 ? 's' : ''}` : 'Todo al día ✓'}
        color="text-red-400"
        icon="🔥"
      />

      <div className="flex-1 overflow-auto p-3 space-y-2">
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-zinc-500">
            <span className="text-4xl">✅</span>
            <span className="text-sm">Sin comandas pendientes</span>
          </div>
        ) : (
          tickets.map(item => (
            <div
              key={item.id}
              className={[
                'rounded-xl border p-3 transition-all',
                item.status === 'WEIGHED'
                  ? 'border-green-600/60 bg-green-900/10'
                  : item.product.isWeighed
                  ? 'border-orange-600/60 bg-orange-900/10'
                  : 'border-brand-border bg-brand-surface',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold bg-orange-900/50 text-orange-300 rounded px-2 py-0.5">
                    Mesa {item.tableNumber}
                  </span>
                  <ElapsedTimer since={item.createdAt} />
                  {item.product.isWeighed && (
                    <span className="text-xs bg-purple-900/40 text-purple-300 rounded px-1.5 py-0.5">
                      ⚖️ Pesar
                    </span>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${
                  item.status === 'WEIGHED' ? 'bg-green-900 text-green-300' :
                  item.status === 'SERVED' ? 'bg-zinc-700 text-zinc-400' :
                  'bg-zinc-700 text-zinc-300'
                }`}>
                  {item.status === 'WEIGHED' ? '✓ Pesado' :
                   item.status === 'SERVED' ? 'Servido' : 'Pendiente'}
                </span>
              </div>

              <p className="font-semibold text-white">{item.product.name}</p>

              {item.product.isWeighed && (
                <div className="mt-1 text-xs text-zinc-400 flex gap-3">
                  <span>Pedido: <span className="text-yellow-300">~{item.estimatedWeightGrams}g</span></span>
                  {item.finalWeightGrams && (
                    <span>Real: <span className="text-green-300 font-medium">{item.finalWeightGrams}g</span></span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
