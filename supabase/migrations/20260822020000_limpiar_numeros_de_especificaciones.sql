-- ============================================================================
--  Limpieza: quitar el número de celular duplicado en `especificaciones`
--
--  ⚠️  DESTRUCTIVO Y SIN VUELTA ATRÁS. Ejecutar SOLO cuando se haya verificado
--     durante varios días que:
--       1. `linea_telefonica` tiene el número correcto en todos los celulares.
--       2. El autocompletado de Préstamos sigue rellenando el contacto.
--
--  Mientras el número exista en ambos sitios no hay ningún problema: el
--  autocompletado prefiere la columna y solo cae en las especificaciones como
--  respaldo. No hay prisa por ejecutar esto.
-- ============================================================================

-- ---------------------------------------------------------------- PASO 1 ---
-- VISTA PREVIA. Muestra cómo quedaría cada texto. No modifica nada.
select
  a.id,
  a.serial_id,
  a.linea_telefonica,
  a.especificaciones as antes,
  nullif(
    trim(
      regexp_replace(
        regexp_replace(
          a.especificaciones,
          '(?i)(l[ií]nea|celular|cel|n[uú]mero|nro|tel[eé]fono|tel)\s*:?\s*',
          '', 'g'
        ),
        '\d{3}[ .-]?\d{3}[ .-]?\d{3,5}',
        '', 'g'
      )
    ),
    ''
  ) as despues
from public.activos a
where a.linea_telefonica is not null
  and a.especificaciones is not null
order by a.id;

-- ---------------------------------------------------------------- PASO 2 ---
-- APLICAR. Solo después de revisar la columna "despues" una por una.
--
-- Antes de ejecutarlo conviene guardar una copia de seguridad:
--   create table respaldo_especificaciones as
--   select id, especificaciones from public.activos
--   where linea_telefonica is not null;
--
-- update public.activos a
-- set especificaciones = nullif(
--   trim(
--     regexp_replace(
--       regexp_replace(
--         a.especificaciones,
--         '(?i)(l[ií]nea|celular|cel|n[uú]mero|nro|tel[eé]fono|tel)\s*:?\s*',
--         '', 'g'
--       ),
--       '\d{3}[ .-]?\d{3}[ .-]?\d{3,5}',
--       '', 'g'
--     )
--   ),
--   ''
-- )
-- where a.linea_telefonica is not null
--   and a.especificaciones is not null;
--
-- Para revertir, si se creó el respaldo:
--   update public.activos a
--   set especificaciones = r.especificaciones
--   from respaldo_especificaciones r
--   where a.id = r.id;
