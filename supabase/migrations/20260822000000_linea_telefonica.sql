-- ============================================================================
--  Línea telefónica como campo propio + arreglo de la vista
--
--  El número de celular vivía dentro de `especificaciones`, un texto libre que
--  también describe la RAM y el disco de las laptops. Ahí no era buscable con
--  certeza, ni validable, ni reportable, y editar las especificaciones se lo
--  llevaba por delante.
--
--  De paso se corrigen dos cosas encontradas al leer las definiciones reales:
--    · La vista no exponía `dni` ni `nombre_cargo`, pese a que varios filtros
--      de búsqueda de la aplicación los mencionaban: nunca hicieron nada.
--    · Existían DOS funciones `ingresar_o_actualizar_activo` (7 y 8 argumentos).
--      La aplicación solo usa la de 8; la de 7 quedaba como ambigüedad latente.
--
--  Respaldo de las definiciones previas en:
--    supabase/respaldos/definiciones-originales-20260821.sql
-- ============================================================================

-- 1. La columna nueva -------------------------------------------------------
alter table public.activos
  add column if not exists linea_telefonica text;

comment on column public.activos.linea_telefonica is
  'Número de línea móvil. Solo aplica a equipos de categoría Celular.';

-- Buscar un teléfono es una consulta frecuente y siempre por igualdad parcial.
create index if not exists activos_por_linea
  on public.activos (linea_telefonica)
  where linea_telefonica is not null;

-- 2. La vista, con lo nuevo y lo que faltaba --------------------------------
--    IMPORTANTE: `create or replace view` no admite insertar columnas en medio
--    ni renombrarlas; solo permite AÑADIR al final. Por eso el orden original
--    se conserva intacto y las tres columnas nuevas van al cierre.
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
    -- Columnas nuevas, obligatoriamente al final:
    a.linea_telefonica,
    u.dni,
    ca.nombre_cargo
   FROM activos a
     LEFT JOIN modelos mo ON a.modelo_id = mo.id
     LEFT JOIN marcas m ON mo.marca_id = m.id
     LEFT JOIN categorias_activo c ON m.categoria_id = c.id
     LEFT JOIN usuarios u ON a.asignado_usuario_id = u.id
     LEFT JOIN cargos ca ON u.cargo_id = ca.id
     LEFT JOIN estados_conservacion ec ON a.estado_conservacion_id = ec.id;

alter view public.vista_activos_completa set (security_invoker = on);

-- 3. La función de guardado, con el parámetro nuevo -------------------------
--    Se elimina la versión anterior en vez de dejar otra sobrecarga: tres
--    funciones con el mismo nombre harían impredecible cuál se ejecuta.
drop function if exists public.ingresar_o_actualizar_activo(text, text, text, integer, text, text, text, text);

create or replace function public.ingresar_o_actualizar_activo(
  p_caf text,
  p_especificaciones text,
  p_estado_actual text,
  p_id integer,
  p_nombre_categoria text,
  p_nombre_marca text,
  p_nombre_modelo text,
  p_serial_id text,
  p_linea_telefonica text default null
)
returns void
language plpgsql
as $function$
DECLARE
    v_categoria_id INT;
    v_marca_id INT;
    v_modelo_id INT;
BEGIN
    -- 1. Asegurar o buscar Categoría
    INSERT INTO categorias_activo (nombre_categoria)
    VALUES (p_nombre_categoria)
    ON CONFLICT (nombre_categoria) DO UPDATE SET nombre_categoria = EXCLUDED.nombre_categoria
    RETURNING id INTO v_categoria_id;

    IF v_categoria_id IS NULL THEN
        SELECT id INTO v_categoria_id FROM categorias_activo WHERE nombre_categoria = p_nombre_categoria LIMIT 1;
    END IF;

    -- 2. Asegurar o buscar Marca vinculada a esa Categoría
    SELECT id INTO v_marca_id FROM marcas WHERE nombre_marca = p_nombre_marca AND categoria_id = v_categoria_id LIMIT 1;
    IF v_marca_id IS NULL THEN
        INSERT INTO marcas (nombre_marca, categoria_id) VALUES (p_nombre_marca, v_categoria_id) RETURNING id INTO v_marca_id;
    END IF;

    -- 3. Asegurar o buscar Modelo vinculado a esa Marca
    SELECT id INTO v_modelo_id FROM modelos WHERE nombre_modelo = p_nombre_modelo AND marca_id = v_marca_id LIMIT 1;
    IF v_modelo_id IS NULL THEN
        INSERT INTO modelos (nombre_modelo, marca_id) VALUES (p_nombre_modelo, v_marca_id) RETURNING id INTO v_modelo_id;
    END IF;

    -- 4. Insertar o Actualizar
    IF p_id IS NULL THEN
        INSERT INTO activos (serial_id, modelo_id, caf, especificaciones, estado_actual, anio_fabricacion, tipo_propiedad, categoria, linea_telefonica)
        VALUES (p_serial_id, v_modelo_id, p_caf, p_especificaciones, p_estado_actual, 2026, 'Compra', p_nombre_categoria, NULLIF(TRIM(p_linea_telefonica), ''));
    ELSE
        UPDATE activos
        SET serial_id = p_serial_id,
            modelo_id = v_modelo_id,
            caf = p_caf,
            especificaciones = p_especificaciones,
            estado_actual = p_estado_actual,
            categoria = p_nombre_categoria,
            linea_telefonica = NULLIF(TRIM(p_linea_telefonica), '')
        WHERE id = p_id;
    END IF;
END;
$function$;

-- 4. Retirar la versión de 7 argumentos, que quedó sin uso ------------------
--    La aplicación siempre envía `p_estado_actual`, así que nunca la invoca.
--    Si prefieres conservarla, comenta esta línea: el resto funciona igual.
drop function if exists public.ingresar_o_actualizar_activo(integer, character varying, character varying, character varying, character varying, character varying, text);
