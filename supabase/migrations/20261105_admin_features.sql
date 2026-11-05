-- =====================================================
-- VIRTUAL PONTO – Admin Features Migration
-- 2026-11-05
-- =====================================================

-- 1. Create work_schedules table
CREATE TABLE IF NOT EXISTS public.work_schedules (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL DEFAULT 'Padrão',
  entry_time    text        NOT NULL DEFAULT '08:00',
  lunch_start   text        NOT NULL DEFAULT '12:00',
  lunch_end     text        NOT NULL DEFAULT '13:00',
  exit_time     text        NOT NULL DEFAULT '17:00',
  daily_minutes integer     NOT NULL DEFAULT 480,
  lunch_minutes integer     NOT NULL DEFAULT 60,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone authenticated can read schedules"
  ON public.work_schedules FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "gestor can manage schedules"
  ON public.work_schedules FOR ALL
  TO authenticated
  USING  (public.has_role('gestor'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('gestor'::public.app_role, auth.uid()));

-- 2. Extend profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_salary  numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS work_schedule_id uuid          REFERENCES public.work_schedules(id),
  ADD COLUMN IF NOT EXISTS is_active        boolean       NOT NULL DEFAULT true;

-- 3. Extend time_entries table
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS edited_at  timestamptz,
  ADD COLUMN IF NOT EXISTS edited_by  uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS note       text;

-- 4. Seed default work schedule
INSERT INTO public.work_schedules (name, entry_time, lunch_start, lunch_end, exit_time, daily_minutes, lunch_minutes)
VALUES ('Padrão (08:00–17:00)', '08:00', '12:00', '13:00', '17:00', 480, 60)
ON CONFLICT DO NOTHING;

