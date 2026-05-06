import { useState } from 'react';
import { useOrders } from './hooks/useOrders';
import { WaiterStation } from './stations/WaiterStation/WaiterStation';
import { KitchenDisplay } from './stations/KitchenDisplay/KitchenDisplay';
import { BarScaleStation } from './stations/ScaleStation/BarScaleStation';
import { CashRegister } from './stations/CashRegister/CashRegister';

export default function App() {
  const { orders, products, refresh, updateItemWeight } = useOrders();
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const activeOrder = orders.find(o => o.id === activeOrderId) ?? null;

  return (
    <div className="min-h-screen bg-brand-dark text-white font-sans select-none">
      <header className="bg-brand-surface border-b border-brand-border px-6 py-3 flex items-center gap-3">
        <span className="text-2xl">🍤</span>
        <h1 className="text-xl font-bold tracking-tight text-brand-orange">
          Bar Freiduría Javi Benítez
        </h1>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${orders.length > 0 ? 'bg-green-400 animate-pulse' : 'bg-zinc-600'}`} />
            <span className="text-xs text-zinc-400">{orders.length} mesa{orders.length !== 1 ? 's' : ''} abiertas</span>
          </div>
          <span className="text-xs font-mono text-zinc-600 border border-zinc-700 rounded px-2 py-0.5">TPV v1.0</span>
        </div>
      </header>

      <div className="grid grid-cols-2 grid-rows-2" style={{ height: 'calc(100vh - 56px)' }}>
        <div className="border-r border-b border-brand-border overflow-auto">
          <WaiterStation orders={orders} products={products} activeOrderId={activeOrderId} onSelectOrder={setActiveOrderId} onRefresh={refresh} />
        </div>
        <div className="border-b border-brand-border overflow-auto">
          <KitchenDisplay orders={orders} onRefresh={refresh} />
        </div>
        <div className="border-r border-brand-border overflow-auto">
          <BarScaleStation orders={orders} onWeightUpdate={updateItemWeight} onRefresh={refresh} />
        </div>
        <div className="overflow-auto">
          <CashRegister order={activeOrder} onRefresh={refresh} />
        </div>
      </div>
    </div>
  );
}
