import { useEffect, useState } from 'react';
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
    <span className={`inline-flex items-center gap-1 font-mono text-xs tabular-nums px-2 py-0.5 rounded-full font-medium ${
      urgent ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
      warning ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
      'bg-zinc-700 text-zinc-400 border border-zinc-600/50'
    }`}>
      {urgent ? '🔴' : warning ? '🟡' : '🟢'}
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

  const pendingCount = tickets.filter(t => t.status === 'PENDING').length;
  const weighedCount = tickets.filter(t => t.status === 'WEIGHED').length;

  // Group tickets by table
  const byTable = tickets.reduce<Record<number, TicketItem[]>>((acc, item) => {
    acc[item.tableNumber] = [...(acc[item.tableNumber] ?? []), item];
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex-none bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 flex items-center gap-2">
        <span className="text-base">🔥</span>
        <span className="font-semibold text-sm text-white">Cocina</span>
        <div className="ml-auto flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30 rounded-full px-2.5 py-0.5">
              {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
            </span>
          )}
          {weighedCount > 0 && (
            <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full px-2.5 py-0.5">
              {weighedCount} listo{weighedCount !== 1 ? 's' : ''}
            </span>
          )}
          {tickets.length === 0 && (
            <span className="text-xs text-emerald-400 font-medium">✓ Todo al día</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {Object.keys(byTable).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-600">
            <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center text-3xl">✅</div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-400">Sin comandas pendientes</p>
              <p className="text-xs text-zinc-600 mt-1">Cocina lista para nuevos pedidos</p>
            </div>
          </div>
        ) : (
          Object.entries(byTable).map(([tableNum, items]) => {
            const hasUrgent = items.some(i => {
              const elapsed = (Date.now() - new Date(i.createdAt).getTime()) / 1000;
              return elapsed > 300;
            });
            const hasWarning = !hasUrgent && items.some(i => {
              const elapsed = (Date.now() - new Date(i.createdAt).getTime()) / 1000;
              return elapsed > 120;
            });
            const oldestItem = items.reduce((oldest, i) =>
              new Date(i.createdAt) < new Date(oldest.createdAt) ? i : oldest
            );

            return (
              <div
                key={tableNum}
                className={[
                  'rounded-2xl border overflow-hidden',
                  hasUrgent ? 'border-red-500/40' :
                  hasWarning ? 'border-amber-500/40' :
                  'border-zinc-800',
                ].join(' ')}
              >
                {/* Ticket header */}
                <div className={[
                  'flex items-center justify-between px-4 py-2.5',
                  hasUrgent ? 'bg-red-500/10' :
                  hasWarning ? 'bg-amber-500/10' :
                  'bg-zinc-900',
                ].join(' ')}>
                  <div className="flex items-center gap-2.5">
                    <span className={`text-xl font-black ${
                      hasUrgent ? 'text-red-300' :
                      hasWarning ? 'text-amber-300' :
                      'text-orange-400'
                    }`}>
                      Mesa {tableNum}
                    </span>
                    <ElapsedTimer since={oldestItem.createdAt} />
                  </div>
                  <span className="text-xs text-zinc-500">{items.length} ítem{items.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Items */}
                <div className="bg-zinc-950 divide-y divide-zinc-800/60">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{item.product.name}</span>
                          {item.product.isWeighed && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20 font-bold">
                              ⚖️ PESAR
                            </span>
                          )}
                        </div>
                        {item.product.isWeighed && (
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Pedido: <span className="text-amber-300 font-medium">~{item.estimatedWeightGrams}g</span>
                            {item.finalWeightGrams != null && (
                              <span className="text-emerald-400 font-medium ml-2">Real: {item.finalWeightGrams}g ✓</span>
                            )}
                          </p>
                        )}
                      </div>
                      <span className={`flex-none text-xs font-bold px-2.5 py-1 rounded-full ${
                        item.status === 'WEIGHED'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
                      }`}>
                        {item.status === 'WEIGHED' ? '✓ Pesado' : 'En cocina'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
