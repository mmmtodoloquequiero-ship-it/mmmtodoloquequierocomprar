import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iiymocpguhdifbkfnpwp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeW1vY3BndWhkaWZia2ZucHdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUwOTY2OCwiZXhwIjoyMDg1MDg1NjY4fQ.SIjxY8OgXdUaaDLqzvBumXfM6sK2E-KiKQ2bFQSWNqg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findMissingColumns() {
    const allCols = [
        'delivery_type',
        'delivery_address',
        'delivery_map_link',
        'delivery_fee',
        'delivery_lat',
        'delivery_lng',
        'is_approved_for_production',
        'afip_billing_requested',
        'afip_client_type',
        'afip_doc_type',
        'afip_doc_number',
        'loyalty_discount_applied',
        'tip_amount',
        'table_charge',
        'is_tip_paid',
        'waiter_name'
    ];
    
    const missing = [];
    
    for (const col of allCols) {
        const payload = {
            client_name: 'Test',
            total_price: 100,
            status: 'pending',
            tenant_id: 'a05f1f9e-c884-482d-bd0d-b4b6ba30c5e3'
        };
        // Add just this one column
        if (col === 'afip_billing_requested' || col === 'is_approved_for_production' || col === 'is_tip_paid') {
            payload[col] = false;
        } else if (col === 'tip_amount' || col === 'loyalty_discount_applied' || col === 'table_charge' || col === 'delivery_fee') {
            payload[col] = 0;
        } else {
            payload[col] = 'test';
        }
        
        const { error } = await supabase.from('orders').insert([payload]).select();
        if (error && error.code === 'PGRST204') {
            missing.push(col);
        } else if (!error) {
            // Delete if success
            await supabase.from('orders').delete().eq('client_name', 'Test');
        }
    }
    
    console.log("Missing columns:", missing);
}

findMissingColumns();
