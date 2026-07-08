import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export async function GET(req: Request) {
  try {
    // Validar autorización básica si se desea proteger el cron (por ejemplo con un token en headers)
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Calcular la fecha límite (en 3 días a partir de hoy)
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysFromNowStr = threeDaysFromNow.toISOString();

    const today = new Date();
    const todayStr = today.toISOString();

    // Buscar locales que están en su promo Pro, y que se vence dentro de los próximos 3 días
    // y que NO se les haya mandado el email todavía
    const { data: expiringPromos, error } = await supabase
      .from('saas_subscriptions')
      .select(`
        tenant_id, 
        promo_pro_ends_at,
        tenants (name, email)
      `)
      .not('promo_pro_ends_at', 'is', null)
      .eq('promo_warning_email_sent', false)
      .lte('promo_pro_ends_at', threeDaysFromNowStr)
      .gte('promo_pro_ends_at', todayStr);

    if (error) {
      console.error('Error fetching expiring promos:', error);
      throw error;
    }

    if (!expiringPromos || expiringPromos.length === 0) {
      return NextResponse.json({ message: 'No expiring promos found for today.' }, { status: 200 });
    }

    const processedTenantIds = [];

    for (const sub of expiringPromos) {
      const tenantData = Array.isArray(sub.tenants) ? sub.tenants[0] : sub.tenants;
      const tenant = tenantData as any;
      if (!tenant || !tenant.email) continue;

      const emailData = {
        to: tenant.email,
        subject: '¡Tu Promoción Pro de Mmm TodoLoQueQuiero Comer está por terminar!',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #f97316;">¡Hola, equipo de ${tenant.name}! 👋</h2>
            <p>Queríamos avisarte que tu promoción de <strong>1 Mes Gratis de Plan Pro Ilimitado</strong> está a punto de vencer.</p>
            <p><strong>A partir de en 3 días</strong>, tu cuenta bajará automáticamente a las funcionalidades de tu <strong>Plan Básico</strong>. No te preocupes, <strong>no se te cobrará ningún adicional</strong> y seguirás pagando el mismo monto que ya venías abonando, pero perderás acceso a las funciones Pro (como estadísticas avanzadas, múltiples sucursales, etc.).</p>
            <p>Si te encantaron las herramientas Pro y querés conservarlas, ¡podés hacer el upgrade ahora mismo desde tu panel de administrador!</p>
            <br/>
            <div style="text-align: center; margin-top: 20px;">
              <a href="https://mymfullcontrol.com.ar/login" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Ir a mi Panel</a>
            </div>
            <p style="font-size: 12px; color: #888; margin-top: 30px;">Si tienes alguna duda, responde a este correo y te ayudaremos con gusto.</p>
          </div>
        `
      };

      try {
        // Enviar Email via Resend
        if (process.env.RESEND_API_KEY) {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'Mmm TodoLoQueQuiero Comer <soporte@mymfullcontrol.com.ar>',
              to: [emailData.to],
              subject: emailData.subject,
              html: emailData.html
            })
          });

          if (!res.ok) {
            console.error(`Resend falló para ${tenant.email}:`, await res.text());
            continue; // Si falla, no marcamos como enviado
          }
        } else {
          // Modo simulado si no hay API Key
          console.log(`[SIMULACIÓN EMAIL] De: soporte@mymfullcontrol.com.ar -> Para: ${emailData.to}`);
          console.log(`Asunto: ${emailData.subject}`);
        }

        // Marcar como enviado en la base de datos
        await supabase
          .from('saas_subscriptions')
          .update({ promo_warning_email_sent: true })
          .eq('tenant_id', sub.tenant_id);

        processedTenantIds.push(sub.tenant_id);

      } catch (emailErr) {
        console.error(`Error enviando correo a ${tenant.email}:`, emailErr);
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: processedTenantIds.length,
      tenants: processedTenantIds
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error en /api/cron/check-promos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
