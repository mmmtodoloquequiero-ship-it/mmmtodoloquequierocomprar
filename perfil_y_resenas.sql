-- ========================================================
-- SCRIPT DE MIGRACIÓN: PERFIL PÚBLICO, REDES Y RESEÑAS
-- ========================================================
-- Ejecuta este script en el SQL Editor de tu consola de Supabase para agregar las columnas faltantes,
-- crear la tabla de opiniones y configurar la replicación en tiempo real.

-- 1. Nuevas columnas para el perfil en tenants si no existen
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS profile_picture_url TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS banner_url TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{"instagram": "", "facebook": "", "whatsapp": ""}'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS reviews_enabled BOOLEAN DEFAULT TRUE;

-- 2. Nueva columna para imágenes en categorías (Para reemplazar el estilo Neón por defecto)
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';

-- 3. Nueva tabla para almacenar las reseñas (Transparente y sin moderación individual)
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en la tabla de reseñas
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Políticas de aislamiento de Tenant y consulta pública
DROP POLICY IF EXISTS "Lectura pública de reseñas" ON public.reviews;
CREATE POLICY "Lectura pública de reseñas" ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Inserción pública de reseñas" ON public.reviews;
CREATE POLICY "Inserción pública de reseñas" ON public.reviews FOR INSERT WITH CHECK (true);

-- 4. Habilitar Replicación en Tiempo Real para la tabla de reseñas de forma segura
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;
