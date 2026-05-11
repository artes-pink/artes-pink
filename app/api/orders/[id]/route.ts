import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderItems, uploadLinks, uploads, productSpecs } from '@/lib/schema';
import { eq, desc, inArray } from 'drizzle-orm';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    const items = await db
      .select({
        id: orderItems.id,
        productCode: orderItems.productCode,
        productName: orderItems.productName,
        quantity: orderItems.quantity,
        specId: orderItems.specId,
        excludedFromPortal: orderItems.excludedFromPortal,
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
          material: productSpecs.material,
          supplierId: productSpecs.supplierId,
          notes: productSpecs.notes,
        },
      })
      .from(orderItems)
      .leftJoin(productSpecs, eq(orderItems.specId, productSpecs.id))
      .where(eq(orderItems.orderId, orderId));

    const links = await db
      .select()
      .from(uploadLinks)
      .where(eq(uploadLinks.orderId, orderId))
      .orderBy(desc(uploadLinks.createdAt));

    // Get uploads for each link
    const linksWithUploads = await Promise.all(
      links.map(async (link) => {
        const linkUploads = await db
          .select()
          .from(uploads)
          .where(eq(uploads.uploadLinkId, link.id));
        return { ...link, uploads: linkUploads };
      })
    );

    return NextResponse.json({ order, items, links: linksWithUploads });
  } catch (error) {
    console.error('GET /api/orders/[id] error:', error);
    return NextResponse.json({ error: 'Error al obtener la orden' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    // Delete uploads for all links of this order
    const links = await db.select({ id: uploadLinks.id }).from(uploadLinks).where(eq(uploadLinks.orderId, orderId));
    if (links.length > 0) {
      await db.delete(uploads).where(inArray(uploads.uploadLinkId, links.map(l => l.id)));
    }

    // Delete upload links, order items, and order
    await db.delete(uploadLinks).where(eq(uploadLinks.orderId, orderId));
    await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    await db.delete(orders).where(eq(orders.id, orderId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/orders/[id] error:', error);
    return NextResponse.json({ error: 'Error al eliminar la orden' }, { status: 500 });
  }
}
