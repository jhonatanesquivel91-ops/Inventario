'use client';

import React from 'react';

interface Comentario {
  id: number;
  tipo_observacion: string;
  fecha_registro: string;
  comentario: string;
  creado_por: string;
}

interface BitacoraNotasProps {
  numeroSerie: string;
  tipoObs: string;
  setTipoObs: (value: string) => void;
  nuevoComentario: string;
  setNuevoComentario: (value: string) => void;
  enviandoComentario: boolean;
  onGuardarComentario: (e: React.FormEvent) => void;
  listaComentarios: Comentario[];
}

export function BitacoraNotas({
  numeroSerie,
  tipoObs,
  setTipoObs,
  nuevoComentario,
  setNuevoComentario,
  enviandoComentario,
  onGuardarComentario,
  listaComentarios
}: BitacoraNotasProps) {
  return (
    <div className="flex flex-col max-h-[70vh] text-xs font-semiboldData">
      <p className="text-slate-500 text-[11px] mb-3 leading-normal border-b pb-2">
        Mostrando el tracking y eventos históricos para el dispositivo con número de serie: 
        <span className="font-mono bg-slate-100 border px-1.5 py-0.5 rounded text-blue-800 font-bold ml-1">{numeroSerie}</span>
      </p>

      {/* Formulario de Registro */}
      <form onSubmit={onGuardarComentario} className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5 flex-shrink-0">
        <div className="flex gap-2 items-center">
          <select value={tipoObs} onChange={(e) => setTipoObs(e.target.value)} className="p-1.5 border rounded-lg bg-white text-[11px] font-bold text-slate-700 outline-none cursor-pointer">
            <option value="General">📝 General</option>
            <option value="Repotenciación">🚀 Repotenciación</option>
            <option value="Falla">⚠️ Falla Técnica</option>
            <option value="Mantenimiento">🔧 Mantenimiento</option>
          </select>
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">Categoría del Evento</span>
        </div>
        <div className="flex gap-2">
          <input type="text" value={nuevoComentario} onChange={(e) => setNuevoComentario(e.target.value)} placeholder="Ej: Equipo enviado a mantenimiento por conector..." className="flex-1 p-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 outline-none font-bold placeholder-slate-300" required />
          <button type="submit" disabled={enviandoComentario} style={{ backgroundColor: 'var(--color-upeu)' }} className="px-4 py-2 text-white font-black rounded-lg uppercase tracking-wider text-[10px] disabled:opacity-50 shadow-sm transition-all active:scale-95">
            {enviandoComentario ? '...' : 'Añadir'}
          </button>
        </div>
      </form>

      {/* Lista del Historial */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
        {listaComentarios.length > 0 ? (
          listaComentarios.map((c) => {
            const esFalla = c.tipo_observacion === 'Falla' || c.tipo_observacion === 'Falla Técnica';
            const esRepotenciacion = c.tipo_observacion === 'Repotenciación';
            const esMantenimiento = c.tipo_observacion === 'Mantenimiento';
            return (
              <div key={c.id} className={`p-3 rounded-xl border text-xs transition-all ${esFalla ? 'bg-red-50/50 border-red-100' : esRepotenciacion ? 'bg-green-50/50 border-green-100' : esMantenimiento ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex justify-between items-center mb-1 text-slate-400 font-bold text-[10px]">
                  <span className={`font-black px-1.5 py-0.5 rounded text-[9px] uppercase border tracking-wider ${esFalla ? 'bg-red-100 border-red-200 text-red-800' : esRepotenciacion ? 'bg-green-100 border-green-200 text-green-800' : esMantenimiento ? 'bg-amber-100 border-amber-200 text-amber-800' : 'bg-slate-200 border-slate-300 text-slate-700'}`}>{c.tipo_observacion}</span>
                  <span className="font-mono">{new Date(c.fecha_registro).toLocaleString('es-PE')}</span>
                </div>
                <p className="text-slate-800 font-bold leading-normal">{c.comentario}</p>
                <span className="text-[9px] text-slate-400 block mt-1 uppercase tracking-wide">✍️ Auditor: {c.creado_por}</span>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-slate-400 font-bold border border-dashed rounded-xl bg-white text-xs">No existen anotaciones registradas.</div>
        )}
      </div>
    </div>
  );
}