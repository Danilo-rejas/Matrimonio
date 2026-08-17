-- Ejecutar esto en Supabase: Panel del proyecto > SQL Editor > New query > Run

create table if not exists rsvps (
  id uuid primary key default gen_random_uuid(),
  cantidad_pases integer not null,
  nombres_asistentes text not null,
  mensaje text default '',
  mesa text default '',
  creado_en timestamptz not null default now()
);

alter table rsvps enable row level security;

-- Cualquier invitado (sin sesión) puede confirmar su asistencia
create policy "cualquiera_puede_confirmar"
  on rsvps for insert
  to anon
  with check (true);

-- Solo los novios (con sesión iniciada) pueden ver las confirmaciones
create policy "solo_autenticados_pueden_leer"
  on rsvps for select
  to authenticated
  using (true);

-- Solo los novios pueden editar (ej. asignar la mesa)
create policy "solo_autenticados_pueden_actualizar"
  on rsvps for update
  to authenticated
  using (true);

-- Habilitar actualizaciones en tiempo real para el panel /admin
alter publication supabase_realtime add table rsvps;
