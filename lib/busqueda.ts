/**
 * Buscador compartido por todos los módulos.
 *
 * Resuelve tres problemas que tenían los filtros escritos a mano:
 *
 *  1. Tildes — "ingenieria" no encontraba "Ingeniería", y nadie escribe
 *     tildes cuando busca con prisa.
 *  2. Varias palabras — "dell 5420" no encontraba nada, porque se comparaba
 *     la frase entera contra cada campo por separado. Ahora cada palabra puede
 *     acertar en un campo distinto.
 *  3. Números con formato — un celular guardado como "987 654 321" no aparecía
 *     al escribirlo seguido. Los dígitos se comparan también sin separadores.
 */

/** Minúsculas y sin tildes ni diacríticos. */
export function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Deja solo dígitos, para comparar teléfonos, DNI y códigos con separadores. */
function soloDigitos(valor: string): string {
  return valor.replace(/\D+/g, '');
}

/**
 * Construye un predicado de búsqueda.
 *
 * @param termino  lo que escribió la persona
 * @param campos   de qué propiedades leer; admite rutas anidadas ("areas.nombre_area")
 */
export function crearFiltro<T>(termino: string, campos: string[]) {
  const palabras = normalizar(termino).split(/\s+/).filter(Boolean);

  return (item: T): boolean => {
    if (palabras.length === 0) return true;

    const valores = campos.map((campo) => {
      const bruto = campo
        .split('.')
        .reduce<any>((acc, parte) => (acc == null ? acc : acc[parte]), item);
      return normalizar(bruto);
    });

    const valoresNumericos = valores.map(soloDigitos).filter(Boolean);

    // Cada palabra debe acertar en algún campo, no necesariamente en el mismo.
    return palabras.every((palabra) => {
      if (valores.some((v) => v.includes(palabra))) return true;

      const palabraNumerica = soloDigitos(palabra);
      return (
        palabraNumerica.length >= 3 &&
        valoresNumericos.some((v) => v.includes(palabraNumerica))
      );
    });
  };
}
