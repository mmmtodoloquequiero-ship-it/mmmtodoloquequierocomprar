-- Script de Migración para Supabase: Refactorización Multi-Tenant (MyMapps)
-- Ejecutar este script en el editor SQL de Supabase para configurar la Base de Datos.

-- 1. Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Crear tabla de Tenants (Negocios)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE, -- Único para evitar nombres duplicados
    slug TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL, -- Correo electrónico obligatorio
    theme_colors JSONB DEFAULT '{"primary": "#f97316", "secondary": "#1e293b", "mode": "dark"}'::jsonb,
    enabled_roles TEXT[] DEFAULT ARRAY['admin', 'staff', 'kitchen', 'delivery', 'bartender', 'waiter', 'animador']::TEXT[], -- Roles habilitados
    location_lat FLOAT8,
    location_lng FLOAT8,
    admin_password TEXT NOT NULL,
    staff_password TEXT NOT NULL DEFAULT '',
    kitchen_password TEXT NOT NULL DEFAULT '',
    delivery_password TEXT NOT NULL DEFAULT '',
    bartender_password TEXT NOT NULL DEFAULT '',
    waiter_password TEXT NOT NULL DEFAULT '',
    animador_password TEXT NOT NULL DEFAULT '',
    tables JSONB DEFAULT '[]'::jsonb,
    waiters JSONB DEFAULT '[]'::jsonb,
    mercadopago_public_key TEXT DEFAULT '',
    mercadopago_access_token TEXT DEFAULT '',
    has_delivery BOOLEAN DEFAULT FALSE,
    delivery_zones JSONB DEFAULT '[]'::jsonb,
    profile_picture_url TEXT DEFAULT '',
    banner_url TEXT DEFAULT '',
    social_links JSONB DEFAULT '{"instagram": "", "facebook": "", "whatsapp": ""}'::jsonb,
    reviews_enabled BOOLEAN DEFAULT TRUE,
    landing_config JSONB DEFAULT '{"enabled": false, "hero_style": "modern", "events": [], "promos": [], "videos": []}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Asegurar actualización de columnas si la tabla ya existía
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS email TEXT DEFAULT 'admin@mymapps.com';

-- Retrocompatibilidad: Rellenar correos vacíos antes de aplicar la restricción NOT NULL
UPDATE public.tenants SET email = 'admin@mymapps.com' WHERE email IS NULL;

ALTER TABLE public.tenants ALTER COLUMN email SET NOT NULL;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS delivery_password TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS bartender_password TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS waiter_password TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS animador_password TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS tables JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS waiters JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS mercadopago_public_key TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS mercadopago_access_token TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS has_delivery BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS delivery_zones JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS profile_picture_url TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS banner_url TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{"instagram": "", "facebook": "", "whatsapp": ""}'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS reviews_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS landing_config JSONB DEFAULT '{"enabled": false, "hero_style": "modern", "events": [], "promos": [], "videos": []}'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS enabled_roles TEXT[] DEFAULT ARRAY['admin', 'staff', 'kitchen', 'delivery', 'bartender', 'waiter', 'animador']::TEXT[];
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS last_online_ping TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_name_key') THEN
        ALTER TABLE public.tenants ADD CONSTRAINT tenants_name_key UNIQUE (name);
    END IF;
END;
$$;

-- 3. Agregar columnas tenant_id y campos específicos a las tablas existentes
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS target_departments TEXT[] DEFAULT ARRAY['kitchen']::TEXT[];
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_offer BOOLEAN DEFAULT FALSE;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.product_ingredients ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Columnas de orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number INT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'efectivo';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pendiente';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS table_number TEXT DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS waiter_name TEXT DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'llevar';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address TEXT DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_map_link TEXT DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_delivery_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_approved_for_production BOOLEAN DEFAULT TRUE;

-- Columnas opcionales para facturación AFIP a petición del cliente
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS afip_billing_requested BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS afip_client_type TEXT DEFAULT 'consumidor_final';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS afip_doc_type TEXT DEFAULT 'DNI';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS afip_doc_number TEXT DEFAULT '';

-- Nuevas columnas para Propinas y Cubiertos
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tip_amount NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_tip_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS table_charge NUMERIC DEFAULT 0;

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS tips_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS table_charge_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS table_charge_amount NUMERIC DEFAULT 0;

-- Columna temporal para las notificaciones y estado de preparación
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS preparation_time_minutes INT DEFAULT NULL;

