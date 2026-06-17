-- ============================================================
--  Viaje a Jerez 🍷  ·  Esquema de base de datos para Supabase
-- ============================================================
-- Cómo usar:
--   1. Entra en tu proyecto de Supabase.
--   2. Menú lateral -> SQL Editor -> New query.
--   3. Pega TODO este archivo y dale a "Run".
--   4. (Storage) Crea dos buckets PÚBLICOS: "avatars" y "fotos".
--      Storage -> New bucket -> nombre "avatars" -> marca "Public bucket".
--      Repite para "fotos".
-- ------------------------------------------------------------
-- Nota: esta app es para un grupo cerrado de amigos, sin login con
-- contraseña. Por eso las políticas permiten acceso anónimo (anon).
-- No metas aquí nada que no quieras que vean tus colegas :)
-- ============================================================

-- ---------- Tabla de personas del viaje ----------
create table if not exists public.usuarios (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  avatar_url  text,
  es_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Si ya tenías la tabla creada de antes, añadimos la columna nueva:
alter table public.usuarios add column if not exists es_admin boolean not null default false;

-- ---------- Registro de "cosas que entran por el cuerpo" ----------
create table if not exists public.consumiciones (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.usuarios(id) on delete cascade,
  tipo        text not null,          -- 'cubata', 'cerveza', 'fino', 'chupito', 'cigarro', 'agua'...
  created_at  timestamptz not null default now()
);

create index if not exists consumiciones_usuario_idx on public.consumiciones(usuario_id);
create index if not exists consumiciones_tipo_idx     on public.consumiciones(tipo);

-- ---------- Galería de fotos (las mejores... y las peores) ----------
create table if not exists public.fotos (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid references public.usuarios(id) on delete set null,
  url         text not null,
  caption     text,
  created_at  timestamptz not null default now()
);

create index if not exists fotos_created_idx on public.fotos(created_at desc);

-- ---------- Misiones diarias (de cachondeo) ----------
-- Cada día hay 3: 2 fáciles (1 punto) y 1 difícil (3 puntos).
create table if not exists public.misiones (
  id           uuid primary key default gen_random_uuid(),
  fecha        date not null default current_date,
  titulo       text not null,
  dificultad   text not null default 'facil' check (dificultad in ('facil','dificil')),
  puntos       int  not null default 1,
  objetivo_id  uuid references public.usuarios(id) on delete set null, -- "robarle una prenda a X"
  propietario_id uuid references public.usuarios(id) on delete cascade, -- si está, es una misión personal (re-roll)
  created_at   timestamptz not null default now()
);

-- Si ya tenías la tabla creada de antes, añadimos la columna del re-roll:
alter table public.misiones add column if not exists propietario_id uuid references public.usuarios(id) on delete cascade;

create index if not exists misiones_fecha_idx on public.misiones(fecha desc);

-- ---------- Quién ha completado qué misión ----------
create table if not exists public.misiones_completadas (
  id             uuid primary key default gen_random_uuid(),
  mision_id      uuid not null references public.misiones(id) on delete cascade,
  usuario_id     uuid not null references public.usuarios(id) on delete cascade,
  estado         text not null default 'pendiente' check (estado in ('pendiente','verificado','rechazado')),
  verificado_por uuid references public.usuarios(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (mision_id, usuario_id)
);

create index if not exists misiones_comp_usuario_idx on public.misiones_completadas(usuario_id);

-- ============================================================
--  Row Level Security: abierto al rol anónimo (app privada)
-- ============================================================
alter table public.usuarios             enable row level security;
alter table public.consumiciones        enable row level security;
alter table public.fotos                enable row level security;
alter table public.misiones             enable row level security;
alter table public.misiones_completadas enable row level security;

-- Borramos políticas previas si re-ejecutas el script
drop policy if exists "acceso_libre_usuarios"      on public.usuarios;
drop policy if exists "acceso_libre_consumiciones" on public.consumiciones;
drop policy if exists "acceso_libre_fotos"         on public.fotos;
drop policy if exists "acceso_libre_misiones"      on public.misiones;
drop policy if exists "acceso_libre_misiones_comp" on public.misiones_completadas;

create policy "acceso_libre_usuarios" on public.usuarios
  for all to anon, authenticated using (true) with check (true);

create policy "acceso_libre_consumiciones" on public.consumiciones
  for all to anon, authenticated using (true) with check (true);

create policy "acceso_libre_fotos" on public.fotos
  for all to anon, authenticated using (true) with check (true);

create policy "acceso_libre_misiones" on public.misiones
  for all to anon, authenticated using (true) with check (true);

create policy "acceso_libre_misiones_comp" on public.misiones_completadas
  for all to anon, authenticated using (true) with check (true);

-- ============================================================
--  Realtime: que se actualice en vivo en el móvil de todos
-- ============================================================
alter publication supabase_realtime add table public.usuarios;
alter publication supabase_realtime add table public.consumiciones;
alter publication supabase_realtime add table public.fotos;
alter publication supabase_realtime add table public.misiones;
alter publication supabase_realtime add table public.misiones_completadas;

-- ============================================================
--  Políticas de Storage (para subir avatares y fotos desde anon)
--  Ejecuta esto DESPUÉS de crear los buckets "avatars" y "fotos".
-- ============================================================
drop policy if exists "storage_lectura_publica" on storage.objects;
drop policy if exists "storage_subida_libre"    on storage.objects;
drop policy if exists "storage_borrado_libre"   on storage.objects;

create policy "storage_lectura_publica" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('avatars', 'fotos'));

create policy "storage_subida_libre" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id in ('avatars', 'fotos'));

create policy "storage_borrado_libre" on storage.objects
  for delete to anon, authenticated
  using (bucket_id in ('avatars', 'fotos'));
