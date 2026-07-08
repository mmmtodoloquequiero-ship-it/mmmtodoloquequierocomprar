-- Agrega las columnas faltantes en orders para propinas y servicio de mesa
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tip_amount NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_charge NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_tip_paid BOOLEAN DEFAULT false;

-- Asegurarse de que el caché del schema de Supabase se recargue
NOTIFY pgrst, 'reload schema';
