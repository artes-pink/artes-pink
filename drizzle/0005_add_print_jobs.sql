-- Track when an order was sent to print suppliers
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS sent_to_print_at TIMESTAMP;

-- One row per order-item/supplier assignment when sending to print
CREATE TABLE IF NOT EXISTS print_job_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  order_item_id INTEGER REFERENCES order_items(id) ON DELETE CASCADE NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  sent_at TIMESTAMP DEFAULT NOW()
);
