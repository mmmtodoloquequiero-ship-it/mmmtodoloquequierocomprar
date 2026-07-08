-- Script de Configuración Inicial para Supabase: Plataforma de Negocios
-- Ejecutar este script en el editor SQL de Supabase para configurar la base de datos desde cero.

-- 1. Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Crear tabla de Tenants (Negocios)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    theme_colors JSONB DEFAULT '{"primary": "#3b82f6", "secondary": "#1e293b", "mode": "light"}'::jsonb,
    enabled_roles TEXT[] DEFAULT ARRAY['admin', 'staff', 'delivery']::TEXT[],
    location_lat FLOAT8,
    location_lng FLOAT8,
    admin_password TEXT NOT NULL,
    staff_password TEXT NOT NULL DEFAULT '',
    delivery_password TEXT NOT NULL DEFAULT '',
    mercadopago_public_key TEXT DEFAULT '',
    mercadopago_access_token TEXT DEFAULT '',
    has_delivery BOOLEAN DEFAULT FALSE,
    delivery_zones JSONB DEFAULT '[]'::jsonb,
    profile_picture_url TEXT DEFAULT '',
    banner_url TEXT DEFAULT '',
    social_links JSONB DEFAULT '{"instagram": "", "facebook": "", "whatsapp": ""}'::jsonb,
    reviews_enabled BOOLEAN DEFAULT TRUE,
    terms_accepted BOOLEAN DEFAULT FALSE,
    terms_accepted_at TIMESTAMPTZ,
    landing_config JSONB DEFAULT '{"enabled": false, "hero_style": "modern", "events": [], "promos": [], "videos": []}'::jsonb,
    description TEXT DEFAULT '',
    last_online_ping TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Crear tablas principales del sistema de ventas
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INT DEFAULT 0,
    is_offer BOOLEAN DEFAULT FALSE,
    image_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    barcode TEXT DEFAULT NULL, -- NUEVO: Para escaneo de códigos de barra
    stock_level INT DEFAULT NULL,
    sale_by_weight BOOLEAN DEFAULT FALSE,
    base_weight NUMERIC DEFAULT NULL,
    base_weight_unit TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- NUEVO SISTEMA DE CUENTAS CORRIENTES (FIADO)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    document_number TEXT,
    max_credit_limit NUMERIC DEFAULT 10000,
    terms_accepted BOOLEAN DEFAULT FALSE,
    terms_accepted_at TIMESTAMPTZ,
    terms_ip_address TEXT,
    terms_user_agent TEXT,
    fiado_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_tabs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    period_start DATE NOT NULL, -- Fecha de inicio del periodo (ej. 2023-10-01)
    period_end DATE NOT NULL,   -- Fecha de fin del periodo (ej. 2023-11-01)
    total_debt NUMERIC DEFAULT 0,
    amount_paid NUMERIC DEFAULT 0,
    is_locked BOOLEAN DEFAULT FALSE, -- Bloqueado si no pagó al terminar el periodo
    is_settled BOOLEAN DEFAULT FALSE, -- Totalmente pagado
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_tab_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_tab_id UUID REFERENCES public.customer_tabs(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    payment_method TEXT DEFAULT 'efectivo',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de Pedidos (Orders)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    order_number INT,
    status TEXT NOT NULL DEFAULT 'pending',
    total NUMERIC NOT NULL,
    payment_method TEXT DEFAULT 'efectivo',
    payment_status TEXT DEFAULT 'pendiente',
    is_archived BOOLEAN DEFAULT FALSE,
    delivery_type TEXT DEFAULT 'llevar',
    delivery_address TEXT DEFAULT '',
    delivery_map_link TEXT DEFAULT '',
    delivery_fee NUMERIC DEFAULT 0,
    is_delivery_paid BOOLEAN DEFAULT FALSE,
    customer_tab_id UUID REFERENCES public.customer_tabs(id) ON DELETE SET NULL, -- Si se pagó con fiado
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INT NOT NULL,
    price_at_time NUMERIC NOT NULL,
    name_at_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, prepared
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    target_roles TEXT[] NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de Ofertas/Cupones
CREATE TABLE IF NOT EXISTS public.product_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    discount_percentage NUMERIC NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    limit_quantity NUMERIC,
    product_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Habilitar Row Level Security (RLS) en todas las tablas
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tab_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 5. Función helper para extraer la cabecera x-tenant-id de la sesión
CREATE OR REPLACE FUNCTION public.get_tenant_id_header()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('request.headers', true)::json->>'x-tenant-id', '')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Función RPC para validar credenciales
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
  ELSIF p_role = 'delivery' AND 'delivery' = ANY(v_tenant.enabled_roles) AND v_tenant.delivery_password = p_password THEN
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

