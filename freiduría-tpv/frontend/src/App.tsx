import { useState } from 'react';
import { useOrders } from './hooks/useOrders';

// Lazy station imports — create empty placeholder components for now
// They will be replaced by full implementations in the next tasks
function PlaceholderStation({ name, color }: { name: string; color: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <span className={`text-sm font-medium ${color}`}>{name}</span>
    </div>
  );
}

export default function App() {
  const { orders, products: _products, refresh: _refresh, updateItemWeight: _updateItemWeight } = useOrders();
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  // Suppress unused-variable errors for state/handlers wired up in future station components
  void _products; void _refresh; void _updateItemWeight; void activeOrderId; void setActiveOrderId;

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
          <PlaceholderStation name="🧑‍🍳 Camarero" color="text-brand-orange" />
        </div>
        <div className="border-b border-brand-border overflow-auto">
          <PlaceholderStation name="🔥 Cocina KDS" color="text-red-400" />
        </div>
        <div className="border-r border-brand-border overflow-auto">
          <PlaceholderStation name="⚖️ Barra + Balanza" color="text-blue-400" />
        </div>
        <div className="overflow-auto">
          <PlaceholderStation name="💳 TPV / Caja" color="text-purple-400" />
        </div>
      </div>
    </div>
  );
}
