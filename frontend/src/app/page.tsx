"use client";

import { useState, useEffect, useCallback } from "react";
import FilterPanel, { Filters } from "./components/FilterPanel";
import OpportunityTable, { LocalItem } from "./components/OpportunityTable";
import MapView from "./components/MapView";
import { TrendingUp, Building2, Star, Sun, Moon } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Stats {
  total_oportunidades: number;
  media_roi: number | null;
  mejor_puntuacion: number | null;
  mejor_local_id: number | null;
}

interface ApiResponse {
  total: number;
  page: number;
  per_page: number;
  items: LocalItem[];
}

function StatCard({
  icon,
  label,
  value,
  link,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  link?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
      <div className="text-blue-400 p-2 bg-blue-950 rounded-lg">{icon}</div>
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
        {link ? (
          <a href={link} className="text-xl font-bold text-blue-400 hover:text-blue-300">
            {value}
          </a>
        ) : (
          <div className="text-xl font-bold text-gray-100">{value}</div>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [currentFilters, setCurrentFilters] = useState<Filters>({
    provincia: "Huelva",
    min_score: 50,
    uso_turistico: false,
    order_by: "puntuacion",
  });
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async (filters: Filters, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        provincia: filters.provincia,
        min_score: String(filters.min_score),
        uso_turistico: String(filters.uso_turistico),
        order_by: filters.order_by,
        page: String(p),
        per_page: "20",
      });

      const [localesRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/locales?${params}`),
        fetch(`${API_URL}/api/stats?provincia=${filters.provincia}`),
      ]);

      if (localesRes.ok) setData(await localesRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(currentFilters, page);
  }, []);

  const handleSearch = (filters: Filters) => {
    setCurrentFilters(filters);
    setPage(1);
    fetchData(filters, 1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchData(currentFilters, newPage);
  };

  const toggleDark = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark");
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">PropTech Locator</h1>
            <p className="text-xs text-gray-400">Oportunidades Inmobiliarias — Costa de Huelva</p>
          </div>
          <button
            onClick={toggleDark}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={<Building2 size={20} />}
            label="Total oportunidades"
            value={stats ? String(stats.total_oportunidades) : "—"}
          />
          <StatCard
            icon={<TrendingUp size={20} />}
            label="Media ROI"
            value={stats?.media_roi != null ? `${stats.media_roi.toFixed(1)}%` : "—"}
          />
          <StatCard
            icon={<Star size={20} />}
            label="Mejor oportunidad"
            value={stats?.mejor_puntuacion != null ? `Score ${stats.mejor_puntuacion}` : "—"}
            link={stats?.mejor_local_id ? `/locales/${stats.mejor_local_id}` : undefined}
          />
        </div>

        <FilterPanel onSearch={handleSearch} loading={loading} />

        <MapView items={[]} />

        {loading ? (
          <div className="text-center py-16 text-gray-500">
            <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p>Cargando oportunidades...</p>
          </div>
        ) : (
          <OpportunityTable
            items={data?.items || []}
            total={data?.total || 0}
            page={page}
            perPage={20}
            onPageChange={handlePageChange}
          />
        )}
      </main>
    </div>
  );
}
