const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://iiymocpguhdifbkfnpwp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeW1vY3BndWhkaWZia2ZucHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MDk2NjgsImV4cCI6MjA4NTA4NTY2OH0.0Xf2AwB1TXIHqXOOBrBR_hgkAA8-uo5fsDsbljh4a9s'
);

async function check() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Latest order keys:', Object.keys(data[0] || {}));
    console.log('Latest order afip_cae:', data[0]?.afip_cae);
  }
}

check();
