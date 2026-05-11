import { db } from '../lib/db';
import { productSpecs } from '../lib/schema';
import { sql } from 'drizzle-orm';

async function main() {
  const count = await db.select({ total: sql`count(*)` }).from(productSpecs);
  console.log('Specs en DB:', count[0].total);
  const sample = await db.select().from(productSpecs).limit(3);
  console.log('Muestra:', JSON.stringify(sample.map(s => ({ code: s.productCode, name: s.productName })), null, 2));
}
main().catch(console.error).finally(() => process.exit());