-- 7. Configuración de Políticas de Seguridad RLS
-- Tenants
DROP POLICY IF EXISTS "Permitir lectura publica de tenants" ON public.tenants;
CREATE POLICY "Permitir lectura publica de tenants" ON public.tenants FOR SELECT USING (true);
DROP POLICY IF EXISTS "Permitir insercion publica de tenants" ON public.tenants;
CREATE POLICY "Permitir insercion publica de tenants" ON public.tenants FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Permitir update de tenant propio" ON public.tenants;
CREATE POLICY "Permitir update de tenant propio" ON public.tenants FOR UPDATE USING (id = public.get_tenant_id_header());

-- Genérica para tablas dependientes de tenant
DROP POLICY IF EXISTS "Tenant isolation select categories" ON public.categories;
CREATE POLICY "Tenant isolation select categories" ON public.categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Tenant isolation modify categories" ON public.categories;
CREATE POLICY "Tenant isolation modify categories" ON public.categories FOR ALL USING (tenant_id = public.get_tenant_id_header());

DROP POLICY IF EXISTS "Tenant isolation select products" ON public.products;
CREATE POLICY "Tenant isolation select products" ON public.products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Tenant isolation modify products" ON public.products;
CREATE POLICY "Tenant isolation modify products" ON public.products FOR ALL USING (tenant_id = public.get_tenant_id_header());

DROP POLICY IF EXISTS "Tenant isolation select customers" ON public.customers;
CREATE POLICY "Tenant isolation select customers" ON public.customers FOR SELECT USING (tenant_id = public.get_tenant_id_header());
DROP POLICY IF EXISTS "Tenant isolation modify customers" ON public.customers;
CREATE POLICY "Tenant isolation modify customers" ON public.customers FOR ALL USING (tenant_id = public.get_tenant_id_header());

DROP POLICY IF EXISTS "Tenant isolation select tabs" ON public.customer_tabs;
CREATE POLICY "Tenant isolation select tabs" ON public.customer_tabs FOR SELECT USING (tenant_id = public.get_tenant_id_header());
DROP POLICY IF EXISTS "Tenant isolation modify tabs" ON public.customer_tabs;
CREATE POLICY "Tenant isolation modify tabs" ON public.customer_tabs FOR ALL USING (tenant_id = public.get_tenant_id_header());

DROP POLICY IF EXISTS "Tenant isolation select payments" ON public.customer_tab_payments;
CREATE POLICY "Tenant isolation select payments" ON public.customer_tab_payments FOR SELECT USING (tenant_id = public.get_tenant_id_header());
DROP POLICY IF EXISTS "Tenant isolation modify payments" ON public.customer_tab_payments;
CREATE POLICY "Tenant isolation modify payments" ON public.customer_tab_payments FOR ALL USING (tenant_id = public.get_tenant_id_header());

DROP POLICY IF EXISTS "Tenant isolation select orders" ON public.orders;
CREATE POLICY "Tenant isolation select orders" ON public.orders FOR SELECT USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
DROP POLICY IF EXISTS "Tenant isolation modify orders" ON public.orders;
CREATE POLICY "Tenant isolation modify orders" ON public.orders FOR ALL USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));

DROP POLICY IF EXISTS "Tenant isolation select order_items" ON public.order_items;
CREATE POLICY "Tenant isolation select order_items" ON public.order_items FOR SELECT USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
DROP POLICY IF EXISTS "Tenant isolation modify order_items" ON public.order_items;
CREATE POLICY "Tenant isolation modify order_items" ON public.order_items FOR ALL USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));

DROP POLICY IF EXISTS "Tenant isolation select app_notif" ON public.app_notifications;
CREATE POLICY "Tenant isolation select app_notif" ON public.app_notifications FOR SELECT USING (tenant_id = public.get_tenant_id_header());
DROP POLICY IF EXISTS "Tenant isolation modify app_notif" ON public.app_notifications;
CREATE POLICY "Tenant isolation modify app_notif" ON public.app_notifications FOR ALL USING (tenant_id = public.get_tenant_id_header());

