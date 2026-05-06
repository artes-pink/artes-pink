-- Run this SQL in your Supabase SQL editor to initialize the database

CREATE TABLE IF NOT EXISTS product_specs (
  id SERIAL PRIMARY KEY,
  product_code VARCHAR(100) UNIQUE NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  width_cm DECIMAL(8,2) NOT NULL,
  height_cm DECIMAL(8,2) NOT NULL,
  resolution_dpi INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  odoo_order_id VARCHAR(50) UNIQUE NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255),
  odoo_raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  odoo_line_id INTEGER,
  product_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  spec_id INTEGER REFERENCES product_specs(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS upload_links (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  all_uploaded_at TIMESTAMP,
  notification_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uploads (
  id SERIAL PRIMARY KEY,
  order_item_id INTEGER REFERENCES order_items(id) ON DELETE CASCADE NOT NULL,
  upload_link_id INTEGER REFERENCES upload_links(id) ON DELETE CASCADE NOT NULL,
  filename_original VARCHAR(500) NOT NULL,
  filename_storage VARCHAR(500) NOT NULL,
  file_size_bytes INTEGER,
  file_format VARCHAR(10),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  detected_width_px INTEGER,
  detected_height_px INTEGER,
  detected_dpi INTEGER,
  detected_width_cm DECIMAL(8,2),
  detected_height_cm DECIMAL(8,2),
  validation_errors JSONB,
  validated_at TIMESTAMP,
  r2_bucket VARCHAR(255),
  r2_key VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_upload_links_order_id ON upload_links(order_id);
CREATE INDEX IF NOT EXISTS idx_upload_links_uuid ON upload_links(uuid);
CREATE INDEX IF NOT EXISTS idx_uploads_order_item_id ON uploads(order_item_id);
CREATE INDEX IF NOT EXISTS idx_uploads_upload_link_id ON uploads(upload_link_id);
