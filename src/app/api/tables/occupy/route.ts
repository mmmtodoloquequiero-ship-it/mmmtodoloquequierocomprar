import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { tenantId, tableId } = await req.json();

        if (!tenantId || !tableId) {
            return NextResponse.json({ error: 'Missing tenantId or tableId' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

        if (!supabaseUrl || !supabaseKey) {
            console.error('Missing Supabase environment variables');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Obtener el tenant actual para acceder a su arreglo de mesas
        const { data: tenant, error: fetchError } = await supabase
            .from('tenants')
            .select('tables')
            .eq('id', tenantId)
            .single();

        if (fetchError || !tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        // 2. Modificar el arreglo de mesas
        let tables = Array.isArray(tenant.tables) ? [...tenant.tables] : [];
        let updated = false;

        tables = tables.map(t => {
            // Match exactly or loosely by ID
            if (t.id === tableId || (t.id || '').toLowerCase().trim() === (tableId || '').toLowerCase().trim()) {
                // Si la mesa ya está ocupada, no hacemos un update redundante
                if (!t.is_occupied) {
                    updated = true;
                }
                return { ...t, is_occupied: true };
            }
            return t;
        });

        // 3. Guardar solo si hubo cambios
        if (updated) {
            const { error: updateError } = await supabase
                .from('tenants')
                .update({ tables })
                .eq('id', tenantId);

            if (updateError) {
                console.error('Error updating table occupancy:', updateError);
                throw updateError;
            }
        }

        return NextResponse.json({ success: true, updated });
    } catch (err: any) {
        console.error('Exception in /api/tables/occupy:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
