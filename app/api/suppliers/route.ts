import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { suppliers } from '@/lib/schema';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { asc } from 'drizzle-orm';

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL?.trim()) return null;
  return user;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const rows = await db.select().from(suppliers).orderBy(asc(suppliers.name));
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json();
  const { name, email, phone, notes } = body;

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Nombre y email son requeridos' }, { status: 400 });
  }

  const [row] = await db.insert(suppliers).values({
    name: name.trim(),
    email: email.trim(),
    phone: phone?.trim() || null,
    notes: notes?.trim() || null,
  }).returning();

  return NextResponse.json(row);
}
