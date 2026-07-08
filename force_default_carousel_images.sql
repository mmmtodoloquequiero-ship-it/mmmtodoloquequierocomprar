-- Este script fuerza la actualización de las imágenes de los items por defecto del carrusel
-- si el usuario ya tenía los items creados pero sin las URLs de las imágenes.

UPDATE public.tenants
SET landing_config = jsonb_set(
  landing_config,
  '{custom_carousel}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN item->>'id' = 'def-1' AND (item->>'image_url' IS NULL OR item->>'image_url' = '') THEN jsonb_set(item, '{image_url}', '"/defaults/carousel1.png"')
        WHEN item->>'id' = 'def-2' AND (item->>'image_url' IS NULL OR item->>'image_url' = '') THEN jsonb_set(item, '{image_url}', '"/defaults/carousel2.png"')
        WHEN item->>'id' = 'def-3' AND (item->>'image_url' IS NULL OR item->>'image_url' = '') THEN jsonb_set(item, '{image_url}', '"/defaults/carousel3.png"')
        ELSE item
      END
    )
    FROM jsonb_array_elements(landing_config->'custom_carousel') as item
  )
)
WHERE landing_config->'custom_carousel' IS NOT NULL;
