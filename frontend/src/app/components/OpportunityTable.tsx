"use client";

import { ExternalLink } from "lucide-react";

export interface LocalItem {
  id: number;
  url_origen: string;
  titulo: string | null;
  precio: number | null;
  superficie_m2: number | null;
  imagen_url: string | null;
  municipio: { nombre: string; provincia: string } | null;
  analisis: {
    puntuacion_viabilidad: number | null;
    distancia_playa_m: number | null;
    roi_pct: number | null;
    uso_recomendado: string | null;
  } | null;
}

interface OpportunityTableProps {
  items: LocalItem[];
  total: number;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-500">—</span>;
  const color =
    score >= 70
      ? "bg-green-900 text-green-300 border-green-700"
      : score >= 40
      ? "bg-yellow-900 text-yellow-300 border-yellow-700"
      : "bg-red-900 text-red-300 border-red-700";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${color}`}>
      {score}
    </span>
  );
}

function formatEur(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDist(m: number | null): string {
  if (m === null) return "—";
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

const USO_LABELS: Record<string, string> = {
  turistico: "Turístico",
  segunda_vivienda: "2ª Vivienda",
  ambos: "Ambos",
  no_viable: "No viable",
};

export default function OpportunityTable({
  items,
  total,
  page,
  perPage,
  onPageChange,
}: OpportunityTableProps) {
  const totalPages = Math.ceil(total / perPage);

  if (!items.length) {
    return (
      <div className="text-center py-20 text-gray-500">
        No se encontraron oportunidades con los filtros seleccionados.
      </div>
    );
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide">
              <th className="px-3 py-3 text-left w-16">Foto</th>
              <th className="px-3 py-3 text-left">Municipio</th>
              <th className="px-3 py-3 text-right">Precio</th>
              <th className="px-3 py-3 text-right">€/m²</th>
              <th className="px-3 py-3 text-right">m²</th>
              <th className="px-3 py-3 text-center">Puntuación</th>
              <th className="px-3 py-3 text-right">Playa</th>
              <th className="px-3 py-3 text-center">Uso</th>
              <th className="px-3 py-3 text-center">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {items.map((item) => {
              const preciom2 =
                item.precio && item.superficie_m2
                  ? item.precio / item.superficie_m2
                  : null;
              return (
                <tr key={item.id} className="hover:bg-gray-900 transition-colors">
                  <td className="px-3 py-2">
                    {item.imagen_url ? (
                      <img
                        src={item.imagen_url}
                        alt={item.titulo || "local"}
                        className="w-14 h-14 object-cover rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-14 h-14 bg-gray-800 rounded-lg flex items-center justify-center text-gray-600 text-xs">
                        Sin foto
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-100">
                      {item.municipio?.nombre || "—"}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-[180px]">
                      {item.titulo || "Sin título"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-100">{formatEur(item.precio)}</td>
                  <td className="px-3 py-2 text-right text-gray-400">{formatEur(preciom2)}</td>
                  <td className="px-3 py-2 text-right text-gray-300">
                    {item.superficie_m2 ? `${item.superficie_m2} m²` : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <ScoreBadge score={item.analisis?.puntuacion_viabilidad ?? null} />
                  </td>
                  <td className="px-3 py-2 text-right text-gray-400">
                    {formatDist(item.analisis?.distancia_playa_m ?? null)}
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-gray-400">
                    {USO_LABELS[item.analisis?.uso_recomendado || ""] || "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <a
                      href={item.url_origen}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex gap-3">
              {item.imagen_url && (
                <img
                  src={item.imagen_url}
                  alt=""
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{item.municipio?.nombre || "—"}</div>
                    <div className="text-xs text-gray-500 truncate">{item.titulo}</div>
                  </div>
                  <ScoreBadge score={item.analisis?.puntuacion_viabilidad ?? null} />
                </div>
                <div className="mt-2 flex gap-4 text-xs text-gray-400">
                  <span>{formatEur(item.precio)}</span>
                  <span>{item.superficie_m2 ? `${item.superficie_m2} m²` : ""}</span>
                  <span>{formatDist(item.analisis?.distancia_playa_m ?? null)}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-between items-center">
              <span className="text-xs text-gray-500">
                {USO_LABELS[item.analisis?.uso_recomendado || ""] || "—"}
              </span>
              <a
                href={item.url_origen}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 text-xs flex items-center gap-1"
              >
                Ver anuncio <ExternalLink size={12} />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
          <span>{total} resultados</span>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40"
            >
              ←
            </button>
            <span className="px-3 py-1.5 text-gray-300">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
