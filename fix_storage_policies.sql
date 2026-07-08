-- Eliminar políticas anteriores si existieran (para evitar errores al correr el script múltiples veces)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Auth Insert" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;

-- Crear políticas permitiendo operaciones para el rol "anon" o "public" (ya que la app usa el anon key para todo)

-- 1. Permitir a cualquier persona VER las imágenes (Public Access)
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'products' );

-- 2. Permitir a los usuarios del sistema SUBIR imágenes
CREATE POLICY "Public Insert" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'products' );

-- 3. Permitir a los usuarios del sistema ACTUALIZAR imágenes
CREATE POLICY "Public Update" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'products' );

-- 4. Permitir a los usuarios del sistema ELIMINAR imágenes
CREATE POLICY "Public Delete" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'products' );
