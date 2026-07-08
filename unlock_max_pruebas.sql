-- SQL para desbloquear el Plan Pro Ilimitado en tu cuenta de pruebas
-- Ejecutar esto en el SQL Editor de Supabase

UPDATE public.saas_subscriptions
SET 
    plan_id = (SELECT id FROM public.saas_plans WHERE name = 'Pro Ilimitado' LIMIT 1),
    status = 'active',
    current_period_end = now() + INTERVAL '1 year', -- Válido por 1 año
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
