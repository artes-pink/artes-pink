'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Supplier {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  materials: string | null;
  notes: string | null;
}

const EMPTY_FORM = { name: '', email: '', phone: '', materials: '', notes: '' };

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuppliers = useCallback(async () => {
    const res = await fetch('/api/suppliers');
    if (res.ok) {
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowCreate(true);
  }

  function openEdit(s: Supplier) {
    setShowCreate(false);
    setEditingId(s.id);
    setForm({ name: s.name, email: s.email, phone: s.phone ?? '', materials: s.materials ?? '', notes: s.notes ?? '' });
    setError(null);
  }

  function cancelForm() {
    setShowCreate(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) {
      setError('Nombre y email son requeridos');
      return;
    }
    setSaving(true);
    setError(null);
    const isEdit = editingId !== null;
    const res = await fetch(isEdit ? `/api/suppliers/${editingId}` : '/api/suppliers', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Error al guardar'); setSaving(false); return; }
    await fetchSuppliers();
    cancelForm();
    setSaving(false);
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`¿Eliminar proveedor "${name}"? Los productos ligados a este proveedor perderán la referencia.`)) return;
    await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
    setSuppliers(prev => prev.filter(s => s.id !== id));
  }

  return (
    <div className="min-h-screen bg-[#F5F4F2]">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            ← Dashboard
          </Link>
          <span className="text-gray-200">/</span>
          <span className="text-sm font-semibold text-gray-900">Proveedores</span>
          <div className="ml-auto">
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#B03060] text-white text-sm font-semibold rounded-lg hover:bg-[#9a2754] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nuevo proveedor
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-5">

        {/* Create form */}
        {showCreate && (
          <div className="bg-white rounded-xl border border-[#B03060]/20 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Nuevo proveedor</h2>
            <SupplierForm form={form} setForm={setForm} error={error} saving={saving} onSave={handleSave} onCancel={cancelForm} />
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          {loading ? (
            <div className="px-6 py-16 text-center text-sm text-gray-400">Cargando...</div>
          ) : suppliers.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-gray-400 mb-1">No hay proveedores registrados.</p>
              <p className="text-xs text-gray-300">Agrega tu primer proveedor con el botón de arriba.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider">Proveedor</th>
                  <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider">Email</th>
                  <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider">Teléfono</th>
                  <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider">Materiales</th>
                  <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider">Notas</th>
                  <th className="px-5 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {suppliers.map(s => {
                  const isEditing = editingId === s.id;
                  return (
                    <tr key={s.id} className={`transition-colors ${isEditing ? 'bg-[#B03060]/5' : 'hover:bg-gray-50/60'}`}>
                      {isEditing ? (
                        <td colSpan={5} className="px-5 py-4">
                          <SupplierForm form={form} setForm={setForm} error={error} saving={saving} onSave={handleSave} onCancel={cancelForm} inline />
                        </td>
                      ) : (
                        <>
                          <td className="px-5 py-3.5 font-medium text-gray-900">{s.name}</td>
                          <td className="px-5 py-3.5 text-gray-500">{s.email}</td>
                          <td className="px-5 py-3.5 text-gray-400">{s.phone || <span className="text-gray-200">—</span>}</td>
                          <td className="px-5 py-3.5 max-w-[240px]">
                            {s.materials ? (
                              <div className="flex flex-wrap gap-1">
                                {s.materials.split(',').map(m => m.trim()).filter(Boolean).map(m => (
                                  <span key={m} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-md">{m}</span>
                                ))}
                              </div>
                            ) : <span className="text-gray-200">—</span>}
                          </td>
                          <td className="px-5 py-3.5 text-gray-400 max-w-[180px]">
                            <span className="block truncate" title={s.notes ?? ''}>{s.notes || <span className="text-gray-200">—</span>}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEdit(s)} title="Editar" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                                </svg>
                              </button>
                              <button onClick={() => handleDelete(s.id, s.name)} title="Eliminar" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

interface FormProps {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  error: string | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  inline?: boolean;
}

function SupplierForm({ form, setForm, error, saving, onSave, onCancel, inline }: FormProps) {
  const set = (k: keyof typeof EMPTY_FORM) => (v: string) => setForm(prev => ({ ...prev, [k]: v }));
  return (
    <div className={inline ? 'space-y-3' : 'space-y-4'}>
      <div className={`grid gap-3 ${inline ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Nombre *</label>
          <input value={form.name} onChange={e => set('name')(e.target.value)} placeholder="Ej. Impresos García" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#B03060] focus:ring-1 focus:ring-[#B03060]/20" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Email *</label>
          <input type="email" value={form.email} onChange={e => set('email')(e.target.value)} placeholder="proveedor@mail.com" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#B03060] focus:ring-1 focus:ring-[#B03060]/20" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Teléfono</label>
          <input value={form.phone} onChange={e => set('phone')(e.target.value)} placeholder="+52 33 1234 5678" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#B03060] focus:ring-1 focus:ring-[#B03060]/20" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Materiales que maneja</label>
        <input value={form.materials} onChange={e => set('materials')(e.target.value)} placeholder="Vinil adhesivo, Lona Front, Coroplast 4mm" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#B03060] focus:ring-1 focus:ring-[#B03060]/20" />
        <p className="mt-1 text-xs text-gray-400">Separa cada material con coma. Deben coincidir exactamente con los materiales del Excel de specs.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Notas internas</label>
        <input value={form.notes} onChange={e => set('notes')(e.target.value)} placeholder="Tiempos de entrega, condiciones, etc." className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#B03060] focus:ring-1 focus:ring-[#B03060]/20" />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving} className="px-4 py-2 bg-[#B03060] text-white text-sm font-semibold rounded-lg hover:bg-[#9a2754] disabled:opacity-50 transition-colors">
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  );
}
