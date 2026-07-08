-- Script de Migración: Alta Digital de Fiados (Onboarding B2C)

-- 1. Añadir columnas a customers para el estado del fiado y registro legal digital
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS fiado_status TEXT DEFAULT 'approved'; -- 'pending', 'approved', 'rejected'
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS terms_ip_address TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS terms_user_agent TEXT;

-- (Opcional) Si en el futuro quieres obligar a que nuevos registros entren como pending por defecto:
-- ALTER TABLE public.customers ALTER COLUMN fiado_status SET DEFAULT 'pending';
