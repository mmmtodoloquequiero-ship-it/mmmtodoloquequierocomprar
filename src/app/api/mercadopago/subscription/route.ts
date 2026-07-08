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
    const { tenantId, planId } = body;

    if (!tenantId || !planId) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios (tenantId, planId)' }, { status: 400 });
    }

    const mpAccessToken = process.env.MP_SAAS_ACCESS_TOKEN;
    if (!mpAccessToken) {
      return NextResponse.json({ error: 'Falta la clave MP_SAAS_ACCESS_TOKEN en las variables de entorno del servidor' }, { status: 500 });
    }

    // 1. Obtener información del local (tenant)
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('name, slug, email')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Local no encontrado' }, { status: 404 });
    }

    const payerEmail = tenant.email || 'test_user_vendedor@testuser.com'; // Fallback a email de prueba si no posee uno

    // 2. Obtener información del plan elegido
    const { data: plan, error: planError } = await supabase
      .from('saas_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    }

    // 3. Obtener suscripción actual para verificar descuentos vigentes
    const { data: sub, error: subError } = await supabase
      .from('saas_subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    let discountPercentage = 0;
    let hasActiveDiscount = false;

    if (sub) {
      discountPercentage = Number(sub.discount_percentage || 0);
      hasActiveDiscount = discountPercentage > 0 && sub.discount_ends_at && new Date(sub.discount_ends_at) > new Date();
    }

    // 4. Calcular el monto final a cobrar
    let amount = plan.price_ars;
    let fallbackPlanId: string | null = null;

    if (hasActiveDiscount) {
      // Calcular precio con descuento
      amount = Math.round(plan.price_ars * (1 - discountPercentage / 100));

      // Determinar el plan de downgrade (el plan inmediatamente menor en precio)
      const { data: lowerPlans } = await supabase
        .from('saas_plans')
        .select('id, price_ars')
        .lt('price_ars', plan.price_ars)
        .order('price_ars', { ascending: false })
        .limit(1);

      if (lowerPlans && lowerPlans.length > 0) {
        fallbackPlanId = lowerPlans[0].id;
      } else {
        // Si no hay plan menor, el fallback es quedarse en el básico
        fallbackPlanId = plan.id;
      }
    }

    // 5. Crear la preapproval (suscripción) en Mercado Pago
    // Obtener host para la url de redirección. Mercado Pago requiere HTTPS obligatorio para back_url.
    const host = req.headers.get('host') || 'localhost:3000';
    let backUrl = '';
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      // Fallback a producción en pruebas locales para pasar la validación estricta de Mercado Pago
      backUrl = `https://mymfullcontrol.com.ar/${tenant.slug}/admin?tab=subscription`;
    } else {
      const protocol = 'https';
      const origin = `${protocol}://${host}`;
      backUrl = `${origin}/${tenant.slug}/admin?tab=subscription`;
    }

    const mpBody = {
      reason: `Suscripción Mmm TodoLoQueQuiero Comer - ${plan.name}`,
      external_reference: tenantId,
      payer_email: payerEmail,
      back_url: backUrl,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: amount,
        currency_id: 'ARS'
      },
      status: 'pending'
    };

    const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mpAccessToken}`
      },
      body: JSON.stringify(mpBody)
    });

    if (!mpRes.ok) {
      const errorText = await mpRes.text();
      console.error('Error de Mercado Pago API:', errorText);
      return NextResponse.json({ error: `Mercado Pago falló: ${errorText}` }, { status: mpRes.status });
    }

    const mpData = await mpRes.json();

    // 5.5 Cancelar la suscripción anterior en MP si existía una activa o pendiente
    if (sub && sub.mp_subscription_id) {
      try {
        await fetch(`https://api.mercadopago.com/preapproval/${sub.mp_subscription_id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mpAccessToken}`
          },
          body: JSON.stringify({ status: 'cancelled' })
        });
        console.log(`Suscripción anterior ${sub.mp_subscription_id} cancelada automáticamente.`);
      } catch (err) {
        console.error('Error al intentar cancelar la suscripción anterior:', err);
      }
    }

    // 6. Actualizar o insertar la suscripción en estado pendiente
    if (sub) {
      const { error: updateError } = await supabase
        .from('saas_subscriptions')
        .update({
          mp_subscription_id: mpData.id,
          pending_plan_id: planId,
          pending_fallback_plan_id: fallbackPlanId,
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('saas_subscriptions')
        .insert({
          tenant_id: tenantId,
          mp_subscription_id: mpData.id,
          pending_plan_id: planId,
          pending_fallback_plan_id: fallbackPlanId,
          status: 'pending',
          current_period_end: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Vencida (ayer)
        });

      if (insertError) throw insertError;
    }

    return NextResponse.json({
      id: mpData.id,
      init_point: mpData.init_point
    });

  } catch (error: any) {
    console.error('Error en POST /api/mercadopago/subscription:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
