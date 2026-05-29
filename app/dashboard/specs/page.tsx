'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ProductSpec {
  id: number;
  productCode: string;
  productName: string;
  colorMode: string | null;
  acceptedFormats: string | null;
  material: string | null;
  widthCm: string | null;
  heightCm: string | null;
  widthVisibleCm: string | null;
  heightVisibleCm: string | null;
  resolutionDpi: number | null;
  resolutionDpiMax: number | null;
  widthPx: number | null;
  heightPx: number | null;
  durationSeconds: number | null;
  notes: string | null;
}

interface SpecForm {
  productCode: string;
  productName: string;
  type: 'physical' | 'digital';
  widthCm: string;
  heightCm: string;
  widthVisibleCm: string;
  heightVisibleCm: string;
  resolutionDpi: string;
  widthPx: string;
  heightPx: string;
  acceptedFormats: string;
  notes: string;
}

const BLANK: SpecForm = {
  productCode: '', productName: '', type: 'physical',
  widthCm: '', heightCm: '', widthVisibleCm: '', heightVisibleCm: '',
  resolutionDpi: '', widthPx: '', heightPx: '', acceptedFormats: '', notes: '',
};

function specToForm(s: ProductSpec): SpecForm {
  return {
    productCode: s.productCode,
    productName: s.productName,
    type: s.widthPx ? 'digital' : 'physical',
    widthCm: s.widthCm ?? '',
    heightCm: s.heightCm ?? '',
    widthVisibleCm: s.widthVisibleCm ?? '',
    heightVisibleCm: s.heightVisibleCm ?? '',
    resolutionDpi: s.resolutionDpi?.toString() ?? '',
    widthPx: s.widthPx?.toString() ?? '',
    heightPx: s.heightPx?.toString() ?? '',
    acceptedFormats: s.acceptedFormats ?? '',
    notes: s.notes ?? '',
  };
}

function formToPayload(f: SpecForm) {
  const isDigital = f.type === 'digital';
  return {
    productCode: f.productCode,
    productName: f.productName,
    colorMode: isDigital ? 'RGB' : 'CMYK',
    widthCm: !isDigital ? (f.widthCm || null) : null,
    heightCm: !isDigital ? (f.heightCm || null) : null,
    widthVisibleCm: !isDigital ? (f.widthVisibleCm || null) : null,
    heightVisibleCm: !isDigital ? (f.heightVisibleCm || null) : null,
    resolutionDpi: !isDigital && f.resolutionDpi ? Number(f.resolutionDpi) : null,
    widthPx: isDigital && f.widthPx ? Number(f.widthPx) : null,
    heightPx: isDigital && f.heightPx ? Number(f.heightPx) : null,
    acceptedFormats: f.acceptedFormats || null,
    notes: f.notes || null,
  };
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{children}</p>;
}

function InputField({ label, value, onChange, placeholder, type = 'text', required = false }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
        {label}{required && <span className="text-[#B03060] ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        step={type === 'number' ? 'any' : undefined}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#B03060]/30 focus:border-[#B03060] transition-all placeholder:text-gray-300"
      />
    </div>
  );
}

