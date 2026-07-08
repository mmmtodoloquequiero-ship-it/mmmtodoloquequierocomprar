-- Añadir soporte para horarios de atención, horarios de envío y botón de pánico de delivery
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{
  "enabled": false,
  "schedule": {
    "1": [{"open": "00:00", "close": "23:59"}],
    "2": [{"open": "00:00", "close": "23:59"}],
    "3": [{"open": "00:00", "close": "23:59"}],
    "4": [{"open": "00:00", "close": "23:59"}],
    "5": [{"open": "00:00", "close": "23:59"}],
    "6": [{"open": "00:00", "close": "23:59"}],
    "0": [{"open": "00:00", "close": "23:59"}]
  }
}'::jsonb;

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS delivery_hours JSONB DEFAULT '{
  "enabled": false,
  "schedule": {
    "1": [{"open": "00:00", "close": "23:59"}],
    "2": [{"open": "00:00", "close": "23:59"}],
    "3": [{"open": "00:00", "close": "23:59"}],
    "4": [{"open": "00:00", "close": "23:59"}],
    "5": [{"open": "00:00", "close": "23:59"}],
    "6": [{"open": "00:00", "close": "23:59"}],
    "0": [{"open": "00:00", "close": "23:59"}]
  }
}'::jsonb;

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS delivery_panic_button BOOLEAN DEFAULT FALSE;
