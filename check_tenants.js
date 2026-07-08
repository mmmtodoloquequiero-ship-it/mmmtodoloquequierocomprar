const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables manually
const envContent = fs.readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTenants() {
  console.log('Fetching tenants...');
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, email, admin_password');
    
  if (error) {
    console.error('Error fetching tenants:', error);
    return;
  }
  
  console.log('Found Tenants:');
  console.table(data);
}

checkTenants();
