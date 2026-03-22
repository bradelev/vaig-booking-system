-- Add category column to services
ALTER TABLE services ADD COLUMN IF NOT EXISTS category text;

-- Populate categories based on service names
UPDATE services SET category = 'Masajes' WHERE LOWER(name) ILIKE '%masaje%' OR LOWER(name) ILIKE '%masaj%';
UPDATE services SET category = 'Facial' WHERE LOWER(name) ILIKE '%facial%' OR LOWER(name) ILIKE '%limpieza%' OR LOWER(name) ILIKE '%peeling%';
UPDATE services SET category = 'Cejas y Pestañas' WHERE LOWER(name) ILIKE '%ceja%' OR LOWER(name) ILIKE '%pestaña%' OR LOWER(name) ILIKE '%lifting%';
UPDATE services SET category = 'Manos y Pies' WHERE LOWER(name) ILIKE '%mano%' OR LOWER(name) ILIKE '%pie%' OR LOWER(name) ILIKE '%manicur%' OR LOWER(name) ILIKE '%pedicur%';
UPDATE services SET category = 'Depilación Láser' WHERE LOWER(name) ILIKE '%depila%' OR LOWER(name) ILIKE '%laser%' OR LOWER(name) ILIKE '%láser%';
UPDATE services SET category = 'Day Spa' WHERE LOWER(name) ILIKE '%spa%' OR LOWER(name) ILIKE '%ritual%';
UPDATE services SET category = 'Aparatología / HIFU' WHERE LOWER(name) ILIKE '%hifu%' OR LOWER(name) ILIKE '%aparato%' OR LOWER(name) ILIKE '%radiofrecuencia%' OR LOWER(name) ILIKE '%ultrasonido%';
UPDATE services SET category = 'Combos' WHERE LOWER(name) ILIKE '%combo%' OR LOWER(name) ILIKE '%pack%' OR LOWER(name) ILIKE '%promo%';
-- Default for uncategorized
UPDATE services SET category = 'Otros' WHERE category IS NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS services_category_idx ON services (category);
