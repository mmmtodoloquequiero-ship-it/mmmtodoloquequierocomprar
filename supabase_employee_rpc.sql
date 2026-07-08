-- Editor SQL de Supabase: Funciones para Empleados

-- 1. Función para verificar las credenciales de un empleado de forma segura
CREATE OR REPLACE FUNCTION public.check_employee_credential(
    p_tenant_id UUID,
    p_employee_id UUID,
    p_pin TEXT
) RETURNS JSON AS $$
DECLARE
    emp_record RECORD;
    v_fingerprint TEXT;
BEGIN
    -- Buscar al empleado y verificar la clave
    SELECT * INTO emp_record 
    FROM public.employees 
    WHERE id = p_employee_id 
      AND tenant_id = p_tenant_id
      AND pin_code = p_pin;

    IF FOUND THEN
        -- Retornar el perfil del empleado validado
        RETURN json_build_object(
            'success', true,
            'employee_id', emp_record.id,
            'name', emp_record.name,
            'role', emp_record.role,
            'tenant_id', p_tenant_id
        );
    ELSE
        RETURN json_build_object(
            'success', false,
            'error', 'PIN incorrecto o empleado no encontrado'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Función para registrar un dispositivo activo
CREATE OR REPLACE FUNCTION public.register_active_device(
    p_tenant_id UUID,
    p_employee_id UUID,
    p_fingerprint TEXT,
    p_user_agent TEXT
) RETURNS JSON AS $$
BEGIN
    INSERT INTO public.active_devices (tenant_id, employee_id, device_fingerprint, user_agent)
    VALUES (p_tenant_id, p_employee_id, p_fingerprint, p_user_agent)
    ON CONFLICT DO NOTHING; -- O manejar si la huella ya existe
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