export default function SpecsPage() {
  const [specs, setSpecs] = useState<ProductSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SpecForm>(BLANK);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Import Excel
  const [uploading, setUploading] = useState(false);
  const [replaceAll, setReplaceAll] = useState(false);
  const [importResult, setImportResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);

  // Delete
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchSpecs = useCallback(async () => {
    const res = await fetch('/api/product-specs');
    if (res.ok) {
      const data = await res.json();
      setSpecs(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Check admin by hitting /api/users — 200 = admin, 403 = not
    fetch('/api/users').then(r => { if (r.ok) setIsAdmin(true); });
    fetchSpecs();
  }, [fetchSpecs]);

  function setField<K extends keyof SpecForm>(key: K, value: SpecForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function openCreate() {
    setForm(BLANK);
    setEditingId(null);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(spec: ProductSpec) {
    setForm(specToForm(spec));
    setEditingId(spec.id);
    setFormError('');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(BLANK);
    setFormError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    const payload = formToPayload(form);
    const url = editingId ? `/api/product-specs/${editingId}` : '/api/product-specs';
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setFormError(data.error || 'Error al guardar');
    } else {
      closeForm();
      fetchSpecs();
    }
    setSaving(false);
  }

  async function handleDelete(spec: ProductSpec) {
    if (!confirm(`¿Eliminar la especificación "${spec.productCode} - ${spec.productName}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(spec.id);
    await fetch(`/api/product-specs/${spec.id}`, { method: 'DELETE' });
    await fetchSpecs();
    setDeletingId(null);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);
    if (replaceAll) formData.append('replace', 'true');
    const res = await fetch('/api/product-specs/import', { method: 'POST', body: formData });
    const data = await res.json();
    if (res.ok) {
      setImportResult({ success: true, message: `Se importaron ${data.imported} especificaciones (${data.physical} físicos, ${data.digital} digitales).` });
      fetchSpecs();
    } else {
      setImportResult({ error: data.error });
    }
    setUploading(false);
    e.target.value = '';
  }

  return (
    <div className="min-h-screen bg-[#F5F4F2]">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            ← Dashboard
          </Link>
          <span className="text-gray-200">/</span>
          <span className="text-sm font-semibold text-gray-900">Especificaciones de Productos</span>
          {isAdmin && !showForm && (
            <button
              onClick={openCreate}
              className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 bg-[#B03060] text-white text-sm font-semibold rounded-lg hover:bg-[#95284F] active:scale-[0.98] transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nueva especificación
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-5">

        {/* Create / Edit Form */}
        {showForm && isAdmin && (
          <div className="bg-white rounded-xl border border-[#B03060]/20 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5">
            <SectionHeader>{editingId ? `Editar especificación — ${form.productCode}` : 'Nueva especificación'}</SectionHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Code + Name */}
              <div className="grid grid-cols-2 gap-3">
                <InputField
                  label="Código de producto"
                  value={form.productCode}
                  onChange={v => setField('productCode', v.toUpperCase())}
                  placeholder="MSS-6 A"
                  required
                />
                <InputField
                  label="Nombre del producto"
                  value={form.productName}
                  onChange={v => setField('productName', v)}
                  placeholder="MUPI PUNTO SUR A VESTIBULO"
                  required
                />
              </div>

              {/* Type toggle */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Tipo</label>
                <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
                  {(['physical', 'digital'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setField('type', t)}
                      className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        form.type === t
                          ? 'bg-white shadow-sm text-gray-900 border border-gray-200'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {t === 'physical' ? 'Físico (CMYK)' : 'Digital (RGB)'}
                    </button>
                  ))}
                </div>
              </div>

              {form.type === 'physical' ? (
                <>
                  <div className="grid grid-cols-4 gap-3">
                    <InputField label="Ancho total (m)" value={form.widthCm} onChange={v => setField('widthCm', v)} placeholder="1.14" type="number" />
                    <InputField label="Alto total (m)" value={form.heightCm} onChange={v => setField('heightCm', v)} placeholder="1.79" type="number" />
                    <InputField label="Ancho visible (m)" value={form.widthVisibleCm} onChange={v => setField('widthVisibleCm', v)} placeholder="1.00" type="number" />
                    <InputField label="Alto visible (m)" value={form.heightVisibleCm} onChange={v => setField('heightVisibleCm', v)} placeholder="1.60" type="number" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <InputField label="Resolución (DPI)" value={form.resolutionDpi} onChange={v => setField('resolutionDpi', v)} placeholder="72" type="number" />
                    <InputField label="Formatos aceptados" value={form.acceptedFormats} onChange={v => setField('acceptedFormats', v)} placeholder="JPG, PDF" />
                    <InputField label="Notas (opcional)" value={form.notes} onChange={v => setField('notes', v)} placeholder="CMYK perfil Fogra39" />
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <InputField label="Ancho (px)" value={form.widthPx} onChange={v => setField('widthPx', v)} placeholder="1080" type="number" />
                  <InputField label="Alto (px)" value={form.heightPx} onChange={v => setField('heightPx', v)} placeholder="1920" type="number" />
                  <InputField label="Formatos aceptados" value={form.acceptedFormats} onChange={v => setField('acceptedFormats', v)} placeholder="MP4, JPG" />
                  <InputField label="Notas (opcional)" value={form.notes} onChange={v => setField('notes', v)} placeholder="Pantalla LED exterior" />
                </div>
              )}

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{formError}</p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving || !form.productCode || !form.productName}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#B03060] text-white text-sm font-semibold rounded-lg hover:bg-[#95284F] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                  {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear especificación'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2.5 text-sm font-semibold text-gray-500 border border-gray-200 bg-white rounded-lg hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Specs Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <SectionHeader>Especificaciones registradas</SectionHeader>
            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full -mt-4">
              {specs.length}
            </span>
            <span className="text-xs text-gray-400 -mt-4">
              {specs.filter(s => s.widthPx).length} digitales · {specs.filter(s => s.widthCm).length} físicos
            </span>
          </div>

          {loading ? (
            <div className="p-10 flex justify-center">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-[#B03060] rounded-full animate-spin" />
            </div>
          ) : specs.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">
              No hay especificaciones.{isAdmin ? ' Usa el botón "Nueva especificación" para agregar.' : ''}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Código</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Producto</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Dimensiones</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Zona visible</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">DPI</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Formato</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Material</th>
                    {isAdmin && <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider w-20" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {specs.map(spec => {
                    const isDigital = !!spec.widthPx;
                    const isBeingEdited = editingId === spec.id;
                    return (
                      <tr key={spec.id} className={`transition-colors ${isBeingEdited ? 'bg-[#B03060]/5' : 'hover:bg-gray-50/60'}`}>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{spec.productCode}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-900 max-w-[200px]">
                          <span className="block truncate text-sm font-medium" title={spec.productName}>
                            {spec.productName.replace(/^\[[^\]]+\]\s*/, '')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isDigital
                            ? <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-sky-50 text-sky-600 border border-sky-100">Digital</span>
                            : <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[#B03060]/10 text-[#B03060] border border-[#B03060]/15">Físico</span>
                          }
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-700">
                          {isDigital
                            ? (spec.widthPx && spec.heightPx ? `${spec.widthPx} × ${spec.heightPx} px` : '—')
                            : (spec.widthCm && spec.heightCm ? `${parseFloat(spec.widthCm)} × ${parseFloat(spec.heightCm)} m` : '—')
                          }
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {spec.widthVisibleCm && spec.heightVisibleCm
                            ? `${parseFloat(spec.widthVisibleCm)} × ${parseFloat(spec.heightVisibleCm)} m`
                            : <span className="text-gray-200">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {spec.resolutionDpi
                            ? (spec.resolutionDpiMax && spec.resolutionDpiMax !== spec.resolutionDpi
                                ? `${spec.resolutionDpi}–${spec.resolutionDpiMax}`
                                : spec.resolutionDpi)
                            : <span className="text-gray-200">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {spec.acceptedFormats || <span className="text-gray-200">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {spec.material || <span className="text-gray-200">—</span>}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEdit(spec)}
                                title="Editar"
                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(spec)}
                                disabled={deletingId === spec.id}
                                title="Eliminar"
                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                              >
                                {deletingId === spec.id ? (
                                  <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Import Excel — only for admin, collapsible */}
        {isAdmin && (
          <details className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] group">
            <summary className="px-5 py-4 cursor-pointer flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 select-none list-none">
              <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              Importación masiva desde Excel
            </summary>
            <div className="px-5 pb-5 pt-1 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Importa múltiples especificaciones a la vez. El archivo debe tener las columnas:{' '}
                {['ID', 'Nombre', 'AREA TOTAL', 'AREA VISIBLE', 'CODIGO DE COLOR', 'FORMATO', 'DPI'].map(col => (
                  <code key={col} className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs mx-0.5">{col}</code>
                ))}
              </p>
              <label className="flex items-center gap-2 mb-4 cursor-pointer select-none w-fit">
                <input
                  type="checkbox"
                  checked={replaceAll}
                  onChange={e => setReplaceAll(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#B03060] accent-[#B03060]"
                />
                <span className="text-sm text-gray-600">
                  Reemplazar todas las specs existentes{' '}
                  <span className="text-gray-400 font-normal">(borra todo antes de importar)</span>
                </span>
              </label>
              <label className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 cursor-pointer transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                {uploading ? 'Importando...' : 'Seleccionar .xlsx / .csv'}
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
              {importResult && (
                <p className={`mt-3 text-sm px-3.5 py-2.5 rounded-lg border ${
                  importResult.success
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                    : 'text-red-600 bg-red-50 border-red-100'
                }`}>
                  {importResult.success ? importResult.message : importResult.error}
                </p>
              )}
            </div>
          </details>
        )}
      </main>
    </div>
  );
}
