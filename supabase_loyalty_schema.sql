-- Migración SQL para Supabase: Programa de Fidelización y Micro-CRM (MyMapps 2026)
-- Ejecuta este script en el Editor SQL de tu panel de Supabase.

-- 1. Agregar columnas de Fidelización en tenants (Negocios)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS loyalty_config JSONB DEFAULT '{
  "earn_channel": "both",
  "redeem_channel": "both",
  "cashback_pct": 5.0,
  "tiers": [
    {"name": "bronce", "min_orders": 0, "max_orders": 5, "cashback_pct": 5.0, "discount_pct": 0.0},
    {"name": "plata", "min_orders": 6, "max_orders": 15, "cashback_pct": 7.0, "discount_pct": 3.0},
    {"name": "oro", "min_orders": 16, "max_orders": 99999, "cashback_pct": 10.0, "discount_pct": 5.0}
  ]
}'::jsonb;

-- 2. Agregar columnas de control en orders (Pedidos)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS loyalty_discount_applied NUMERIC DEFAULT 0.0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_loyalty_processed BOOLEAN DEFAULT FALSE;

-- 3. Crear la Tabla de Cuentas de Fidelización (Clientes)
CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    client_name TEXT,
    balance NUMERIC DEFAULT 0.0, -- Saldo acumulado / monedero virtual disponible
    total_spent NUMERIC DEFAULT 0.0, -- Total gastado histórico
    total_orders INT DEFAULT 0, -- Cantidad de pedidos finalizados
    last_order_date TIMESTAMPTZ DEFAULT now(),
    tier TEXT DEFAULT 'bronce',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (tenant_id, phone_number)
);

-- Habilitar RLS (Row Level Security) en loyalty_accounts
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas si existen para evitar duplicados
DROP POLICY IF EXISTS "Tenant isolation select" ON public.loyalty_accounts;
DROP POLICY IF EXISTS "Tenant isolation insert" ON public.loyalty_accounts;
DROP POLICY IF EXISTS "Tenant isolation update" ON public.loyalty_accounts;
DROP POLICY IF EXISTS "Tenant isolation delete" ON public.loyalty_accounts;

-- Crear políticas basadas en Tenant Isolation Header
CREATE POLICY "Tenant isolation select" ON public.loyalty_accounts FOR SELECT USING (true);
CREATE POLICY "Tenant isolation insert" ON public.loyalty_accounts FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id_header());
CREATE POLICY "Tenant isolation update" ON public.loyalty_accounts FOR UPDATE USING (tenant_id = public.get_tenant_id_header());
CREATE POLICY "Tenant isolation delete" ON public.loyalty_accounts FOR DELETE USING (tenant_id = public.get_tenant_id_header());

-- 4. Crear Función del Trigger para procesar Cashback y Tiers automáticamente al completarse el pago
CREATE OR REPLACE FUNCTION public.process_loyalty_on_order()
RETURNS TRIGGER AS $$
DECLARE
    tenant_rec RECORD;
    loyalty_enabled_var BOOLEAN;
    loyalty_config_var JSONB;
    cashback_pct_var NUMERIC := 5.0;
    earned_cashback NUMERIC := 0.0;
    client_tier TEXT := 'bronce';
    loy_id UUID;
    clean_phone TEXT;
    tiers_arr JSONB;
    found_tier BOOLEAN := FALSE;
    earn_chan TEXT := 'both';
    updated_orders INT;
    new_tier TEXT := 'bronce';
