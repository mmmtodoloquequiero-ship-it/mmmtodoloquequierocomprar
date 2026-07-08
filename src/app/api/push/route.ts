import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@Mmm TodoLoQueQuiero Comer.com.ar';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} else {
  console.warn("⚠️ Advertencia: VAPID keys no están configuradas. Las notificaciones Push no funcionarán.");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false }
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenant_id, role, title, body: notificationBody, icon, url, data } = body;

    if (!tenant_id || !role || !title) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios' }, { status: 400 });
    }

    // Buscar dispositivos activos que pertenezcan al tenant, que tengan push_subscription, 
    // y cuyo empleado asignado tenga el rol deseado
    const { data: devices, error: dbError } = await supabase
      .from('active_devices')
      .select('push_subscription, employees!inner(role)')
      .eq('tenant_id', tenant_id)
      .not('push_subscription', 'is', null)
      .eq('employees.role', role);

    if (dbError) {
      throw dbError;
    }

    if (!devices || devices.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'Ningún dispositivo suscrito para este rol' });
    }

    const payload = JSON.stringify({
      title,
      body: notificationBody,
      icon: icon || '/icon512_maskable.png',
      url: url || '/',
      data: data || {}
    });

    const sendPromises = devices.map(async (device) => {
      const subscription = device.push_subscription;
      try {
        await webpush.sendNotification(subscription, payload);
      } catch (error: any) {
        console.error('Error enviando push a un dispositivo:', error);
        // Si el status es 410 (Gone), la suscripción ya no es válida y deberíamos borrarla de la DB
        if (error.statusCode === 410 || error.statusCode === 404) {
          await supabase
            .from('active_devices')
            .update({ push_subscription: null })
            .eq('push_subscription->>endpoint', subscription.endpoint);
        }
      }
    });

    await Promise.allSettled(sendPromises);

    return NextResponse.json({ success: true, sent: devices.length });

  } catch (error: any) {
    console.error('Error general enviando push:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
