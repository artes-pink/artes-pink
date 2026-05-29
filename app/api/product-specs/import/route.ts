import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productSpecs, suppliers } from '@/lib/schema';
import * as xlsx from 'xlsx';
import { sql } from 'drizzle-orm';
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
  material: string | null;
  // Physical (CMYK)
  widthCm: number | null;
  heightCm: number | null;
  widthVisibleCm: number | null;
  heightVisibleCm: number | null;
  resolutionDpi: number | null;
  resolutionDpiMax: number | null;
  // Digital (RGB)
  widthPx: number | null;
  heightPx: number | null;
  durationSeconds: number | null;
  notes: string | null;
}

// Parses "1.23 x 1.81 m" or "1920 x 1080 px" or "295 x 185 cm"
function parseDimension(val: unknown): { widthM: number | null; heightM: number | null; widthPx: number | null; heightPx: number | null } {
  const str = String(val ?? '').trim();
  if (!str || str === '-') return { widthM: null, heightM: null, widthPx: null, heightPx: null };

  const pxMatch = str.match(/([\d.]+)\s*[xX×]\s*([\d.]+)\s*px/i);
  if (pxMatch) {
    return { widthM: null, heightM: null, widthPx: Math.round(parseFloat(pxMatch[1])), heightPx: Math.round(parseFloat(pxMatch[2])) };
  }

  const mMatch = str.match(/([\d.]+)\s*[xX×]\s*([\d.]+)\s*m\b/i);
  if (mMatch) {
    return { widthM: parseFloat(parseFloat(mMatch[1]).toFixed(3)), heightM: parseFloat(parseFloat(mMatch[2]).toFixed(3)), widthPx: null, heightPx: null };
  }

  const cmMatch = str.match(/([\d.]+)\s*[xX×]\s*([\d.]+)\s*cm/i);
  if (cmMatch) {
    return { widthM: parseFloat((parseFloat(cmMatch[1]) / 100).toFixed(3)), heightM: parseFloat((parseFloat(cmMatch[2]) / 100).toFixed(3)), widthPx: null, heightPx: null };
  }

  return { widthM: null, heightM: null, widthPx: null, heightPx: null };
}

// Parses "150 - 300 Dpi" → {min: 150, max: 300}; "50 Dpi" → {min: 50, max: 50}; "-" → null
function parseDpi(val: unknown): { min: number | null; max: number | null } {
  const str = String(val ?? '').trim();
  if (!str || str === '-') return { min: null, max: null };
  const rangeMatch = str.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    return { min: parseInt(rangeMatch[1], 10), max: parseInt(rangeMatch[2], 10) };
  }
  const singleMatch = str.match(/(\d+)/);
  if (singleMatch) {
    const v = parseInt(singleMatch[1], 10);
    return { min: v, max: v };
  }
  return { min: null, max: null };
}

