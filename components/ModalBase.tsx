'use client';

import React from 'react';

interface ModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  titulo: string;
  subtitulo?: string;
  maxWithClass?: string; // Por defecto max-w-md
  children: React.ReactNode;
}

export function ModalBase({ isOpen, onClose, titulo, subtitulo, maxWithClass = 'max-w-md', children }: ModalBaseProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className={`bg-white rounded-2xl border border-slate-100 shadow-2xl w-full ${maxWithClass} flex flex-col max-h-[85vh] overflow-hidden`}>
        {/* Cabecera Estructurada */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-wide">{titulo}</h2>
            {subtitulo && <p className="text-[10px] text-slate-400 font-bold tracking-wide mt-0.5">{subtitulo}</p>}
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 text-xs bg-slate-100 px-2 py-1 rounded-lg font-bold transition-colors"
          >
            ✕
          </button>
        </div>
        
        {/* Contenido con scroll independiente si es muy largo */}
        <div className="p-5 flex-1 overflow-y-auto min-h-0 text-xs font-medium text-slate-600">
          {children}
        </div>
      </div>
    </div>
  );
}