-- ========================================================
-- SCRIPT DE MIGRACIÓN: Guardar código de cupón/reserva en pedidos
-- ========================================================
-- Ejecuta este script en el SQL Editor de tu consola de Supabase para habilitar la columna
-- que guardará el código de descuento o reserva aplicado a cada comanda.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code TEXT DEFAULT '';
