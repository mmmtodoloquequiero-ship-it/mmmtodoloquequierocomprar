import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tenantId, employeeName } = body;

    if (!tenantId || !employeeName) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios (tenantId, employeeName)' }, { status: 400 });
    }

    // Obtener las órdenes del delivery completadas, no pagadas
    let query = supabase
      .from('orders')
      .select('id, delivery_fee')
      .eq('tenant_id', tenantId)
      .eq('delivery_type', 'delivery')
      .in('status', ['completed', 'delivered'])
      .eq('is_delivery_paid', false);

    if (employeeName !== 'all') {
      query = query.eq('waiter_name', employeeName);
    }

    const { data: unpaidOrders, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!unpaidOrders || unpaidOrders.length === 0) {
      return NextResponse.json({ error: 'No hay envíos pendientes de pago para este día.' }, { status: 400 });
    }

    const totalToPay = unpaidOrders.reduce((acc, order) => acc + (Number(order.delivery_fee) || 0), 0);
    const orderIds = unpaidOrders.map(o => o.id);

    // 1. Marcar órdenes como pagadas
    const { error: updateError } = await supabase
      .from('orders')
      .update({ is_delivery_paid: true })
      .in('id', orderIds);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 2. Registrar el gasto en caja
    const expenseDesc = employeeName === 'all' 
      ? `Pago a Todos los Repartidores - Liquidación de envíos` 
      : `Pago a Repartidor: ${employeeName} - Liquidación de envíos`;

    const { error: expenseError } = await supabase
      .from('expenses')
      .insert({
        tenant_id: tenantId,
        description: expenseDesc,
        amount: totalToPay,
        type: 'salary', // Gasto por honorarios/salarios de envío
        date: new Date().toISOString().split('T')[0] // Fecha actual
      });

    if (expenseError) {
      return NextResponse.json({ error: expenseError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Pago registrado exitosamente.', totalPaid: totalToPay });

  } catch (error: any) {
    console.error('Error en POST /api/delivery/pay:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
