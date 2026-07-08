import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iiymocpguhdifbkfnpwp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeW1vY3BndWhkaWZia2ZucHdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUwOTY2OCwiZXhwIjoyMDg1MDg1NjY4fQ.SIjxY8OgXdUaaDLqzvBumXfM6sK2E-KiKQ2bFQSWNqg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function updateMaxprueba() {
  console.log('Obteniendo tenant maxprueba...');
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, landing_config')
    .eq('slug', 'maxprueba')
    .single();

  if (error) {
    console.error('Error fetching tenant:', error);
    return;
  }

  const landingConfig = tenant.landing_config || {};

  landingConfig.custom_carousel = [
    {
      id: "slide_1",
      image_url: "/carousel/dish.png",
      title: "Alta Cocina en Cada Plato",
      description: "Descubre nuestra selección de ingredientes premium. Cada detalle está pensado para ofrecerte una experiencia gastronómica inolvidable.",
      badge_text: "Top Seleccionado"
    },
    {
      id: "slide_2",
      image_url: "/carousel/kitchen.png",
      title: "Higiene Impecable",
      description: "Nos tomamos la limpieza muy en serio. Nuestra cocina cuenta con los más altos estándares de sanitización diarios para tu tranquilidad.",
      badge_text: "Certificación de Calidad"
    },
    {
      id: "slide_3",
      image_url: "/carousel/event.png",
      title: "Eventos Inolvidables",
      description: "Música en vivo, degustaciones y promociones especiales todos los fines de semana. Vení a disfrutar de la mejor atmósfera.",
      badge_text: "¡Este Finde!"
    }
  ];
  
  // also make sure landing is enabled
  landingConfig.enabled = true;

  console.log('Actualizando tenant...');
  const { error: updateError } = await supabase
    .from('tenants')
    .update({ landing_config: landingConfig })
    .eq('id', tenant.id);

  if (updateError) {
    console.error('Error updating tenant:', updateError);
  } else {
    console.log('¡Tenant maxprueba actualizado con éxito!');
  }
}

updateMaxprueba();
