const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let key = match[1].trim();
    let val = match[2].trim();
    if(val.startsWith('"') && val.endsWith('"')) val = val.slice(1,-1);
    process.env[key] = val;
  }
});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: plans } = await supabase.from('saas_plans').select('*');
  console.log('Planes disponibles:');
  plans.forEach(p => console.log(`- ID: ${p.id}, Nombre: ${p.name}, Precio: ${p.price_ars}`));
}
run();
