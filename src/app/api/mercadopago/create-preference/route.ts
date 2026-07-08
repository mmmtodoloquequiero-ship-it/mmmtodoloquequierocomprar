import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tenant_id, items, external_reference, back_urls, accessToken: clientToken } = body;

    let accessToken = clientToken;

    // Securely fetch access token if tenant_id is provided
    if (tenant_id) {
      const { data: secretData } = await supabase
        .from('tenant_secrets')
        .select('mercadopago_access_token')
        .eq('tenant_id', tenant_id)
        .single();
        
      if (secretData?.mercadopago_access_token) {
        accessToken = secretData.mercadopago_access_token;
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
    }

    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: items,
        external_reference: external_reference,
        back_urls: back_urls,
        auto_return: 'approved'
      }
    });

    return NextResponse.json({
      id: result.id,
      init_point: result.init_point
    });

  } catch (error: any) {
    console.error("Error creating Mercado Pago preference:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
