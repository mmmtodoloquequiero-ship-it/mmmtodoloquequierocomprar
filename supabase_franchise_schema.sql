-- Script de Migración para Supabase: Sistema Multi-Sucursal (Franquicias)
-- Ejecutar este script en el editor SQL de Supabase para configurar la Base de Datos.

-- 1. Crear tabla de Franquicias (Franchises)
CREATE TABLE IF NOT EXISTS public.franchises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    admin_email TEXT UNIQUE NOT NULL,
    admin_password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en la tabla de franquicias
ALTER TABLE public.franchises ENABLE ROW LEVEL SECURITY;

-- Políticas públicas para lectura e inserción (ajustar en producción)
DROP POLICY IF EXISTS "Lectura pública de franquicias" ON public.franchises;
CREATE POLICY "Lectura pública de franquicias" ON public.franchises FOR SELECT USING (true);

DROP POLICY IF EXISTS "Inserción pública de franquicias" ON public.franchises;
CREATE POLICY "Inserción pública de franquicias" ON public.franchises FOR INSERT WITH CHECK (true);

-- 2. Modificar tabla de Tenants (Sucursales)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL;

-- 3. Habilitar Replicación en Tiempo Real para la nueva tabla
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.franchises;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;
