-- Add materials list to suppliers
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS materials TEXT;
