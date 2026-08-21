-- ============================================================================
--  Cierra el acceso público a la base de datos del Inventario TI - UPeU.
--
--  Antes de esto, la anon key (visible en el navegador) permitía leer y
--  escribir en todas las tablas sin autenticación. Con RLS activo, solo un
--  usuario con sesión iniciada en Supabase Auth puede operar.
--
--  Sistema mono-usuario: no se distingue entre roles, basta con estar
--  autenticado. Ejecutar completo en el SQL Editor del proyecto.
-- ============================================================================

-- 1. Activar RLS en todas las tablas del inventario ---------------------------
alter table public.activos                enable row level security;
alter table public.areas                  enable row level security;
alter table public.asignaciones           enable row level security;
alter table public.cargos                 enable row level security;
alter table public.categorias_activo      enable row level security;
alter table public.estados_conservacion   enable row level security;
alter table public.marcas                 enable row level security;
alter table public.modelos                enable row level security;
alter table public.observaciones_activos  enable row level security;
alter table public.prestamos              enable row level security;
alter table public.usuarios               enable row level security;

-- 2. Una política por tabla: acceso total solo para sesiones autenticadas -----
--    (el rol `anon`, sin política, queda automáticamente bloqueado)
do $$
declare
  t text;
  tablas text[] := array[
    'activos', 'areas', 'asignaciones', 'cargos', 'categorias_activo',
    'estados_conservacion', 'marcas', 'modelos', 'observaciones_activos',
    'prestamos', 'usuarios'
  ];
begin
  foreach t in array tablas loop
    execute format('drop policy if exists "acceso_admin_autenticado" on public.%I', t);
    execute format(
      'create policy "acceso_admin_autenticado" on public.%I
         for all
         to authenticated
         using (true)
         with check (true)', t
    );
  end loop;
end $$;

-- 3. La vista debe respetar los permisos de quien consulta, no los del dueño --
--    (sin esto, una vista SECURITY DEFINER sortearía el RLS de las tablas base)
alter view public.vista_activos_completa set (security_invoker = on);

-- 4. Revocar los permisos de tabla que aún tuviera el rol anónimo -------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- 5. Función de "latido" para el cron -----------------------------------------
--    Mantiene despierto el proyecto generando tráfico real contra Postgres.
--    No lee ninguna tabla ni expone dato alguno: solo devuelve la hora.
--    Por eso puede invocarse con la anon key pública sin riesgo.
create or replace function public.latido()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

revoke all on function public.latido() from public;
grant execute on function public.latido() to anon, authenticated;