DROP POLICY IF EXISTS "Tenant isolation select offers" ON public.product_offers;
CREATE POLICY "Tenant isolation select offers" ON public.product_offers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Tenant isolation modify offers" ON public.product_offers;
CREATE POLICY "Tenant isolation modify offers" ON public.product_offers FOR ALL USING (tenant_id = public.get_tenant_id_header());

DROP POLICY IF EXISTS "Lectura pública reseñas" ON public.reviews;
CREATE POLICY "Lectura pública reseñas" ON public.reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Inserción pública reseñas" ON public.reviews;
CREATE POLICY "Inserción pública reseñas" ON public.reviews FOR INSERT WITH CHECK (true);

-- Asignar valores por defecto para tenant_id
ALTER TABLE public.categories ALTER COLUMN tenant_id SET DEFAULT public.get_tenant_id_header();
ALTER TABLE public.products ALTER COLUMN tenant_id SET DEFAULT public.get_tenant_id_header();
ALTER TABLE public.customers ALTER COLUMN tenant_id SET DEFAULT public.get_tenant_id_header();
ALTER TABLE public.customer_tabs ALTER COLUMN tenant_id SET DEFAULT public.get_tenant_id_header();
ALTER TABLE public.customer_tab_payments ALTER COLUMN tenant_id SET DEFAULT public.get_tenant_id_header();
ALTER TABLE public.orders ALTER COLUMN tenant_id SET DEFAULT public.get_tenant_id_header();
ALTER TABLE public.order_items ALTER COLUMN tenant_id SET DEFAULT public.get_tenant_id_header();
ALTER TABLE public.app_notifications ALTER COLUMN tenant_id SET DEFAULT public.get_tenant_id_header();
ALTER TABLE public.product_offers ALTER COLUMN tenant_id SET DEFAULT public.get_tenant_id_header();

-- 8. Trigger para Números de Pedido Diarios
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER AS $$
DECLARE
    v_max_number INT;
BEGIN
    SELECT COALESCE(MAX(order_number), 0) INTO v_max_number
    FROM public.orders
    WHERE tenant_id = NEW.tenant_id
      AND (created_at AT TIME ZONE 'UTC')::DATE = (now() AT TIME ZONE 'UTC')::DATE;
    NEW.order_number := v_max_number + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_order_number ON public.orders;
CREATE TRIGGER tr_set_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_order_number();

-- 9. Habilitar Replicación en Tiempo Real
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_tabs;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 10. Tabla de Planes SaaS
CREATE TABLE IF NOT EXISTS public.saas_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price_ars NUMERIC NOT NULL DEFAULT 0,
    max_devices INT NOT NULL DEFAULT 999,
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar plan único por defecto
INSERT INTO public.saas_plans (name, description, price_ars, max_devices, features)
VALUES 
('Único', 'Control total para tu negocio', 30000, 999, '["Cuentas ilimitadas", "Soporte", "Catálogo online", "Fiado"]'::jsonb)
ON CONFLICT DO NOTHING;

-- 11. Tabla de Suscripciones por Local
CREATE TABLE IF NOT EXISTS public.saas_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.saas_plans(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'trial', -- 'trial', 'active', 'past_due', 'canceled', 'suspended'
    current_period_end TIMESTAMPTZ NOT NULL,
    mp_subscription_id TEXT, -- ID de la suscripción de Mercado Pago
    mp_payer_email TEXT,
    discount_percentage NUMERIC DEFAULT 0,
    discount_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id)
);

-- 12. Tabla de Códigos de Descuento (Cupones SaaS)
CREATE TABLE IF NOT EXISTS public.saas_discount_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL DEFAULT 'free_months', -- 'free_months', 'percentage'
    discount_value NUMERIC NOT NULL, -- Ej: 1 (meses) o 100 (porcentaje)
    valid_until TIMESTAMPTZ,
    is_used BOOLEAN DEFAULT FALSE,
    used_by_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_discount_codes ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Lectura publica de saas_plans" ON public.saas_plans;
CREATE POLICY "Lectura publica de saas_plans" ON public.saas_plans FOR SELECT USING (true);
DROP POLICY IF EXISTS "Lectura propia de saas_subscriptions" ON public.saas_subscriptions;
CREATE POLICY "Lectura propia de saas_subscriptions" ON public.saas_subscriptions 
FOR SELECT USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));

-- RPC Canje de Cupones
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
        RETURN jsonb_build_object('success', false, 'message', 'Tipo de descuento no soportado.');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