-- Columnas de order_items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_served BOOLEAN DEFAULT FALSE;

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.app_notifications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 3.1. Evolución de Insumos y Ruteo Inteligente
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS target_departments TEXT[] DEFAULT ARRAY['kitchen']::TEXT[];
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS target_departments TEXT[] DEFAULT NULL; -- Si es NULL, se usará el de la categoría
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- 3.5. Retrocompatibilidad y Migración de Datos Existentes
-- Rellenar de forma segura columnas nulas para locales y registros ya existentes.
-- Esto evita bloqueos de inicio de sesión y asegura que las vistas funcionen perfectamente.

UPDATE public.tenants 
SET enabled_roles = ARRAY['admin', 'staff', 'kitchen', 'delivery', 'bartender']::TEXT[] 
WHERE enabled_roles IS NULL;

UPDATE public.tenants 
SET staff_password = '' 
WHERE staff_password IS NULL;

UPDATE public.tenants 
SET kitchen_password = '' 
WHERE kitchen_password IS NULL;

UPDATE public.tenants 
SET delivery_password = '' 
WHERE delivery_password IS NULL;

UPDATE public.tenants 
SET bartender_password = '' 
WHERE bartender_password IS NULL;

UPDATE public.tenants 
SET animador_password = '' 
WHERE animador_password IS NULL;

-- Migración para soportar múltiples departamentos por categoría
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS target_departments TEXT[] DEFAULT ARRAY['kitchen']::TEXT[];

-- Migrar datos de la columna antigua (si existe) a la nueva de forma segura
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'target_department') THEN
        UPDATE public.categories SET target_departments = ARRAY[target_department]::TEXT[] 
        WHERE (target_departments IS NULL OR target_departments = ARRAY['kitchen']::TEXT[]);
    END IF;
END $$;


-- 3.6. Auto-Mapeo Inteligente de Departamentos (Sincronización Crítica)
-- Configura automáticamente insumos comunes a sus departamentos correspondientes
UPDATE public.ingredients 
SET target_departments = ARRAY['bartender']::TEXT[] 
WHERE (name ILIKE '%Coca-Cola%' 
   OR name ILIKE '%Agua%' 
   OR name ILIKE '%Cerveza%' 
   OR name ILIKE '%Soda%' 
   OR name ILIKE '%Bebida%'
   OR name ILIKE '%Jugo%'
   OR name ILIKE '%Sprite%'
   OR name ILIKE '%Fanta%'
   OR name ILIKE '%Gaseosa%'
   OR name ILIKE '%Vino%'
   OR name ILIKE '%Fernet%'
   OR name ILIKE '%Gin%'
   OR name ILIKE '%Tónica%'
   OR name ILIKE '%Hielo%');

UPDATE public.ingredients 
SET target_departments = ARRAY['kitchen']::TEXT[] 
WHERE (name ILIKE '%Pan%' 
   OR name ILIKE '%Carne%' 
   OR name ILIKE '%Papa%' 
   OR name ILIKE '%Queso%' 
   OR name ILIKE '%Pollo%' 
   OR name ILIKE '%Salsa%'
   OR name ILIKE '%Tomate%'
   OR name ILIKE '%Lechuga%'
   OR name ILIKE '%Fritas%'
   OR name ILIKE '%Milanesa%'
   OR name ILIKE '%Huevo%'
   OR name ILIKE '%Jamón%');

-- 3.7. Reparación de Datos Huérfanos (tenant_id IS NULL)
-- Este script asocia todos los datos existentes al primer local si no tienen tenant_id.
-- Es CRUCIAL para que los datos sean visibles bajo las nuevas políticas de RLS.
DO $$
DECLARE
    v_first_tenant_id UUID;
BEGIN
    SELECT id INTO v_first_tenant_id FROM public.tenants LIMIT 1;
    
    IF v_first_tenant_id IS NOT NULL THEN
        UPDATE public.categories SET tenant_id = v_first_tenant_id WHERE tenant_id IS NULL;
        UPDATE public.products SET tenant_id = v_first_tenant_id WHERE tenant_id IS NULL;
        UPDATE public.ingredients SET tenant_id = v_first_tenant_id WHERE tenant_id IS NULL;
        UPDATE public.product_ingredients SET tenant_id = v_first_tenant_id WHERE tenant_id IS NULL;
        UPDATE public.orders SET tenant_id = v_first_tenant_id WHERE tenant_id IS NULL;
        UPDATE public.order_items SET tenant_id = v_first_tenant_id WHERE tenant_id IS NULL;
        UPDATE public.expenses SET tenant_id = v_first_tenant_id WHERE tenant_id IS NULL;
        UPDATE public.app_notifications SET tenant_id = v_first_tenant_id WHERE tenant_id IS NULL;
    END IF;
