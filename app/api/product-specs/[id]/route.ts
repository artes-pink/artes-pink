import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productSpecs } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { createSupabaseServerClient } from '@/lib/supabase';

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
  const specId = Number(id);
  if (isNaN(specId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  try {
    const body = await request.json();
    const {
      productCode, productName,
      widthCm, heightCm, widthVisibleCm, heightVisibleCm, resolutionDpi,
      widthPx, heightPx,
      colorMode, acceptedFormats, notes,
    } = body;

    if (!productCode?.trim() || !productName?.trim()) {
      return NextResponse.json({ error: 'Código y nombre son obligatorios' }, { status: 400 });
    }

    const [updated] = await db
      .update(productSpecs)
      .set({
        productCode: productCode.trim().toUpperCase(),
        productName: productName.trim(),
        widthCm: widthCm || null,
        heightCm: heightCm || null,
        widthVisibleCm: widthVisibleCm || null,
        heightVisibleCm: heightVisibleCm || null,
        resolutionDpi: resolutionDpi ? Number(resolutionDpi) : null,
        widthPx: widthPx ? Number(widthPx) : null,
        heightPx: heightPx ? Number(heightPx) : null,
        colorMode: colorMode || null,
        acceptedFormats: acceptedFormats?.trim() || null,
        notes: notes?.trim() || null,
      })
      .where(eq(productSpecs.id, specId))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Especificación no encontrada' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Ya existe una especificación con ese código' }, { status: 409 });
    }
    console.error('PUT /api/product-specs/[id] error:', error);
    return NextResponse.json({ error: 'Error al actualizar la especificación' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  const specId = Number(id);
  if (isNaN(specId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  try {
    const [deleted] = await db
      .delete(productSpecs)
      .where(eq(productSpecs.id, specId))
      .returning();

    if (!deleted) return NextResponse.json({ error: 'Especificación no encontrada' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/product-specs/[id] error:', error);
    return NextResponse.json({ error: 'Error al eliminar la especificación' }, { status: 500 });
  }
}
