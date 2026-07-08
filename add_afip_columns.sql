-- Agregar las columnas de facturación AFIP a la tabla orders si no existen
ALTER TABLE orders ADD COLUMN IF NOT EXISTS afip_billing_requested boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS afip_client_type text DEFAULT 'consumidor_final';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS afip_doc_type text DEFAULT 'DNI';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS afip_doc_number text DEFAULT '';

-- Refrescar la memoria caché de PostgREST para que los cambios se reflejen inmediatamente
NOTIFY pgrst, 'reload schema';
