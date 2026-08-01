-- ============================================================
-- ENARM Pro — Esquema inicial (uso personal, un solo usuario)
-- ============================================================
-- Cada tabla tiene user_id y RLS: solo el dueño de la fila
-- (auth.uid() = user_id) puede leerla, editarla o borrarla.
-- Esto significa que aunque la app esté en internet, nadie
-- más que tú (autenticado) puede ver o tocar tus datos.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- Especialidades (6 fijas) ----------
create table public.specialties (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  code text not null unique,
  created_at timestamptz not null default now()
);

-- Insertar las 6 especialidades principales (datos iniciales)
insert into public.specialties (name, code) values
  ('Cirugía General', 'cirugia'),
  ('Medicina Interna', 'med_interna'),
  ('Pediatría', 'pediatria'),
  ('Ginecología y Obstetricia', 'gineobst'),
  ('Medicina Familiar y Comunitaria', 'med_familiar'),
  ('Salud Pública / Medicina Preventiva', 'salud_publica');

-- ---------- Subcategorías (dinámicas, creadas por usuario) ----------
create table public.subcategories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  specialty_id uuid not null references public.specialties(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, specialty_id, name)
);

-- ---------- Temas (dinámicos, creados por usuario, bajo una subcategoría) ----------
create table public.themes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subcategory_id uuid not null references public.subcategories(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, subcategory_id, name)
);

-- ---------- Preguntas (banco de preguntas) ----------
create table public.questions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subcategory_id uuid not null references public.subcategories(id) on delete cascade,
  theme_id uuid references public.themes(id) on delete set null,
  sequence_number int,
  difficulty text not null default 'media' check (difficulty in ('facil', 'media', 'dificil')),
  vignette text not null,
  explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, sequence_number)
);

create table public.question_options (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references public.questions(id) on delete cascade,
  label text not null,           -- 'A', 'B', 'C', 'D'...
  content text not null,
  is_correct boolean not null default false,
  order_index int not null default 0
);

-- ---------- Flashcards (con campos FSRS para repetición espaciada) ----------
create table public.flashcards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  front text not null,
  back text not null,
  specialty text,
  tags text[] default '{}',
  -- Campos que usa el algoritmo FSRS (ts-fsrs) para programar el repaso
  due timestamptz not null default now(),
  stability float not null default 0,
  difficulty float not null default 0,
  elapsed_days int not null default 0,
  scheduled_days int not null default 0,
  reps int not null default 0,
  lapses int not null default 0,
  state text not null default 'new' check (state in ('new', 'learning', 'review', 'relearning')),
  last_review timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Perfil del usuario ----------
create table public.user_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  gender text check (gender in ('M', 'F', 'O') or gender IS NULL),
  specialty text,
  target_exam_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Historial de respuestas (para estadísticas futuras) ----------
create table public.answer_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option_id uuid references public.question_options(id),
  is_correct boolean not null,
  answered_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security — solo el dueño accede a sus propias filas
-- ============================================================
alter table public.specialties enable row level security;
alter table public.subcategories enable row level security;
alter table public.themes enable row level security;
alter table public.user_profiles enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.flashcards enable row level security;
alter table public.answer_logs enable row level security;

-- Specialties: todos las ven (son públicas y fijas)
create policy "public_read" on public.specialties
  for select using (true);

-- Subcategorías: solo el dueño accede a las suyas
create policy "owner_full_access" on public.subcategories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Temas: solo el dueño accede a los suyos
create policy "owner_full_access" on public.themes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner_full_access" on public.user_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Preguntas: solo el dueño accede a las suyas (vinculadas vía subcategoría)
create policy "owner_full_access" on public.questions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- question_options no tiene user_id directo: se valida contra la pregunta dueña
create policy "owner_full_access" on public.question_options
  for all using (
    auth.uid() = (select user_id from public.questions where id = question_id)
  ) with check (
    auth.uid() = (select user_id from public.questions where id = question_id)
  );

create policy "owner_full_access" on public.flashcards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner_full_access" on public.answer_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Índices útiles para las consultas del dashboard y estadísticas
create index idx_profiles_user on public.user_profiles(user_id);
create index idx_subcategories_user on public.subcategories(user_id);
create index idx_subcategories_specialty on public.subcategories(specialty_id);
create index idx_themes_user on public.themes(user_id);
create index idx_themes_subcategory on public.themes(subcategory_id);
create index idx_questions_user on public.questions(user_id);
create index idx_questions_subcategory on public.questions(subcategory_id);
create index idx_questions_theme on public.questions(theme_id);
create index idx_options_question on public.question_options(question_id);
create index idx_flashcards_user_due on public.flashcards(user_id, due);
create index idx_answer_logs_user on public.answer_logs(user_id);
