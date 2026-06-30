'use client';

import React from 'react';

interface PanelFormularioProps {
  idEditando: number | null;
  onCancelar: () => void;
  onSubmit: (e: React.FormEvent) => void;
  guardando: boolean;
  children: React.ReactNode; // Aquí se inyectan los inputs dinámicos de cada pantalla
}

export function PanelFormulario({
  idEditando,
  onCancelar,
  onSubmit,
  guardando,
  children
}: PanelFormularioProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between min-h-0 overflow-y-auto">
      <form onSubmit={onSubmit} className="space-y-4 text-xs font-medium text-slate-600">
        <div>
          <span 
            className="text-[11px] font-black tracking-wider uppercase block border-b pb-1.5" 
            style={{ color: 'rgb(1, 71, 118)' }}
          >
            {idEditando ? '✏️ Actualizar Parámetro' : '➕ Registrar Nuevo Elemento'}
          </span>
          <p className="text-[10px] text-slate-400 mt-1">
            Completa los campos para impactar de forma global las dependencias en cascada.
          </p>
        </div>

        {/* Aquí entran los inputs específicos de la pantalla que lo use */}
        <div className="space-y-4">
          {children}
        </div>

        <div className="pt-2 flex gap-2">
          {/* El botón de cancelar aparece y desaparece mágicamente según el estado de edición */}
          {idEditando && (
            <button 
              type="button" 
              onClick={onCancelar} 
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-lg text-[11px] uppercase text-slate-600 transition-all"
            >
              Cancelar
            </button>
          )}
          <button 
            type="submit" 
            disabled={guardando} 
            style={{ backgroundColor: 'rgb(1, 71, 118)' }} 
            className="flex-2 py-2 text-white font-black rounded-lg text-[11px] uppercase tracking-wider shadow hover:brightness-110 w-full transition-all"
          >
            {guardando ? 'Sincronizando...' : (idEditando ? '💾 Actualizar' : '➕ Guardar Entrada')}
          </button>
        </div>
      </form>
    </div>
  );
}