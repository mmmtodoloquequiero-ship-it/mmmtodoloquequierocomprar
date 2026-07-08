import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usar el Service Role Key para ignorar el Row Level Security y forzar la cancelación/borrado
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; 

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Faltan las credenciales de entorno del Service Role.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Falta el ID del pedido a cancelar' }, { status: 400 });
    }

    // 1. Borramos los items de la orden para que desaparezca automáticamente de la cocina y mozos en tiempo real.
    const { error: itemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);

    if (itemsError) throw itemsError;

    // 2. Marcamos la orden principal como cancelada y archivada.
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'cancelled', is_archived: true })
      .eq('id', orderId);

    if (orderError) throw orderError;

    return NextResponse.json({ success: true, message: 'Orden cancelada y eliminada correctamente de los paneles.' });
  } catch (err: any) {
    console.error("Error en API de cancelación de órdenes:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
