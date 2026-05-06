'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

interface Spec {
  id: number;
  widthCm: string | null;
  heightCm: string | null;
  widthVisibleCm: string | null;
  heightVisibleCm: string | null;
  resolutionDpi: number | null;
  widthPx: number | null;
  heightPx: number | null;
  colorMode: string | null;
  acceptedFormats: string | null;
  notes: string | null;
}

interface OrderItem {
  id: number;
  productCode: string;
  productName: string;
  quantity: number;
  specId: number | null;
  spec: Spec | null;
  latestUpload?: UploadRecord | null;
  excludedFromPortal: boolean;
}

interface UploadRecord {
  id: number;
  status: string;
  filenameOriginal: string;
  detectedWidthCm: string | null;
  detectedHeightCm: string | null;
  detectedDpi: number | null;
  validationErrors: string[] | null;
  createdAt: string;
}

interface LinkWithUploads {
  id: number;
  uuid: string;
  expiresAt: string;
  isActive: boolean;
  allUploadedAt: string | null;
  notificationSent: boolean;
  createdAt: string;
  uploads: UploadRecord[];
}

interface OrderDetail {
  order: { id: number; odooOrderId: string; clientName: string; clientEmail: string | null };
  items: OrderItem[];
  links: LinkWithUploads[];
}

function UploadStatusBadge({ status }: { status: string }) {
  if (status === 'valid') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Válido
      </span>
    );
  }
  if (status === 'invalid') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-50 text-red-700 border border-red-200">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Inválido
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      Pendiente
    </span>
  );
}

