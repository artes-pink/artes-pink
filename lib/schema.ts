import { pgTable, serial, varchar, text, decimal, integer, boolean, timestamp, jsonb, uuid } from 'drizzle-orm/pg-core';

export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  materials: text('materials'), // comma-separated list of material names this supplier handles
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const productSpecs = pgTable('product_specs', {
  id: serial('id').primaryKey(),
  productCode: varchar('product_code', { length: 100 }).unique().notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  // Physical products (CMYK) — dimensions in cm
  widthCm: decimal('width_cm', { precision: 8, scale: 2 }),
  heightCm: decimal('height_cm', { precision: 8, scale: 2 }),
  widthVisibleCm: decimal('width_visible_cm', { precision: 8, scale: 2 }),
  heightVisibleCm: decimal('height_visible_cm', { precision: 8, scale: 2 }),
  resolutionDpi: integer('resolution_dpi'),
  resolutionDpiMax: integer('resolution_dpi_max'),
  // Digital products (RGB) — dimensions in pixels
  widthPx: integer('width_px'),
  heightPx: integer('height_px'),
  // Metadata
  colorMode: varchar('color_mode', { length: 10 }),
  acceptedFormats: varchar('accepted_formats', { length: 100 }),
  material: varchar('material', { length: 255 }),
  durationSeconds: integer('duration_seconds'),
  supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  odooOrderId: varchar('odoo_order_id', { length: 50 }).unique().notNull(),
  clientName: varchar('client_name', { length: 255 }).notNull(),
  clientEmail: varchar('client_email', { length: 255 }),
  odooRawData: jsonb('odoo_raw_data'),
  sentToPrintAt: timestamp('sent_to_print_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  odooLineId: integer('odoo_line_id'),
  productCode: varchar('product_code', { length: 100 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  specId: integer('spec_id').references(() => productSpecs.id),
  excludedFromPortal: boolean('excluded_from_portal').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const uploadLinks = pgTable('upload_links', {
  id: serial('id').primaryKey(),
  uuid: uuid('uuid').unique().notNull().defaultRandom(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  isActive: boolean('is_active').default(true),
  allUploadedAt: timestamp('all_uploaded_at'),
  notificationSent: boolean('notification_sent').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const uploads = pgTable('uploads', {
  id: serial('id').primaryKey(),
  orderItemId: integer('order_item_id').references(() => orderItems.id, { onDelete: 'cascade' }).notNull(),
  uploadLinkId: integer('upload_link_id').references(() => uploadLinks.id, { onDelete: 'cascade' }).notNull(),
  filenameOriginal: varchar('filename_original', { length: 500 }).notNull(),
  filenameStorage: varchar('filename_storage', { length: 500 }).notNull(),
  fileSizeBytes: integer('file_size_bytes'),
  fileFormat: varchar('file_format', { length: 10 }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  detectedWidthPx: integer('detected_width_px'),
  detectedHeightPx: integer('detected_height_px'),
  detectedDpi: integer('detected_dpi'),
  detectedWidthCm: decimal('detected_width_cm', { precision: 8, scale: 2 }),
  detectedHeightCm: decimal('detected_height_cm', { precision: 8, scale: 2 }),
  validationErrors: jsonb('validation_errors'),
  validatedAt: timestamp('validated_at'),
  r2Bucket: varchar('r2_bucket', { length: 255 }),
  r2Key: varchar('r2_key', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const printJobItems = pgTable('print_job_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  orderItemId: integer('order_item_id').references(() => orderItems.id, { onDelete: 'cascade' }).notNull(),
  supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  sentAt: timestamp('sent_at').defaultNow(),
});

export type ProductSpec = typeof productSpecs.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type UploadLink = typeof uploadLinks.$inferSelect;
export type Upload = typeof uploads.$inferSelect;
