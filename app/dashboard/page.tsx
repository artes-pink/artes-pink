'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';

interface OrderRow {
  id: number;
  odooOrderId: string;
  clientName: string;
  clientEmail: string | null;
  createdAt: string;
  linkCount: number;
  completedLinks: number;
}

function StatusBadge({ linkCount, completedLinks }: { linkCount: number; completedLinks: number }) {
  if (linkCount === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        Sin link
      </span>
    );
  }
  if (completedLinks > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Completo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      Esperando arte
    </span>
  );
}

function IconSearch() {
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderInput, setOrderInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [search, setSearch] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const fetchOrders = useCallback(async () => {
    const res = await fetch('/api/orders');
    const data = await res.json();
    setOrders(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
    supabase.auth.getUser().then(({ data }) => setCurrentUserEmail(data.user?.email ?? ''));
  }, [fetchOrders]);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!orderInput.trim()) return;
    setImporting(true);
    setImportError('');

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber: orderInput.trim() }),
    });

    const data = await res.json();
    if (!res.ok) {
      setImportError(data.error || 'Error al importar la orden');
    } else {
      setOrderInput('');
      router.push(`/dashboard/orders/${data.orderId}`);
    }
    setImporting(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const filtered = orders.filter(o =>
    o.odooOrderId.toLowerCase().includes(search.toLowerCase()) ||
    o.clientName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F5F4F2]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
          {/* Left: logo + logout */}
          <div className="flex items-center gap-4">
            <img src="/logo-icon.png" alt="Pink Connections" className="h-8 w-8 object-contain" />
            <div className="w-px h-4 bg-gray-200" />
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors font-medium"
            >
              Cerrar sesión
            </button>
          </div>

          {/* Right: nav */}
          <nav className="flex items-center gap-0.5">
            <Link
              href="/dashboard/analytics"
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            >
              Tablero
            </Link>
            <Link
              href="/dashboard/specs"
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            >
              Especificaciones
            </Link>
            <Link
              href="/dashboard/suppliers"
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            >
              Proveedores
            </Link>
            {currentUserEmail === 'pablo@pinkconnections.com' && (
              <Link
                href="/dashboard/users"
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors font-medium"
              >
                Usuarios
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-5">
        {/* Import form */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Importar desde Odoo</p>
          <form onSubmit={handleImport} className="flex gap-2.5">
            <input
              type="text"
              value={orderInput}
              onChange={e => setOrderInput(e.target.value.toUpperCase())}
              placeholder="Ej: S00395"
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-mono font-semibold text-gray-800 placeholder:font-sans placeholder:font-normal placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#B03060]/30 focus:border-[#B03060] transition-all"
            />
            <button
              type="submit"
              disabled={importing || !orderInput.trim()}
              className="px-5 py-2.5 bg-[#B03060] text-white rounded-lg text-sm font-semibold hover:bg-[#95284F] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {importing ? 'Importando...' : 'Importar'}
            </button>
          </form>
          {importError && (
            <p className="mt-2.5 text-sm text-red-600">{importError}</p>
          )}
        </div>

        {/* Orders list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Órdenes</h2>
              {!loading && (
                <span className="text-xs text-gray-400 font-medium">{filtered.length}</span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <IconSearch />
              </span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por número o cliente..."
                className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#B03060]/30 focus:border-[#B03060] transition-all w-52"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-[#B03060] rounded-full animate-spin mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-400">
                {search ? 'Sin resultados para tu búsqueda' : 'Aún no hay órdenes importadas'}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Orden</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Fecha</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50/70 transition-colors group">
                    <td className="px-5 py-4">
                      <span className="font-mono text-sm font-bold text-gray-900">{order.odooOrderId}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-gray-900">{order.clientName}</div>
                      {order.clientEmail && (
                        <div className="text-xs text-gray-400 mt-0.5">{order.clientEmail}</div>
                      )}
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge
                        linkCount={Number(order.linkCount)}
                        completedLinks={Number(order.completedLinks)}
                      />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/dashboard/orders/${order.id}`}
                        className="text-xs font-semibold text-[#B03060] hover:text-[#95284F] opacity-0 group-hover:opacity-100 transition-all"
                      >
                        Ver orden
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
