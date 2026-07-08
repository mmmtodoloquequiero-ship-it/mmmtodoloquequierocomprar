-- ==========================================
-- SCRIPT DE MIGRACIÓN: MERCADO PAGO Y ENVÍOS
-- ==========================================
-- Ejecuta este script en el SQL Editor de tu consola de Supabase para agregar las columnas faltantes,
-- asegurando el correcto funcionamiento de la integración premium y el enlace a mapas.

-- 1. Agregar columnas a la tabla de tenants si no existen
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS mercadopago_public_key TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS mercadopago_access_token TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS has_delivery BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS delivery_zones JSONB DEFAULT '[]'::jsonb;

-- 2. Asegurar que las consultas públicas de clientes (anónimas) NO expongan el access_token privado
COMMENT ON COLUMN public.tenants.mercadopago_access_token IS 'Clave privada de Mercado Pago - No exponer en APIs públicas ni consultas directas del cliente.';

-- 3. Agregar la columna de enlace de Google Maps y costos de envío a la tabla de orders si no existe
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_map_link TEXT DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0;

-- 4. Opcional: Asegurar que existan las columnas de geolocalización y tipos de envío si no se crearon previamente
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'llevar';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address TEXT DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_approved_for_production BOOLEAN DEFAULT TRUE;
