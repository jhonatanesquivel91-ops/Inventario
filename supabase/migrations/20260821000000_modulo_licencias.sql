-- ============================================================================
--  Módulo de Licencias de Software — Inventario TI UPeU
--
--  Una licencia (ChatGPT, Zoom, Microsoft 365) no es un activo físico: no tiene
--  serie ni código patrimonial, y una sola compra cubre a varias personas a la
--  vez. Por eso se separa el CONTRATO de sus OCUPANTES, igual que `activos` se
--  separa de `asignaciones`.
--
--  Ejecutar completo en el SQL Editor del proyecto.
-- ============================================================================

-- 1. El contrato ------------------------------------------------------------
create table if not exists public.licencias (
  id                    bigint generated always as identity primary key,
  nombre_servicio       text        not null,
  proveedor             text,
  tipo                  text        not null default 'Suscripción',
  plan                  text,
  cantidad_asientos     integer     not null default 1,
  fecha_inicio          date,
  fecha_renovacion      date,
  ciclo_facturacion     text        default 'Anual',
  costo                 numeric(12,2),
  moneda                text        default 'USD',
  renovacion_automatica boolean     not null default false,
  estado                text        not null default 'Activa',
  notas                 text,
  fecha_registro        timestamptz not null default now(),

  constraint licencias_tipo_valido
    check (tipo in ('Suscripción', 'Perpetua')),
  constraint licencias_ciclo_valido
    check (ciclo_facturacion in ('Mensual', 'Anual', 'Único')),
  constraint licencias_estado_valido
    check (estado in ('Activa', 'Vencida', 'Cancelada')),
  constraint licencias_asientos_positivos
    check (cantidad_asientos > 0)
);

-- 2. Quién ocupa cada asiento ----------------------------------------------
create table if not exists public.licencias_asignaciones (
  id                 bigint generated always as identity primary key,
  licencia_id        bigint      not null references public.licencias(id) on delete cascade,
  usuario_id         bigint      not null references public.usuarios(id) on delete restrict,
  cuenta_activacion  text,
  fecha_asignacion   date        not null default current_date,
  fecha_baja         date,
  estado_asignacion  text        not null default 'Activo',
  fecha_registro     timestamptz not null default now(),

  constraint licencias_asig_estado_valido
    check (estado_asignacion in ('Activo', 'Liberado'))
);

-- Una persona no puede ocupar dos veces el mismo asiento activo.
create unique index if not exists licencias_asig_unica_activa
  on public.licencias_asignaciones (licencia_id, usuario_id)
  where estado_asignacion = 'Activo';

create index if not exists licencias_asig_por_licencia
  on public.licencias_asignaciones (licencia_id);
create index if not exists licencias_asig_por_usuario
  on public.licencias_asignaciones (usuario_id);
-- Las alertas de renovación filtran por fecha: conviene indexarla.
create index if not exists licencias_por_renovacion
  on public.licencias (fecha_renovacion)
  where estado = 'Activa';

-- 3. Vista de consulta: asientos ocupados y libres ya calculados ------------
create or replace view public.vista_licencias_completa as
select
  l.*,
  coalesce(ocupacion.asientos_usados, 0)                        as asientos_usados,
  l.cantidad_asientos - coalesce(ocupacion.asientos_usados, 0)  as asientos_libres,
  case
    when l.tipo = 'Perpetua' or l.fecha_renovacion is null then null
    else (l.fecha_renovacion - current_date)
  end                                                            as dias_para_renovar
from public.licencias l
left join (
  select licencia_id, count(*)::int as asientos_usados
  from public.licencias_asignaciones
  where estado_asignacion = 'Activo'
  group by licencia_id
) ocupacion on ocupacion.licencia_id = l.id;

alter view public.vista_licencias_completa set (security_invoker = on);

-- 4. Mismo criterio de acceso que el resto del sistema ----------------------
alter table public.licencias enable row level security;
alter table public.licencias_asignaciones enable row level security;

drop policy if exists "acceso_admin_autenticado" on public.licencias;
create policy "acceso_admin_autenticado" on public.licencias
  for all to authenticated using (true) with check (true);

drop policy if exists "acceso_admin_autenticado" on public.licencias_asignaciones;
create policy "acceso_admin_autenticado" on public.licencias_asignaciones
  for all to authenticated using (true) with check (true);

revoke all on public.licencias from anon;
revoke all on public.licencias_asignaciones from anon;
revoke all on public.vista_licencias_completa from anon;
