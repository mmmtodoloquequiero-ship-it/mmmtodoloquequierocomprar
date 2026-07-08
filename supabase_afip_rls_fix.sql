-- Solución al error "new row violates row-level security policy"
-- Ejecuta esto en el SQL Editor de Supabase

-- 1. Permitir que cualquiera pueda SUBIR archivos al bucket
CREATE POLICY "Permitir subida de certificados afip"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'afip-certificates');

-- 2. Permitir que cualquiera pueda VER/DESCARGAR los archivos del bucket
CREATE POLICY "Permitir lectura de certificados afip"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'afip-certificates');

-- 3. Permitir que cualquiera pueda REEMPLAZAR los archivos del bucket
CREATE POLICY "Permitir actualizacion de certificados afip"
ON storage.objects FOR UPDATE TO public
USING (bucket_id = 'afip-certificates');
