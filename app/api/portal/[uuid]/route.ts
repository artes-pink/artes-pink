import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadLinks, orders, orderItems, productSpecs, uploads } from '@/lib/schema';
import { and, eq, desc } from 'drizzle-orm';

export async function GET(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  try {
    const { uuid } = await params;
    const [link] = await db
      .select()
      .from(uploadLinks)
      .where(eq(uploadLinks.uuid, uuid))
      .limit(1);

    if (!link) {
      return NextResponse.json({ error: 'Link no encontrado' }, { status: 404 });
    }

    if (!link.isActive) {
      return NextResponse.json({ error: 'Este link ha sido desactivado' }, { status: 410 });
    }

    if (new Date() > new Date(link.expiresAt)) {
      return NextResponse.json({ error: 'Este link ha vencido. Contacta a tu agente de ventas.' }, { status: 410 });
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, link.orderId)).limit(1);

    const items = await db
      .select({
        id: orderItems.id,
        productCode: orderItems.productCode,
        productName: orderItems.productName,
        quantity: orderItems.quantity,
        specId: orderItems.specId,
        spec: {
          id: productSpecs.id,
          widthCm: productSpecs.widthCm,
          heightCm: productSpecs.heightCm,
          widthVisibleCm: productSpecs.widthVisibleCm,
          heightVisibleCm: productSpecs.heightVisibleCm,
          resolutionDpi: productSpecs.resolutionDpi,
          widthPx: productSpecs.widthPx,
          heightPx: productSpecs.heightPx,
          colorMode: productSpecs.colorMode,
          acceptedFormats: productSpecs.acceptedFormats,
          notes: productSpecs.notes,
        },
      })
      .from(orderItems)
      .leftJoin(productSpecs, eq(orderItems.specId, productSpecs.id))
      .where(and(
        eq(orderItems.orderId, link.orderId),
        eq(orderItems.excludedFromPortal, false)
      ));

    // Get the latest upload for each item
    const itemsWithUploads = await Promise.all(
      items.map(async (item) => {
        const latestUploads = await db
          .select()
          .from(uploads)
          .where(eq(uploads.orderItemId, item.id))
          .orderBy(desc(uploads.createdAt))
          .limit(1);
        return { ...item, latestUpload: latestUploads[0] || null };
      })
    );

    return NextResponse.json({
      link: {
        uuid: link.uuid,
        expiresAt: link.expiresAt,
        allUploadedAt: link.allUploadedAt,
      },
      order: {
        odooOrderId: order.odooOrderId,
        clientName: order.clientName,
      },
      items: itemsWithUploads,
    });
  } catch (error) {
    console.error('GET /api/portal/[uuid] error:', error);
    return NextResponse.json({ error: 'Error al cargar el portal' }, { status: 500 });
  }
}
