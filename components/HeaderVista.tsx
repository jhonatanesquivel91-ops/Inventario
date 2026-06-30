import React from 'react';

interface HeaderProps {
  titulo: string;
  subtitulo: string;
  badgeStatus?: string;
  children?: React.ReactNode; // Para botones de acción a la derecha
}

export function HeaderVista({ titulo, subtitulo, badgeStatus, children }: HeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white px-5 py-4 rounded-xl border border-slate-200 shadow-sm gap-3 flex-shrink-0 animate-fade-in">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          {badgeStatus && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>}
          <h1 className="text-lg font-black tracking-tight" style={{ color: 'rgb(1, 71, 118)' }}>{titulo}</h1>
        </div>
        <p className="text-slate-500 text-[11px] font-medium tracking-wide">{subtitulo}</p>
      </div>
      <div className="flex items-center gap-2 self-end md:self-center">
        {children}
      </div>
    </div>
  );
}