-- 1. Añadir campos a saas_discount_codes
ALTER TABLE public.saas_discount_codes ADD COLUMN IF NOT EXISTS discount_duration_months INT DEFAULT 1;

-- 2. Añadir campos a saas_subscriptions para rastrear el descuento vigente
ALTER TABLE public.saas_subscriptions ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC DEFAULT 0;
ALTER TABLE public.saas_subscriptions ADD COLUMN IF NOT EXISTS discount_ends_at TIMESTAMPTZ;

-- 3. Actualizar RPC para crear códigos de descuento (ahora acepta meses de duración)
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
    IF p_admin_email = 'ceo@mymapps.com' AND p_admin_pass = 'master2026' THEN v_is_valid := TRUE; END IF;

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


-- 4. Actualizar RPC de Canjear Código para soportar Porcentaje y Duración
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
        -- Si no tenía registro, se lo creamos vencido ayer
        INSERT INTO public.saas_subscriptions (tenant_id, status, current_period_end) 
        VALUES (p_tenant_id, 'trial', now() - INTERVAL '1 day')
        RETURNING * INTO v_sub;
    END IF;

    IF v_code.discount_type = 'free_months' THEN
        -- Actualizar suscripción sumando meses
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
        
        RETURN jsonb_build_object('success', true, 'message', '¡Código canjeado! Se han sumado ' || v_code.discount_value || ' meses a tu plan de prueba.');
        
    ELSIF v_code.discount_type = 'percentage' THEN
        -- Aplicar descuento porcentual por X meses
        UPDATE public.saas_subscriptions 
        SET 
            discount_percentage = v_code.discount_value,
            discount_ends_at = now() + (v_code.discount_duration_months || ' months')::INTERVAL,
            updated_at = now()
        WHERE tenant_id = p_tenant_id;
        
        -- Marcar código como usado
        UPDATE public.saas_discount_codes 
        SET is_used = true, used_by_tenant_id = p_tenant_id, used_at = now() 
        WHERE id = v_code.id;
        
        RETURN jsonb_build_object('success', true, 'message', '¡Cupón aplicado! Tenés ' || v_code.discount_value || '% de descuento por los próximos ' || v_code.discount_duration_months || ' meses al suscribirte.');
        
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Tipo de descuento no soportado.');
    END IF;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
