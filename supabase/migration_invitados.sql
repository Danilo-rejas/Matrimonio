-- Ejecutar esto en Supabase: Panel del proyecto > SQL Editor > New query > Run
-- Agrega el sistema de invitados con pases limitados (adultos / niños) por familia

create table if not exists invitados (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  nombre text not null,
  max_adultos integer not null default 1,
  max_ninos integer not null default 0,
  creado_en timestamptz not null default now()
);

alter table invitados enable row level security;

-- El sitio necesita poder leer el invitado por su código (viene en el link) sin sesión iniciada
create policy "cualquiera_puede_leer_invitados"
  on invitados for select
  to anon, authenticated
  using (true);

-- Solo los novios (con sesión iniciada) administran la lista de invitados
create policy "solo_autenticados_pueden_insertar_invitados"
  on invitados for insert
  to authenticated
  with check (true);

create policy "solo_autenticados_pueden_actualizar_invitados"
  on invitados for update
  to authenticated
  using (true);

create policy "solo_autenticados_pueden_borrar_invitados"
  on invitados for delete
  to authenticated
  using (true);

-- Vincular cada confirmación con su invitado y guardar el detalle de pases
alter table rsvps
  add column if not exists invitado_id uuid references invitados(id),
  add column if not exists pases_adultos integer not null default 0,
  add column if not exists pases_ninos integer not null default 0;

alter table rsvps alter column cantidad_pases drop not null;
alter table rsvps alter column cantidad_pases set default 0;
