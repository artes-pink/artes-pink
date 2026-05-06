import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploads, orderItems, orders, uploadLinks } from '@/lib/schema';
import { eq, sql, desc, and } from 'drizzle-orm';

export async function GET() {
  try {
    // KPI counts
    const [totals] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        valid: sql<number>`SUM(CASE WHEN ${uploads.status} = 'valid' THEN 1 ELSE 0 END)::int`,
        invalid: sql<number>`SUM(CASE WHEN ${uploads.status} = 'invalid' THEN 1 ELSE 0 END)::int`,
        pending: sql<number>`SUM(CASE WHEN ${uploads.status} = 'pending' THEN 1 ELSE 0 END)::int`,
      })
      .from(uploads);

    const [orderStats] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        completed: sql<number>`SUM(CASE WHEN ${uploadLinks.allUploadedAt} IS NOT NULL THEN 1 ELSE 0 END)::int`,
        activeLinks: sql<number>`SUM(CASE WHEN ${uploadLinks.allUploadedAt} IS NULL AND ${uploadLinks.expiresAt} > NOW() THEN 1 ELSE 0 END)::int`,
      })
      .from(uploadLinks);

    // Uploads by day (last 30 days)
    const dailyActivity = await db
      .select({
        day: sql<string>`DATE(${uploads.createdAt})::text`,
        total: sql<number>`COUNT(*)::int`,
        valid: sql<number>`SUM(CASE WHEN ${uploads.status} = 'valid' THEN 1 ELSE 0 END)::int`,
        invalid: sql<number>`SUM(CASE WHEN ${uploads.status} = 'invalid' THEN 1 ELSE 0 END)::int`,
      })
      .from(uploads)
      .where(sql`${uploads.createdAt} >= NOW() - INTERVAL '30 days'`)
      .groupBy(sql`DATE(${uploads.createdAt})`)
      .orderBy(sql`DATE(${uploads.createdAt})`);

    // Recent failed uploads with product/client context
    const recentFailed = await db
      .select({
        id: uploads.id,
        filenameOriginal: uploads.filenameOriginal,
        validationErrors: uploads.validationErrors,
        detectedWidthCm: uploads.detectedWidthCm,
        detectedHeightCm: uploads.detectedHeightCm,
        detectedWidthPx: uploads.detectedWidthPx,
        detectedHeightPx: uploads.detectedHeightPx,
        detectedDpi: uploads.detectedDpi,
        createdAt: uploads.createdAt,
        productCode: orderItems.productCode,
        productName: orderItems.productName,
        clientName: orders.clientName,
        odooOrderId: orders.odooOrderId,
      })
      .from(uploads)
      .innerJoin(orderItems, eq(uploads.orderItemId, orderItems.id))
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(eq(uploads.status, 'invalid'))
      .orderBy(desc(uploads.createdAt))
      .limit(20);

    // Products with most failures
    const productFailures = await db
      .select({
        productCode: orderItems.productCode,
        productName: orderItems.productName,
        invalid: sql<number>`SUM(CASE WHEN ${uploads.status} = 'invalid' THEN 1 ELSE 0 END)::int`,
        valid: sql<number>`SUM(CASE WHEN ${uploads.status} = 'valid' THEN 1 ELSE 0 END)::int`,
        total: sql<number>`COUNT(*)::int`,
      })
      .from(uploads)
      .innerJoin(orderItems, eq(uploads.orderItemId, orderItems.id))
      .groupBy(orderItems.productCode, orderItems.productName)
      .having(sql`SUM(CASE WHEN ${uploads.status} = 'invalid' THEN 1 ELSE 0 END) > 0`)
      .orderBy(sql`SUM(CASE WHEN ${uploads.status} = 'invalid' THEN 1 ELSE 0 END) DESC`)
      .limit(10);

    return NextResponse.json({
      totals: { ...totals, ordersTotal: orderStats.total, ordersCompleted: orderStats.completed, activeLinks: orderStats.activeLinks },
      dailyActivity,
      recentFailed,
      productFailures,
    });
  } catch (error) {
    console.error('GET /api/analytics error:', error);
    return NextResponse.json({ error: 'Error al cargar analytics' }, { status: 500 });
  }
}
