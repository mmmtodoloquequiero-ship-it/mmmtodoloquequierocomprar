-- ========================================================
-- SCRIPT DE MIGRACIÓN: RESERVAS PRO
-- ========================================================

-- Agregar columnas necesarias a la tabla de reservas
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS assigned_tables JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS message_sent BOOLEAN DEFAULT FALSE;

-- En caso de que se necesite guardar a qué turno pertenece explícitamente (opcional pero útil)
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS shift TEXT DEFAULT 'noche';
