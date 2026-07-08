-- Script de Migración para Supabase: Sistema SaaS y Facturación
-- Ejecutar este script en el editor SQL de Supabase para crear la estructura del Master Admin.

-- 1. Modificar tabla de Tenants (Bloqueo Maestro)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;

-- 2. Tabla de Planes SaaS
CREATE TABLE IF NOT EXISTS public.saas_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price_ars NUMERIC NOT NULL DEFAULT 0,
    max_devices INT NOT NULL DEFAULT 3,
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar planes por defecto
INSERT INTO public.saas_plans (name, description, price_ars, max_devices, features)
VALUES 
('Básico', 'Ideal para locales pequeños', 15000, 3, '["Gestión de 3 cuentas", "Soporte estándar"]'::jsonb),
('Avanzado', 'Para restaurantes en crecimiento', 25000, 6, '["Gestión de 6 cuentas", "Soporte prioritario", "Módulo Delivery"]'::jsonb),
('Pro Ilimitado', 'Control total y sin límites', 40000, 999, '["Cuentas ilimitadas", "Soporte 24/7", "Todas las funciones"]'::jsonb)
ON CONFLICT DO NOTHING;

-- 3. Tabla de Suscripciones por Local
CREATE TABLE IF NOT EXISTS public.saas_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.saas_plans(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'trial', -- 'trial', 'active', 'past_due', 'canceled', 'suspended'
    current_period_end TIMESTAMPTZ NOT NULL,
    mp_subscription_id TEXT, -- ID de la suscripción de Mercado Pago
    mp_payer_email TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id)
);

-- 4. Tabla de Códigos de Descuento (Cupones SaaS)
CREATE TABLE IF NOT EXISTS public.saas_discount_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL DEFAULT 'free_months', -- 'free_months', 'percentage'
    discount_value NUMERIC NOT NULL, -- Ej: 3 (meses) o 100 (porcentaje)
    valid_until TIMESTAMPTZ,
    is_used BOOLEAN DEFAULT FALSE,
    used_by_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabla de Tickets de Soporte
CREATE TABLE IF NOT EXISTS public.saas_support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Habilitar RLS
ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_support_tickets ENABLE ROW LEVEL SECURITY;

-- 7. Políticas de Seguridad (RLS) para Tenants (Los permisos del CEO se manejarán vía Service Role en el backend)

-- saas_plans: Lectura pública (para que el cliente vea los planes al suscribirse)
DROP POLICY IF EXISTS "Lectura publica de saas_plans" ON public.saas_plans;
CREATE POLICY "Lectura publica de saas_plans" ON public.saas_plans FOR SELECT USING (true);

-- saas_subscriptions: El tenant solo ve su propia suscripción
DROP POLICY IF EXISTS "Lectura propia de saas_subscriptions" ON public.saas_subscriptions;
CREATE POLICY "Lectura propia de saas_subscriptions" ON public.saas_subscriptions 
FOR SELECT USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));

-- saas_support_tickets: El tenant ve e inserta sus propios tickets
DROP POLICY IF EXISTS "Lectura propia de tickets" ON public.saas_support_tickets;
CREATE POLICY "Lectura propia de tickets" ON public.saas_support_tickets 
FOR SELECT USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));

DROP POLICY IF EXISTS "Insercion propia de tickets" ON public.saas_support_tickets;
CREATE POLICY "Insercion propia de tickets" ON public.saas_support_tickets 
FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));

-- 8. RPC: Canjear Código de Descuento de forma segura
-- Evita que el cliente modifique la tabla de códigos manualmente
CREATE OR REPLACE FUNCTION public.redeem_saas_discount_code(p_code TEXT, p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_code RECORD;
    v_sub RECORD;
BEGIN
    -- Buscar el código
    SELECT * INTO v_code FROM public.saas_discount_codes WHERE code = p_code;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'El código ingresado no existe.');
    END IF;
    
    IF v_code.is_used THEN
        RETURN jsonb_build_object('success', false, 'message', 'Este código ya ha sido utilizado.');
    END IF;
    
    IF v_code.valid_until IS NOT NULL AND v_code.valid_until < now() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Este código ha caducado.');
    END IF;

    -- Obtener la suscripción actual del local (o crearla si no existe)
    SELECT * INTO v_sub FROM public.saas_subscriptions WHERE tenant_id = p_tenant_id;
    IF NOT FOUND THEN
        -- Si no tenía registro, se lo creamos vencido ayer para sumarle los meses
        INSERT INTO public.saas_subscriptions (tenant_id, status, current_period_end) 
        VALUES (p_tenant_id, 'trial', now() - INTERVAL '1 day')
        RETURNING * INTO v_sub;
    END IF;

    -- Aplicar lógica de regalo de meses
    IF v_code.discount_type = 'free_months' THEN
        -- Actualizar suscripción
        UPDATE public.saas_subscriptions 
        SET 
            status = 'trial',
            current_period_end = GREATEST(current_period_end, now()) + (v_code.discount_value || ' months')::INTERVAL,
            updated_at = now()
        WHERE tenant_id = p_tenant_id;
        
        -- Marcar código como usado
        UPDATE public.saas_discount_codes 
        SET is_used = true, used_by_tenant_id = p_tenant_id, used_at = now() 
        WHERE id = v_code.id;
        
        RETURN jsonb_build_object('success', true, 'message', '¡Código canjeado! Se han sumado ' || v_code.discount_value || ' meses a tu plan.');
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Tipo de descuento no soportado todavía.');
    END IF;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Inicializar Suscripciones para Locales Existentes
-- Otorga 15 días de prueba a los locales que ya existen para que no se bloqueen al instalar esto
INSERT INTO public.saas_subscriptions (tenant_id, status, current_period_end)
SELECT id, 'trial', now() + INTERVAL '15 days'
FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- 10. Publicar en Realtime
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.saas_subscriptions;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.saas_support_tickets;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;
