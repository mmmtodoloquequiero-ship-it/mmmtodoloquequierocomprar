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
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (error) {
        console.error("Error:", error);
        return;
    }
    
    let updatedCount = 0;
    for (const o of orders) {
        if (o.delivery_type === 'delivery' || (!o.table_number && o.delivery_address && o.delivery_address.trim().length > 0)) {
            const { error: updateError } = await supabase
                .from('orders')
                .update({ status: 'pending' })
                .eq('id', o.id);
                
            if (!updateError) {
                console.log(`Recovered recent delivery: ${o.id}`);
                updatedCount++;
            }
        }
    }
    console.log(`Recovered ${updatedCount} recent deliveries.`);
}

main();
