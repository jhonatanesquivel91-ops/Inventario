-- ============================================================================
--  obtener_reporte_activos: campos que el código leía y la función no devolvía
--
--  Cuando Activos y Reportes pasaron a leer de este RPC en lugar de
--  `vista_activos_completa`, tres columnas quedaron fuera del RETURNS TABLE.
--  El código seguía leyéndolas, así que llegaban como `undefined`:
--
--   · estado_actual        Al EDITAR un activo, `modalForm.activo.estado_actual`
--                          era undefined y se enviaba como p_estado_actual,
--                          dejando el estado del equipo en NULL en la base.
--                          Este era el problema grave.
--   · asignado_usuario_id  Se usa para distinguir un equipo en custodia de uno
--                          en almacén; sin él, algunos asignados se veían
--                          como disponibles.
--   · linea_telefonica     La columna nueva de celulares no aparecía ni se
--                          podía buscar desde Activos ni Reportes.
--
--  Lleva DROP porque cambiar las columnas de una función RETURNS TABLE no es
--  posible con CREATE OR REPLACE. Ejecutar de una sola vez: entre el DROP y el
--  CREATE, Activos y Reportes fallan.
-- ============================================================================

drop function if exists public.obtener_reporte_activos();

create or replace function public.obtener_reporte_activos()
 returns table(
   id integer,
   activo_id integer,
   serial_id character varying,
   caf character varying,
   marca character varying,
   modelo character varying,
   categoria character varying,
   especificaciones text,
   linea_telefonica text,
   estado_actual character varying,
   asignado_usuario_id integer,
   tipo_propiedad character varying,
   fecha_fin_alquiler date,
   fecha_registro timestamp with time zone,
   nombre_completo character varying,
   dni character varying,
   nombre_area character varying,
   color_hex character varying,
   nombre_estado character varying,
   color_alerta character varying,
   nombre_cargo character varying
 )
 language plpgsql
as $function$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.id AS activo_id,
    a.serial_id,
    a.caf,
    m.nombre_marca AS marca,
    mo.nombre_modelo AS modelo,
    cat.nombre_categoria AS categoria,
    a.especificaciones,
    a.linea_telefonica,
    a.estado_actual,
    a.asignado_usuario_id,
    a.tipo_propiedad,
    a.fecha_fin_alquiler,
    a.fecha_registro,
    u.nombre_completo,
    u.dni,
    ar.nombre_area,
    ar.color_hex,
    est.nombre_estado,
    est.color_alerta,
    car.nombre_cargo
  FROM activos a
  LEFT JOIN usuarios u ON a.asignado_usuario_id = u.id
  LEFT JOIN areas ar ON u.area_id = ar.id
  LEFT JOIN cargos car ON u.cargo_id = car.id
  LEFT JOIN estados_conservacion est ON a.estado_conservacion_id = est.id
  LEFT JOIN modelos mo ON a.modelo_id = mo.id
  LEFT JOIN marcas m ON mo.marca_id = m.id
  LEFT JOIN categorias_activo cat ON m.categoria_id = cat.id
  ORDER BY a.id DESC;
END;
$function$;

-- La función es SECURITY INVOKER (por defecto), así que respeta el RLS de
-- `activos`: verificado con la anon key pública, responde 401 sin sesión.
