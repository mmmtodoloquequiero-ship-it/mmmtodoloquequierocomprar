-- Actualizar planes de precios y crear tabla de reacciones
UPDATE public.saas_plans SET price_ars = 90000 WHERE name = 'Pro Ilimitado';

INSERT INTO public.saas_plans (name, description, price_ars, max_devices, features)
VALUES 
('Premium VIP', 'Muro interactivo y funciones multimedia exclusivas', 150000, 999, '["Cuentas ilimitadas", "Muro interactivo multimedia en vivo", "Soporte prioritario VIP", "Todas las funciones"]'::jsonb)
ON CONFLICT DO NOTHING;

-- Agregar columna de reacciones
ALTER TABLE public.social_interactions ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{"like": 0, "haha": 0, "love": 0, "sad": 0, "angry": 0}'::jsonb;

-- Comentarios
ALTER TABLE public.social_interactions ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.increment_social_reaction(p_interaction_id UUID, p_reaction_type TEXT)
RETURNS void AS $$
BEGIN
    UPDATE public.social_interactions
    SET reactions = jsonb_set(
        COALESCE(reactions, '{"like": 0, "haha": 0, "love": 0, "sad": 0, "angry": 0}'::jsonb),
        ARRAY[p_reaction_type],
        (COALESCE((reactions->>p_reaction_type)::int, 0) + 1)::text::jsonb
    )
    WHERE id = p_interaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.add_social_comment(p_interaction_id UUID, p_comment TEXT, p_sender TEXT)
RETURNS void AS $$
BEGIN
    UPDATE public.social_interactions
    SET comments = COALESCE(comments, '[]'::jsonb) || jsonb_build_object(
        'sender', p_sender,
        'text', p_comment,
        'timestamp', now()
    )
    WHERE id = p_interaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
