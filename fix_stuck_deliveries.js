require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // Buscar todos los pedidos que estén 'delivered' pero NO 'is_archived' y NO 'completed'
    // que son los que se quedaron atascados por el bug de la cocina
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'delivered')
        .eq('is_archived', false)
        .neq('payment_status', 'pagado'); // Opcional, pero para estar seguros
    
    if (error) {
        console.error("Error fetching orders:", error);
        return;
    }
    
    console.log(`Found ${orders.length} stuck deliveries.`);
    
    // Convertirlos a 'ready' para que el repartidor los vea en Activos
    let updatedCount = 0;
    for (const o of orders) {
        // Doble validación por si acaso: si tienen delivery_address o delivery_type
        if (o.delivery_type === 'delivery' || (!o.table_number && o.delivery_address && o.delivery_address.trim().length > 0)) {
            const { error: updateError } = await supabase
                .from('orders')
                .update({ status: 'pending' })
                .eq('id', o.id);
                
            if (updateError) {
                console.error(`Error updating order ${o.id}:`, updateError);
            } else {
                console.log(`Order ${o.id} reverted to 'ready'.`);
                updatedCount++;
            }
        }
    }
    
    console.log(`Successfully fixed ${updatedCount} orders.`);
}

main();
