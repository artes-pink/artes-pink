import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orderItems } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params;
    const { excludedFromPortal } = await request.json();

    await db
      .update(orderItems)
      .set({ excludedFromPortal })
      .where(and(
        eq(orderItems.id, parseInt(itemId)),
        eq(orderItems.orderId, parseInt(id))
      ));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/orders/[id]/items/[itemId] error:', error);
    return NextResponse.json({ error: 'Error al actualizar el producto' }, { status: 500 });
  }
}
