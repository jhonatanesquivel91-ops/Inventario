'use client';

import { useCallback, useEffect, useState } from 'react';

const EVENTO = 'inventario:destacar';

/**
 * Aviso de que se pidió destacar un registro. Lo emite la campana de alertas
 * después de navegar.
 *
 * Hace falta porque al pulsar una notificación de la misma pantalla en la que
 * ya se está, la ruta no cambia: el componente no se vuelve a montar y sin
 * este aviso el resaltado nunca se dispararía.
 */
export function anunciarDestacado() {
  window.dispatchEvent(new Event(EVENTO));
}

/**
 * Lee el parámetro `?destacar=` con el que llegan las notificaciones.
 *
 * Se lee desde `window.location` y no con `useSearchParams` a propósito: ese
 * hook obliga a envolver la página en un <Suspense> y la saca del
 * prerenderizado estático. Aquí basta con leerlo ya en el navegador.
 *
 * El parámetro se borra de la barra de direcciones en cuanto se usa, para que
 * recargar la página no vuelva a resaltar un registro ya atendido.
 */
export function useDestacar(): string | null {
  const [id, setId] = useState<string | null>(null);

  const leer = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const valor = params.get('destacar');
    if (!valor) return;

    setId(valor);

    params.delete('destacar');
    const query = params.toString();
    window.history.replaceState(
      null,
      '',
      window.location.pathname + (query ? `?${query}` : '')
    );
  }, []);

  useEffect(() => {
    leer();
    window.addEventListener(EVENTO, leer);
    return () => window.removeEventListener(EVENTO, leer);
  }, [leer]);

  return id;
}
