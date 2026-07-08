-- MMMcomprar Security Patch
-- 1. Create Secrets Table to store passwords securely
CREATE TABLE IF NOT EXISTS public.tenant_secrets (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    admin_password TEXT NOT NULL,
    staff_password TEXT DEFAULT '',
    kitchen_password TEXT DEFAULT '',
    delivery_password TEXT DEFAULT '',
    bartender_password TEXT DEFAULT '',
    waiter_password TEXT DEFAULT '',
    mercadopago_access_token TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en tenant_secrets pero SOLO para Service Role (Ningún cliente público puede leerlo)
ALTER TABLE public.tenant_secrets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No public access to tenant_secrets" ON public.tenant_secrets;
-- No se crea ninguna política, por defecto RLS bloquea todo acceso excepto a superuser/service_role.

-- 2. Migrate data from tenants to tenant_secrets
INSERT INTO public.tenant_secrets (
    tenant_id, 
    admin_password, 
    staff_password, 
    kitchen_password,
    delivery_password, 
    bartender_password,
    waiter_password,
    mercadopago_access_token
)
SELECT 
    id, 
    admin_password, 
    staff_password, 
    kitchen_password,
    delivery_password, 
    bartender_password,
    waiter_password,
    mercadopago_access_token
FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- 3. Create Tenant Sessions for secure authentication
CREATE TABLE IF NOT EXISTS public.tenant_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_seen TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tenant_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sessions no public" ON public.tenant_sessions;

-- 4. Secure RLS Helper Functions
-- Nueva función que requiere un token seguro (UUID) en x-tenant-session
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
  v_tenant_id UUID;
BEGIN
  BEGIN
    v_session_id := NULLIF(current_setting('request.headers', true)::json->>'x-tenant-session', '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  IF v_session_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM public.tenant_sessions WHERE id = v_session_id LIMIT 1;
  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Mantenemos la función legacy para retrocompatibilidad en el menú público (solo categorías/productos/insert orders)
CREATE OR REPLACE FUNCTION public.get_tenant_id_header()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('request.headers', true)::json->>'x-tenant-id', '')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 5. Actualizar check_tenant_credential para validar contra tenant_secrets y generar Sesión
CREATE OR REPLACE FUNCTION public.check_tenant_credential(p_slug TEXT, p_role TEXT, p_password TEXT)
RETURNS JSONB AS $$
DECLARE
  v_tenant RECORD;
  v_secrets RECORD;
  v_success BOOLEAN := FALSE;
  v_session_id UUID;
BEGIN
  SELECT * INTO v_tenant FROM public.tenants WHERE slug = p_slug;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Local no encontrado');
  END IF;

  SELECT * INTO v_secrets FROM public.tenant_secrets WHERE tenant_id = v_tenant.id;

  IF p_role = 'admin' AND v_secrets.admin_password = p_password THEN
    v_success := TRUE;
  ELSIF p_role = 'staff' AND 'staff' = ANY(v_tenant.enabled_roles) AND v_secrets.staff_password = p_password THEN
    v_success := TRUE;
  ELSIF p_role = 'delivery' AND 'delivery' = ANY(v_tenant.enabled_roles) AND v_secrets.delivery_password = p_password THEN
    v_success := TRUE;
  ELSIF p_role = 'kitchen' AND 'kitchen' = ANY(v_tenant.enabled_roles) AND v_secrets.kitchen_password = p_password THEN
    v_success := TRUE;
  ELSIF p_role = 'bartender' AND 'bartender' = ANY(v_tenant.enabled_roles) AND v_secrets.bartender_password = p_password THEN
    v_success := TRUE;
  END IF;
  
  IF v_success THEN
    -- Crear sesión segura
    INSERT INTO public.tenant_sessions (tenant_id, role) VALUES (v_tenant.id, p_role) RETURNING id INTO v_session_id;

    RETURN jsonb_build_object(
      'success', true, 
      'tenant_id', v_tenant.id, 
      'tenant_name', v_tenant.name,
      'theme_colors', v_tenant.theme_colors,
      'enabled_roles', to_jsonb(v_tenant.enabled_roles),
      'session_id', v_session_id
    );
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Contraseña incorrecta o rol inactivo');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Actualizar check_employee_credential para generar Sesión
CREATE OR REPLACE FUNCTION public.check_employee_credential(
    p_tenant_id UUID,
    p_employee_id UUID,
    p_pin TEXT
) RETURNS JSON AS $$
DECLARE
    emp_record RECORD;
    v_session_id UUID;
BEGIN
    SELECT * INTO emp_record 
    FROM public.employees 
    WHERE id = p_employee_id 
      AND tenant_id = p_tenant_id
      AND pin_code = p_pin;

    IF FOUND THEN
        -- Crear sesión segura
        INSERT INTO public.tenant_sessions (tenant_id, role) VALUES (p_tenant_id, emp_record.role) RETURNING id INTO v_session_id;

        RETURN json_build_object(
            'success', true,
            'employee_id', emp_record.id,
            'name', emp_record.name,
            'role', emp_record.role,
            'tenant_id', p_tenant_id,
            'session_id', v_session_id
        );
    ELSE
        RETURN json_build_object(
            'success', false,
            'error', 'PIN incorrecto o empleado no encontrado'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. LOCK DOWN DE TABLAS SENSIBLES (Fiados, Clientes, Empleados)
DROP POLICY IF EXISTS "Tenant isolation select customers" ON public.customers;
CREATE POLICY "Tenant isolation select customers" ON public.customers FOR SELECT USING (tenant_id = public.get_auth_tenant_id());
DROP POLICY IF EXISTS "Tenant isolation modify customers" ON public.customers;
CREATE POLICY "Tenant isolation modify customers" ON public.customers FOR ALL USING (tenant_id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation select tabs" ON public.customer_tabs;
CREATE POLICY "Tenant isolation select tabs" ON public.customer_tabs FOR SELECT USING (tenant_id = public.get_auth_tenant_id());
DROP POLICY IF EXISTS "Tenant isolation modify tabs" ON public.customer_tabs;
CREATE POLICY "Tenant isolation modify tabs" ON public.customer_tabs FOR ALL USING (tenant_id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation select payments" ON public.customer_tab_payments;
CREATE POLICY "Tenant isolation select payments" ON public.customer_tab_payments FOR SELECT USING (tenant_id = public.get_auth_tenant_id());
DROP POLICY IF EXISTS "Tenant isolation modify payments" ON public.customer_tab_payments;
CREATE POLICY "Tenant isolation modify payments" ON public.customer_tab_payments FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- 8. Seguridad en Comandas (Prevención de manipulación)
-- Permitimos INSERT a los clientes anónimos para crear carritos.
-- Pero bloqueamos UPDATE y DELETE para todos excepto administradores/staff verificados.
DROP POLICY IF EXISTS "Tenant isolation modify orders" ON public.orders;
CREATE POLICY "Tenant isolation insert orders" ON public.orders FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id_header());
CREATE POLICY "Tenant isolation update orders" ON public.orders FOR UPDATE USING (tenant_id = public.get_auth_tenant_id());
CREATE POLICY "Tenant isolation delete orders" ON public.orders FOR DELETE USING (tenant_id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation modify order_items" ON public.order_items;
CREATE POLICY "Tenant isolation insert order_items" ON public.order_items FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id_header());
CREATE POLICY "Tenant isolation update order_items" ON public.order_items FOR UPDATE USING (tenant_id = public.get_auth_tenant_id());
CREATE POLICY "Tenant isolation delete order_items" ON public.order_items FOR DELETE USING (tenant_id = public.get_auth_tenant_id());


-- 9. RPC para que el Panel de Administración actualice las claves de forma segura
CREATE OR REPLACE FUNCTION public.update_tenant_secrets(
    p_admin_password TEXT,
    p_staff_password TEXT,
    p_kitchen_password TEXT,
    p_delivery_password TEXT,
    p_bartender_password TEXT,
    p_waiter_password TEXT,
    p_mercadopago_token TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := public.get_auth_tenant_id();
    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
    END IF;

    UPDATE public.tenant_secrets 
    SET 
        admin_password = COALESCE(NULLIF(p_admin_password, ''), admin_password),
        staff_password = COALESCE(NULLIF(p_staff_password, ''), staff_password),
        kitchen_password = COALESCE(NULLIF(p_kitchen_password, ''), kitchen_password),
        delivery_password = COALESCE(NULLIF(p_delivery_password, ''), delivery_password),
        bartender_password = COALESCE(NULLIF(p_bartender_password, ''), bartender_password),
        waiter_password = COALESCE(NULLIF(p_waiter_password, ''), waiter_password),
        mercadopago_access_token = COALESCE(NULLIF(p_mercadopago_token, ''), mercadopago_access_token)
    WHERE tenant_id = v_tenant_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 10. Limpiar columnas sensibles de la vista pública de tenants
UPDATE public.tenants SET 
    admin_password = 'redacted',
    staff_password = 'redacted',
    kitchen_password = 'redacted',
    delivery_password = 'redacted',
    bartender_password = 'redacted',
    waiter_password = 'redacted',
    mercadopago_access_token = 'redacted';
