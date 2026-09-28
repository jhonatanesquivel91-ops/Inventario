-- ============================================================================
--  Fecha de adquisición de los activos
--
--  Para equipos comprados es la fecha de compra; para equipos en alquiler, la
--  de inicio del contrato. Permite conocer la antigüedad del parque y planear
--  renovaciones.
--
--  Se guarda desde la aplicación con el mismo `update` que ya guarda el régimen
--  de propiedad, así que NO hace falta modificar ingresar_o_actualizar_activo.
--  Solo se añade la columna y se expone en la vista y en el RPC de reportes.
-- ============================================================================

-- 1. La columna -------------------------------------------------------------
alter table public.activos
  add column if not exists fecha_adquisicion date;

comment on column public.activos.fecha_adquisicion is
  'Fecha de compra, o de inicio del contrato si el equipo es alquilado.';

-- 2. La vista: la columna nueva va AL FINAL -------------------------------
--    `create or replace view` no permite insertar columnas en medio.
create or replace view public.vista_activos_completa as
 SELECT a.id AS activo_id,
    a.id,
    a.serial_id,
    a.caf,
    a.especificaciones,
    a.estado_actual,
    a.tipo_propiedad,
    a.fecha_fin_alquiler,
    a.fecha_registro,
    a.categoria,
    a.asignado_usuario_id,
    a.asignado_usuario_id AS usuario_id,
    c.nombre_categoria,
    m.nombre_marca AS marca,
    mo.nombre_modelo AS modelo,
    u.nombre_completo,
    u.nombre_area,
    ec.nombre_estado,
    ec.color_alerta,
    a.linea_telefonica,
    u.dni,
    ca.nombre_cargo,
    a.fecha_adquisicion
   FROM activos a
     LEFT JOIN modelos mo ON a.modelo_id = mo.id
     LEFT JOIN marcas m ON mo.marca_id = m.id
     LEFT JOIN categorias_activo c ON m.categoria_id = c.id
     LEFT JOIN usuarios u ON a.asignado_usuario_id = u.id
     LEFT JOIN cargos ca ON u.cargo_id = ca.id
     LEFT JOIN estados_conservacion ec ON a.estado_conservacion_id = ec.id;

alter view public.vista_activos_completa set (security_invoker = on);

-- 3. El RPC que usan Activos y Reportes -------------------------------------
--    Cambiar las columnas de un RETURNS TABLE exige DROP + CREATE.
--    Ejecutar todo de una vez: entre ambos, Activos y Reportes fallan.
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
   fecha_adquisicion date,
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
    a.fecha_adquisicion,
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
