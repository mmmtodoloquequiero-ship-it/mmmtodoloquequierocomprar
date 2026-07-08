-- ========================================================
-- SCRIPT DE MIGRACIÓN: RESERVAS AVANZADAS
-- ========================================================
-- Ejecuta este script en el SQL Editor de tu consola de Supabase.
-- Resolverá el error de "intenta más tarde" creando la tabla necesaria,
-- y añadirá soporte para la nueva funcionalidad de horarios de reservas.

-- 1. Asegurar nuevas columnas de configuración en public.tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS reservations_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS reservation_deposit_amount NUMERIC DEFAULT 0;

-- 1.5. AÑADIR NUEVA COLUMNA DE HORARIOS DE RESERVAS
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS reservation_hours JSONB DEFAULT '{
  "enabled": false,
  "schedule": {
    "1": [{"open": "00:00", "close": "23:59"}],
    "2": [{"open": "00:00", "close": "23:59"}],
    "3": [{"open": "00:00", "close": "23:59"}],
    "4": [{"open": "00:00", "close": "23:59"}],
    "5": [{"open": "00:00", "close": "23:59"}],
    "6": [{"open": "00:00", "close": "23:59"}],
    "0": [{"open": "00:00", "close": "23:59"}]
  }
}'::jsonb;

-- 2. Asegurar columna discount_amount en public.orders para el registro de descuento de señas en pedidos
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;

-- 3. Crear tabla de Reservas con columnas de control de cupones y seña
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    party_size INTEGER NOT NULL,
    status TEXT DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'confirmed', 'cancelled', 'completed')),
    deposit_amount NUMERIC DEFAULT 0,
    reservation_code TEXT UNIQUE,
    is_deposit_applied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en la tabla de reservas
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Políticas públicas de lectura y escritura
DROP POLICY IF EXISTS "Lectura pública de reservas" ON public.reservations;
CREATE POLICY "Lectura pública de reservas" ON public.reservations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Escritura pública de reservas" ON public.reservations;
CREATE POLICY "Escritura pública de reservas" ON public.reservations FOR ALL USING (true) WITH CHECK (true);

-- 4. Habilitar Replicación en Tiempo Real para la tabla de reservas de forma segura
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;
