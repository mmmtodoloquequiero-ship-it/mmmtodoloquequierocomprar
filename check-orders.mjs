import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iiymocpguhdifbkfnpwp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeW1vY3BndWhkaWZia2ZucHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MDk2NjgsImV4cCI6MjA4NTA4NTY2OH0.0Xf2AwB1TXIHqXOOBrBR_hgkAA8-uo5fsDsbljh4a9s';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
    const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, client_name, waiter_name, tip_amount, total_price, is_tip_paid')
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
