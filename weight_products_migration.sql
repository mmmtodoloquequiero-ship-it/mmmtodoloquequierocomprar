-- Script de Migración: Venta por peso en Productos (Fraccionables)

-- Agregar soporte de fraccionamiento a la tabla products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_by_weight BOOLEAN DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS base_weight NUMERIC DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS base_weight_unit TEXT DEFAULT NULL;

-- Actualizar productos existentes si es necesario para mantener compatibilidad
-- UPDATE public.products SET sale_by_weight = FALSE WHERE sale_by_weight IS NULL;