// Parses "10 seg." → 10; "-" → null
function parseDuration(val: unknown): number | null {
  const str = String(val ?? '').trim();
  if (!str || str === '-') return null;
  const m = str.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// Reads a row by column INDEX (positions A=0, B=1, ...). The Excel has duplicate headers
// so reading by header name doesn't work — we map by position.
function parseExcelRow(row: unknown[]): SpecRow | null {
  // Column layout (matches DIMENSIONES PRODUCTOS ODOO Excel):
  // 0:CATEGORIA  1:Nombre  2:ID  3:ESTATUS  4:FORMATO
  // 5:AREA VISIBLE (M)  6:AREA VISIBLE (CM)  7:AREA VISIBLE (10% CM)
  // 8:AREA TOTAL (M)    9:AREA TOTAL (CM)    10:AREA TOTAL (10% CM)
  // 11:DURACIÓN  12:RESOLUCIÓN  13:CODIGO DE COLOR  14:MATERIAL

  const code = String(row[2] ?? '').trim();
  const name = String(row[1] ?? '').trim();
  if (!code || !name) return null;

  const formato = String(row[4] ?? '').trim() || null;
  const visibleArea = parseDimension(row[5]);
  const totalArea = parseDimension(row[8]);
  const duration = parseDuration(row[11]);
  const dpi = parseDpi(row[12]);
  const colorMode = String(row[13] ?? '').trim().toUpperCase() || null;
  const material = String(row[14] ?? '').trim();
  const materialClean = material && material !== '-' ? material : null;

  // Digital product: AREA TOTAL holds pixel dimensions
  const isDigital = totalArea.widthPx !== null;

  if (isDigital) {
    return {
      productCode: code,
      productName: name,
      colorMode: colorMode === '-' ? null : colorMode,
      acceptedFormats: formato,
      material: materialClean,
      widthCm: null,
      heightCm: null,
      widthVisibleCm: null,
      heightVisibleCm: null,
      resolutionDpi: null,
      resolutionDpiMax: null,
      widthPx: totalArea.widthPx,
      heightPx: totalArea.heightPx,
      durationSeconds: duration ?? 10,
      notes: null,
    };
  }

  // Physical product needs AREA TOTAL in meters
  if (totalArea.widthM === null || totalArea.heightM === null) return null;

  return {
    productCode: code,
    productName: name,
    colorMode: colorMode === '-' ? null : colorMode,
    acceptedFormats: formato,
    material: materialClean,
    widthCm: totalArea.widthM,
    heightCm: totalArea.heightM,
    widthVisibleCm: visibleArea.widthM,
    heightVisibleCm: visibleArea.heightM,
    resolutionDpi: dpi.min,
    resolutionDpiMax: dpi.max,
    widthPx: null,
    heightPx: null,
    durationSeconds: null,
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

    // Read as array of arrays (preserves duplicate headers by position)
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

    // Skip header row, parse rest
    const dataRows = rows.slice(1);
    const parsed: SpecRow[] = dataRows.map(parseExcelRow).filter((r): r is SpecRow => r !== null);

    if (parsed.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron filas válidas. Verifica que el archivo tenga las columnas: CATEGORIA, Nombre, ID, FORMATO, AREA TOTAL (M/CM/10%), DURACIÓN, RESOLUCIÓN, CODIGO DE COLOR, MATERIAL.',
      }, { status: 400 });
    }

    if (replaceAll) {
      await db.execute(sql`UPDATE order_items SET spec_id = NULL`);
      await db.execute(sql`DELETE FROM product_specs`);
    }

    // Build material → supplier_id map
    const allSuppliers = await db.select({ id: suppliers.id, materials: suppliers.materials }).from(suppliers);
    const materialToSupplierId = new Map<string, number>();
    for (const s of allSuppliers) {
      if (!s.materials) continue;
      for (const mat of s.materials.split(',')) {
        const key = mat.trim().toLowerCase();
        if (key) materialToSupplierId.set(key, s.id);
      }
    }

    await db
      .insert(productSpecs)
      .values(parsed.map(s => ({
        productCode: s.productCode,
        productName: s.productName,
        colorMode: s.colorMode,
        acceptedFormats: s.acceptedFormats,
        material: s.material,
        supplierId: s.material ? (materialToSupplierId.get(s.material.toLowerCase()) ?? null) : null,
        widthCm: s.widthCm?.toString() ?? null,
        heightCm: s.heightCm?.toString() ?? null,
        widthVisibleCm: s.widthVisibleCm?.toString() ?? null,
        heightVisibleCm: s.heightVisibleCm?.toString() ?? null,
        resolutionDpi: s.resolutionDpi,
        resolutionDpiMax: s.resolutionDpiMax,
        widthPx: s.widthPx,
        heightPx: s.heightPx,
        durationSeconds: s.durationSeconds,
        notes: s.notes,
      })))
      .onConflictDoUpdate({
        target: productSpecs.productCode,
        set: {
          productName: sql`excluded.product_name`,
          colorMode: sql`excluded.color_mode`,
          acceptedFormats: sql`excluded.accepted_formats`,
          material: sql`excluded.material`,
          supplierId: sql`excluded.supplier_id`,
          widthCm: sql`excluded.width_cm`,
          heightCm: sql`excluded.height_cm`,
          widthVisibleCm: sql`excluded.width_visible_cm`,
          heightVisibleCm: sql`excluded.height_visible_cm`,
          resolutionDpi: sql`excluded.resolution_dpi`,
          resolutionDpiMax: sql`excluded.resolution_dpi_max`,
          widthPx: sql`excluded.width_px`,
          heightPx: sql`excluded.height_px`,
          durationSeconds: sql`excluded.duration_seconds`,
          notes: sql`excluded.notes`,
        },
      });

    if (replaceAll) {
      await db.execute(sql`
        UPDATE order_items oi
        SET spec_id = ps.id
        FROM product_specs ps
        WHERE oi.product_code = ps.product_code
      `);
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
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Error al importar el archivo: ${msg}` }, { status: 500 });
  }
}
