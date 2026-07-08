import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iiymocpguhdifbkfnpwp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeW1vY3BndWhkaWZia2ZucHdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUwOTY2OCwiZXhwIjoyMDg1MDg1NjY4fQ.SIjxY8OgXdUaaDLqzvBumXfM6sK2E-KiKQ2bFQSWNqg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    console.log("Testing insert...");
    
    // Test all columns used in firstAttempt
    const payload = {
        client_name: 'Test',
        table_number: '1',
        total_price: 100,
        discount_amount: 0,
        coupon_code: '',
        status: 'pending',
        phone_number: '',
        tenant_id: 'a05f1f9e-c884-482d-bd0d-b4b6ba30c5e3', // Needs a real tenant ID maybe, or any string if foreign keys aren't checked rigidly here
        waiter_name: 'test',
        delivery_type: 'local',
        delivery_address: '',
        delivery_map_link: '',
        delivery_fee: 0,
        delivery_lat: null,
        delivery_lng: null,
        payment_status: 'pendiente',
        payment_method: 'efectivo',
        is_approved_for_production: true,
        afip_billing_requested: false,
        afip_client_type: 'consumidor_final',
        afip_doc_type: 'DNI',
        afip_doc_number: '',
        loyalty_discount_applied: 0,
        tip_amount: 100,
        table_charge: 0,
        is_tip_paid: false
    };

    const { data, error } = await supabase.from('orders').insert([payload]).select();
    
    if (error) {
        console.error("Insert failed with error:");
        console.error(error);
    } else {
        console.log("Insert success!");
        // Delete it after success
        if (data && data[0]) {
            await supabase.from('orders').delete().eq('id', data[0].id);
            console.log("Cleaned up test row.");
        }
    }
}

testInsert();
