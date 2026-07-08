-- RPC para obtener toda la info del SaaS (Uso exclusivo del Master Admin)
CREATE OR REPLACE FUNCTION public.get_all_saas_data(p_admin_email TEXT, p_admin_pass TEXT)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_is_valid BOOLEAN := FALSE;
BEGIN
    -- Validar Credenciales (Hardcodeado para el dueño del SaaS)
    -- Puedes cambiar 'ceo@mymapps.com' y 'master2026' por tus datos reales aquí mismo antes de ejecutar el script.
    IF p_admin_email = 'ceo@mymapps.com' AND p_admin_pass = 'master2026' THEN
        v_is_valid := TRUE;
    END IF;

    IF NOT v_is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'Credenciales de CEO inválidas.');
    END IF;

    -- Recopilar toda la información (Bypass RLS porque es SECURITY DEFINER)
    v_result := jsonb_build_object(
        'success', true,
        'tenants', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
            SELECT t.id, t.name, t.slug, t.email, t.is_suspended, t.created_at,
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

-- RPC para actualizar el estado de una franquicia (Suspender/Activar)
CREATE OR REPLACE FUNCTION public.toggle_tenant_suspension(p_admin_email TEXT, p_admin_pass TEXT, p_tenant_id UUID, p_suspend BOOLEAN)
RETURNS JSONB AS $$
DECLARE
    v_is_valid BOOLEAN := FALSE;
BEGIN
    IF p_admin_email = 'ceo@mymapps.com' AND p_admin_pass = 'master2026' THEN v_is_valid := TRUE; END IF;

    IF NOT v_is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'Acceso denegado.');
    END IF;

    UPDATE public.tenants SET is_suspended = p_suspend WHERE id = p_tenant_id;
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para crear códigos de descuento
CREATE OR REPLACE FUNCTION public.create_discount_code(p_admin_email TEXT, p_admin_pass TEXT, p_code TEXT, p_type TEXT, p_value NUMERIC)
RETURNS JSONB AS $$
DECLARE
    v_is_valid BOOLEAN := FALSE;
BEGIN
    IF p_admin_email = 'ceo@mymapps.com' AND p_admin_pass = 'master2026' THEN v_is_valid := TRUE; END IF;

    IF NOT v_is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'Acceso denegado.');
    END IF;

    INSERT INTO public.saas_discount_codes (code, discount_type, discount_value) VALUES (p_code, p_type, p_value);
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'El código ya existe.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
