import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, uploadLinks } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    // Expire in 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const [link] = await db
      .insert(uploadLinks)
      .values({ orderId, expiresAt })
      .returning();

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/${link.uuid}`;

    return NextResponse.json({
      success: true,
      link: { ...link, portalUrl },
    });
  } catch (error) {
    console.error('POST /api/orders/[id]/link error:', error);
    return NextResponse.json({ error: 'Error al generar el link' }, { status: 500 });
  }
}
