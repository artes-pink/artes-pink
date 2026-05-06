import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderItems, uploadLinks, uploads, productSpecs } from '@/lib/schema';
import { fetchOdooOrder } from '@/lib/odoo';
import { and, eq, desc, isNotNull } from 'drizzle-orm';
import { createSupabaseServerClient } from '@/lib/supabase';

// GET /api/orders - list all orders with link status
export async function GET() {
  try {
    const allOrders = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt));

    const result = await Promise.all(allOrders.map(async (order) => {
      const links = await db
        .select({ id: uploadLinks.id, allUploadedAt: uploadLinks.allUploadedAt })
        .from(uploadLinks)
        .where(eq(uploadLinks.orderId, order.id));

      const linkCount = links.length;

      // An order is complete if all non-excluded items have at least one valid upload
      let completedLinks = 0;
      if (linkCount > 0) {
        const items = await db
          .select({ id: orderItems.id })
          .from(orderItems)
          .where(and(
            eq(orderItems.orderId, order.id),
            eq(orderItems.excludedFromPortal, false)
          ));

        if (items.length > 0) {
          const allValid = await Promise.all(items.map(async (item) => {
            const validUpload = await db
              .select({ id: uploads.id })
              .from(uploads)
              .where(and(
                eq(uploads.orderItemId, item.id),
                eq(uploads.status, 'valid')
              ))
              .limit(1);
            return validUpload.length > 0;
          }));

          if (allValid.every(Boolean)) completedLinks = 1;
        }
      }

      return { ...order, linkCount, completedLinks };
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/orders error:', error);
    return NextResponse.json({ error: 'Error al obtener las órdenes' }, { status: 500 });
  }
}

// POST /api/orders - fetch order from Odoo and save to DB
export async function POST(request: NextRequest) {
  try {
    const { orderNumber } = await request.json();
    if (!orderNumber) {
      return NextResponse.json({ error: 'Se requiere el número de orden' }, { status: 400 });
    }

    // Fetch from Odoo
    const odooData = await fetchOdooOrder(orderNumber);

    // Upsert order
    const [order] = await db
      .insert(orders)
      .values({
        odooOrderId: odooData.odooOrderId,
        clientName: odooData.clientName,
        clientEmail: odooData.clientEmail,
        odooRawData: odooData.rawData as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: orders.odooOrderId,
        set: {
          clientName: odooData.clientName,
          clientEmail: odooData.clientEmail,
          odooRawData: odooData.rawData as Record<string, unknown>,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Delete existing order items and re-insert (re-sync from Odoo)
    await db.delete(orderItems).where(eq(orderItems.orderId, order.id));

    // For each line, look up spec by product code
    const itemsToInsert = await Promise.all(
      odooData.lines.map(async (line) => {
        const specRows = await db
          .select()
          .from(productSpecs)
          .where(eq(productSpecs.productCode, line.productCode))
          .limit(1);

        return {
          orderId: order.id,
          odooLineId: line.odooLineId,
          productCode: line.productCode,
          productName: line.productName,
          quantity: line.quantity,
          specId: specRows[0]?.id ?? null,
        };
      })
    );

    if (itemsToInsert.length > 0) {
      await db.insert(orderItems).values(itemsToInsert);
    }

    return NextResponse.json({ success: true, orderId: order.id, order: odooData });
  } catch (error) {
    console.error('POST /api/orders error:', error);
    const message = error instanceof Error ? error.message : 'Error al importar la orden de Odoo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
