'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface AppUser {
  id: string;
  email: string;
  createdAt: string;
  lastSignIn: string | null;
}

function IconUser() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{children}</p>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resetingId, setResetingId] = useState<string | null>(null);
  const [newPasswords, setNewPasswords] = useState<Record<string, string>>({});

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/users');
    if (res.status === 403) { setError('No tienes acceso a esta sección.'); setLoading(false); return; }
    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    setCreateSuccess('');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail.trim(), password: newPassword }),
    });
    const data = await res.json();
    if (data.error) {
      setCreateError(data.error);
    } else {
      setCreateSuccess(`Usuario ${newEmail} creado correctamente.`);
      setNewEmail('');
      setNewPassword('');
      fetchUsers();
    }
    setCreating(false);
  }

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`¿Quitar el acceso de ${email}? El usuario ya no podrá ingresar al dashboard.`)) return;
    setDeletingId(userId);
    await fetch(`/api/users/${userId}`, { method: 'DELETE' });
    await fetchUsers();
    setDeletingId(null);
  }

  async function resetPassword(userId: string) {
    const pwd = newPasswords[userId];
    if (!pwd || pwd.length < 8) return;
    setResetingId(userId);
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd }),
    });
    const data = await res.json();
    if (data.success) {
      setNewPasswords(p => ({ ...p, [userId]: '' }));
    }
    setResetingId(null);
  }

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
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Volver al dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F4F2]">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            ← Dashboard
          </Link>
          <span className="text-gray-200">/</span>
          <span className="text-sm font-semibold text-gray-900">Gestión de usuarios</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        {/* Create user */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5">
          <SectionHeader>Agregar usuario</SectionHeader>
          <form onSubmit={createUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Correo electrónico</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="jimena@pinkconnections.com"
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#B03060]/30 focus:border-[#B03060] transition-all placeholder:text-gray-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Contraseña inicial</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#B03060]/30 focus:border-[#B03060] transition-all placeholder:text-gray-300"
                />
              </div>
            </div>

            {createError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                {createError}
              </div>
            )}

            {createSuccess && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3.5 py-2.5">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                {createSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={creating || !newEmail || newPassword.length < 8}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#B03060] text-white text-sm font-semibold rounded-lg hover:bg-[#95284F] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {creating ? 'Creando...' : 'Crear usuario'}
            </button>
          </form>
        </div>

        {/* User list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader>Usuarios con acceso</SectionHeader>
            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full -mt-4">{users.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {users.map(u => {
              const isSuperAdmin = u.email === 'pablo@pinkconnections.com';
              const pwdValue = newPasswords[u.id] || '';

              return (
                <div key={u.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0 text-gray-400">
                        <IconUser />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{u.email}</span>
                          {isSuperAdmin && (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[#B03060]/10 text-[#B03060] border border-[#B03060]/20">
                              Superadmin
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Creado {new Date(u.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {u.lastSignIn && (
                            <span className="before:content-['·'] before:mx-1.5">
                              Último acceso {new Date(u.lastSignIn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {!isSuperAdmin && (
                      <button
                        onClick={() => deleteUser(u.id, u.email)}
                        disabled={deletingId === u.id}
                        className="text-xs font-semibold px-3 py-1.5 text-red-500 border border-red-200 bg-white rounded-lg hover:bg-red-50 active:scale-[0.98] disabled:opacity-40 transition-all shrink-0"
                      >
                        {deletingId === u.id ? (
                          <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : 'Quitar acceso'}
                      </button>
                    )}
                  </div>

                  {/* Reset password */}
                  {!isSuperAdmin && (
                    <div className="mt-3 flex items-center gap-2 pl-11">
                      <input
                        type="password"
                        placeholder="Nueva contraseña (mín. 8 caracteres)"
                        value={pwdValue}
                        onChange={e => setNewPasswords(p => ({ ...p, [u.id]: e.target.value }))}
                        className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#B03060]/30 focus:border-[#B03060] transition-all placeholder:text-gray-300"
                      />
                      <button
                        onClick={() => resetPassword(u.id)}
                        disabled={resetingId === u.id || pwdValue.length < 8}
                        className="text-xs font-semibold px-3 py-1.5 text-gray-600 border border-gray-200 bg-white rounded-lg hover:bg-gray-50 active:scale-[0.98] disabled:opacity-40 transition-all shrink-0 whitespace-nowrap"
                      >
                        {resetingId === u.id ? (
                          <div className="w-3.5 h-3.5 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                        ) : 'Cambiar contraseña'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
