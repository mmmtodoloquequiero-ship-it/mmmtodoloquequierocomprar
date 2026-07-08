-- ========================================================
-- SCRIPT DE MIGRACIÓN: Días de Envío Activos
-- ========================================================

-- Añadir la columna delivery_days a la tabla tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS delivery_days INT[] DEFAULT ARRAY[0,1,2,3,4,5,6]::INT[];

-- Asegurar retrocompatibilidad para los registros existentes que tengan la columna en NULL
UPDATE public.tenants 
SET delivery_days = ARRAY[0,1,2,3,4,5,6]::INT[] 
WHERE delivery_days IS NULL;