async function downloadFile(uploadId: number, filename: string) {
  const res = await fetch(`/api/uploads/${uploadId}/download`);
  const data = await res.json();
  if (data.downloadUrl) {
    const a = document.createElement('a');
    a.href = data.downloadUrl;
    a.download = filename;
    a.click();
  }
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{children}</p>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkJustGenerated, setLinkJustGenerated] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [deletingLinkId, setDeletingLinkId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/orders/${orderId}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [orderId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function generateLink() {
    setGeneratingLink(true);
    const res = await fetch(`/api/orders/${orderId}/link`, { method: 'POST' });
    const json = await res.json();
    if (json.link) {
      setLinkJustGenerated(true);
      setTimeout(() => setLinkJustGenerated(false), 4000);
      fetchData();
    }
    setGeneratingLink(false);
  }

  async function toggleItemExclusion(itemId: number, exclude: boolean) {
    await fetch(`/api/orders/${orderId}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ excludedFromPortal: exclude }),
    });
    fetchData();
  }

  async function deleteOrder() {
    if (!confirm(`¿Eliminar la orden ${data?.order.odooOrderId}? Se eliminarán todos los links y archivos registrados. Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
    router.push('/dashboard');
  }

  async function deleteLink(linkId: number) {
    if (!confirm('¿Eliminar este link? El cliente ya no podrá usarlo.')) return;
    setDeletingLinkId(linkId);
    await fetch(`/api/orders/${orderId}/link/${linkId}`, { method: 'DELETE' });
    await fetchData();
    setDeletingLinkId(null);
  }

  async function resyncOrder() {
    if (!data) return;
    setResyncing(true);
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber: data.order.odooOrderId }),
    });
    await fetchData();
    setResyncing(false);
  }

  async function copyLink(url: string, id: string) {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F4F2] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-[#B03060] rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F5F4F2] flex items-center justify-center">
        <p className="text-sm text-red-500">Orden no encontrada</p>
      </div>
    );
  }

  const { order, items, links } = data;
  const hasAnyValidLink = links.some(l => l.allUploadedAt);

  return (
    <div className="min-h-screen bg-[#F5F4F2]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
            >
              ← Dashboard
            </Link>
            <span className="text-gray-200">/</span>
            <span className="font-mono font-bold text-gray-900">{order.odooOrderId}</span>
            {hasAnyValidLink && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Artes completos
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resyncOrder}
              disabled={resyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 bg-white rounded-lg hover:bg-gray-50 active:scale-[0.98] disabled:opacity-40 transition-all"
            >
              <svg className={`w-3.5 h-3.5 ${resyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              {resyncing ? 'Sincronizando...' : 'Re-sincronizar'}
            </button>
            <button
              onClick={deleteOrder}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 bg-white rounded-lg hover:bg-red-50 active:scale-[0.98] disabled:opacity-40 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              {deleting ? 'Eliminando...' : 'Eliminar orden'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-5">
        {/* Client info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5">
          <SectionHeader>Cliente</SectionHeader>
          <div className="flex gap-8 text-sm">
            <div>
              <span className="text-gray-400">Nombre</span>
              <p className="font-semibold text-gray-900 mt-0.5">{order.clientName}</p>
            </div>
            <div>
              <span className="text-gray-400">Email</span>
              <p className="font-medium text-gray-700 mt-0.5">{order.clientEmail || '—'}</p>
            </div>
          </div>
        </div>

        {/* Products */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5">
          <SectionHeader>Productos de la orden</SectionHeader>
          <div className="divide-y divide-gray-50">
            {items.map(item => (
              <div key={item.id} className={`py-3 first:pt-0 last:pb-0 transition-opacity ${item.excludedFromPortal ? 'opacity-40' : ''}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md shrink-0">
                      {item.productCode}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${item.excludedFromPortal ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {item.productName.replace(/^\[[^\]]+\]\s*/, '')}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">Cantidad: {item.quantity}</p>
                    </div>
                    {!item.specId && !item.excludedFromPortal && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                        Sin specs
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    {item.spec && !item.excludedFromPortal && (
                      <div className="text-right text-xs text-gray-500">
                        {item.spec.widthPx
                          ? <span className="font-semibold text-gray-700">{item.spec.widthPx} × {item.spec.heightPx} px</span>
                          : <span className="font-semibold text-gray-700">{item.spec.widthCm} × {item.spec.heightCm} m</span>
                        }
                        {item.spec.acceptedFormats && (
                          <span className="ml-2 text-gray-400">{item.spec.acceptedFormats}</span>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => toggleItemExclusion(item.id, !item.excludedFromPortal)}
                      className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 whitespace-nowrap transition-colors"
                    >
                      {item.excludedFromPortal ? 'Mostrar en portal' : 'Ocultar del portal'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Links */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader>Links para el cliente</SectionHeader>
            <button
              onClick={generateLink}
              disabled={generatingLink}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#B03060] text-white text-sm font-semibold rounded-lg hover:bg-[#95284F] active:scale-[0.98] disabled:opacity-40 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {generatingLink ? 'Generando...' : 'Nuevo link'}
            </button>
          </div>

          {linkJustGenerated && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 font-medium">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              Link generado — cópialo y compártelo con el cliente
            </div>
          )}

          {links.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              Aún no hay links para esta orden. Genera uno para compartir con el cliente.
            </p>
          ) : (
            <div className="space-y-3">
              {links.map(link => {
                const portalUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${link.uuid}`;
                const isExpired = new Date() > new Date(link.expiresAt);

                return (
                  <div key={link.id} className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          {link.allUploadedAt ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Completo
                            </span>
                          ) : isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                              Vencido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Activo
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            Vence {new Date(link.expiresAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <p className="font-mono text-xs text-gray-400 truncate max-w-xs">{portalUrl}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => copyLink(portalUrl, String(link.id))}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-[0.98] ${
                            copiedId === String(link.id)
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-[#B03060] text-white hover:bg-[#95284F]'
                          }`}
                        >
                          {copiedId === String(link.id) ? (
                            <>
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Copiado
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                              </svg>
                              Copiar link
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => deleteLink(link.id)}
                          disabled={deletingLinkId === link.id}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg text-red-500 border border-red-200 bg-white hover:bg-red-50 active:scale-[0.98] disabled:opacity-40 transition-all"
                        >
                          {deletingLinkId === link.id ? (
                            <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          )}
                          Eliminar
                        </button>
                      </div>
                    </div>

                    {/* Uploads */}
                    {link.uploads.length > 0 && (
                      <div className="mt-2 divide-y divide-gray-100 border-t border-gray-100 pt-2">
                        {link.uploads.map(upload => (
                          <div key={upload.id} className="flex items-center justify-between py-2 gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <UploadStatusBadge status={upload.status} />
                              <span className="text-xs text-gray-600 truncate max-w-[180px] font-medium">{upload.filenameOriginal}</span>
                              {upload.detectedWidthCm && (
                                <span className="text-xs text-gray-400 hidden sm:inline">
                                  {upload.detectedWidthCm}×{upload.detectedHeightCm}m
                                  {upload.detectedDpi ? ` · ${upload.detectedDpi}DPI` : ''}
                                </span>
                              )}
                            </div>
                            {upload.status === 'valid' && (
                              <button
                                onClick={() => downloadFile(upload.id, upload.filenameOriginal)}
                                className="text-xs font-semibold text-[#B03060] hover:text-[#95284F] shrink-0 transition-colors"
                              >
                                Descargar
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
