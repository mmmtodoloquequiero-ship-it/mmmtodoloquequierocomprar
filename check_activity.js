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
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: tenants } = await supabase.from('tenants').select('id, name, slug');
  for (let t of tenants) {
    const { count, error } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('tenant_id', t.id);
    const { data: latest } = await supabase.from('orders').select('created_at').eq('tenant_id', t.id).order('created_at', { ascending: false }).limit(1);
    
    const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('tenant_id', t.id);
    console.log(t.name + ' (' + t.slug + ') -> Pedidos:', count, latest && latest.length ? 'Ultimo: ' + latest[0].created_at : 'Ninguno', '| Productos:', prodCount);
  }
}
run();
