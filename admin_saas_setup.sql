-- Script de Migración para Supabase: Sistema SaaS (CEO Dashboard)
-- Ejecutar este script en el editor SQL de Supabase para crear la estructura del Master Admin de MMMcomprar.

-- 1. Modificar tabla de Tenants (Bloqueo Maestro y Conteos para el Dashboard)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;
-- Agregamos estos contadores virtuales si no existen, útiles para el funnel en el panel CEO
-- En una implementación real, esto suele resolverse con vistas o queries en el RPC,
-- pero el frontend espera 'orders_count' y 'products_count'.

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

-- Limpiar planes anteriores para dejar solo el Plan Único
DELETE FROM public.saas_plans;

-- Insertar plan único
INSERT INTO public.saas_plans (name, description, price_ars, max_devices, features)
VALUES 
('Plan Único', 'Acceso total a todas las funciones del sistema', 35000, 999, '["Cuentas ilimitadas", "Soporte 24/7", "Todas las funciones"]'::jsonb)
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
    discount_duration_months INT DEFAULT 1, -- Para porcentaje (cuántos meses dura el % off)
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

-- 7. Políticas de Seguridad (RLS) para Tenants 

DROP POLICY IF EXISTS "Lectura publica de saas_plans" ON public.saas_plans;
CREATE POLICY "Lectura publica de saas_plans" ON public.saas_plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lectura propia de saas_subscriptions" ON public.saas_subscriptions;
CREATE POLICY "Lectura propia de saas_subscriptions" ON public.saas_subscriptions 
FOR SELECT USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));

DROP POLICY IF EXISTS "Lectura propia de tickets" ON public.saas_support_tickets;
CREATE POLICY "Lectura propia de tickets" ON public.saas_support_tickets 
FOR SELECT USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));

DROP POLICY IF EXISTS "Insercion propia de tickets" ON public.saas_support_tickets;
CREATE POLICY "Insercion propia de tickets" ON public.saas_support_tickets 
FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));

-- 8. RPC: Canjear Código de Descuento de forma segura
CREATE OR REPLACE FUNCTION public.redeem_saas_discount_code(p_code TEXT, p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_code RECORD;
    v_sub RECORD;
BEGIN
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

    SELECT * INTO v_sub FROM public.saas_subscriptions WHERE tenant_id = p_tenant_id;
    IF NOT FOUND THEN
        INSERT INTO public.saas_subscriptions (tenant_id, status, current_period_end) 
        VALUES (p_tenant_id, 'trial', now() - INTERVAL '1 day')
        RETURNING * INTO v_sub;
    END IF;

    IF v_code.discount_type = 'free_months' THEN
        UPDATE public.saas_subscriptions 
        SET 
            status = 'trial',
            current_period_end = GREATEST(current_period_end, now()) + (v_code.discount_value || ' months')::INTERVAL,
            updated_at = now()
        WHERE tenant_id = p_tenant_id;
        
        UPDATE public.saas_discount_codes 
        SET is_used = true, used_by_tenant_id = p_tenant_id, used_at = now() 
        WHERE id = v_code.id;
        
        RETURN jsonb_build_object('success', true, 'message', '¡Código canjeado! Se han sumado ' || v_code.discount_value || ' meses a tu plan.');
    ELSE
        -- Logica para porcentaje
        UPDATE public.saas_discount_codes 
        SET is_used = true, used_by_tenant_id = p_tenant_id, used_at = now() 
        WHERE id = v_code.id;
        RETURN jsonb_build_object('success', true, 'message', '¡Código aplicado con ' || v_code.discount_value || '% de descuento!');
    END IF;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Inicializar Suscripciones para Locales Existentes
-- Otorga 14 días de prueba a los locales que ya existen para que no se bloqueen al instalar esto
INSERT INTO public.saas_subscriptions (tenant_id, status, current_period_end)
SELECT id, 'trial', now() + INTERVAL '14 days'
FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;


-- =========================================================================
--  R P C s   D E L   C E O   ( M A S T E R   A D M I N )
-- =========================================================================

-- RPC para obtener toda la info del SaaS
CREATE OR REPLACE FUNCTION public.get_all_saas_data(p_admin_email TEXT, p_admin_pass TEXT)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_is_valid BOOLEAN := FALSE;
BEGIN
    -- Credenciales del CEO (MMMcomprar)
    IF p_admin_email = 'maxesalmiron@gmail.com' AND p_admin_pass = 'mmm25comprar10co23' THEN
        v_is_valid := TRUE;
    END IF;

    IF NOT v_is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'Credenciales de CEO inválidas.');
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'tenants', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
            SELECT t.id, t.name, t.slug, t.email, t.is_suspended, t.created_at,
                   (SELECT COUNT(*) FROM public.orders o WHERE o.tenant_id = t.id) as orders_count,
                   (SELECT COUNT(*) FROM public.products p WHERE p.tenant_id = t.id) as products_count,
                   s.status as subscription_status, s.current_period_end,
                   p.name as plan_name, p.max_devices
            FROM public.tenants t
            LEFT JOIN public.saas_subscriptions s ON t.id = s.tenant_id
            LEFT JOIN public.saas_plans p ON s.plan_id = p.id
            ORDER BY t.created_at DESC
        ) t),
        'plans', (SELECT COALESCE(jsonb_agg(p), '[]'::jsonb) FROM (SELECT * FROM public.saas_plans ORDER BY price_ars ASC) p),
        'discount_codes', (SELECT COALESCE(jsonb_agg(d), '[]'::jsonb) FROM (
            SELECT d.*, t.name as used_by_tenant_name 
            FROM public.saas_discount_codes d 
            LEFT JOIN public.tenants t ON d.used_by_tenant_id = t.id
            ORDER BY d.created_at DESC
        ) d),
        'support_tickets', (SELECT COALESCE(jsonb_agg(st), '[]'::jsonb) FROM (
            SELECT st.*, t.name as tenant_name 
            FROM public.saas_support_tickets st 
            JOIN public.tenants t ON st.tenant_id = t.id
            ORDER BY st.created_at DESC
        ) st)
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para actualizar el estado de un local (Suspender/Activar)
CREATE OR REPLACE FUNCTION public.toggle_tenant_suspension(p_admin_email TEXT, p_admin_pass TEXT, p_tenant_id UUID, p_suspend BOOLEAN)
RETURNS JSONB AS $$
DECLARE
    v_is_valid BOOLEAN := FALSE;
BEGIN
    IF p_admin_email = 'maxesalmiron@gmail.com' AND p_admin_pass = 'mmm25comprar10co23' THEN v_is_valid := TRUE; END IF;

    IF NOT v_is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'Acceso denegado.');
    END IF;

    UPDATE public.tenants SET is_suspended = p_suspend WHERE id = p_tenant_id;
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para crear códigos de descuento (con soporte de duration_months)
CREATE OR REPLACE FUNCTION public.create_discount_code(
    p_admin_email TEXT, 
    p_admin_pass TEXT, 
    p_code TEXT, 
    p_type TEXT, 
    p_value NUMERIC,
    p_duration_months INT DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
    v_is_valid BOOLEAN := FALSE;
BEGIN
    IF p_admin_email = 'maxesalmiron@gmail.com' AND p_admin_pass = 'mmm25comprar10co23' THEN v_is_valid := TRUE; END IF;

    IF NOT v_is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'Acceso denegado.');
    END IF;

    INSERT INTO public.saas_discount_codes (code, discount_type, discount_value, discount_duration_months) 
    VALUES (p_code, p_type, p_value, p_duration_months);
    
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'El código ya existe.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