END $$;


-- 4. Habilitar Row Level Security (RLS) en todas las tablas
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

-- 5. Función helper para extraer la cabecera x-tenant-id de la sesión
CREATE OR REPLACE FUNCTION public.get_tenant_id_header()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('request.headers', true)::json->>'x-tenant-id', '')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Función RPC para validar credenciales de un tenant de forma segura (sin exponer contraseñas al cliente)
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
  ELSIF p_role = 'animador' AND 'animador' = ANY(v_tenant.enabled_roles) AND v_tenant.animador_password = p_password THEN
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
-- Eliminamos políticas antiguas para evitar duplicados
DROP POLICY IF EXISTS "Permitir lectura publica de tenants" ON public.tenants;
DROP POLICY IF EXISTS "Permitir insercion publica de tenants" ON public.tenants;
DROP POLICY IF EXISTS "Permitir update de tenant propio" ON public.tenants;
DROP POLICY IF EXISTS "Tenant isolation select" ON public.categories;
DROP POLICY IF EXISTS "Tenant isolation insert" ON public.categories;
DROP POLICY IF EXISTS "Tenant isolation update" ON public.categories;
DROP POLICY IF EXISTS "Tenant isolation delete" ON public.categories;

DROP POLICY IF EXISTS "Tenant isolation select" ON public.products;
DROP POLICY IF EXISTS "Tenant isolation insert" ON public.products;
DROP POLICY IF EXISTS "Tenant isolation update" ON public.products;
DROP POLICY IF EXISTS "Tenant isolation delete" ON public.products;

DROP POLICY IF EXISTS "Tenant isolation select" ON public.ingredients;
DROP POLICY IF EXISTS "Tenant isolation insert" ON public.ingredients;
DROP POLICY IF EXISTS "Tenant isolation update" ON public.ingredients;
DROP POLICY IF EXISTS "Tenant isolation delete" ON public.ingredients;

DROP POLICY IF EXISTS "Tenant isolation select" ON public.product_ingredients;
DROP POLICY IF EXISTS "Tenant isolation insert" ON public.product_ingredients;
DROP POLICY IF EXISTS "Tenant isolation update" ON public.product_ingredients;
DROP POLICY IF EXISTS "Tenant isolation delete" ON public.product_ingredients;

DROP POLICY IF EXISTS "Tenant isolation select" ON public.orders;
DROP POLICY IF EXISTS "Tenant isolation insert" ON public.orders;
DROP POLICY IF EXISTS "Tenant isolation update" ON public.orders;
DROP POLICY IF EXISTS "Tenant isolation delete" ON public.orders;

DROP POLICY IF EXISTS "Tenant isolation select" ON public.order_items;
DROP POLICY IF EXISTS "Tenant isolation insert" ON public.order_items;
DROP POLICY IF EXISTS "Tenant isolation update" ON public.order_items;
DROP POLICY IF EXISTS "Tenant isolation delete" ON public.order_items;

DROP POLICY IF EXISTS "Tenant isolation select" ON public.expenses;
DROP POLICY IF EXISTS "Tenant isolation insert" ON public.expenses;
DROP POLICY IF EXISTS "Tenant isolation update" ON public.expenses;
DROP POLICY IF EXISTS "Tenant isolation delete" ON public.expenses;

DROP POLICY IF EXISTS "Tenant isolation select" ON public.app_notifications;
DROP POLICY IF EXISTS "Tenant isolation insert" ON public.app_notifications;
DROP POLICY IF EXISTS "Tenant isolation update" ON public.app_notifications;
DROP POLICY IF EXISTS "Tenant isolation delete" ON public.app_notifications;

-- Políticas para TABLE: tenants
CREATE POLICY "Permitir lectura publica de tenants" ON public.tenants FOR SELECT USING (true);
CREATE POLICY "Permitir insercion publica de tenants" ON public.tenants FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update de tenant propio" ON public.tenants FOR UPDATE USING (id = public.get_tenant_id_header());

-- Políticas para TABLE: categories
CREATE POLICY "Tenant isolation select" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Tenant isolation insert" ON public.categories FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation update" ON public.categories FOR UPDATE USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation delete" ON public.categories FOR DELETE USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));

