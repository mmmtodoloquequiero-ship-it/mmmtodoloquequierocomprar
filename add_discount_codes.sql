-- ========================================================
-- SCRIPT DE MIGRACIÓN: Códigos de Descuento
-- ========================================================

-- Habilitar UUID si no está habilitado
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear tabla discount_codes
CREATE TABLE IF NOT EXISTS public.discount_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    discount_amount NUMERIC NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

-- Habilitar RLS
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad (RLS)
-- Permitir lectura pública (para que el cliente pueda validar el código en el front-end)
CREATE POLICY "Public read access for discount_codes" 
    ON public.discount_codes FOR SELECT 
    USING (true);

-- Permitir inserción/actualización pública (para quemar el código tras usarlo)
CREATE POLICY "Public write access for discount_codes" 
    ON public.discount_codes FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Public update access for discount_codes" 
    ON public.discount_codes FOR UPDATE 
    USING (true);

-- Añadir a realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.discount_codes;
