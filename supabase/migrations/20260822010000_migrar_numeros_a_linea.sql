-- ============================================================================
--  Traslado de los números de celular desde `especificaciones` a su columna
--
--  NO se borra nada de `especificaciones`: el número se COPIA. Así la
--  operación es reversible (basta con vaciar `linea_telefonica`) y el
--  autocompletado de Préstamos sigue teniendo su respaldo mientras se valida.
--
--  Se reconocen dos formatos:
--    · 9 a 11 dígitos seguidos      → "Linea 987654321"
--    · grupos de 3 con separador    → "Línea 987 654 321" / "987-654-321"
-- ============================================================================

-- ---------------------------------------------------------------- PASO 1 ---
-- VISTA PREVIA. No modifica nada: muestra qué se copiaría y de dónde.
select
  a.id,
  a.serial_id,
  a.categoria,
  a.especificaciones,
  coalesce(
    substring(a.especificaciones from '\d{9,11}'),
    regexp_replace(
      substring(a.especificaciones from '\d{3}[ .-]\d{3}[ .-]\d{3}'),
      '\D', '', 'g'
    )
  ) as numero_detectado
from public.activos a
where a.linea_telefonica is null
  and a.especificaciones is not null
  and lower(a.categoria) like '%celular%'
order by a.id;

-- ---------------------------------------------------------------- PASO 2 ---
-- APLICAR. Ejecutar solo después de revisar la vista previa.
update public.activos a
set linea_telefonica = detectado.numero
from (
  select
    id,
    coalesce(
      substring(especificaciones from '\d{9,11}'),
      regexp_replace(
        substring(especificaciones from '\d{3}[ .-]\d{3}[ .-]\d{3}'),
        '\D', '', 'g'
      )
    ) as numero
  from public.activos
  where linea_telefonica is null
    and especificaciones is not null
    and lower(categoria) like '%celular%'
) detectado
where a.id = detectado.id
  and detectado.numero is not null
  and length(detectado.numero) between 9 and 11;

-- ------------------------------------------------------------- REVERTIR ---
-- Si algo quedó mal, esto deshace el paso 2 sin tocar `especificaciones`:
--   update public.activos set linea_telefonica = null
--   where lower(categoria) like '%celular%';
