'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Detecta si la base de datos ya tiene una columna opcional de `activos`.
 *
 * El código de la interfaz puede adelantarse a una migración: mientras esta no
 * se ejecute, mostrar el campo sería una trampa, porque aceptaría un dato y lo
 * descartaría sin avisar (o peor, haría fallar el guardado entero). Con esta
 * comprobación el campo simplemente no aparece hasta que exista dónde
 * guardarlo, y se activa solo después.
 *
 * Cada columna se consulta una vez por sesión y se comparte entre pantallas.
 */
const comprobaciones = new Map<string, Promise<boolean>>();

function comprobarColumna(columna: string): Promise<boolean> {
  let comprobacion = comprobaciones.get(columna);
  if (!comprobacion) {
    // El constructor de consultas de Supabase devuelve un PromiseLike,
    // por eso se envuelve con Promise.resolve antes de guardarlo en caché.
    comprobacion = Promise.resolve(
      supabase.from('activos').select(columna).limit(1)
    ).then(({ error }) => !error);
    comprobaciones.set(columna, comprobacion);
  }
  return comprobacion;
}

function useSoportaColumna(columna: string): boolean {
  const [soporta, setSoporta] = useState(false);

  useEffect(() => {
    let vigente = true;
    comprobarColumna(columna).then((r) => {
      if (vigente) setSoporta(r);
    });
    return () => {
      vigente = false;
    };
  }, [columna]);

  return soporta;
}

export function useSoportaLineaTelefonica(): boolean {
  return useSoportaColumna('linea_telefonica');
}

export function useSoportaFechaAdquisicion(): boolean {
  return useSoportaColumna('fecha_adquisicion');
}
