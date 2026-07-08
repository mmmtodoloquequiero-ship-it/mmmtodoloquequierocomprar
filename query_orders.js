require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, status, is_archived, payment_status, delivery_type, delivery_address, table_number')
        .eq('is_archived', false);
    
    if (error) {
        console.error("Error:", error);
        return;
    }
    
    const pendingDeliveries = orders.filter(o => 
        o.status !== 'completed' && 
        (o.delivery_type === 'delivery' || (!o.table_number && o.delivery_address && o.delivery_address.trim().length > 0))
    );

    console.log(`Caja sees ${pendingDeliveries.length} pending deliveries.`);
    console.log(pendingDeliveries);
}

main();
