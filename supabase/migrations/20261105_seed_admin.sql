-- =====================================================
-- VIRTUAL PONTO – Seed Admin User
-- Execute este script no SQL Editor do Supabase
-- =====================================================
-- Cria o usuário administrador padrão:
--   Usuário: admin  (login: admin@admin.local)
--   Senha:   admin
-- =====================================================

DO $$
DECLARE
  v_uid uuid := gen_random_uuid();
BEGIN
  -- Verifica se já existe um admin
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'admin@admin.local'
  ) THEN
    -- Insere na tabela de autenticação
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_user_meta_data, raw_app_meta_data,
      created_at, updated_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_uid,
      'authenticated',
      'authenticated',
      'admin@admin.local',
      crypt('admin', gen_salt('bf')),
      now(),
      '{"full_name": "Administrador"}'::jsonb,
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      now(), now(), '', ''
    );

    -- Garante que o perfil seja criado
    INSERT INTO public.profiles (id, full_name, email, daily_minutes, lunch_minutes, monthly_salary, is_active)
    VALUES (v_uid, 'Administrador', 'admin@admin.local', 480, 60, 0, true)
    ON CONFLICT (id) DO NOTHING;

    -- Atribui role de gestor (admin)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'gestor')
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Admin criado: admin@admin.local / admin';
  ELSE
    RAISE NOTICE 'Admin já existe: admin@admin.local';
  END IF;
END;
$$;

