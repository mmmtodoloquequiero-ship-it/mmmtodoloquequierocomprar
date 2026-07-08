-- Añadir columnas a saas_subscriptions para el control de la promo
ALTER TABLE public.saas_subscriptions 
ADD COLUMN IF NOT EXISTS promo_pro_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS promo_warning_email_sent BOOLEAN DEFAULT false;

-- Actualizar la función que retorna las características del plan del tenant
-- Para asegurarnos de que, si está en el periodo de promoción, devuelva las características del "Pro Ilimitado".
CREATE OR REPLACE FUNCTION get_tenant_plan_features(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub RECORD;
    v_features JSONB;
    v_pro_plan RECORD;
BEGIN
    -- Obtener la suscripción actual
    SELECT s.*, p.features, p.name INTO v_sub
    FROM saas_subscriptions s
    LEFT JOIN saas_plans p ON s.plan_id = p.id
    WHERE s.tenant_id = p_tenant_id;

    -- Si no hay suscripción, o está en "pending_trial" o "trial", podemos darle las características que le corresponden por defecto (Pro)
    IF v_sub IS NULL THEN
        RETURN '[]'::JSONB;
    END IF;

    -- Lógica de promoción de 1 mes: si pagó un plan menor (Ej: Básico) pero tiene la promo activa
    IF v_sub.promo_pro_ends_at IS NOT NULL AND v_sub.promo_pro_ends_at > NOW() THEN
        -- Buscar el plan Pro Ilimitado para darle esas características
        SELECT * INTO v_pro_plan FROM saas_plans WHERE name ILIKE '%Pro Ilimitado%' LIMIT 1;
        
        IF v_pro_plan.features IS NOT NULL THEN
            RETURN v_pro_plan.features;
        END IF;
    END IF;

    -- Si no está en promo, devolver las características normales de su plan
    RETURN COALESCE(v_sub.features, '[]'::JSONB);
END;
$$;
