-- 1. Asegurar que el bucket 'products' exista y sea PÚBLICO
INSERT INTO storage.buckets (id, name, public) 
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Eliminar cualquier política anterior que pueda estar interfiriendo
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Auth Insert" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert" ON storage.objects;
DROP POLICY IF EXISTS "Public Update" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete" ON storage.objects;
DROP POLICY IF EXISTS "Master Access to products" ON storage.objects;
DROP POLICY IF EXISTS "Allow all for products" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon for products" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated for products" ON storage.objects;
DROP POLICY IF EXISTS "Give public access to products bucket" ON storage.objects;

-- 3. Crear políticas ultra permisivas explícitas para CADA tipo de usuario
-- Esto garantiza que no haya forma de que Supabase rechace la conexión, ya seas anónimo o logueado.

CREATE POLICY "Allow all for products"
ON storage.objects
FOR ALL
USING (bucket_id = 'products')
WITH CHECK (bucket_id = 'products');

CREATE POLICY "Allow anon for products"
ON storage.objects
FOR ALL
TO anon
USING (bucket_id = 'products')
WITH CHECK (bucket_id = 'products');

CREATE POLICY "Allow authenticated for products"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'products')
WITH CHECK (bucket_id = 'products');
