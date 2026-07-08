-- Script de Migración para Seguridad y Control de Empleados
-- Ejecutar en el Editor SQL de Supabase

-- 1. Añadir el límite de dispositivos a las sucursales (tenants)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS max_devices INTEGER DEFAULT 3;

-- 2. Crear tabla de Empleados
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    pin_code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Crear tabla de Dispositivos Activos (Sesiones)
CREATE TABLE IF NOT EXISTS public.active_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_devices ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad de Desarrollo (Se volverán restrictivas más adelante)
-- Empleados
DROP POLICY IF EXISTS "Lectura publica employees" ON public.employees;
CREATE POLICY "Lectura publica employees" ON public.employees FOR SELECT USING (true);

DROP POLICY IF EXISTS "Insercion publica employees" ON public.employees;
CREATE POLICY "Insercion publica employees" ON public.employees FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Actualizacion publica employees" ON public.employees;
CREATE POLICY "Actualizacion publica employees" ON public.employees FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Borrado publico employees" ON public.employees;
CREATE POLICY "Borrado publico employees" ON public.employees FOR DELETE USING (true);

-- Dispositivos
DROP POLICY IF EXISTS "Lectura publica active_devices" ON public.active_devices;
CREATE POLICY "Lectura publica active_devices" ON public.active_devices FOR SELECT USING (true);

DROP POLICY IF EXISTS "Insercion publica active_devices" ON public.active_devices;
CREATE POLICY "Insercion publica active_devices" ON public.active_devices FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Borrado publico active_devices" ON public.active_devices;
CREATE POLICY "Borrado publico active_devices" ON public.active_devices FOR DELETE USING (true);

-- Habilitar Realtime para expulsiones en vivo
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.active_devices;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;
