require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'delivered')
        .eq('is_archived', false);
    
    if (error) {
        console.error("Error fetching orders:", error);
        return;
    }
    
    console.log(`Found ${orders.length} stuck deliveries.`);
    
    let updatedCount = 0;
    for (const o of orders) {
        if (o.delivery_type === 'delivery' || (!o.table_number && o.delivery_address && o.delivery_address.trim().length > 0)) {
            const { error: updateError } = await supabase
                .from('orders')
                .update({ status: 'pending' })
                .eq('id', o.id);
                
            if (updateError) {
                console.error(`Error updating order ${o.id}:`, updateError);
            } else {
                console.log(`Order ${o.id} reverted to 'pending'.`);
                updatedCount++;
            }
        }
    }
    
    console.log(`Successfully fixed ${updatedCount} orders.`);
}

main();
