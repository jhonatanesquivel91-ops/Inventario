-- Respaldo de las definiciones ANTES de añadir linea_telefonica.
-- Guardado por si hay que revertir la migración 20260822000000.

-- ---------------------------------------------------------------- VISTA ----
create or replace view public.vista_activos_completa as
 SELECT a.id AS activo_id, a.id, a.serial_id, a.caf, a.especificaciones,
    a.estado_actual, a.tipo_propiedad, a.fecha_fin_alquiler, a.fecha_registro,
    a.categoria, a.asignado_usuario_id, a.asignado_usuario_id AS usuario_id,
    c.nombre_categoria, m.nombre_marca AS marca, mo.nombre_modelo AS modelo,
    u.nombre_completo, u.nombre_area, ec.nombre_estado, ec.color_alerta
   FROM activos a
     LEFT JOIN modelos mo ON a.modelo_id = mo.id
     LEFT JOIN marcas m ON mo.marca_id = m.id
     LEFT JOIN categorias_activo c ON m.categoria_id = c.id
     LEFT JOIN usuarios u ON a.asignado_usuario_id = u.id
     LEFT JOIN estados_conservacion ec ON a.estado_conservacion_id = ec.id;

-- ------------------------------------------------- FUNCIÓN EN USO (8 args) --
CREATE OR REPLACE FUNCTION public.ingresar_o_actualizar_activo(p_caf text, p_especificaciones text, p_estado_actual text, p_id integer, p_nombre_categoria text, p_nombre_marca text, p_nombre_modelo text, p_serial_id text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_categoria_id INT;
    v_marca_id INT;
    v_modelo_id INT;
BEGIN
    INSERT INTO categorias_activo (nombre_categoria)
    VALUES (p_nombre_categoria)
    ON CONFLICT (nombre_categoria) DO UPDATE SET nombre_categoria = EXCLUDED.nombre_categoria
    RETURNING id INTO v_categoria_id;

    IF v_categoria_id IS NULL THEN
        SELECT id INTO v_categoria_id FROM categorias_activo WHERE nombre_categoria = p_nombre_categoria LIMIT 1;
    END IF;

    SELECT id INTO v_marca_id FROM marcas WHERE nombre_marca = p_nombre_marca AND categoria_id = v_categoria_id LIMIT 1;
    IF v_marca_id IS NULL THEN
        INSERT INTO marcas (nombre_marca, categoria_id) VALUES (p_nombre_marca, v_categoria_id) RETURNING id INTO v_marca_id;
    END IF;

    SELECT id INTO v_modelo_id FROM modelos WHERE nombre_modelo = p_nombre_modelo AND marca_id = v_marca_id LIMIT 1;
    IF v_modelo_id IS NULL THEN
        INSERT INTO modelos (nombre_modelo, marca_id) VALUES (p_nombre_modelo, v_marca_id) RETURNING id INTO v_modelo_id;
    END IF;

    IF p_id IS NULL THEN
        INSERT INTO activos (serial_id, modelo_id, caf, especificaciones, estado_actual, anio_fabricacion, tipo_propiedad, categoria)
        VALUES (p_serial_id, v_modelo_id, p_caf, p_especificaciones, p_estado_actual, 2026, 'Compra', p_nombre_categoria);
    ELSE
        UPDATE activos
        SET serial_id = p_serial_id, modelo_id = v_modelo_id, caf = p_caf,
            especificaciones = p_especificaciones, estado_actual = p_estado_actual,
            categoria = p_nombre_categoria
        WHERE id = p_id;
    END IF;
END;
$function$;

-- La versión de 7 argumentos (RETURNS TABLE(id integer)) quedó sin uso; su
-- definición completa está en el historial de la conversación si hiciera falta.
