-- Este script agrega a la base de datos las columnas que faltan
-- para guardar los links de las imágenes (logos, banners), redes sociales, y las reservas.

-- 1. Columnas faltantes en TENANTS (Locales)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS profile_picture_url TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS banner_url TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS landing_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS delivery_zones JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS reviews_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS tips_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS table_charge_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS table_charge_amount NUMERIC DEFAULT 0;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS delivery_hours JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS reservation_hours JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS delivery_panic_button BOOLEAN DEFAULT FALSE;

-- 2. Columnas faltantes en RESERVATIONS (Reservas)
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS assigned_tables JSONB DEFAULT '[]'::jsonb;

-- 3. Obligar a Supabase a recargar el caché de su base de datos
NOTIFY pgrst, 'reload schema';
