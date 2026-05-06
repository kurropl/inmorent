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
  const openCount = orders.filter(o => o.status === 'OPEN').length;

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-white overflow-hidden" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header className="flex-none bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-base">🍤</div>
          <div>
            <h1 className="text-sm font-bold leading-tight text-white">Bar Freiduría Javi Benítez</h1>
            <p className="text-xs text-zinc-500 leading-tight">Sistema TPV</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {openCount > 0 ? (
            <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/30 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-xs font-medium text-orange-300">{openCount} mesa{openCount !== 1 ? 's' : ''} activa{openCount !== 1 ? 's' : ''}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-zinc-800 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
              <span className="text-xs text-zinc-500">Sin mesas abiertas</span>
            </div>
          )}
          <span className="text-xs font-mono text-zinc-600 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5">v1.0</span>
        </div>
      </header>

      {/* 2×2 grid */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 overflow-hidden">
        {/* Top-left: Camarero */}
        <div className="border-r border-b border-zinc-800 overflow-hidden flex flex-col">
          <WaiterStation
            orders={orders}
            products={products}
            activeOrderId={activeOrderId}
            onSelectOrder={setActiveOrderId}
            onRefresh={refresh}
          />
        </div>

        {/* Top-right: Cocina */}
        <div className="border-b border-zinc-800 overflow-hidden flex flex-col">
          <KitchenDisplay orders={orders} onRefresh={refresh} />
        </div>

        {/* Bottom-left: Barra + Balanza */}
        <div className="border-r border-zinc-800 overflow-hidden flex flex-col">
          <BarScaleStation orders={orders} onWeightUpdate={updateItemWeight} onRefresh={refresh} />
        </div>

        {/* Bottom-right: TPV/Caja */}
        <div className="overflow-hidden flex flex-col">
          <CashRegister order={activeOrder} onRefresh={refresh} />
        </div>
      </div>
    </div>
  );
}
