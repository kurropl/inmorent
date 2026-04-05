"use client";

// TODO: Implement full Leaflet map for production
// MVP placeholder — install: npm install leaflet react-leaflet @types/leaflet

export interface MapItem {
  id: number;
  lat: number;
  lon: number;
  titulo: string | null;
  precio: number | null;
  puntuacion: number | null;
  url: string;
}

interface MapViewProps {
  items: MapItem[];
}

export default function MapView({ items }: MapViewProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col items-center justify-center min-h-[300px] text-center">
      <div className="text-4xl mb-3">🗺️</div>
      <h3 className="text-lg font-semibold text-gray-200 mb-1">Mapa de oportunidades</h3>
      <p className="text-gray-500 text-sm max-w-sm">
        Vista de mapa con Leaflet — próximamente. Se mostrarán {items.length} oportunidades
        con marcadores codificados por puntuación (verde / amarillo / rojo).
      </p>
      <p className="text-xs text-gray-600 mt-3">
        TODO: npm install leaflet react-leaflet @types/leaflet
      </p>
    </div>
  );
}
