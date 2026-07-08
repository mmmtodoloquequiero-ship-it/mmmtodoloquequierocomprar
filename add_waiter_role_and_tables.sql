-- 1. Agregar credenciales y estructura JSONB de mesas en tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS waiter_password TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS tables JSONB DEFAULT '[]'::JSONB; -- Guarda [{ "id": "uuid", "name": "Mesa 1", "description": "Sector VIP Terraza" }]

-- 2. Campos de mesa en pedidos y servicio físico de ítems
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS table_number TEXT DEFAULT NULL;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_served BOOLEAN DEFAULT false;

-- 3. Habilitar política de lectura de notificaciones para el mozo
DROP POLICY IF EXISTS "Permitir lectura de notificaciones para mozo" ON public.app_notifications;
CREATE POLICY "Permitir lectura de notificaciones para mozo" ON public.app_notifications
    FOR SELECT USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));

-- 4. Recrear función de chequeo de credenciales para dar soporte al rol de 'waiter' (Mozo)
CREATE OR REPLACE FUNCTION public.check_tenant_credential(p_slug TEXT, p_role TEXT, p_password TEXT)
RETURNS JSONB AS $$
DECLARE
  v_tenant RECORD;
  v_success BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_tenant FROM public.tenants WHERE slug = p_slug;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Local no encontrado');
  END IF;
  
  IF p_role = 'admin' AND v_tenant.admin_password = p_password THEN
    v_success := TRUE;
  ELSIF p_role = 'staff' AND 'staff' = ANY(v_tenant.enabled_roles) AND v_tenant.staff_password = p_password THEN
    v_success := TRUE;
  ELSIF p_role = 'kitchen' AND 'kitchen' = ANY(v_tenant.enabled_roles) AND v_tenant.kitchen_password = p_password THEN
    v_success := TRUE;
  ELSIF p_role = 'delivery' AND 'delivery' = ANY(v_tenant.enabled_roles) AND v_tenant.delivery_password = p_password THEN
    v_success := TRUE;
  ELSIF p_role = 'bartender' AND 'bartender' = ANY(v_tenant.enabled_roles) AND v_tenant.bartender_password = p_password THEN
    v_success := TRUE;
  ELSIF p_role = 'waiter' AND 'waiter' = ANY(v_tenant.enabled_roles) AND v_tenant.waiter_password = p_password THEN
    v_success := TRUE;
  END IF;
  
  IF v_success THEN
    RETURN jsonb_build_object(
      'success', true, 
      'tenant_id', v_tenant.id, 
      'tenant_name', v_tenant.name,
      'theme_colors', v_tenant.theme_colors,
      'enabled_roles', to_jsonb(v_tenant.enabled_roles)
    );
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Contraseña incorrecta o rol inactivo');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
