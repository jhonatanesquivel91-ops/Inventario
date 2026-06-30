'use client';

import React from 'react';

interface FiltroSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function FiltroSelect({ value, onChange, options }: FiltroSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-[34px] px-3 border border-slate-200 rounded-xl text-[11px] font-black text-slate-700 bg-white outline-none cursor-pointer shadow-sm hover:border-slate-300 focus:border-blue-700 focus:ring-1 focus:ring-blue-800 transition-all"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}