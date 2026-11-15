-- FieldShift · esquema de Supabase (login + historial de lotes)
-- Cómo usarlo: Supabase → tu proyecto → SQL Editor → pegar todo esto → Run.
-- Es idempotente: se puede correr más de una vez sin romper nada.
-- La autenticación (correo y contraseña) ya viene con Supabase; acá solo creamos
-- las tablas del usuario y las reglas para que cada uno vea SOLO lo suyo (RLS).

-- 1) Perfil del usuario (opcional). Se enlaza con la cuenta de Supabase.
create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text,
  tipo text check (tipo in ('huerta', 'agricultor')),
  creado_en timestamptz not null default now()
);

-- 2) Lotes/campos guardados por el usuario.
create table if not exists public.lotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  establecimiento text,
  lat double precision not null,
  lon double precision not null,
  area_ha double precision,
  con_riego boolean not null default false,
  datos jsonb,                       -- perfil de suelo u otros datos del lote
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists lotes_user_id_idx on public.lotes (user_id);

-- 3) Historial de cada lote: siembra, cosecha, riego, observación, nota…
--    Es lo que permite "llevar la historia del lote para después decidir".
create table if not exists public.lote_historial (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null default current_date,
  tipo text,                         -- 'siembra' | 'cosecha' | 'riego' | 'observacion' | 'nota'
  cultivo text,
  nota text,
  datos jsonb,
  creado_en timestamptz not null default now()
);
create index if not exists lote_historial_lote_id_idx on public.lote_historial (lote_id);

-- 4) Seguridad por fila (RLS): cada usuario accede solo a sus propias filas.
alter table public.perfiles enable row level security;
alter table public.lotes enable row level security;
alter table public.lote_historial enable row level security;

-- Nota: Postgres no admite "create policy if not exists", así que las borramos y recreamos.
drop policy if exists "perfil propio" on public.perfiles;
create policy "perfil propio" on public.perfiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "lotes propios" on public.lotes;
create policy "lotes propios" on public.lotes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "historial propio" on public.lote_historial;
create policy "historial propio" on public.lote_historial
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5) Al registrarse un usuario, crear su fila en "perfiles" automáticamente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, new.raw_user_meta_data ->> 'nombre')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
