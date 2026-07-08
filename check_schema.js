const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://iiymocpguhdifbkfnpwp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeW1vY3BndWhkaWZia2ZucHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MDk2NjgsImV4cCI6MjA4NTA4NTY2OH0.0Xf2AwB1TXIHqXOOBrBR_hgkAA8-uo5fsDsbljh4a9s';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: tenantData } = await supabase.from('tenants').select('id').limit(1);
  const tenantId = tenantData[0].id;

  const firstAttemptData = {
    client_name: 'Test',
    total_price: 100,
    status: 'pending',
    tenant_id: tenantId,
    delivery_type: 'delivery',
    delivery_address: 'Test Address',
    delivery_map_link: '',
    delivery_fee: 0,
    delivery_lat: null,
    delivery_lng: null,
    is_approved_for_production: true,
    afip_billing_requested: false,
    afip_client_type: 'consumidor_final',
    afip_doc_type: 'DNI',
    afip_doc_number: '',
    discount_amount: 0,
    coupon_code: ''
  };

  const { error } = await supabase.from('orders').insert([firstAttemptData]);
  console.log("Error from first attempt:", error);
}
check();
