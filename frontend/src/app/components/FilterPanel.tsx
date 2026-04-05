"use client";

import { useState } from "react";

export interface Filters {
  provincia: string;
  min_score: number;
  uso_turistico: boolean;
  order_by: "puntuacion" | "precio" | "precio_m2";
}

interface FilterPanelProps {
  onSearch: (filters: Filters) => void;
  loading?: boolean;
}

export default function FilterPanel({ onSearch, loading }: FilterPanelProps) {
  const [provincia, setProvincia] = useState("Huelva");
  const [minScore, setMinScore] = useState(50);
  const [usoTuristico, setUsoTuristico] = useState(false);
  const [orderBy, setOrderBy] = useState<Filters["order_by"]>("puntuacion");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({ provincia, min_score: minScore, uso_turistico: usoTuristico, order_by: orderBy });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-wrap gap-4 items-end"
    >
      <div className="flex flex-col gap-1 min-w-[160px]">
        <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">
          Provincia
        </label>
        <select
          value={provincia}
          onChange={(e) => setProvincia(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
        >
          <option value="Huelva">Huelva</option>
          <option value="Sevilla">Sevilla</option>
          <option value="Cádiz">Cádiz</option>
          <option value="Málaga">Málaga</option>
        </select>
      </div>

      <div className="flex flex-col gap-1 min-w-[200px]">
        <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">
          Puntuación mínima: <span className="text-blue-400">{minScore}</span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
          className="accent-blue-500 w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      <div className="flex flex-col gap-1 min-w-[150px]">
        <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">
          Ordenar por
        </label>
        <select
          value={orderBy}
          onChange={(e) => setOrderBy(e.target.value as Filters["order_by"])}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
        >
          <option value="puntuacion">Puntuación</option>
          <option value="precio">Precio</option>
          <option value="precio_m2">EUR/m²</option>
        </select>
      </div>

      <div className="flex items-center gap-2 pb-2">
        <input
          id="uso_turistico"
          type="checkbox"
          checked={usoTuristico}
          onChange={(e) => setUsoTuristico(e.target.checked)}
          className="w-4 h-4 accent-blue-500"
        />
        <label htmlFor="uso_turistico" className="text-sm text-gray-300 cursor-pointer">
          Solo uso turístico
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
      >
        {loading ? "Buscando..." : "Buscar"}
      </button>
    </form>
  );
}
