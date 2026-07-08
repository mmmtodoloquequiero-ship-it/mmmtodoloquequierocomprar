require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, status, is_archived, payment_status, client_name, delivery_type')
        .order('created_at', { ascending: false })
        .limit(3);
    
    if (error) {
        console.error("Error:", error);
    } else {
        console.log(JSON.stringify(orders, null, 2));
    }
}

main();
