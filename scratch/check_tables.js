import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iiymocpguhdifbkfnpwp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeW1vY3BndWhkaWZia2ZucHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MDk2NjgsImV4cCI6MjA4NTA4NTY2OH0.0Xf2AwB1TXIHqXOOBrBR_hgkAA8-uo5fsDsbljh4a9s';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, tables');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Tenants y sus mesas:');
    data.forEach(t => {
      console.log(`\nTenant: ${t.name} (ID: ${t.id})`);
      console.log('Mesas:', JSON.stringify(t.tables, null, 2));
    });
  }
}

check();
