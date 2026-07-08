import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tenant_id, collection_id, order_id, reservation_id, generated_code } = body;

    if (!tenant_id || !collection_id || (!order_id && !reservation_id)) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Fetch secure access token for tenant
    const { data: secretData } = await supabase
      .from('tenant_secrets')
      .select('mercadopago_access_token')
      .eq('tenant_id', tenant_id)
      .single();

    if (!secretData?.mercadopago_access_token) {
      return NextResponse.json({ error: 'Mercado Pago not configured for this tenant' }, { status: 400 });
    }

    // 2. Query Mercado Pago for the true status of this payment
    const client = new MercadoPagoConfig({ accessToken: secretData.mercadopago_access_token });
    const payment = new Payment(client);
    
    const paymentData = await payment.get({ id: collection_id });

    // 3. Verify if payment is approved
    if (paymentData.status === 'approved') {
      if (reservation_id) {
         // Securely update the reservation
         const { error: updateError } = await supabase
          .from('reservations')
          .update({ 
            status: 'confirmed',
            reservation_code: generated_code
          })
          .eq('id', reservation_id)
          .eq('tenant_id', tenant_id); // Extra safety check

         if (updateError) throw updateError;
         return NextResponse.json({ success: true, status: 'approved', type: 'reservation' });
      } else if (order_id) {
         // Securely update the order using the SERVICE ROLE KEY (bypasses RLS)
         const { data: updatedOrder, error: updateError } = await supabase
          .from('orders')
          .update({ 
            payment_status: 'pagado', 
            is_approved_for_production: true,
            status: 'pending'
          })
          .eq('id', order_id)
          .eq('tenant_id', tenant_id) // Extra safety check
          .select()
          .single();

         if (updateError) throw updateError;
         return NextResponse.json({ success: true, status: 'approved', type: 'order', order: updatedOrder });
      }
    } else {
      return NextResponse.json({ success: false, status: paymentData.status });
    }

  } catch (error: any) {
    console.error("Error verifying Mercado Pago payment:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
