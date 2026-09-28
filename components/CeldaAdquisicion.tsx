import React from 'react';

/** Años/meses transcurridos, en formato corto para una celda de tabla. */
function antiguedadCorta(inicio: Date): string {
  const hoy = new Date();
  let meses = (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth());
  if (hoy.getDate() < inicio.getDate()) meses -= 1;
  if (meses < 1) return '< 1 mes';
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  if (!anios) return `${resto} ${resto === 1 ? 'mes' : 'meses'}`;
  return resto ? `${anios} a ${resto} m` : `${anios} ${anios === 1 ? 'año' : 'años'}`;
}

/**
 * Fecha de adquisición con su antigüedad debajo. Se muestra SIEMPRE, con un
 * guion si falta: una columna que aparece y desaparece según el dato hace que
 * los equipos sin fecha pasen desapercibidos, que es justo lo que hay que ver.
 */
export function CeldaAdquisicion({ valor }: { valor?: string | null }) {
  if (!valor) {
    return <span className="text-slate-300 font-bold text-[11px]">—</span>;
  }
  const d = new Date(`${String(valor).slice(0, 10)}T00:00:00`);
  if (isNaN(d.getTime())) return <span className="text-slate-300">—</span>;

  return (
    <div className="font-mono text-[10px] leading-tight whitespace-nowrap">
      <div className="text-slate-700 font-bold">{d.toLocaleDateString('es-PE')}</div>
      <div className="text-slate-400 font-medium">{antiguedadCorta(d)}</div>
    </div>
  );
}

/** Columna lista para TablaControl; ordenable por fecha. */
export const columnaAdquisicion = {
  header: 'Adquisición',
  field: 'fecha_adquisicion',
  className: 'w-24',
  render: (a: any) => <CeldaAdquisicion valor={a.fecha_adquisicion} />,
};
