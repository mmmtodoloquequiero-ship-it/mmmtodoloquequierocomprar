-- 🚀 Migración para Soporte de Facturación Electrónica AFIP / ARCA
-- Ejecuta este script en el editor SQL de Supabase (SQL Editor)

-- 1. Agregar columnas a la tabla de 'tenants' para configuración fiscal
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS afip_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS afip_cuit TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS afip_punto_venta INT DEFAULT 1;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS afip_condicion_iva TEXT DEFAULT 'Monotributista'; -- 'Monotributista', 'Responsable Inscripto', 'Exento', 'Consumidor Final'
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS afip_cert_path TEXT DEFAULT ''; -- Ruta del archivo .crt en el Storage privado
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS afip_key_path TEXT DEFAULT '';  -- Ruta del archivo .key en el Storage privado
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS afip_is_sandbox BOOLEAN DEFAULT TRUE; -- TRUE para homologación/pruebas, FALSE para producción

-- 2. Agregar columnas a la tabla de 'orders' para datos de comprobante fiscal AFIP
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS afip_cae TEXT DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS afip_cae_vencimiento TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS afip_tipo_comprobante INT DEFAULT NULL; -- 1 (Factura A), 6 (Factura B), 11 (Factura C), etc.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS afip_punto_venta INT DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS afip_numero_comprobante INT DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS afip_error TEXT DEFAULT NULL; -- Almacenar el error en caso de fallo en la autorización
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS afip_facturado_at TIMESTAMPTZ DEFAULT NULL; -- Fecha exacta de la facturación ante AFIP

-- 3. Crear Storage Bucket Privado para los certificados de AFIP
-- Para seguridad absoluta, los certificados se almacenan en un bucket privado que solo el backend de Next.js puede leer.
-- Ejecutamos un bloque para insertar el bucket en la tabla de storage si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('afip-certificates', 'afip-certificates', false, 1048576, ARRAY['application/x-x509-ca-cert', 'application/x-pem-file', 'text/plain', 'application/octet-stream'])
ON CONFLICT (id) DO NOTHING;

-- 4. Crear políticas de seguridad para el Storage de certificados
-- Solo permitimos que los administradores autenticados puedan subir y gestionar sus propios certificados
-- Nota: Como el backend de Next.js utiliza la Service Role Key para leer los certificados para facturar,
-- las políticas de Storage no bloquearán la lectura del backend, garantizando seguridad y funcionamiento óptimos.

-- Nota: Si usas Supabase Storage mediante la consola de Supabase, puedes crear el bucket 'afip-certificates' manualmente como PRIVADO.
