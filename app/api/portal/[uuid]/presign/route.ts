import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadLinks, orderItems, uploads } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { generatePresignedUploadUrl, buildR2Key } from '@/lib/r2';
import { z } from 'zod';

const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/pdf': 'pdf',
};

const bodySchema = z.object({
  orderItemId: z.number(),
  filename: z.string(),
  mimeType: z.string(),
  fileSizeBytes: z.number().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  try {
    const { uuid } = await params;
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const { orderItemId, filename, mimeType, fileSizeBytes } = parsed.data;

    if (!ALLOWED_TYPES[mimeType]) {
      return NextResponse.json({
        error: 'Formato no permitido. Solo se aceptan PNG, JPG y PDF.',
      }, { status: 400 });
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

    const r2Key = buildR2Key(uuid, orderItemId, filename);
    const presignedUrl = await generatePresignedUploadUrl(r2Key);

    // Create a pending upload record
    const [upload] = await db
      .insert(uploads)
      .values({
        orderItemId,
        uploadLinkId: link.id,
        filenameOriginal: filename,
        filenameStorage: r2Key,
        fileSizeBytes: fileSizeBytes || null,
        fileFormat: ALLOWED_TYPES[mimeType],
        status: 'pending',
        r2Bucket: process.env.R2_BUCKET_NAME!,
        r2Key,
      })
      .returning();

    return NextResponse.json({ presignedUrl, uploadId: upload.id, r2Key });
  } catch (error) {
    console.error('POST /api/portal/[uuid]/presign error:', error);
    return NextResponse.json({ error: 'Error al generar la URL de subida' }, { status: 500 });
  }
}
