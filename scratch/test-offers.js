const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://iiymocpguhdifbkfnpwp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeW1vY3BndWhkaWZia2ZucHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MDk2NjgsImV4cCI6MjA4NTA4NTY2OH0.0Xf2AwB1TXIHqXOOBrBR_hgkAA8-uo5fsDsbljh4a9s';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("=== OBTENIENDO OFERTAS ===");
  const { data: offers, error: errOffers } = await supabase.from('product_offers').select('*');
  if (errOffers) {
    console.error("Error al obtener ofertas:", errOffers);
    return;
  }
  console.log("Ofertas encontradas:", JSON.stringify(offers, null, 2));

  console.log("\n=== OBTENIENDO PRODUCTOS ===");
  const { data: products, error: errProducts } = await supabase.from('products').select('id, name');
  if (errProducts) {
    console.error("Error al obtener productos:", errProducts);
    return;
  }
  console.log("Productos encontrados:", JSON.stringify(products, null, 2));
}

run();
