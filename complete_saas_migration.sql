-- MIGRACIÓN SAAS COMPLETA (Mercado Pago, Descuentos, Downgrade Automático y Desbloqueo de Pruebas)
-- Ejecutar este archivo completo en el SQL Editor de Supabase

-- =========================================================================
-- 1. CREACIÓN / ACTUALIZACIÓN DE COLUMNAS EN saas_subscriptions
-- =========================================================================
ALTER TABLE public.saas_subscriptions ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC DEFAULT 0;
ALTER TABLE public.saas_subscriptions ADD COLUMN IF NOT EXISTS discount_ends_at TIMESTAMPTZ;
ALTER TABLE public.saas_subscriptions ADD COLUMN IF NOT EXISTS fallback_plan_id UUID REFERENCES public.saas_plans(id) ON DELETE SET NULL;
ALTER TABLE public.saas_subscriptions ADD COLUMN IF NOT EXISTS pending_plan_id UUID REFERENCES public.saas_plans(id) ON DELETE SET NULL;
ALTER TABLE public.saas_subscriptions ADD COLUMN IF NOT EXISTS pending_fallback_plan_id UUID REFERENCES public.saas_plans(id) ON DELETE SET NULL;
ALTER TABLE public.saas_subscriptions ADD COLUMN IF NOT EXISTS show_downgrade_alert BOOLEAN DEFAULT FALSE;
ALTER TABLE public.saas_subscriptions ADD COLUMN IF NOT EXISTS last_downgraded_at TIMESTAMPTZ;

ALTER TABLE public.saas_discount_codes ADD COLUMN IF NOT EXISTS discount_duration_months INT DEFAULT 1;

-- =========================================================================
-- 2. ACTUALIZACIÓN DE PRECIOS Y CARACTERÍSTICAS DE LOS PLANES SaaS
-- =========================================================================
UPDATE public.saas_plans SET price_ars = 29900 WHERE name = 'Básico';
UPDATE public.saas_plans SET price_ars = 59900 WHERE name = 'Avanzado';
UPDATE public.saas_plans SET price_ars = 88900 WHERE name = 'Pro Ilimitado';

UPDATE public.saas_plans 
SET features = '["KDS Cocina", "POS Caja", "Facturación AFIP", "Soporte Estándar"]'::jsonb 
WHERE name = 'Básico';

UPDATE public.saas_plans 
SET features = '["KDS Cocina", "POS Caja", "Facturación AFIP", "Panel de Mozos", "Panel de Barra", "Módulo Delivery", "Stock Avanzado", "Reservas con Seña", "Soporte Prioritario"]'::jsonb 
WHERE name = 'Avanzado';

UPDATE public.saas_plans 
SET features = '["KDS Cocina", "POS Caja", "Facturación AFIP", "Panel de Mozos", "Panel de Barra", "Módulo Delivery", "Stock Avanzado", "Reservas con Seña", "Programa de Fidelización", "Ofertas Programadas", "Balance Financiero Avanzado", "Soporte 24/7", "Cuentas Ilimitadas"]'::jsonb 
WHERE name = 'Pro Ilimitado';

-- =========================================================================
-- 3. FUNCIONES RPC Y TRIGGERS DE CONTROL
-- =========================================================================

-- A. Función para Canjear Código de Descuento
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
        
        RETURN jsonb_build_object('success', true, 'message', '¡Código canjeado! Se han sumado ' || v_code.discount_value || ' meses a tu plan de prueba.');
        
    ELSIF v_code.discount_type = 'percentage' THEN
        UPDATE public.saas_subscriptions 
        SET 
            discount_percentage = v_code.discount_value,
            discount_ends_at = now() + (v_code.discount_duration_months || ' months')::INTERVAL,
            updated_at = now()
        WHERE tenant_id = p_tenant_id;
        
        UPDATE public.saas_discount_codes 
        SET is_used = true, used_by_tenant_id = p_tenant_id, used_at = now() 
        WHERE id = v_code.id;
        
        RETURN jsonb_build_object('success', true, 'message', '¡Cupón aplicado! Tenés ' || v_code.discount_value || '% de descuento por los próximos ' || v_code.discount_duration_months || ' meses al suscribirte.');
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Tipo de descuento no soportado.');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Función para crear códigos de descuento (Administrador)
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

