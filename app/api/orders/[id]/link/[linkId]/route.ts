import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadLinks, uploads } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    const { linkId } = await params;
    const id = parseInt(linkId);

    const [link] = await db.select().from(uploadLinks).where(eq(uploadLinks.id, id)).limit(1);
    if (!link) {
      return NextResponse.json({ error: 'Link no encontrado' }, { status: 404 });
    }

    await db.delete(uploads).where(eq(uploads.uploadLinkId, id));
    await db.delete(uploadLinks).where(eq(uploadLinks.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/orders/[id]/link/[linkId] error:', error);
    return NextResponse.json({ error: 'Error al eliminar el link' }, { status: 500 });
  }
}
