import React from 'react';
import { HeaderVista } from './HeaderVista';

interface ContenedorVistaProps {
  titulo: string;
  subtitulo: string;
  badgeStatus?: string;
  children: React.ReactNode;
}

export function ContenedorVista({ titulo, subtitulo, badgeStatus, children }: ContenedorVistaProps) {
  return (
    <div className="h-[calc(100vh-80px)] flex flex-col font-sans antialiased text-slate-700 space-y-4 overflow-hidden animate-fade-in">
      {/* Encabezado Unificado */}
      <HeaderVista titulo={titulo} subtitulo={subtitulo} badgeStatus={badgeStatus} />
      
      {/* Zona de Trabajo Única */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}