import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Usamos el service_role key para ignorar RLS ya que esto viene de servidor a servidor
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { tenant_id, external_id, customer, items } = body;

        if (!tenant_id || !items || items.length === 0) {
            return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey, {
            global: {
                headers: { 'x-tenant-id': tenant_id }
            }
        });

        // 1. Calcular el total
        let totalPrice = 0;
        items.forEach((item: any) => {
            totalPrice += item.unit_price * item.quantity;
        });

        // 2. Crear la orden local con estado 'pending' (o preparing si queremos auto-aceptar de inmediato)
        // Auto-Aceptación Inteligente: Entra directo como "pending" pero con un origin claro para que la cocina lo vea.
        const orderData = {
            tenant_id,
            client_name: customer?.name || 'Cliente de Rappi',
            phone_number: customer?.phone || 'Sin número',
            status: 'pending',
            total_price: totalPrice,
            payment_method: 'rappi',
            payment_status: 'paid', // Las apps de delivery suelen cobrar por adelantado
            delivery_type: 'rappi_delivery',
            origin: 'rappi',
            external_order_id: external_id,
            external_raw_data: body
        };

        const { data: newOrder, error: orderError } = await supabase
            .from('orders')
            .insert(orderData)
            .select()
            .single();

        if (orderError) throw orderError;

        // 3. Obtener los departamentos destino (cocina, barra, etc.) de las categorías de los productos
        const productIds = items.map((item: any) => item.product_id);
        const { data: dbProducts } = await supabase
            .from('products')
            .select('id, category:categories(target_departments)')
            .in('id', productIds);

        // 4. Obtener recetas e insumos para el Ruteo Inteligente (Smart Splitter)
        const { data: dbRecipe } = await supabase
            .from('product_ingredients')
            .select('product_id, ingredient_id')
            .in('product_id', productIds);
            
        const ingredientIds = dbRecipe?.map(r => r.ingredient_id) || [];
        const { data: dbIngredients } = await supabase
            .from('ingredients')
            .select('id, name, target_departments')
            .in('id', ingredientIds.length > 0 ? ingredientIds : ['00000000-0000-0000-0000-000000000000']);

        const orderItemsData: any[] = [];
        
        items.forEach((item: any) => {
            const dbProd = dbProducts?.find((p: any) => p.id === item.product_id);
            const targetDepts = (dbProd?.category as any)?.target_departments || ['kitchen'];

            if (targetDepts.length <= 1) {
                orderItemsData.push({
                    order_id: newOrder.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    target_departments: targetDepts
                });
                return;
            }

            // Ruteo Inteligente: Dividir por insumos si es multi-departamento
            const recipe = dbRecipe?.filter(r => r.product_id === item.product_id) || [];
            const deptsMap: Record<string, string[]> = {};
            
            recipe.forEach(ri => {
                const ing = dbIngredients?.find(i => i.id === ri.ingredient_id);
                const depts = (ing?.target_departments && ing.target_departments.length > 0) ? (ing.target_departments as string[]) : ['kitchen'];
                depts.forEach((d: string) => {
                    if (!deptsMap[d]) deptsMap[d] = [];
                    if (ing) deptsMap[d].push(ing.name);
                });
            });
            
            const deptsFound = Object.keys(deptsMap);
            
            if (deptsFound.length <= 1) {
                orderItemsData.push({
                    order_id: newOrder.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    target_departments: deptsFound.length === 1 ? [deptsFound[0]] : ['kitchen']
                });
            } else {
                deptsFound.forEach((d, idx) => {
                    orderItemsData.push({
                        order_id: newOrder.id,
                        product_id: item.product_id,
                        quantity: item.quantity,
                        unit_price: idx === 0 ? item.unit_price : 0,
                        target_departments: [d],
                        notes: deptsMap[d].join(', ')
                    });
                });
            }
        });

        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItemsData);

        if (itemsError) throw itemsError;

        return NextResponse.json({ success: true, order_id: newOrder.id });
    } catch (error: any) {
        console.error('Error en Webhook Rappi:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
