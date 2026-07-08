-- 1. Añadir columna para registrar el inicio real del Trial
ALTER TABLE public.saas_subscriptions ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Trigger para asignar Suscripción "Pro Ilimitado" en estado 'pending_trial' al registrar nuevo local
CREATE OR REPLACE FUNCTION public.auto_create_saas_subscription()
RETURNS TRIGGER AS $$
DECLARE
    v_pro_plan_id UUID;
BEGIN
    -- Buscar el plan "Pro Ilimitado" (Tercer plan)
    SELECT id INTO v_pro_plan_id FROM public.saas_plans WHERE name ILIKE '%Pro Ilimitado%' LIMIT 1;
    
    INSERT INTO public.saas_subscriptions (tenant_id, plan_id, status, current_period_end, trial_started_at)
    VALUES (NEW.id, v_pro_plan_id, 'pending_trial', NULL, NULL);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_auto_create_saas_subscription ON public.tenants;
CREATE TRIGGER tr_auto_create_saas_subscription
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_saas_subscription();


-- 3. Trigger para INICIAR el reloj del Trial al recibir el PRIMER PEDIDO
CREATE OR REPLACE FUNCTION public.start_trial_on_first_order()
RETURNS TRIGGER AS $$
DECLARE
    v_sub RECORD;
BEGIN
    SELECT * INTO v_sub FROM public.saas_subscriptions WHERE tenant_id = NEW.tenant_id;
    
    -- Si está en pending_trial y aún no inició, iniciamos los 14 días.
    IF FOUND AND v_sub.trial_started_at IS NULL AND v_sub.status IN ('trial', 'pending_trial') THEN
        UPDATE public.saas_subscriptions 
        SET trial_started_at = now(),
            status = 'trial',
            current_period_end = now() + INTERVAL '14 days'
        WHERE tenant_id = NEW.tenant_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_start_trial_on_first_order ON public.orders;
CREATE TRIGGER tr_start_trial_on_first_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.start_trial_on_first_order();

-- 4. Retrocompatibilidad para Locales Existentes
-- Los que ya tienen 'trial' y current_period_end pero no tienen trial_started_at, los iniciamos ahora.
UPDATE public.saas_subscriptions 
SET trial_started_at = GREATEST(now() - INTERVAL '14 days', current_period_end - INTERVAL '14 days')
WHERE trial_started_at IS NULL AND current_period_end IS NOT NULL AND status = 'trial';

-- Los que no tenían plan asignado por error, se los forzamos a Pro Ilimitado
UPDATE public.saas_subscriptions
SET plan_id = (SELECT id FROM public.saas_plans WHERE name ILIKE '%Pro Ilimitado%' LIMIT 1)
WHERE plan_id IS NULL;


-- 5. Actualizar el RPC del CEO para sumar métricas de productos y órdenes
CREATE OR REPLACE FUNCTION public.get_all_saas_data(p_admin_email TEXT, p_admin_pass TEXT)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_is_valid BOOLEAN := FALSE;
BEGIN
    IF p_admin_email = 'ceo@mymapps.com' AND p_admin_pass = 'master2026' THEN
        v_is_valid := TRUE;
    END IF;

    IF NOT v_is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'Credenciales de CEO inválidas.');
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'tenants', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
            SELECT t.id, t.name, t.slug, t.email, t.is_suspended, t.created_at,
                   s.status as subscription_status, s.current_period_end, s.trial_started_at,
                   p.name as plan_name, p.max_devices, p.price_ars,
                   (SELECT COUNT(*) FROM public.products WHERE tenant_id = t.id) as products_count,
                   (SELECT COUNT(*) FROM public.orders WHERE tenant_id = t.id) as orders_count
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
