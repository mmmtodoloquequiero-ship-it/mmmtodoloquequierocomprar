-- ==============================================================================
-- SCRIPT FINAL DE MIGRACIÓN: FUNCIONES PREMIUM (Reservas, Delivery, Plataformas)
-- ==============================================================================
-- Ejecutar este script en el editor SQL de tu panel de Supabase.

-- 1. Reservas
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS reservations_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS reservation_deposit_amount NUMERIC DEFAULT 0;

-- 2. Días de Delivery Propio
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS delivery_days JSONB DEFAULT '[]'::jsonb;

-- 3. Integración con Plataformas (Rappi / PedidosYa)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS delivery_apps_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS delivery_apps_token TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS delivery_apps_markup NUMERIC DEFAULT 0;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS rappi_store_id TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS pedidosya_store_id TEXT DEFAULT '';

-- 4. Botón de Pánico y Horarios para Delivery Apps
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_delivery_apps_panic_active BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS delivery_apps_schedule JSONB DEFAULT '{"monday":{"open":"","close":""},"tuesday":{"open":"","close":""},"wednesday":{"open":"","close":""},"thursday":{"open":"","close":""},"friday":{"open":"","close":""},"saturday":{"open":"","close":""},"sunday":{"open":"","close":""}}'::jsonb;

-- 5. Confirmar que la caché de Supabase se actualice
NOTIFY pgrst, 'reload schema';
