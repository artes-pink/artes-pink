import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { suppliers } from '@/lib/schema';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { eq } from 'drizzle-orm';

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL?.trim()) return null;
  return user;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { name, email, phone, materials, notes } = body;

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Nombre y email son requeridos' }, { status: 400 });
  }

  const [row] = await db.update(suppliers).set({
    name: name.trim(),
    email: email.trim(),
    phone: phone?.trim() || null,
    materials: materials?.trim() || null,
    notes: notes?.trim() || null,
    updatedAt: new Date(),
  }).where(eq(suppliers.id, parseInt(id))).returning();

  if (!row) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  await db.delete(suppliers).where(eq(suppliers.id, parseInt(id)));
  return NextResponse.json({ success: true });
}
