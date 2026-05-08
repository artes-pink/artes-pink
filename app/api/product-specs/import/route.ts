import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productSpecs, orderItems } from '@/lib/schema';
import * as xlsx from 'xlsx';
import { sql, eq } from 'drizzle-orm';
import { createSupabaseServerClient } from '@/lib/supabase-server';

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL?.trim()) return null;
  return user;
}

interface SpecRow {
  productCode: string;
  productName: string;
  colorMode: string | null;
  acceptedFormats: string | null;
  // Physical (CMYK)
  widthCm: number | null;
  heightCm: number | null;
  widthVisibleCm: number | null;
  heightVisibleCm: number | null;
  resolutionDpi: number | null;
  // Digital (RGB)
  widthPx: number | null;
  heightPx: number | null;
  notes: string | null;
}

// Parses "1.23 x 1.81 m." or "1920 x 1080 px" or "114 x 179 cm"
function parseDimension(val: unknown): { widthCm: number | null; heightCm: number | null; widthPx: number | null; heightPx: number | null } {
  const str = String(val ?? '').trim();
  if (!str || str === '-') return { widthCm: null, heightCm: null, widthPx: null, heightPx: null };

  // "1920 x 1080 px" or "1920x1080px"
  const pxMatch = str.match(/([\d.]+)\s*[xX×]\s*([\d.]+)\s*px/i);
  if (pxMatch) {
    return { widthCm: null, heightCm: null, widthPx: Math.round(parseFloat(pxMatch[1])), heightPx: Math.round(parseFloat(pxMatch[2])) };
  }

  // "1.23 x 1.81 m." or "1.23x1.81m" — store as meters
  const mMatch = str.match(/([\d.]+)\s*[xX×]\s*([\d.]+)\s*m/i);
  if (mMatch) {
    return { widthCm: parseFloat(parseFloat(mMatch[1]).toFixed(3)), heightCm: parseFloat(parseFloat(mMatch[2]).toFixed(3)), widthPx: null, heightPx: null };
  }

  // "114 x 179 cm" — convert to meters
  const cmMatch = str.match(/([\d.]+)\s*[xX×]\s*([\d.]+)\s*cm/i);
  if (cmMatch) {
    return { widthCm: parseFloat((parseFloat(cmMatch[1]) / 100).toFixed(3)), heightCm: parseFloat((parseFloat(cmMatch[2]) / 100).toFixed(3)), widthPx: null, heightPx: null };
  }

  return { widthCm: null, heightCm: null, widthPx: null, heightPx: null };
}

function parseExcelRow(row: Record<string, unknown>): SpecRow | null {
  const code = String(row['ID'] ?? row['product_code'] ?? row['Código'] ?? row['Codigo'] ?? '').trim();
  const name = String(row['Nombre'] ?? row['product_name'] ?? row['name'] ?? '').trim();

  if (!code || !name) return null;

  const areaTotal = parseDimension(row['AREA TOTAL'] ?? row['area_total'] ?? row['Area Total'] ?? '');
  const areaVisible = parseDimension(row['AREA VISIBLE'] ?? row['area_visible'] ?? row['Area Visible'] ?? '');

  const colorMode = String(row['CODIGO DE COLOR'] ?? row['color_mode'] ?? row['Código de color'] ?? '').trim() || null;
  const acceptedFormats = String(row['FORMATO'] ?? row['formato'] ?? '').trim() || null;

  const dpiRaw = String(row['DPI'] ?? row['dpi'] ?? row['Resolución'] ?? row['Resolucion'] ?? row['RESOLUCION'] ?? row['resolution_dpi'] ?? '').trim();
  const resolutionDpi = dpiRaw ? parseInt(dpiRaw.replace(/[^\d]/g, ''), 10) || null : null;

  const isDigital = areaTotal.widthPx !== null;

  if (isDigital) {
    return {
      productCode: code,
      productName: name,
      colorMode,
      acceptedFormats,
      widthCm: null,
      heightCm: null,
      widthVisibleCm: null,
      heightVisibleCm: null,
      resolutionDpi,
      widthPx: areaTotal.widthPx,
      heightPx: areaTotal.heightPx,
      notes: null,
    };
  }

  // Physical product: must have at least AREA TOTAL in cm
  if (!areaTotal.widthCm || !areaTotal.heightCm) return null;

  return {
    productCode: code,
    productName: name,
    colorMode,
    acceptedFormats,
    widthCm: areaTotal.widthCm,
    heightCm: areaTotal.heightCm,
    widthVisibleCm: areaVisible.widthCm,
    heightVisibleCm: areaVisible.heightCm,
    resolutionDpi,
    widthPx: null,
    heightPx: null,
    notes: null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const replaceAll = formData.get('replace') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return NextResponse.json({ error: 'Solo se aceptan archivos .xlsx, .xls o .csv' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet) as Record<string, unknown>[];

    const parsed: SpecRow[] = rows.map(parseExcelRow).filter((r): r is SpecRow => r !== null);

    if (parsed.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron filas válidas. Verifica que el archivo tenga las columnas: ID, Nombre, AREA TOTAL, CODIGO DE COLOR, FORMATO.',
      }, { status: 400 });
    }

    if (replaceAll) {
      // Null out FK references first, then delete, then re-link after insert
      await db.update(orderItems).set({ specId: null });
      await db.delete(productSpecs);
    }

    await db
      .insert(productSpecs)
      .values(parsed.map(s => ({
        productCode: s.productCode,
        productName: s.productName,
        colorMode: s.colorMode,
        acceptedFormats: s.acceptedFormats,
        widthCm: s.widthCm?.toString() ?? null,
        heightCm: s.heightCm?.toString() ?? null,
        widthVisibleCm: s.widthVisibleCm?.toString() ?? null,
        heightVisibleCm: s.heightVisibleCm?.toString() ?? null,
        resolutionDpi: s.resolutionDpi,
        widthPx: s.widthPx,
        heightPx: s.heightPx,
        notes: s.notes,
      })))
      .onConflictDoUpdate({
        target: productSpecs.productCode,
        set: {
          productName: sql`excluded.product_name`,
          colorMode: sql`excluded.color_mode`,
          acceptedFormats: sql`excluded.accepted_formats`,
          widthCm: sql`excluded.width_cm`,
          heightCm: sql`excluded.height_cm`,
          widthVisibleCm: sql`excluded.width_visible_cm`,
          heightVisibleCm: sql`excluded.height_visible_cm`,
          resolutionDpi: sql`excluded.resolution_dpi`,
          widthPx: sql`excluded.width_px`,
          heightPx: sql`excluded.height_px`,
          notes: sql`excluded.notes`,
        },
      });

    if (replaceAll) {
      // Re-link order items to new specs by matching productCode
      const newSpecs = await db.select({ id: productSpecs.id, productCode: productSpecs.productCode }).from(productSpecs);
      await Promise.all(
        newSpecs.map(s =>
          db.update(orderItems)
            .set({ specId: s.id })
            .where(eq(orderItems.productCode, s.productCode))
        )
      );
    }

    const digital = parsed.filter(r => r.widthPx !== null).length;
    const physical = parsed.length - digital;

    return NextResponse.json({
      success: true,
      imported: parsed.length,
      digital,
      physical,
      rows: parsed,
    });
  } catch (error) {
    console.error('POST /api/product-specs/import error:', error);
    return NextResponse.json({ error: 'Error al importar el archivo' }, { status: 500 });
  }
}
