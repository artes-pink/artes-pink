import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderItems, productSpecs, suppliers, uploads, uploadLinks, printJobItems } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { generateLongLivedDownloadUrl } from '@/lib/r2';
import { sendToPrintNotification } from '@/lib/email';

export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);

    // assignments: [{ itemId, supplierId }]
    const { assignments } = await request.json() as { assignments: { itemId: number; supplierId: number }[] };

    if (!assignments?.length) {
      return NextResponse.json({ error: 'No hay asignaciones' }, { status: 400 });
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

    // Group assignments by supplier
    const bySupplier = new Map<number, number[]>();
    for (const { itemId, supplierId } of assignments) {
      if (!bySupplier.has(supplierId)) bySupplier.set(supplierId, []);
      bySupplier.get(supplierId)!.push(itemId);
    }

    // For each supplier, build email and send
    for (const [supplierId, itemIds] of bySupplier) {
      const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
      if (!supplier) continue;

      // Get items with their specs and latest valid upload
      const itemDetails = await Promise.all(itemIds.map(async (itemId) => {
        const [item] = await db
          .select({ item: orderItems, spec: productSpecs })
          .from(orderItems)
          .leftJoin(productSpecs, eq(orderItems.specId, productSpecs.id))
          .where(eq(orderItems.id, itemId))
          .limit(1);

        if (!item) return null;

        // Get latest valid upload for this item across any link
        const [upload] = await db
          .select()
          .from(uploads)
          .where(and(eq(uploads.orderItemId, itemId), eq(uploads.status, 'valid')))
          .limit(1);

        let downloadUrl: string | null = null;
        if (upload?.r2Key) {
          downloadUrl = await generateLongLivedDownloadUrl(upload.r2Key, upload.filenameOriginal ?? undefined);
        }

        return { item: item.item, spec: item.spec, upload, downloadUrl };
      }));

      const validItems = itemDetails.filter(Boolean) as NonNullable<typeof itemDetails[0]>[];

      await sendToPrintNotification({
        supplierName: supplier.name,
        supplierEmail: supplier.email,
        orderNumber: order.odooOrderId,
        clientName: order.clientName,
        items: validItems.map(d => ({
          productName: d.item.productName,
          productCode: d.item.productCode,
          quantity: d.item.quantity,
          material: d.spec?.material ?? null,
          widthCm: d.spec?.widthCm ?? null,
          heightCm: d.spec?.heightCm ?? null,
          widthPx: d.spec?.widthPx ?? null,
          heightPx: d.spec?.heightPx ?? null,
          colorMode: d.spec?.colorMode ?? null,
          filename: d.upload?.filenameOriginal ?? null,
          downloadUrl: d.downloadUrl,
        })),
      });

      // Record print job items
      await db.insert(printJobItems).values(
        itemIds.map(itemId => ({ orderId, orderItemId: itemId, supplierId }))
      );
    }

    // Mark order as sent to print
    await db.update(orders).set({ sentToPrintAt: new Date() }).where(eq(orders.id, orderId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/orders/[id]/send-to-print error:', error);
    return NextResponse.json({ error: 'Error al enviar a impresión' }, { status: 500 });
  }
}
