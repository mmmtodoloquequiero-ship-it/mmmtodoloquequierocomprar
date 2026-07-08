require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase.rpc('get_table_constraints', { p_table_name: 'orders' });
    if (error) {
        console.error("Error fetching constraints via RPC, trying a raw query...");
    }
}

main();