-- Políticas para TABLE: products
CREATE POLICY "Tenant isolation select" ON public.products FOR SELECT USING (true);
CREATE POLICY "Tenant isolation insert" ON public.products FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation update" ON public.products FOR UPDATE USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation delete" ON public.products FOR DELETE USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));

-- Políticas para TABLE: ingredients
CREATE POLICY "Tenant isolation select" ON public.ingredients FOR SELECT USING (true);
CREATE POLICY "Tenant isolation insert" ON public.ingredients FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation update" ON public.ingredients FOR UPDATE USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation delete" ON public.ingredients FOR DELETE USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));

-- Políticas para TABLE: product_ingredients
CREATE POLICY "Tenant isolation select" ON public.product_ingredients FOR SELECT USING (true);
CREATE POLICY "Tenant isolation insert" ON public.product_ingredients FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation update" ON public.product_ingredients FOR UPDATE USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation delete" ON public.product_ingredients FOR DELETE USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));

-- Políticas para TABLE: orders
CREATE POLICY "Tenant isolation select" ON public.orders FOR SELECT USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation insert" ON public.orders FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation update" ON public.orders FOR UPDATE USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation delete" ON public.orders FOR DELETE USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));

-- Políticas para TABLE: order_items
CREATE POLICY "Tenant isolation select" ON public.order_items FOR SELECT USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation insert" ON public.order_items FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation update" ON public.order_items FOR UPDATE USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation delete" ON public.order_items FOR DELETE USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));

-- Políticas para TABLE: expenses
CREATE POLICY "Tenant isolation select" ON public.expenses FOR SELECT USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation insert" ON public.expenses FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation update" ON public.expenses FOR UPDATE USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation delete" ON public.expenses FOR DELETE USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));

-- Políticas para TABLE: app_notifications
CREATE POLICY "Tenant isolation select" ON public.app_notifications FOR SELECT USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation insert" ON public.app_notifications FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation update" ON public.app_notifications FOR UPDATE USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));
CREATE POLICY "Tenant isolation delete" ON public.app_notifications FOR DELETE USING (tenant_id = public.get_tenant_id_header() OR (public.get_tenant_id_header() IS NULL AND tenant_id IS NULL));

-- 7.5. Configurar Valores por Defecto Automáticos para tenant_id
-- Esto garantiza que las inserciones desde cualquier cliente (incluyendo offline sync)
-- hereden automáticamente el tenant_id de la cabecera activa x-tenant-id.
ALTER TABLE public.categories ALTER COLUMN tenant_id SET DEFAULT public.get_tenant_id_header();
ALTER TABLE public.ingredients ALTER COLUMN tenant_id SET DEFAULT public.get_tenant_id_header();
ALTER TABLE public.products ALTER COLUMN tenant_id SET DEFAULT public.get_tenant_id_header();
ALTER TABLE public.product_ingredients ALTER COLUMN tenant_id SET DEFAULT public.get_tenant_id_header();
ALTER TABLE public.orders ALTER COLUMN tenant_id SET DEFAULT public.get_tenant_id_header();
ALTER TABLE public.order_items ALTER COLUMN tenant_id SET DEFAULT public.get_tenant_id_header();
ALTER TABLE public.expenses ALTER COLUMN tenant_id SET DEFAULT public.get_tenant_id_header();
ALTER TABLE public.app_notifications ALTER COLUMN tenant_id SET DEFAULT public.get_tenant_id_header();

-- 7.6. Lógica de Stock Automatizada (Reducción en Comanda Servida)
CREATE OR REPLACE FUNCTION public.reduce_stock_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
    rec RECORD;
BEGIN
    -- Solo actuar cuando el estado cambia a 'delivered'
    IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
        FOR rec IN 
            SELECT pi.ingredient_id, pi.quantity_used 
            FROM public.product_ingredients pi
            JOIN public.ingredients i ON i.id = pi.ingredient_id
            WHERE pi.product_id = NEW.product_id
              AND (NEW.target_departments IS NULL OR i.target_departments && NEW.target_departments)
        LOOP
            UPDATE public.ingredients 
            SET stock_level = stock_level - (rec.quantity_used * NEW.quantity)
            WHERE id = rec.ingredient_id;
        END LOOP;
    -- Revertir stock si se desmarca como entregado (ej. error de dedo)
    ELSIF NEW.status = 'pending' AND OLD.status = 'delivered' THEN
        FOR rec IN 
            SELECT pi.ingredient_id, pi.quantity_used 
            FROM public.product_ingredients pi
            JOIN public.ingredients i ON i.id = pi.ingredient_id
            WHERE pi.product_id = NEW.product_id
              AND (NEW.target_departments IS NULL OR i.target_departments && NEW.target_departments)
        LOOP
            UPDATE public.ingredients 
            SET stock_level = stock_level + (rec.quantity_used * NEW.quantity)
            WHERE id = rec.ingredient_id;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_reduce_stock_on_delivery ON public.order_items;
