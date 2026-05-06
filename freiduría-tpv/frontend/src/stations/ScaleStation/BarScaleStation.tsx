import { useState } from 'react';
import { StationHeader } from '../../components/StationHeader';
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

export function BarScaleStation({ orders, onWeightUpdate, onRefresh }: Props) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeMsg, setBarcodeMsg] = useState('');
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
      .filter(i => i.product.destination === 'BAR' && i.status !== 'SERVED')
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
    setBarcodeMsg('');
    const parsed = parseWeightBarcode(barcodeInput.trim());
    if (!parsed) { setBarcodeMsg('❌ EAN-13 no válido'); setBarcodeInput(''); return; }

    if (pendingWeigh.length > 0) {
      setManualGrams(m => ({ ...m, [pendingWeigh[0].id]: String(parsed.weightGrams) }));
      setBarcodeMsg(`✓ ${parsed.weightGrams}g cargado`);
    } else {
      setBarcodeMsg(`⚠️ ${parsed.weightGrams}g — sin items pendientes`);
    }
    setBarcodeInput('');
  }

  return (
    <div className="flex flex-col h-full">
      <StationHeader
        title="Barra + Balanza"
        subtitle={`${pendingWeigh.length} pte. pesaje · ${barItems.length} en barra`}
        color="text-blue-400"
        icon="⚖️"
      />

      {/* EAN-13 scanner */}
      <div className="p-3 border-b border-brand-border bg-zinc-900/50">
        <p className="text-xs text-zinc-500 mb-2 uppercase tracking-widest">Lector EAN-13 / Balanza</p>
        <form onSubmit={handleBarcode} className="flex gap-2">
          <input
            value={barcodeInput}
            onChange={e => setBarcodeInput(e.target.value)}
            placeholder="Escanear código EAN-13..."
            className="flex-1 bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-blue-500"
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
            Leer
          </button>
        </form>
        {barcodeMsg && <p className="text-xs mt-1 text-zinc-400">{barcodeMsg}</p>}
        <p className="text-xs text-zinc-600 mt-1">Demo: <span className="font-mono">2012345002609</span> = 260g</p>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Pending weighing */}
        {pendingWeigh.length > 0 && (
          <div className="p-3 border-b border-brand-border">
            <p className="text-xs text-zinc-400 uppercase tracking-widest mb-2">⚖️ Pendiente pesar ({pendingWeigh.length})</p>
            <div className="space-y-2">
              {pendingWeigh.map(item => (
                <div key={item.id} className="bg-brand-surface rounded-xl border border-yellow-600/40 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold bg-orange-900/50 text-orange-300 rounded px-2 py-0.5">Mesa {item.tableNumber}</span>
                    <span className="font-semibold text-sm">{item.product.name}</span>
                    <span className="text-xs text-zinc-500 ml-auto">~{item.estimatedWeightGrams}g</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number" placeholder="Peso real (g)" min="1"
                      value={manualGrams[item.id] ?? ''}
                      onChange={e => setManualGrams(m => ({ ...m, [item.id]: e.target.value }))}
                      className="flex-1 bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-1.5 text-sm text-center font-mono focus:outline-none focus:border-green-500"
                    />
                    <button
                      onClick={() => void submitWeight(item.id)}
                      disabled={!manualGrams[item.id] || submitting === item.id}
                      className="bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg text-sm font-bold"
                    >
                      {submitting === item.id ? '…' : '✓ Pesar'}
                    </button>
                  </div>
                  {manualGrams[item.id] && item.product.pricePerKg != null && (
                    <p className="text-xs text-green-400 mt-1.5">
                      → {((item.product.pricePerKg * parseInt(manualGrams[item.id])) / 1000 / 100).toFixed(2)} €
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bar items */}
        <div className="p-3">
          <p className="text-xs text-zinc-400 uppercase tracking-widest mb-2">🍺 Barra ({barItems.length})</p>
          {barItems.length === 0
            ? <p className="text-zinc-600 text-sm">Sin pedidos en barra</p>
            : (
              <div className="space-y-1.5">
                {barItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-brand-surface rounded-lg px-3 py-2">
                    <div>
                      <span className="text-xs font-bold text-brand-orange mr-2">Mesa {item.tableNumber}</span>
                      <span className="text-sm">{item.product.name}</span>
                    </div>
                    <span className="font-mono text-sm text-zinc-300">{((item.priceFixed ?? 0) / 100).toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
