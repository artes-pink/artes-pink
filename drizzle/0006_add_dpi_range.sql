-- Add upper bound for DPI so specs can be a range (150-300 Dpi)
ALTER TABLE product_specs
  ADD COLUMN IF NOT EXISTS resolution_dpi_max INTEGER;
