import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
    const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, client_name, waiter_name, tip_amount, total_price')
        .order('created_at', { ascending: false })
        .limit(10);
        
    if (error) {
        console.error("Error fetching orders:", error);
    } else {
        console.log("Last 10 orders:");
        console.log(data);
    }
}

checkOrders();
