import React from 'react';

interface Columna<T> {
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
}

interface TablaDinamicaProps<T> {
  data: T[];
  columnas: Columna<T>[];
  loading?: boolean;
  msgVacio?: string;
}

export function TablaDinamica<T>({ data, columnas, loading, msgVacio = "No se encontraron registros." }: TablaDinamicaProps<T>) {
  if (loading) {
    return (
      <div className="text-center py-10 text-xs font-bold text-slate-400 animate-pulse">
        ⏳ Sincronizando registros con el servidor central...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-10 text-xs font-bold text-slate-400 border border-dashed rounded-xl bg-slate-50/50">
        {msgVacio}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto w-full border border-slate-200 rounded-xl bg-white shadow-sm">
      <table className="w-full text-left text-xs text-slate-600 border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-black tracking-wider text-slate-400">
            {columnas.map((col, idx) => (
              <th key={idx} className={`p-2.5 ${col.className || ''}`}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
          {data.map((item, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-slate-50/60 transition-colors">
              {columnas.map((col, colIdx) => (
                <td key={colIdx} className={`p-2.5 ${col.className || ''}`}>
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}