import React from 'react';

interface Activo {
  id: number;
  categoria: string;
  marca: string;
  modelo: string;
  serial_id: string;
  caf: string | null;
  especificaciones: string | null;
  estado_actual: string;
}

interface TablaActivosProps {
  activos: Activo[];
  seleccionados: number[];
  onAlternarSeleccion: (id: number) => void;
  onAlternarTodos: () => void; // 👈 OJO: Asegúrate de que no tenga nada dentro del paréntesis
  onEditar: (id: number) => void;
  onBaja: (id: number) => void;
  onEliminar: (id: number) => void;
  onVerComentarios: (id: number, serie: string) => void;
}

export const TablaActivos: React.FC<TablaActivosProps> = ({ 
  activos, 
  seleccionados, 
  onAlternarSeleccion, 
  onAlternarTodos, 
  onEditar, 
  onBaja,
  onEliminar,
  onVerComentarios
}) => {
  const todosSeleccionados = activos.length > 0 && activos.every(a => seleccionados.includes(a.id));

  return (
    <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-left text-sm text-slate-600">
        <thead style={{ backgroundColor: 'rgb(1, 71, 118)' }} className="text-xs uppercase text-white font-semibold">
          <tr>
            <th className="px-6 py-4 border-b border-slate-200 w-12 text-center">
              <input 
                type="checkbox" 
                checked={todosSeleccionados}
                onChange={onAlternarTodos}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
              />
            </th>
            <th className="px-6 py-4 border-b border-slate-200">Clasificación</th>
            <th className="px-6 py-4 border-b border-slate-200">Hardware (Marca / Modelo)</th>
            <th className="px-6 py-4 border-b border-slate-200">Número de Serie</th>
            <th className="px-6 py-4 border-b border-slate-200">Código Patrimonial (CAF)</th>
            <th className="px-6 py-4 border-b border-slate-200">Disponibilidad</th>
            <th className="px-6 py-4 border-b border-slate-200 text-center w-36">Acciones</th>
          </tr>
        </thead>
        
        <tbody className="divide-y divide-slate-200 bg-white">
          {activos.map((activo) => {
            const esAlmacen = activo.estado_actual === "Disponible en Almacén TI";
            const esAsignado = activo.estado_actual === "Asignado";
            const estaMarcado = seleccionados.includes(activo.id);
            
            return (
              <tr key={activo.id} className={`transition-colors ${estaMarcado ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                <td className="px-6 py-4 text-center border-r border-slate-100">
                  <input 
                    type="checkbox" 
                    checked={estaMarcado}
                    onChange={() => onAlternarSeleccion(activo.id)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                  />
                </td>
                <td className="px-6 py-4 font-medium text-slate-900 border-r border-slate-100">{activo.categoria}</td>
                <td className="px-6 py-4 border-r border-slate-100">
                  <div className="font-semibold text-slate-800">{activo.marca} <span className="font-normal text-slate-600">{activo.modelo}</span></div>
                  {activo.especificaciones && <div className="text-xs text-slate-400 mt-0.5">*{activo.especificaciones}*</div>}
                </td>
                <td className="px-6 py-4 border-r border-slate-100">
                  <span className="font-mono bg-slate-100 text-slate-800 px-2 py-1 rounded text-xs border border-slate-200">{activo.serial_id}</span>
                </td>
                <td className="px-6 py-4 text-slate-700 border-r border-slate-100">{activo.caf || 'N/A'}</td>
                
                <td className="px-6 py-4 border-r border-slate-100">
                  <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                    esAlmacen ? 'bg-green-100 text-green-800' : esAsignado ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {activo.estado_actual}
                  </span>
                </td>
                
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-3">
                    {/* Botón de comentarios integrado */}
                    <button onClick={() => onVerComentarios(activo.id, activo.serial_id)} className="text-slate-400 hover:text-green-600 text-lg transition-colors" title="Ver Observaciones">💬</button>
                    <button onClick={() => onEditar(activo.id)} className="text-slate-400 hover:text-blue-600 text-lg transition-colors" title="Modificar Todo">✏️</button>
                    <button onClick={() => onBaja(activo.id)} className="text-slate-400 hover:text-amber-600 text-lg transition-colors" title="Dar de Baja">☣️</button>
                    <button onClick={() => onEliminar(activo.id)} className="text-slate-400 hover:text-red-600 text-lg transition-colors" title="Eliminar Definitivamente">❌</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};