const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://iiymocpguhdifbkfnpwp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeW1vY3BndWhkaWZia2ZucHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MDk2NjgsImV4cCI6MjA4NTA4NTY2OH0.0Xf2AwB1TXIHqXOOBrBR_hgkAA8-uo5fsDsbljh4a9s'
);

async function testUpdate() {
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchError) {
    console.error('Fetch error:', fetchError);
    return;
  }

  console.log('Found order:', order.id, 'Tenant:', order.tenant_id);

  const localSupabase = createClient(
    'https://iiymocpguhdifbkfnpwp.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeW1vY3BndWhkaWZia2ZucHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MDk2NjgsImV4cCI6MjA4NTA4NTY2OH0.0Xf2AwB1TXIHqXOOBrBR_hgkAA8-uo5fsDsbljh4a9s',
    {
      global: {
        headers: {
          'x-tenant-id': order.tenant_id
        }
      }
    }
  );

  const { data: updateData, error: updateError } = await localSupabase
    .from('orders')
    .update({ afip_cae: '12345678901234' })
    .eq('id', order.id)
    .select();

  console.log('Update result:', { updateData, updateError });
}

testUpdate();
