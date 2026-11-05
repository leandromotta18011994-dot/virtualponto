ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS work_schedule_id UUID,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edited_by UUID,
  ADD COLUMN IF NOT EXISTS note TEXT;

CREATE TABLE IF NOT EXISTS public.work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  entry_time TIME NOT NULL DEFAULT '08:00',
  lunch_start TIME NOT NULL DEFAULT '12:00',
  lunch_end TIME NOT NULL DEFAULT '13:00',
  exit_time TIME NOT NULL DEFAULT '18:00',
  daily_minutes INTEGER NOT NULL DEFAULT 480,
  lunch_minutes INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_work_schedule_id_fkey
  FOREIGN KEY (work_schedule_id) REFERENCES public.work_schedules(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_schedules TO authenticated;
GRANT ALL ON public.work_schedules TO service_role;

ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read work schedules"
  ON public.work_schedules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Gestores can insert work schedules"
  ON public.work_schedules FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Gestores can update work schedules"
  ON public.work_schedules FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Gestores can delete work schedules"
  ON public.work_schedules FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'));