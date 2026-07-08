-- Migración para Suscripciones SaaS: Downgrade Automático, Alertas y Nuevos Precios
-- Ejecutar en el SQL Editor de Supabase

-- 1. Añadir columnas a saas_subscriptions
ALTER TABLE public.saas_subscriptions ADD COLUMN IF NOT EXISTS fallback_plan_id UUID REFERENCES public.saas_plans(id) ON DELETE SET NULL;
ALTER TABLE public.saas_subscriptions ADD COLUMN IF NOT EXISTS pending_plan_id UUID REFERENCES public.saas_plans(id) ON DELETE SET NULL;
ALTER TABLE public.saas_subscriptions ADD COLUMN IF NOT EXISTS pending_fallback_plan_id UUID REFERENCES public.saas_plans(id) ON DELETE SET NULL;
ALTER TABLE public.saas_subscriptions ADD COLUMN IF NOT EXISTS show_downgrade_alert BOOLEAN DEFAULT FALSE;
ALTER TABLE public.saas_subscriptions ADD COLUMN IF NOT EXISTS last_downgraded_at TIMESTAMPTZ;

-- 2. Función RPC para chequear y aplicar el downgrade
CREATE OR REPLACE FUNCTION public.check_and_downgrade_subscription(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_sub RECORD;
    v_downgraded BOOLEAN := FALSE;
BEGIN
    -- Obtener la suscripción del tenant
    SELECT * INTO v_sub FROM public.saas_subscriptions 
    WHERE tenant_id = p_tenant_id;
    
    IF FOUND AND v_sub.discount_ends_at IS NOT NULL AND v_sub.discount_ends_at < now() AND v_sub.fallback_plan_id IS NOT NULL THEN
        -- Aplicar el downgrade automático
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

-- 3. Función RPC para descartar la alerta de downgrade
CREATE OR REPLACE FUNCTION public.dismiss_downgrade_alert(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.saas_subscriptions
    SET show_downgrade_alert = FALSE
    WHERE tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Triggers para sincronizar límites de la suscripción con el local (tenant)
CREATE OR REPLACE FUNCTION public.sync_tenant_plan_limits()
RETURNS TRIGGER AS $$
DECLARE
    v_max_devices INT := 3;
    v_is_suspended BOOLEAN := FALSE;
BEGIN
    -- Si la suscripción está activa o de prueba (trial), obtener los límites del plan
    IF NEW.status IN ('active', 'trial') AND NEW.plan_id IS NOT NULL THEN
        SELECT max_devices INTO v_max_devices FROM public.saas_plans WHERE id = NEW.plan_id;
    ELSIF NEW.status = 'suspended' THEN
        v_is_suspended := TRUE;
    END IF;

    -- Actualizar la tabla tenants
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

-- 5. Actualizar precios de los planes SaaS existentes
UPDATE public.saas_plans SET price_ars = 29900 WHERE name = 'Básico';
UPDATE public.saas_plans SET price_ars = 59900 WHERE name = 'Avanzado';
UPDATE public.saas_plans SET price_ars = 88900 WHERE name = 'Pro Ilimitado';

-- 6. Actualizar las características (features) en formato JSON para el control de accesos frontend/backend
UPDATE public.saas_plans 
SET features = '["KDS Cocina", "POS Caja", "Facturación AFIP", "Soporte Estándar"]'::jsonb 
WHERE name = 'Básico';

UPDATE public.saas_plans 
SET features = '["KDS Cocina", "POS Caja", "Facturación AFIP", "Panel de Mozos", "Panel de Barra", "Módulo Delivery", "Stock Avanzado", "Reservas con Seña", "Soporte Prioritario"]'::jsonb 
WHERE name = 'Avanzado';

UPDATE public.saas_plans 
SET features = '["KDS Cocina", "POS Caja", "Facturación AFIP", "Panel de Mozos", "Panel de Barra", "Módulo Delivery", "Stock Avanzado", "Reservas con Seña", "Programa de Fidelización", "Ofertas Programadas", "Balance Financiero Avanzado", "Soporte 24/7", "Cuentas Ilimitadas"]'::jsonb 
WHERE name = 'Pro Ilimitado';
