import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadLinks, uploads, orderItems, orders } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { generateLongLivedDownloadUrl, getFileBuffer } from '@/lib/r2';
import { sendOrderReadyNotification, UploadEmailInfo } from '@/lib/email';
import sharp from 'sharp';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  try {
    const { uuid } = await params;

    const [link] = await db
      .select()
      .from(uploadLinks)
      .where(eq(uploadLinks.uuid, uuid))
      .limit(1);

    if (!link || !link.isActive || new Date() > new Date(link.expiresAt)) {
      return NextResponse.json({ error: 'Link inválido o vencido' }, { status: 403 });
    }

    // Already submitted — return success idempotently
    if (link.allUploadedAt) {
      return NextResponse.json({ success: true });
    }

    // Get all items for this order (non-excluded)
    const items = await db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(and(eq(orderItems.orderId, link.orderId), eq(orderItems.excludedFromPortal, false)));

    if (items.length === 0) {
      return NextResponse.json({ error: 'No hay productos en esta orden' }, { status: 400 });
    }

    // Verify all items have at least one valid upload
    const checks = await Promise.all(
      items.map(async (item) => {
        const [valid] = await db
          .select({ id: uploads.id })
          .from(uploads)
          .where(and(
            eq(uploads.orderItemId, item.id),
            eq(uploads.uploadLinkId, link.id),
            eq(uploads.status, 'valid'),
          ))
          .limit(1);
        return !!valid;
      })
    );

    if (!checks.every(Boolean)) {
      return NextResponse.json({ error: 'Aún hay artes pendientes de validar' }, { status: 400 });
    }

    // Mark as submitted
    await db
      .update(uploadLinks)
      .set({ allUploadedAt: new Date() })
      .where(eq(uploadLinks.id, link.id));

    // Send email if not already sent
    if (!link.notificationSent) {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, link.orderId))
        .limit(1);

      if (order) {
        // Get all valid uploads for this link
        const validUploads = await db
          .select({
            r2Key: uploads.r2Key,
            filenameOriginal: uploads.filenameOriginal,
            fileFormat: uploads.fileFormat,
            detectedWidthCm: uploads.detectedWidthCm,
            detectedHeightCm: uploads.detectedHeightCm,
            detectedDpi: uploads.detectedDpi,
          })
          .from(uploads)
          .where(and(eq(uploads.uploadLinkId, link.id), eq(uploads.status, 'valid')));

        const emailUploads: UploadEmailInfo[] = await Promise.all(
          validUploads.map(async (u) => {
            const downloadUrl = await generateLongLivedDownloadUrl(u.r2Key!);

            let thumbnailBase64: string | undefined;
            const isImage = u.fileFormat === 'jpg' || u.fileFormat === 'png';
            if (isImage && u.r2Key) {
              try {
                const buffer = await getFileBuffer(u.r2Key);
                const thumb = await sharp(buffer)
                  .resize(400, 300, { fit: 'inside', withoutEnlargement: true })
                  .jpeg({ quality: 72 })
                  .toBuffer();
                thumbnailBase64 = thumb.toString('base64');
              } catch {
                // Skip thumbnail on error
              }
            }

            return {
              filename: u.filenameOriginal,
              downloadUrl,
              fileFormat: u.fileFormat,
              detectedWidthCm: u.detectedWidthCm?.toString() ?? null,
              detectedHeightCm: u.detectedHeightCm?.toString() ?? null,
              detectedDpi: u.detectedDpi,
              thumbnailBase64,
            };
          })
        );

        try {
          await sendOrderReadyNotification({
            orderNumber: order.odooOrderId,
            clientName: order.clientName,
            itemCount: items.length,
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/orders/${order.id}`,
            uploads: emailUploads,
          });

          await db
            .update(uploadLinks)
            .set({ notificationSent: true })
            .where(eq(uploadLinks.id, link.id));
        } catch (emailErr) {
          console.error('Failed to send notification email:', emailErr);
          // Don't fail the submit if email fails
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/portal/[uuid]/submit error:', error);
    return NextResponse.json({ error: 'Error al enviar los artes' }, { status: 500 });
  }
}
