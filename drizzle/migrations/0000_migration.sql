create type public.app_role as enum ('gestor', 'funcionario');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  daily_minutes integer not null default 480,
  lunch_minutes integer not null default 60,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles or gestor" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'gestor'));

create policy "profiles select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'gestor'));
create policy "profiles gestor update" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(), 'gestor')) with check (public.has_role(auth.uid(), 'gestor'));

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  kind text not null check (kind in ('entrada','saida_almoco','volta_almoco','saida')),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.time_entries (user_id, recorded_at);
grant select, insert, update, delete on public.time_entries to authenticated;
grant all on public.time_entries to service_role;
alter table public.time_entries enable row level security;

create policy "entries select" on public.time_entries for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'gestor'));
create policy "entries insert" on public.time_entries for insert to authenticated
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'gestor'));
create policy "entries gestor update" on public.time_entries for update to authenticated
  using (public.has_role(auth.uid(), 'gestor')) with check (public.has_role(auth.uid(), 'gestor'));
create policy "entries gestor delete" on public.time_entries for delete to authenticated
  using (public.has_role(auth.uid(), 'gestor'));

-- employees can't backdate: force server time
create or replace function public.enforce_entry_time()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'gestor') then
    new.recorded_at := now();
    new.user_id := auth.uid();
  end if;
  return new;
end $$;
create trigger trg_enforce_entry_time before insert on public.time_entries
  for each row execute function public.enforce_entry_time();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email);
  if not exists (select 1 from public.user_roles where role = 'gestor') then
    insert into public.user_roles (user_id, role) values (new.id, 'gestor');
  end if;
  insert into public.user_roles (user_id, role) values (new.id, 'funcionario');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();