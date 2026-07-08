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
    console.log('Webhook Mercado Pago SaaS recibido:', JSON.stringify(body));

    // Determinar el ID del recurso (preapproval_id)
    const resourceId = body.data?.id || body.id;
    const type = body.type || body.action;

    // Solo procesamos eventos relacionados a suscripciones/preapproval
    if (!resourceId) {
      return NextResponse.json({ message: 'No resource ID found in body' }, { status: 200 });
    }

    const mpAccessToken = process.env.MP_SAAS_ACCESS_TOKEN;
    if (!mpAccessToken) {
      console.error('Error: MP_SAAS_ACCESS_TOKEN no configurado');
      return NextResponse.json({ error: 'Token del servidor faltante' }, { status: 500 });
    }

    // Consultar el detalle de la suscripción directamente a Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${resourceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`
      }
    });

    if (!mpRes.ok) {
      const errorText = await mpRes.text();
      console.error(`Error al consultar preapproval ${resourceId} en MP:`, errorText);
      return NextResponse.json({ error: 'Error consultando recurso en MP' }, { status: 200 }); // Retornamos 200 para evitar que MP reintente indefinidamente si es un id de pruebas expirado
    }

    const mpData = await mpRes.json();
    const tenantId = mpData.external_reference;

    if (!tenantId) {
      console.warn('Advertencia: El recurso consultado no posee external_reference (tenantId)');
      return NextResponse.json({ message: 'No tenantId reference found' }, { status: 200 });
    }

    // Buscar si existe esta suscripción en la base de datos
    const { data: sub, error: subError } = await supabase
      .from('saas_subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (subError) {
      console.error('Error buscando la suscripción en base de datos:', subError);
      throw subError;
    }

    const mpStatus = mpData.status; // 'pending', 'authorized', 'paused', 'cancelled'
    
    // Si la suscripción fue autorizada por el usuario
    if (mpStatus === 'authorized') {
      const nextPaymentStr = mpData.next_payment_date;
      let periodEnd = new Date();
      if (nextPaymentStr) {
        periodEnd = new Date(nextPaymentStr);
      } else {
        periodEnd.setDate(periodEnd.getDate() + 30); // Fallback a 30 días
      }

      // Si existe una actualización de plan pendiente, la activamos ahora
      const newPlanId = sub?.pending_plan_id || sub?.plan_id;
      const newFallbackId = sub?.pending_fallback_plan_id || sub?.fallback_plan_id;

      let promoUpdate = {};
      // Lógica Promo 1 Mes: Si están suscribiéndose y nunca usaron la promo
      if (!sub?.promo_pro_ends_at) {
        const promoEnds = new Date();
        promoEnds.setDate(promoEnds.getDate() + 30);
        promoUpdate = {
          promo_pro_ends_at: promoEnds.toISOString(),
          promo_warning_email_sent: false
        };
        console.log(`Promoción de 1 mes (Pro Ilimitado) activada para el local ${tenantId} hasta ${promoEnds.toISOString()}`);
      }

      const updateData: any = {
        status: 'active',
        current_period_end: periodEnd.toISOString(),
        mp_subscription_id: mpData.id,
        mp_payer_email: mpData.payer_email || sub?.mp_payer_email,
        updated_at: new Date().toISOString(),
        ...promoUpdate
      };

      // Si teníamos un plan pendiente, consolidar los campos
      if (sub?.pending_plan_id) {
        updateData.plan_id = newPlanId;
        updateData.fallback_plan_id = newFallbackId;
        updateData.pending_plan_id = null;
        updateData.pending_fallback_plan_id = null;
      }

      const { error: updateError } = await supabase
        .from('saas_subscriptions')
        .update(updateData)
        .eq('tenant_id', tenantId);

      if (updateError) {
        console.error('Error al activar la suscripción en la base de datos:', updateError);
        throw updateError;
      }

      console.log(`Suscripción SaaS activada con éxito para el local ${tenantId}. Plan: ${newPlanId}`);

    } else if (mpStatus === 'cancelled') {
      // Suscripción cancelada por el cliente o administración en MP
      const { error: cancelError } = await supabase
        .from('saas_subscriptions')
        .update({
          status: 'canceled',
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId);

      if (cancelError) {
        console.error('Error al cancelar la suscripción en la base de datos:', cancelError);
        throw cancelError;
      }

      console.log(`Suscripción SaaS cancelada para el local ${tenantId}.`);
    } else {
      // Otros estados menores (pending, paused)
      const { error: statusError } = await supabase
        .from('saas_subscriptions')
        .update({
          status: mpStatus === 'paused' ? 'suspended' : 'trial',
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId);

      if (statusError) {
        console.error('Error al actualizar estado menor de suscripción:', statusError);
        throw statusError;
      }
      
      console.log(`Estado de suscripción actualizado a ${mpStatus} para el local ${tenantId}.`);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error general en el Webhook de MP SaaS:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
