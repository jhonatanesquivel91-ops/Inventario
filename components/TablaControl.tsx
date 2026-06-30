import React, { useState } from 'react';

interface Column<T> {
  header: string;
  field?: keyof T | string; 
  render: (item: T) => React.ReactNode;
  className?: string;
}

interface TablaControlProps<T> {
  tituloSeccion: string;
  badgeCount?: number;
  data: T[];
  columnas: Column<T>[];
  loading?: boolean;
  msgVacio?: string;
  children?: React.ReactNode; // Filtros embebidos
}

export function TablaControl<T>({ 
  tituloSeccion, 
  badgeCount, 
  data, 
  columnas, 
  loading, 
  msgVacio = "No se encontraron registros.", 
  children 
}: TablaControlProps<T>) {
  
  // --- Estados de Ordenamiento ---
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // --- Estados de Paginación Integrada Senior ---
  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(15);

  const handleSort = (field?: string) => {
    if (!field) return;
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setPaginaActual(1); // Resetea página al ordenar
  };

  // 1. Procesar Ordenamiento en Caliente
  const sortedData = React.useMemo(() => {
    if (!sortField) return data;
    return [...data].sort((a: any, b: any) => {
      const resolvePath = (obj: any, path: string) => 
        path.split('.').reduce((acc, part) => acc && acc[part], obj);

      const valA = String(resolvePath(a, sortField) || '').toLowerCase();
      const valB = String(resolvePath(b, sortField) || '').toLowerCase();

      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }, [data, sortField, sortAsc]);

  // 2. Procesar Paginación en Caliente sobre los datos ordenados
  const totalFilas = sortedData.length;
  const paginasTotales = Math.max(1, Math.ceil(totalFilas / registrosPorPagina));
  const inicioIdx = (paginaActual - 1) * registrosPorPagina;
  
  // Sincronizar página actual si el dataset se reduce drásticamente por filtros externos
  React.useEffect(() => {
    if (paginaActual > paginasTotales) {
      setPaginaActual(1);
    }
  }, [paginasTotales, paginaActual]);

  const datosPaginados = React.useMemo(() => {
    return sortedData.slice(inicioIdx, inicioIdx + registrosPorPagina);
  }, [sortedData, inicioIdx, registrosPorPagina]);

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden font-sans">
      
      {/* CABECERA INTEGRADA CON FILTROS */}
      <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider">{tituloSeccion}</span>
          {badgeCount !== undefined && (
            <span className="bg-slate-200/80 text-slate-700 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
              {badgeCount}
            </span>
          )}
        </div>
        {children && <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">{children}</div>}
      </div>

      {/* CUERPO DE LA TABLA */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="text-center py-16 text-xs font-bold text-slate-400 animate-pulse">
            ⏳ Sincronizando registros con el servidor de Posgrado...
          </div>
        ) : datosPaginados.length === 0 ? (
          <div className="text-center py-16 text-xs font-bold text-slate-400">
            {msgVacio}
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/40 border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-400/90">
                {columnas.map((col, idx) => (
                  <th 
                    key={idx} 
                    onClick={() => handleSort(col.field as string)}
                    className={`px-4 py-2.5 font-bold ${col.field ? 'cursor-pointer hover:bg-slate-100/80 select-none' : ''} ${col.className || ''}`}
                  >
                    <div className="flex items-center gap-1">
                      {col.header}
                      {col.field && sortField === col.field && (
                        <span className="text-[9px]">{sortAsc ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {datosPaginados.map((item, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-slate-50/40 transition-colors">
                  {columnas.map((col, colIdx) => (
                    <td key={colIdx} className={`px-4 py-2.5 ${col.className || ''}`}>
                      {/* 🛠️ CORRECCIÓN: Validar si existe renderizador o pintar la propiedad plana del objeto */}
                      {col.render ? col.render(item) : (col.field ? (item as any)[col.field] : '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 📄 PIE DE PÁGINA: PAGINACIÓN INTEGRADA Y LIMPIA DE CLASE MUNDIAL */}
      {!loading && totalFilas > 0 && (
        <div className="px-4 py-2 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 flex-shrink-0 text-[11px] font-bold text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 uppercase text-[9px] tracking-wide">Mostrar:</span>
            <select 
              value={registrosPorPagina} 
              onChange={(e) => { setRegistrosPorPagina(Number(e.target.value)); setPaginaActual(1); }} 
              className="p-1 border border-slate-200 rounded bg-white font-medium outline-none text-slate-700 cursor-pointer"
            >
              <option value={10}>10 filas</option>
              <option value={25}>25 filas</option>
              <option value={50}>50 filas</option>
            </select>
          </div>

          <span>
            {inicioIdx + 1} - {Math.min(inicioIdx + registrosPorPagina, totalFilas)} de {totalFilas}
          </span>

          <div className="flex gap-1">
            <button 
              onClick={() => setPaginaActual(p => Math.max(1, p - 1))} 
              disabled={paginaActual === 1} 
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-black hover:bg-slate-100 disabled:opacity-40 transition-opacity select-none"
            >
              ◀
            </button>
            <button 
              onClick={() => setPaginaActual(p => Math.min(paginasTotales, p + 1))} 
              disabled={paginaActual === paginasTotales} 
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-black hover:bg-slate-100 disabled:opacity-40 transition-opacity select-none"
            >
              ▶
            </button>
          </div>
        </div>
      )}

    </div>
  );
}