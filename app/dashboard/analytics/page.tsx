'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DailyPoint { day: string; total: number; valid: number; invalid: number }
interface FailedUpload {
  id: number;
  filenameOriginal: string;
  validationErrors: string[] | null;
  detectedWidthCm: string | null;
  detectedHeightCm: string | null;
  detectedWidthPx: number | null;
  detectedHeightPx: number | null;
  detectedDpi: number | null;
  createdAt: string;
  productCode: string;
  productName: string;
  clientName: string;
  odooOrderId: string;
}
interface ProductFailure { productCode: string; productName: string; invalid: number; valid: number; total: number }
interface Totals { total: number; valid: number; invalid: number; pending: number; ordersTotal: number; ordersCompleted: number; activeLinks: number }
interface AnalyticsData {
  totals: Totals;
  dailyActivity: DailyPoint[];
  recentFailed: FailedUpload[];
  productFailures: ProductFailure[];
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: 'green' | 'red' | 'default';
}) {
  const valueColor =
    accent === 'green' ? 'text-emerald-600' :
    accent === 'red' ? 'text-red-500' :
    'text-gray-900';

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{label}</p>
      <p className={`font-[family-name:var(--font-outfit)] text-3xl font-bold leading-none ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-2">{sub}</p>}
    </div>
  );
}

function BarChart({ data }: { data: DailyPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center">
        <p className="text-sm text-gray-400">Sin actividad aún</p>
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d.total), 1);

  return (
    <div className="flex items-end gap-0.5 h-28 w-full">
      {data.map(d => (
        <div key={d.day} className="flex-1 flex flex-col justify-end gap-0 group relative min-w-0">
          <div
            className="w-full rounded-t-sm bg-red-300 transition-opacity group-hover:opacity-80"
            style={{ height: `${(d.invalid / maxVal) * 100}%`, minHeight: d.invalid > 0 ? 2 : 0 }}
          />
          <div
            className="w-full bg-emerald-400 transition-opacity group-hover:opacity-80"
            style={{ height: `${(d.valid / maxVal) * 100}%`, minHeight: d.valid > 0 ? 2 : 0 }}
          />
          {d.total > 0 && (
            <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap z-10 shadow-lg">
              <span className="font-semibold">{d.day.slice(5)}</span>
              <span className="text-gray-300 mx-1">·</span>
              <span className="text-emerald-400">{d.valid} ok</span>
              {d.invalid > 0 && (
                <>
                  <span className="text-gray-500 mx-1">/</span>
                  <span className="text-red-400">{d.invalid} err</span>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data: d }) => {
        if (!ok || !d.totals) setError(d.error || 'Error al cargar el tablero');
        else setData(d);
        setLoading(false);
      })
      .catch(() => { setError('Sin conexión con el servidor'); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F4F2] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-[#B03060] rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F5F4F2] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm font-semibold text-red-500 mb-2">{error}</p>
          <p className="text-xs text-gray-400">Revisa la conexión a la base de datos e intenta de nuevo.</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { totals, dailyActivity, recentFailed, productFailures } = data;
  const successRate = totals.total > 0 ? Math.round((totals.valid / totals.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#F5F4F2]">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            ← Dashboard
          </Link>
          <span className="text-gray-200">/</span>
          <span className="text-sm font-semibold text-gray-900">Tablero de actividad</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Artes subidos"
            value={totals.total}
            sub="todos los tiempos"
          />
          <KpiCard
            label="Validados"
            value={totals.valid}
            accent="green"
            sub={`${successRate}% tasa de éxito`}
          />
          <KpiCard
            label="Rechazados"
            value={totals.invalid}
            accent="red"
            sub="con errores de medidas"
          />
          <KpiCard
            label="Órdenes completas"
            value={`${totals.ordersCompleted} / ${totals.ordersTotal}`}
            sub={`${totals.activeLinks} links activos`}
          />
        </div>

        {/* Activity chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Actividad</p>
              <h2 className="text-sm font-semibold text-gray-900">Últimos 30 días</h2>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />
                Válidos
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-300 inline-block" />
                Rechazados
              </div>
            </div>
          </div>
          <BarChart data={dailyActivity} />
          {dailyActivity.length > 0 && (
            <div className="flex justify-between text-xs text-gray-300 mt-2">
              <span>{dailyActivity[0].day.slice(5)}</span>
              <span>{dailyActivity[dailyActivity.length - 1].day.slice(5)}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Product failures */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Rechazos por producto</p>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Los que más fallan</h2>
            {productFailures.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Sin rechazos registrados</p>
            ) : (
              <div className="space-y-3">
                {productFailures.map(p => (
                  <div key={p.productCode} className="flex items-center gap-3">
                    <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md shrink-0">
                      {p.productCode}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">
                        {p.productName.replace(/^\[[^\]]+\]\s*/, '')}
                      </p>
                      <div className="flex items-center gap-0.5 mt-1 h-1.5 rounded-full overflow-hidden bg-gray-100">
                        {p.valid > 0 && (
                          <div
                            className="h-full bg-emerald-400 rounded-l-full"
                            style={{ width: `${Math.round((p.valid / p.total) * 100)}%` }}
                          />
                        )}
                        {p.invalid > 0 && (
                          <div
                            className="h-full bg-red-300 rounded-r-full"
                            style={{ width: `${Math.round((p.invalid / p.total) * 100)}%` }}
                          />
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-red-500 shrink-0">{p.invalid}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">General</p>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Resumen</h2>
            <div className="divide-y divide-gray-50">
              <div className="flex justify-between items-center py-2.5">
                <span className="text-sm text-gray-500">Tasa de éxito global</span>
                <span className={`text-sm font-bold ${successRate >= 80 ? 'text-emerald-600' : successRate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                  {successRate}%
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-sm text-gray-500">Pendientes de validar</span>
                <span className="text-sm font-bold text-gray-700">{totals.pending}</span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-sm text-gray-500">Links activos (abiertos)</span>
                <span className="text-sm font-bold text-gray-700">{totals.activeLinks}</span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-sm text-gray-500">Órdenes con artes completos</span>
                <span className="text-sm font-bold text-emerald-600">{totals.ordersCompleted}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent failures */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Historial</p>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Últimos intentos fallidos</h2>
          {recentFailed.length === 0 ? (
            <div className="py-8 text-center">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">Sin intentos fallidos — todo limpio</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                    <th className="text-left pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Orden</th>
                    <th className="text-left pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Producto</th>
                    <th className="text-left pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Archivo</th>
                    <th className="text-left pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentFailed.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 pr-4 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-mono text-xs font-bold text-gray-800">{u.odooOrderId}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[100px]">{u.clientName}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">{u.productCode}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-xs text-gray-500 truncate max-w-[140px] block">{u.filenameOriginal}</span>
                      </td>
                      <td className="py-3">
                        <span className="text-xs text-red-600 leading-relaxed">
                          {u.validationErrors && u.validationErrors.length > 0
                            ? u.validationErrors[0]
                            : u.detectedWidthCm
                              ? `Detectado: ${u.detectedWidthCm}×${u.detectedHeightCm}m`
                              : u.detectedWidthPx
                                ? `Detectado: ${u.detectedWidthPx}×${u.detectedHeightPx}px`
                                : 'Error de validación'
                          }
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
