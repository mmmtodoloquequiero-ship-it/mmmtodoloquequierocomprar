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
    const { tenantId } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios (tenantId)' }, { status: 400 });
    }

    const mpAccessToken = process.env.MP_SAAS_ACCESS_TOKEN;
    if (!mpAccessToken) {
      return NextResponse.json({ error: 'Falta la clave MP_SAAS_ACCESS_TOKEN en las variables de entorno del servidor' }, { status: 500 });
    }

    // 1. Obtener la suscripción actual
    const { data: sub, error: subError } = await supabase
      .from('saas_subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (subError || !sub) {
      return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });
    }

    if (!sub.mp_subscription_id) {
       return NextResponse.json({ error: 'No hay suscripción activa en Mercado Pago vinculada' }, { status: 400 });
    }

    // 2. Cancelar la suscripción en Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${sub.mp_subscription_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mpAccessToken}`
      },
      body: JSON.stringify({ status: 'cancelled' })
    });

    if (!mpRes.ok) {
      const errorText = await mpRes.text();
      console.error('Error al cancelar en MP:', errorText);
      return NextResponse.json({ error: 'No se pudo cancelar en Mercado Pago' }, { status: mpRes.status });
    }

    // 3. Actualizar estado en Supabase (Cancelada) y fallback a Plan Básico u otro si se desea,
    // o simplemente mantener cancelado
    await supabase
      .from('saas_subscriptions')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId);

    return NextResponse.json({ success: true, message: 'Suscripción cancelada exitosamente' });

  } catch (error: any) {
    console.error('Error en POST /api/mercadopago/cancel-subscription:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