CREATE TRIGGER tr_reduce_stock_on_delivery
AFTER UPDATE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.reduce_stock_on_delivery();


-- 8. Insertar Tenants de Prueba
INSERT INTO public.tenants (name, slug, email, theme_colors, admin_password, staff_password, kitchen_password)
VALUES 
('Local A - Belgrano', 'local-a', 'belgrano@mymapps.com', '{"primary": "#f97316", "secondary": "#1e293b", "mode": "dark"}'::jsonb, 'admina', 'staffa', 'kitchena'),
('Local B - Palermo', 'local-b', 'palermo@mymapps.com', '{"primary": "#a855f7", "secondary": "#1e293b", "mode": "dark"}'::jsonb, 'adminb', 'staffb', 'kitchenb')
ON CONFLICT (slug) DO NOTHING;

-- 9. Lógica de Números de Pedido Diarios (Secuencial 1, 2, 3... por día/tenant)
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER AS $$
DECLARE
    v_max_number INT;
BEGIN
    -- Buscar el máximo número de pedido para este tenant en el día actual (UTC para consistencia)
    SELECT COALESCE(MAX(order_number), 0) INTO v_max_number
    FROM public.orders
    WHERE tenant_id = NEW.tenant_id
      AND (created_at AT TIME ZONE 'UTC')::DATE = (now() AT TIME ZONE 'UTC')::DATE;

    -- Asignar el siguiente número
    NEW.order_number := v_max_number + 1;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_order_number ON public.orders;
CREATE TRIGGER tr_set_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_order_number();


-- 10. Lógica de Autocompletado Automático de Pedidos (Garantía de Base de Datos)
-- Esta función asegura que si todos los ítems de un pedido pasan a 'delivered', la orden principal se actualice
-- automáticamente a 'delivered', evitando que pedidos queden "anclados" en estado 'pending'.
CREATE OR REPLACE FUNCTION public.autocomplete_order_on_items_delivered()
RETURNS TRIGGER AS $$
BEGIN
    -- Verificar si todos los ítems de esta orden están en 'delivered'
    IF NOT EXISTS (
        SELECT 1 
        FROM public.order_items 
        WHERE order_id = NEW.order_id 
          AND status != 'delivered'
    ) THEN
        -- Actualizar la orden principal
        UPDATE public.orders 
        SET status = 'delivered' 
        WHERE id = NEW.order_id AND status != 'delivered';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_autocomplete_order ON public.order_items;
CREATE TRIGGER tr_autocomplete_order
AFTER UPDATE OF status ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.autocomplete_order_on_items_delivered();


-- 11. Estructura de Lotes y Fechas de Vencimiento de Insumos (Garantía de Calidad)
CREATE TABLE IF NOT EXISTS public.ingredient_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL,
    expiration_date DATE NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en la tabla de lotes
ALTER TABLE public.ingredient_batches ENABLE ROW LEVEL SECURITY;

-- Políticas de aislamiento de Tenant
DROP POLICY IF EXISTS "Tenant isolation select" ON public.ingredient_batches;
CREATE POLICY "Tenant isolation select" ON public.ingredient_batches
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Tenant isolation insert" ON public.ingredient_batches;
CREATE POLICY "Tenant isolation insert" ON public.ingredient_batches
    FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id_header());

DROP POLICY IF EXISTS "Tenant isolation update" ON public.ingredient_batches;
CREATE POLICY "Tenant isolation update" ON public.ingredient_batches
    FOR UPDATE USING (tenant_id = public.get_tenant_id_header());

DROP POLICY IF EXISTS "Tenant isolation delete" ON public.ingredient_batches;
CREATE POLICY "Tenant isolation delete" ON public.ingredient_batches
    FOR DELETE USING (tenant_id = public.get_tenant_id_header());


