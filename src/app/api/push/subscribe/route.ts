import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; 
// Note: In production, you MUST use the service role key to bypass RLS, or ensure the active device can update its own row.
// We are using service role key if available, otherwise fallback.

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false }
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceFingerprint, subscription } = body;

    if (!deviceFingerprint || !subscription) {
      return NextResponse.json({ error: 'Missing deviceFingerprint or subscription' }, { status: 400 });
    }

    const { error } = await supabase
      .from('active_devices')
      .update({ push_subscription: subscription })
      .eq('device_fingerprint', deviceFingerprint);

    if (error) {
      console.error('Error saving push subscription:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
