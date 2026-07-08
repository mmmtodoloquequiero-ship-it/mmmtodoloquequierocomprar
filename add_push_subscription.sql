-- Añadir soporte para notificaciones push a los dispositivos
ALTER TABLE public.active_devices ADD COLUMN IF NOT EXISTS push_subscription JSONB;
