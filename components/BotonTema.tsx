'use client';

import { useEffect, useState } from 'react';

export type Tema = 'claro' | 'oscuro';

/** Lee el tema guardado; si no hay ninguno, sigue la preferencia del sistema. */
export function temaInicial(): Tema {
  if (typeof window === 'undefined') return 'claro';
  const guardado = localStorage.getItem('tema');
  if (guardado === 'claro' || guardado === 'oscuro') return guardado;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

export function aplicarTema(tema: Tema) {
  document.documentElement.classList.toggle('dark', tema === 'oscuro');
  localStorage.setItem('tema', tema);
}

export function BotonTema() {
  // Arranca en null para no renderizar un icono distinto al que ya pintó el
  // script de arranque: eso provocaría un desajuste de hidratación.
  const [tema, setTema] = useState<Tema | null>(null);

  useEffect(() => {
    setTema(document.documentElement.classList.contains('dark') ? 'oscuro' : 'claro');
  }, []);

  const alternar = () => {
    const siguiente: Tema = tema === 'oscuro' ? 'claro' : 'oscuro';
    aplicarTema(siguiente);
    setTema(siguiente);
  };

  const esOscuro = tema === 'oscuro';

  return (
    <button
      type="button"
      onClick={alternar}
      className="p-2 rounded-full hover:bg-white/15 transition-all active:scale-90 text-white"
      title={esOscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      aria-label={esOscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
    >
      {/* Mientras no se conoce el tema se reserva el espacio, sin icono */}
      <span className="block w-5 h-5">
        {tema === null ? null : esOscuro ? (
          // Sol: pulsarlo devuelve al tema claro
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
          </svg>
        ) : (
          // Luna: pulsarlo activa el tema oscuro
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        )}
      </span>
    </button>
  );
}
