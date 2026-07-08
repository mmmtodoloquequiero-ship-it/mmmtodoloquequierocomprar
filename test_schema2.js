require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: items, error } = await supabase
        .from('order_items')
        .select('id, target_departments')
        .limit(2);
    
    if (error) {
        console.error("Error order_items:", error);
    } else {
        console.log("order_items:", JSON.stringify(items, null, 2));
    }
}

main();
