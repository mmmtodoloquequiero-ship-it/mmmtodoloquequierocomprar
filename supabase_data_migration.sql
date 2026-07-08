-- Script de Migración para locales existentes (Datos Huérfanos)
-- Esto crea empleados automáticamente basados en las contraseñas antiguas para no interrumpir el acceso a usuarios actuales.

DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT * FROM public.tenants
    LOOP
        -- Verificamos que el tenant no tenga empleados ya creados
        IF NOT EXISTS (SELECT 1 FROM public.employees WHERE tenant_id = t.id) THEN
            
            -- Crear empleado Cajero/Staff si tenía contraseña configurada
            IF t.staff_password IS NOT NULL AND t.staff_password <> '' THEN
                INSERT INTO public.employees (tenant_id, name, role, pin_code)
                VALUES (t.id, 'Staff / Caja', 'staff', t.staff_password);
            END IF;

            -- Crear empleado Cocina
            IF t.kitchen_password IS NOT NULL AND t.kitchen_password <> '' THEN
                INSERT INTO public.employees (tenant_id, name, role, pin_code)
                VALUES (t.id, 'Cocina', 'kitchen', t.kitchen_password);
            END IF;

            -- Crear empleado Bartender
            IF t.bartender_password IS NOT NULL AND t.bartender_password <> '' THEN
                INSERT INTO public.employees (tenant_id, name, role, pin_code)
                VALUES (t.id, 'Barra', 'bartender', t.bartender_password);
            END IF;

            -- Crear empleado Mozo
            IF t.waiter_password IS NOT NULL AND t.waiter_password <> '' THEN
                INSERT INTO public.employees (tenant_id, name, role, pin_code)
                VALUES (t.id, 'Mozo Principal', 'waiter', t.waiter_password);
            END IF;

            -- Crear empleado Delivery
            IF t.delivery_password IS NOT NULL AND t.delivery_password <> '' THEN
                INSERT INTO public.employees (tenant_id, name, role, pin_code)
                VALUES (t.id, 'Delivery', 'delivery', t.delivery_password);
            END IF;

        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
