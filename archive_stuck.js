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
        .eq('payment_status', 'pagado');
    
    if (error) {
        console.error("Error:", error);
        return;
    }
    
    let updatedCount = 0;
    for (const o of orders) {
        const { error: updateError } = await supabase
            .from('orders')
            .update({ status: 'completed', is_archived: true })
            .eq('id', o.id);
            
        if (!updateError) {
            console.log(`Archived stuck paid delivery: ${o.id}`);
            updatedCount++;
        }
    }
    console.log(`Archived ${updatedCount} stuck paid deliveries.`);
}

main();