BEGIN
    -- Limpiar número de teléfono (quitar espacios y caracteres extraños)
    clean_phone := TRIM(NEW.phone_number);
    
    -- Si no hay teléfono o es un teléfono ficticio, no hacemos nada
    IF clean_phone IS NULL OR clean_phone = '' OR clean_phone ILIKE 'Sin número' OR clean_phone ILIKE 'N/A' OR LENGTH(clean_phone) < 6 THEN
        RETURN NEW;
    END IF;

    -- Solo procesamos si el pago pasó a estar 'pagado' en esta transacción
    -- O si es una orden nueva que entra directamente pagada (ej: Mercado Pago)
    IF (NEW.payment_status = 'pagado' AND (TG_OP = 'INSERT' OR OLD.payment_status != 'pagado')) AND NOT COALESCE(NEW.is_loyalty_processed, FALSE) THEN
        
        -- Obtener configuración del local (tenant)
        SELECT loyalty_enabled, loyalty_config INTO tenant_rec FROM public.tenants WHERE id = NEW.tenant_id;
        IF tenant_rec IS NULL THEN
            RETURN NEW;
        END IF;

        loyalty_enabled_var := COALESCE(tenant_rec.loyalty_enabled, TRUE);
        IF NOT loyalty_enabled_var THEN
            RETURN NEW;
        END IF;

        loyalty_config_var := tenant_rec.loyalty_config;
        earn_chan := COALESCE(loyalty_config_var->>'earn_channel', 'both');

        -- Validar canal de acumulación
        IF earn_chan = 'online' AND NEW.table_number IS NOT NULL THEN
            RETURN NEW; -- No acumula en salón
        END IF;
        IF earn_chan = 'salon' AND NEW.table_number IS NULL THEN
            RETURN NEW; -- No acumula online/delivery
        END IF;

        -- Buscar cuenta existente o crearla
        SELECT id, tier INTO loy_id, client_tier 
        FROM public.loyalty_accounts 
        WHERE tenant_id = NEW.tenant_id AND phone_number = clean_phone;

        IF loy_id IS NULL THEN
            INSERT INTO public.loyalty_accounts (tenant_id, phone_number, client_name, balance, total_spent, total_orders, tier)
            VALUES (NEW.tenant_id, clean_phone, NEW.client_name, 0.0, 0.0, 0, 'bronce')
            RETURNING id, tier INTO loy_id, client_tier;
        END IF;

        -- Buscar el % de cashback configurado para el nivel actual del cliente
        tiers_arr := loyalty_config_var->'tiers';
        IF tiers_arr IS NOT NULL AND jsonb_array_length(tiers_arr) > 0 THEN
            FOR i IN 0..jsonb_array_length(tiers_arr) - 1 LOOP
                IF (tiers_arr->i->>'name') = client_tier THEN
                    cashback_pct_var := (tiers_arr->i->>'cashback_pct')::NUMERIC;
                    found_tier := TRUE;
                END IF;
            END LOOP;
        END IF;

        IF NOT found_tier THEN
            cashback_pct_var := COALESCE((loyalty_config_var->>'cashback_pct')::NUMERIC, 5.0);
        END IF;

        -- Calcular cashback ganado (Redondeado a 2 decimales)
        -- Se acumula sobre el total neto de la orden (precio total menos cualquier descuento por redención anterior)
        earned_cashback := ROUND((NEW.total_price * (cashback_pct_var / 100.0))::NUMERIC, 2);

        -- Actualizar balance e historial del cliente
        UPDATE public.loyalty_accounts
        SET 
            client_name = COALESCE(NEW.client_name, client_name),
            balance = balance + earned_cashback,
            total_spent = total_spent + NEW.total_price,
            total_orders = total_orders + 1,
            last_order_date = now()
        WHERE id = loy_id
        RETURNING total_orders INTO updated_orders;

        -- Evaluar y actualizar nivel (tier) del cliente dinámicamente
        IF tiers_arr IS NOT NULL AND jsonb_array_length(tiers_arr) > 0 THEN
            FOR i IN 0..jsonb_array_length(tiers_arr) - 1 LOOP
                IF updated_orders >= (tiers_arr->i->>'min_orders')::INT AND updated_orders <= (tiers_arr->i->>'max_orders')::INT THEN
                    new_tier := tiers_arr->i->>'name';
                END IF;
            END LOOP;
        END IF;

        UPDATE public.loyalty_accounts SET tier = new_tier WHERE id = loy_id;

        -- Marcar la orden como procesada (al estar en BEFORE, modificamos directamente NEW)
        NEW.is_loyalty_processed := TRUE;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Crear el Trigger en la tabla orders
DROP TRIGGER IF EXISTS trigger_process_loyalty ON public.orders;
CREATE TRIGGER trigger_process_loyalty
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.process_loyalty_on_order();
