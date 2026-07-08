-- Actualizar el valor POR DEFECTO de la columna landing_config para todos los nuevos locales
ALTER TABLE public.tenants ALTER COLUMN landing_config SET DEFAULT '{
  "enabled": true,
  "hero_style": "modern",
  "interactive_wall_enabled": true,
  "featured_products_enabled": true,
  "custom_carousel": [
    {
      "id": "def-1",
      "title": "Pedidos desde Casa",
      "description": "Explorá nuestro catálogo, armá tu carrito y comprá todo lo que necesites sin moverte. Pagá online o en efectivo.",
      "image_url": "/defaults/carousel1.png",
      "action_text": "Ver Productos"
    },
    {
      "id": "def-2",
      "title": "Sistema de Fiado",
      "description": "Comprá ahora y pagá después. Anotamos tu cuenta personal para que manejes tus gastos con total facilidad y confianza.",
      "image_url": "/defaults/carousel2.png",
      "action_text": "Saber Más"
    },
    {
      "id": "def-3",
      "title": "Retiro Express (Take-away)",
      "description": "Hacé tu pedido rápido desde tu celular, te avisamos cuando está listo y pasá a retirarlo sin tener que hacer fila.",
      "image_url": "/defaults/carousel3.png",
      "action_text": "Pedir Ahora"
    }
  ]
}'::jsonb;

-- Actualizar los locales EXISTENTES que NO tengan items en su carrusel
UPDATE public.tenants
SET landing_config = jsonb_set(
  COALESCE(landing_config, '{}'::jsonb),
  '{custom_carousel}',
  '[
    {
      "id": "def-1",
      "title": "Pedidos desde Casa",
      "description": "Explorá nuestro catálogo, armá tu carrito y comprá todo lo que necesites sin moverte. Pagá online o en efectivo.",
      "image_url": "/defaults/carousel1.png",
      "action_text": "Ver Productos"
    },
    {
      "id": "def-2",
      "title": "Sistema de Fiado",
      "description": "Comprá ahora y pagá después. Anotamos tu cuenta personal para que manejes tus gastos con total facilidad y confianza.",
      "image_url": "/defaults/carousel2.png",
      "action_text": "Saber Más"
    },
    {
      "id": "def-3",
      "title": "Retiro Express (Take-away)",
      "description": "Hacé tu pedido rápido desde tu celular, te avisamos cuando está listo y pasá a retirarlo sin tener que hacer fila.",
      "image_url": "/defaults/carousel3.png",
      "action_text": "Pedir Ahora"
    }
  ]'::jsonb
)
WHERE landing_config->>'custom_carousel' IS NULL 
   OR landing_config->>'custom_carousel' = '[]'
   OR jsonb_array_length(COALESCE(landing_config->'custom_carousel', '[]'::jsonb)) = 0;
