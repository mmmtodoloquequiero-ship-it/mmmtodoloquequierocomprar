require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: items, error } = await supabase
        .from('order_items')
        .select('id, target_departments, products(id, name, target_departments)')
        .limit(5);
    
    if (error) {
        console.error("Error:", error);
    } else {
        console.log(JSON.stringify(items, null, 2));
    }
}

main();