-- 12. Estructura de Ofertas y Descuentos Programados (Marketing Gastronómico)
CREATE TABLE IF NOT EXISTS public.product_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discount_percentage NUMERIC NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    limit_quantity NUMERIC,
    product_ids UUID[] NOT NULL DEFAULT '{}'::UUID[], -- Array de productos participantes
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en la tabla de ofertas
ALTER TABLE public.product_offers ENABLE ROW LEVEL SECURITY;

-- Políticas de aislamiento de Tenant
DROP POLICY IF EXISTS "Tenant isolation select" ON public.product_offers;
CREATE POLICY "Tenant isolation select" ON public.product_offers
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Tenant isolation insert" ON public.product_offers;
CREATE POLICY "Tenant isolation insert" ON public.product_offers
    FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id_header());

DROP POLICY IF EXISTS "Tenant isolation update" ON public.product_offers;
CREATE POLICY "Tenant isolation update" ON public.product_offers
    FOR UPDATE USING (tenant_id = public.get_tenant_id_header());

DROP POLICY IF EXISTS "Tenant isolation delete" ON public.product_offers;
CREATE POLICY "Tenant isolation delete" ON public.product_offers
    FOR DELETE USING (tenant_id = public.get_tenant_id_header());


-- 12.5. Estructura de Reseñas de Clientes (SaaS Transparente)
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en la tabla de reseñas
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de reseñas" ON public.reviews;
CREATE POLICY "Lectura pública de reseñas" ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Inserción pública de reseñas" ON public.reviews;
CREATE POLICY "Inserción pública de reseñas" ON public.reviews FOR INSERT WITH CHECK (true);

-- 12.6. Tabla de Interacciones Sociales (Rockola / Social Dining)
CREATE TABLE IF NOT EXISTS public.social_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL, -- 'music_request', 'announcement', 'table_invite'
    from_table TEXT,
    to_table TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE,
    message TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.social_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica de interacciones (con filtros)" ON public.social_interactions;
CREATE POLICY "Lectura publica de interacciones (con filtros)" ON public.social_interactions 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Insercion publica de interacciones" ON public.social_interactions;
CREATE POLICY "Insercion publica de interacciones" ON public.social_interactions 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Update publico interacciones (staff)" ON public.social_interactions;
CREATE POLICY "Update publico interacciones (staff)" ON public.social_interactions 
    FOR UPDATE USING (tenant_id = public.get_tenant_id_header());

-- Asignar default tenant_id
ALTER TABLE public.social_interactions ALTER COLUMN tenant_id SET DEFAULT public.get_tenant_id_header();

-- Nuevas columnas para Rockola Multimedia VIP
ALTER TABLE public.social_interactions ADD COLUMN IF NOT EXISTS media_url TEXT DEFAULT NULL;
ALTER TABLE public.social_interactions ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT NULL;
ALTER TABLE public.social_interactions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.social_interactions ADD COLUMN IF NOT EXISTS view_once BOOLEAN DEFAULT FALSE;

-- 12.7. Crear Bucket de Storage para Multimedia Social y configurar políticas (si está disponible el esquema storage)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
        -- Insertar el bucket si no existe
        INSERT INTO storage.buckets (id, name, public) 
        VALUES ('social_media', 'social_media', true)
        ON CONFLICT (id) DO NOTHING;
        
        -- Configurar políticas de acceso
        DROP POLICY IF EXISTS "Permitir lectura publica de social_media" ON storage.objects;
        CREATE POLICY "Permitir lectura publica de social_media" 
        ON storage.objects FOR SELECT USING (bucket_id = 'social_media');
        
        DROP POLICY IF EXISTS "Permitir subida publica a social_media" ON storage.objects;
        CREATE POLICY "Permitir subida publica a social_media" 
        ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'social_media');
        
        DROP POLICY IF EXISTS "Permitir delete publico a social_media" ON storage.objects;
        CREATE POLICY "Permitir delete publico a social_media" 
        ON storage.objects FOR DELETE USING (bucket_id = 'social_media');
    END IF;
END $$;


-- 13. Habilitar Replicación en Tiempo Real para todas las tablas necesarias
-- En Supabase, para que los eventos en tiempo real se propaguen, las tablas deben estar en la publicación supabase_realtime.
DO $$
BEGIN
    -- Crear publicación supabase_realtime si por alguna razón no existiese en el esquema
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Agregar tablas a la publicación de tiempo real de forma tolerante a fallos
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ingredients;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.product_ingredients;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ingredient_batches;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.product_offers;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.social_interactions;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;


