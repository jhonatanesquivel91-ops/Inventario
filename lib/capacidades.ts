'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Detecta si la base de datos ya tiene la columna `linea_telefonica`.
 *
 * El código de la interfaz puede adelantarse a una migración: mientras esta no
 * se ejecute, mostrar el campo sería una trampa, porque aceptaría un número y
 * lo descartaría sin avisar. Con esta comprobación el campo simplemente no
 * aparece hasta que exista dónde guardarlo, y se activa solo después.
 *
 * La consulta se hace una vez por sesión y se comparte entre pantallas.
 */
let comprobacion: Promise<boolean> | null = null;

function comprobarColumna(): Promise<boolean> {
  if (!comprobacion) {
    // El constructor de PromiseBuilder de Supabase devuelve un PromiseLike,
    // por eso se envuelve con Promise.resolve antes de guardarlo en caché.
    comprobacion = Promise.resolve(
      supabase.from('activos').select('linea_telefonica').limit(1)
    ).then(({ error }) => !error);
  }
  return comprobacion;
}

export function useSoportaLineaTelefonica(): boolean {
  const [soporta, setSoporta] = useState(false);

  useEffect(() => {
    let vigente = true;
    comprobarColumna().then((r) => {
      if (vigente) setSoporta(r);
    });
    return () => {
      vigente = false;
    };
  }, []);

  return soporta;
}
