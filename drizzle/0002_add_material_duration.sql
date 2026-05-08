-- Add material and duration_seconds columns to product_specs
ALTER TABLE product_specs
  ADD COLUMN IF NOT EXISTS material VARCHAR(255),
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
