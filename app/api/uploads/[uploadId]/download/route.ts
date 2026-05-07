import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploads } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { generatePresignedDownloadUrl } from '@/lib/r2';

export async function GET(request: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  try {
    const { uploadId } = await params;
    const [upload] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, parseInt(uploadId)))
      .limit(1);

    if (!upload || !upload.r2Key) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    const downloadUrl = await generatePresignedDownloadUrl(upload.r2Key, upload.filenameOriginal ?? undefined);
    return NextResponse.json({ downloadUrl, filename: upload.filenameOriginal });
  } catch (error) {
    console.error('GET /api/uploads/[uploadId]/download error:', error);
    return NextResponse.json({ error: 'Error al generar el link de descarga' }, { status: 500 });
  }
}
