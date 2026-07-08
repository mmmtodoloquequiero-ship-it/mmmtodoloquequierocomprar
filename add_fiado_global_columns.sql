-- Script de Migración: Sistema Global de Fiados, Escáner e Insumos

-- 1. Tabla Global de Reputación (Veraz de Barrio)
CREATE TABLE IF NOT EXISTS public.global_customers (
    document_number TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    global_rating FLOAT DEFAULT 5.0,
    total_defaults INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.global_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura global de clientes" ON public.global_customers FOR SELECT USING (true);
CREATE POLICY "Insercion global de clientes" ON public.global_customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualizacion global de clientes" ON public.global_customers FOR UPDATE USING (true);

-- 2. Restaurar Tabla Insumos (Stock Físico) con soporte para Escáner y Venta por Peso
CREATE TABLE IF NOT EXISTS public.ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    cost_per_unit NUMERIC NOT NULL,
    stock_level NUMERIC NOT NULL DEFAULT 0,
    min_stock_level NUMERIC NOT NULL DEFAULT 0,
    barcode TEXT DEFAULT NULL,
    is_fractionable BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation select ingredients" ON public.ingredients FOR SELECT USING (tenant_id = public.get_tenant_id_header());
CREATE POLICY "Tenant isolation modify ingredients" ON public.ingredients FOR ALL USING (tenant_id = public.get_tenant_id_header());

-- 3. Modificaciones a la tabla de Clientes Locales
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS document_number TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS max_credit_limit NUMERIC DEFAULT 10000;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE;

-- 4. Actualizar estado del Fiado
ALTER TABLE public.customer_tabs ADD COLUMN IF NOT EXISTS monthly_surcharge_percentage NUMERIC DEFAULT 0;

-- 5. Restaurar tabla intermedia para armar Combos (Productos compuestos por Insumos)
CREATE TABLE IF NOT EXISTS public.product_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE CASCADE,
    quantity_needed NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation select product_ingredients" ON public.product_ingredients FOR SELECT USING (tenant_id = public.get_tenant_id_header());
CREATE POLICY "Tenant isolation modify product_ingredients" ON public.product_ingredients FOR ALL USING (tenant_id = public.get_tenant_id_header());