-- C. Función para Chequear y Aplicar el Downgrade automático
CREATE OR REPLACE FUNCTION public.check_and_downgrade_subscription(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_sub RECORD;
    v_downgraded BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_sub FROM public.saas_subscriptions 
    WHERE tenant_id = p_tenant_id;
    
    IF FOUND AND v_sub.discount_ends_at IS NOT NULL AND v_sub.discount_ends_at < now() AND v_sub.fallback_plan_id IS NOT NULL THEN
        UPDATE public.saas_subscriptions
        SET 
            plan_id = fallback_plan_id,
            fallback_plan_id = NULL,
            discount_percentage = 0,
            discount_ends_at = NULL,
            show_downgrade_alert = TRUE,
            last_downgraded_at = now(),
            updated_at = now()
        WHERE tenant_id = p_tenant_id;
        
        v_downgraded := TRUE;
    END IF;
    
    RETURN jsonb_build_object('success', true, 'downgraded', v_downgraded);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- D. Función para Descartar Alerta de Downgrade
CREATE OR REPLACE FUNCTION public.dismiss_downgrade_alert(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.saas_subscriptions
    SET show_downgrade_alert = FALSE
    WHERE tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- E. Función y Trigger de Sincronización de Límites de Dispositivos y Suspensión
CREATE OR REPLACE FUNCTION public.sync_tenant_plan_limits()
RETURNS TRIGGER AS $$
DECLARE
    v_max_devices INT := 3;
    v_is_suspended BOOLEAN := FALSE;
BEGIN
    IF NEW.status IN ('active', 'trial') AND NEW.plan_id IS NOT NULL THEN
        SELECT max_devices INTO v_max_devices FROM public.saas_plans WHERE id = NEW.plan_id;
    ELSIF NEW.status = 'suspended' THEN
        v_is_suspended := TRUE;
    END IF;

    UPDATE public.tenants
    SET 
        max_devices = v_max_devices,
        is_suspended = v_is_suspended
    WHERE id = NEW.tenant_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_tenant_plan_limits ON public.saas_subscriptions;
CREATE TRIGGER trg_sync_tenant_plan_limits
AFTER INSERT OR UPDATE ON public.saas_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_plan_limits();

-- =========================================================================
-- 4. DESBLOQUEAR EL PLAN PRO ILIMITADO EN TU CUENTA DE PRUEBAS "Max pruebas" / "maxprueba"
-- =========================================================================

-- Asegurarse de que exista el registro de suscripción para el local de pruebas
INSERT INTO public.saas_subscriptions (tenant_id, status, current_period_end)
SELECT id, 'active', now() + INTERVAL '1 year'
FROM public.tenants
WHERE name ILIKE '%max%prueba%' OR slug ILIKE '%max%prueba%'
ON CONFLICT (tenant_id) DO NOTHING;

-- Forzar el Plan Pro Ilimitado y estado activo en la suscripción
UPDATE public.saas_subscriptions
SET 
    plan_id = (SELECT id FROM public.saas_plans WHERE name = 'Pro Ilimitado' LIMIT 1),
    status = 'active',
    current_period_end = now() + INTERVAL '1 year',
    discount_percentage = 0,
    discount_ends_at = NULL,
    fallback_plan_id = NULL,
    pending_plan_id = NULL,
    pending_fallback_plan_id = NULL,
    show_downgrade_alert = FALSE
WHERE tenant_id IN (
    SELECT id FROM public.tenants 
    WHERE name ILIKE '%max%prueba%' 
       OR slug ILIKE '%max%prueba%'
);

