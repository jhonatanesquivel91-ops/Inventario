'use client';

import React from 'react';

interface BuscadorControlProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function BuscadorControl({ value, onChange, placeholder }: BuscadorControlProps) {
  return (
    <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-2 flex-shrink-0 shadow-sm transition-all focus-within:border-blue-700 focus-within:ring-1 focus-within:ring-blue-800">
      {/* Icono de Lupa Estilizado */}
      <span className="text-slate-400 text-xs pl-1.5 select-none">🔍</span>
      
      <input 
        type="text" 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        placeholder={placeholder} 
        className="w-full bg-transparent text-slate-900 font-bold text-xs placeholder-slate-400 outline-none border-none py-0.5" 
      />
    </div>
  );
}