-- Crear el bucket 'products' si no existe, y marcarlo como público
INSERT INTO storage.buckets (id, name, public) 
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Eliminar políticas anteriores si existieran (para evitar errores al correr el script múltiples veces)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Auth Insert" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;

-- 1. Permitir a cualquier persona VER las imágenes (Public Access)
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'products' );

-- 2. Permitir a usuarios autenticados (como el admin/cajero) SUBIR imágenes
CREATE POLICY "Auth Insert" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'products' );

-- 3. Permitir a usuarios autenticados ACTUALIZAR imágenes
CREATE POLICY "Auth Update" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING ( bucket_id = 'products' );

-- 4. Permitir a usuarios autenticados ELIMINAR imágenes
CREATE POLICY "Auth Delete" 
ON storage.objects FOR DELETE 
TO authenticated 
USING ( bucket_id = 'products' );
