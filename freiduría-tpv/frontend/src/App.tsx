import { useState } from 'react';
import { useOrders } from './hooks/useOrders';
import { WaiterStation } from './stations/WaiterStation/WaiterStation';
import { KitchenDisplay } from './stations/KitchenDisplay/KitchenDisplay';

function ComingSoon({ name, color, icon }: { name: string; color: string; icon: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <span className="text-4xl">{icon}</span>
      <span className={`text-sm font-medium ${color}`}>{name}</span>
      <span className="text-xs text-zinc-500">Próximamente...</span>
    </div>
  );
}

export default function App() {
  const { orders, products, refresh, updateItemWeight } = useOrders();
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  void updateItemWeight; // will be used in BarScaleStation

  return (
    <div className="min-h-screen bg-brand-dark text-white font-sans">
      <header className="bg-brand-surface border-b border-brand-border px-6 py-3 flex items-center gap-3">
        <span className="text-2xl">🍤</span>
        <h1 className="text-xl font-bold tracking-tight text-brand-orange">
          Bar Freiduría Javi Benítez
        </h1>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-zinc-400">
            {orders.length} mesa{orders.length !== 1 ? 's' : ''} abiertas
          </span>
          <span className="text-xs font-mono text-zinc-500">TPV v1.0</span>
        </div>
      </header>

      <div className="grid grid-cols-2 grid-rows-2" style={{ height: 'calc(100vh - 56px)' }}>
        <div className="border-r border-b border-brand-border overflow-auto">
          <WaiterStation
            orders={orders}
            products={products}
            activeOrderId={activeOrderId}
            onSelectOrder={setActiveOrderId}
            onRefresh={refresh}
          />
        </div>
        <div className="border-b border-brand-border overflow-auto">
          <KitchenDisplay orders={orders} onRefresh={refresh} />
        </div>
        <div className="border-r border-brand-border overflow-auto">
          <ComingSoon name="Barra + Balanza" color="text-blue-400" icon="⚖️" />
        </div>
        <div className="overflow-auto">
          <ComingSoon name="TPV / Caja" color="text-purple-400" icon="💳" />
        </div>
      </div>
    </div>
  );
}
