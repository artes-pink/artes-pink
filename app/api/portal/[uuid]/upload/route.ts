import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { db } from '@/lib/db';
import { uploadLinks, orderItems, uploads, productSpecs } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { buildR2Key } from '@/lib/r2';
import { validateFile } from '@/lib/validation';

export const maxDuration = 60;

const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/pdf': 'pdf',
  'image/vnd.adobe.photoshop': 'psd',
  'image/x-photoshop': 'psd',
  'application/photoshop': 'psd',
  'image/psd': 'psd',
  'video/mp4': 'mp4',
};

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID!.trim()}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
  },
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  try {
    const { uuid } = await params;
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const orderItemIdRaw = formData.get('orderItemId');
    const orderItemId = parseInt(orderItemIdRaw as string);

    if (!file || isNaN(orderItemId)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const mimeType = file.type;
    if (!ALLOWED_TYPES[mimeType]) {
      return NextResponse.json({ error: 'Formato no permitido. Solo PNG, JPG y PDF.' }, { status: 400 });
    }

    // Validate link
    const [link] = await db
      .select()
      .from(uploadLinks)
      .where(eq(uploadLinks.uuid, uuid))
      .limit(1);

    if (!link || !link.isActive || new Date() > new Date(link.expiresAt)) {
      return NextResponse.json({ error: 'Link inválido o vencido' }, { status: 403 });
    }
    if (link.allUploadedAt) {
      return NextResponse.json({ error: 'Este pedido ya está completo' }, { status: 409 });
    }

    // Validate item belongs to this link's order
    const [item] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, orderItemId))
      .limit(1);

    if (!item || item.orderId !== link.orderId) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    // Read file and upload to R2 directly (no CORS needed)
    const buffer = Buffer.from(await file.arrayBuffer());
    const r2Key = buildR2Key(uuid, orderItemId, file.name);

    const BUCKET = process.env.R2_BUCKET_NAME!.trim();

    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: r2Key,
      Body: buffer,
      ContentType: mimeType,
    }));

    // Create upload record
    const [upload] = await db
      .insert(uploads)
      .values({
        orderItemId,
        uploadLinkId: link.id,
        filenameOriginal: file.name,
        filenameStorage: r2Key,
        fileSizeBytes: file.size,
        fileFormat: ALLOWED_TYPES[mimeType],
        status: 'pending',
        r2Bucket: BUCKET,
        r2Key,
      })
      .returning();

    // Get spec for validation
    const [itemWithSpec] = await db
      .select({ item: orderItems, spec: productSpecs })
      .from(orderItems)
      .leftJoin(productSpecs, eq(orderItems.specId, productSpecs.id))
      .where(eq(orderItems.id, orderItemId))
      .limit(1);

    // MP4: accept without dimension validation
    if (mimeType === 'video/mp4') {
      await db
        .update(uploads)
        .set({ status: 'valid', validatedAt: new Date(), updatedAt: new Date() })
        .where(eq(uploads.id, upload.id));

      return NextResponse.json({
        valid: true,
        warnings: ['Los archivos de video MP4 se aceptan sin validación automática de dimensiones.'],
        errors: [],
        detected: {},
      });
    }

    // No spec → accept without dimension check
    if (!itemWithSpec?.spec) {
      await db
        .update(uploads)
        .set({ status: 'valid', validatedAt: new Date(), updatedAt: new Date() })
        .where(eq(uploads.id, upload.id));

      return NextResponse.json({
        valid: true,
        warnings: ['Este producto no tiene especificaciones configuradas. El arte fue aceptado sin validar dimensiones.'],
        errors: [],
        detected: {},
      });
    }

    const s = itemWithSpec.spec;
    const spec = {
      widthCm: s.widthCm ? parseFloat(s.widthCm) : null,
      heightCm: s.heightCm ? parseFloat(s.heightCm) : null,
      resolutionDpi: s.resolutionDpi ?? null,
      widthPx: s.widthPx ?? null,
      heightPx: s.heightPx ?? null,
    };

    const result = await validateFile(buffer, mimeType, spec);

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
      .where(eq(uploads.id, upload.id));

    return NextResponse.json({
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
      detected: result.detected,
    });
  } catch (error) {
    console.error('POST /api/portal/[uuid]/upload error:', error);
    return NextResponse.json({ error: 'Error al procesar el archivo' }, { status: 500 });
  }
}
