-- FieldShift · esquema de Supabase (historial de lotes)
-- Cómo usarlo: Supabase → tu proyecto → SQL Editor → pegar TODO este contenido → Run.
-- Es idempotente: se puede correr más de una vez sin romper nada.
--
-- El login (correo y contraseña) ya viene con Supabase y no necesita nada de acá.
-- El nombre del usuario se guarda en su cuenta (user_metadata), así que no hace falta
-- una tabla de perfiles. Acá solo creamos los lotes, su historial y las reglas para
-- que cada usuario vea SOLO lo suyo (RLS).

-- 1) Lotes/campos guardados por el usuario.
create table if not exists public.lotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  establecimiento text,
  lat double precision not null,
  lon double precision not null,
  area_ha double precision,
  con_riego boolean not null default false,
  datos jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists lotes_user_id_idx on public.lotes (user_id);

-- 2) Historial de cada lote: siembra, cosecha, riego, observación o nota.
--    Es lo que permite llevar la historia del lote para después decidir.
create table if not exists public.lote_historial (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null default current_date,
  tipo text,
  cultivo text,
  nota text,
  datos jsonb,
  creado_en timestamptz not null default now()
);

create index if not exists lote_historial_lote_id_idx on public.lote_historial (lote_id);

-- 3) Seguridad por fila: cada usuario accede solo a sus propias filas.
alter table public.lotes enable row level security;
alter table public.lote_historial enable row level security;

drop policy if exists "lotes propios" on public.lotes;
create policy "lotes propios" on public.lotes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "historial propio" on public.lote_historial;
create policy "historial propio" on public.lote_historial
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
