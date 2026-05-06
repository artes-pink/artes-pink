import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productSpecs } from '@/lib/schema';
import { asc } from 'drizzle-orm';
import { createSupabaseServerClient } from '@/lib/supabase';

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) return null;
  return user;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const specs = await db
      .select()
      .from(productSpecs)
      .orderBy(asc(productSpecs.productCode));
    return NextResponse.json(specs);
  } catch (error) {
    console.error('GET /api/product-specs error:', error);
    return NextResponse.json({ error: 'Error al obtener las especificaciones' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

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

    const [created] = await db
      .insert(productSpecs)
      .values({
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
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Ya existe una especificación con ese código' }, { status: 409 });
    }
    console.error('POST /api/product-specs error:', error);
    return NextResponse.json({ error: 'Error al crear la especificación' }, { status: 500 });
  }
}
