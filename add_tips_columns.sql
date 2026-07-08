-- Agrega las columnas de configuración de propinas y cubiertos
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tips_enabled BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS table_charge_enabled BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS table_charge_amount NUMERIC DEFAULT 0;

-- Asegurarse de que el caché del schema de Supabase se recargue
NOTIFY pgrst, 'reload schema';
