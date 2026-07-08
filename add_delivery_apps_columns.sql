-- ==============================================================
-- SCRIPT DE MIGRACIÓN: INTEGRACIÓN DE PLATAFORMAS DE DELIVERY
-- ==============================================================
-- Ejecuta este script en el SQL Editor de tu consola de Supabase.
-- Esto agregará las columnas necesarias para Rappi, PedidosYa,
-- zonas de envío, reservas de mesa y Mercado Pago.

-- 1. Agregar columnas para la integración de Apps de Delivery a la tabla tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS delivery_apps_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS delivery_apps_token TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS delivery_apps_markup NUMERIC DEFAULT 0;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS rappi_store_id TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS pedidosya_store_id TEXT DEFAULT '';

-- 2. Asegurar que las columnas premium de Mercado Pago y Envíos también existan
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS mercadopago_public_key TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS mercadopago_access_token TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS has_delivery BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS delivery_zones JSONB DEFAULT '[]'::jsonb;

-- 3. Asegurar las columnas en la tabla de pedidos (orders)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'llevar';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address TEXT DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_map_link TEXT DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_approved_for_production BOOLEAN DEFAULT TRUE;

-- 4. Comentario de seguridad para el token de Mercado Pago
COMMENT ON COLUMN public.tenants.mercadopago_access_token IS 'Clave privada de Mercado Pago - No exponer en APIs públicas.';
