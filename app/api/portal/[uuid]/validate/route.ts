import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadLinks, uploads, orderItems, productSpecs } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { getFileBuffer } from '@/lib/r2';
import { validateFile } from '@/lib/validation';
import { z } from 'zod';

export const maxDuration = 60; // Allow up to 60s for large file validation

const bodySchema = z.object({
  uploadId: z.number(),
  mimeType: z.string(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  try {
    const { uuid } = await params;
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const { uploadId, mimeType } = parsed.data;

    // Get the link
    const [link] = await db
      .select()
      .from(uploadLinks)
      .where(eq(uploadLinks.uuid, uuid))
      .limit(1);

    if (!link || !link.isActive || new Date() > new Date(link.expiresAt)) {
      return NextResponse.json({ error: 'Link inválido o vencido' }, { status: 403 });
    }

    // Get the upload record
    const [upload] = await db
      .select()
      .from(uploads)
      .where(and(eq(uploads.id, uploadId), eq(uploads.uploadLinkId, link.id)))
      .limit(1);

    if (!upload) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    // Get the order item and its spec
    const [itemWithSpec] = await db
      .select({
        item: orderItems,
        spec: productSpecs,
      })
      .from(orderItems)
      .leftJoin(productSpecs, eq(orderItems.specId, productSpecs.id))
      .where(eq(orderItems.id, upload.orderItemId))
      .limit(1);

    if (!itemWithSpec) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    if (!itemWithSpec.spec) {
      // No spec configured - skip validation, mark as valid with warning
      await db
        .update(uploads)
        .set({
          status: 'valid',
          validationErrors: ['Sin especificaciones configuradas — validación omitida'],
          validatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(uploads.id, uploadId));

      return NextResponse.json({
        valid: true,
        warnings: ['Este producto no tiene especificaciones configuradas. El arte fue aceptado sin validar dimensiones.'],
        errors: [],
        detected: {},
      });
    }

    // Download file from R2 for validation
    const buffer = await getFileBuffer(upload.r2Key!);

    const s = itemWithSpec.spec;
    const spec = {
      widthCm: s.widthCm ? parseFloat(s.widthCm) : null,
      heightCm: s.heightCm ? parseFloat(s.heightCm) : null,
      resolutionDpi: s.resolutionDpi ?? null,
      widthPx: s.widthPx ?? null,
      heightPx: s.heightPx ?? null,
    };

    const result = await validateFile(buffer, mimeType, spec);

    // Update upload record with validation results
    await db
      .update(uploads)
      .set({
        status: result.valid ? 'valid' : 'invalid',
        validationErrors: result.errors.length > 0 ? result.errors : null,
        detectedWidthPx: result.detected.widthPx ?? null,
        detectedHeightPx: result.detected.heightPx ?? null,
        detectedDpi: result.detected.dpi ?? null,
        detectedWidthCm: result.detected.widthCm?.toString() ?? null,
        detectedHeightCm: result.detected.heightCm?.toString() ?? null,
        validatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(uploads.id, uploadId));

    return NextResponse.json({
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
      detected: result.detected,
    });
  } catch (error) {
    console.error('POST /api/portal/[uuid]/validate error:', error);
    return NextResponse.json({ error: 'Error al validar el archivo' }, { status: 500 });
  }
}

