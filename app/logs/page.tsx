'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { ContenedorVista } from '@/components/ContenedorVista';
import { TablaControl } from '@/components/TablaControl';

export default function PaginaLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState('');

  const cargarLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('logs_sistema')
        .select('*')
        .order('fecha_registro', { ascending: false });

      if (!error && data) setLogs(data);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarLogs();
  }, []);

  const logsFiltrados = useMemo(() => {
    return logs.filter(l => 
      String(l.usuario || '').toLowerCase().includes(filtro.toLowerCase()) ||
      String(l.accion || '').toLowerCase().includes(filtro.toLowerCase()) ||
      String(l.detalles || '').toLowerCase().includes(filtro.toLowerCase()) ||
      String(l.modulo || '').toLowerCase().includes(filtro.toLowerCase())
    );
  }, [logs, filtro]);

  const columnasConfig = [
    {
      header: "Fecha y Hora",
      field: "fecha_registro",
      render: (item: any) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-700 text-[11px]">{new Date(item.fecha_registro).toLocaleDateString('es-PE')}</span>
          <span className="font-mono text-[10px] text-slate-400">{new Date(item.fecha_registro).toLocaleTimeString('es-PE')}</span>
        </div>
      )
    },
    {
      header: "Usuario",
      field: "usuario",
      render: (item: any) => <span className="font-black text-slate-800">👤 {item.usuario || 'Sistema'}</span>
    },
    {
      header: "Módulo / Origen",
      field: "modulo",
      render: (item: any) => (
        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase tracking-wider border">
          💻 {item.modulo || 'GENERAL'}
        </span>
      )
    },
    {
      header: "Acción",
      field: "accion",
      render: (item: any) => <span className="font-extrabold text-blue-700 uppercase text-[11px]">{item.accion}</span>
    },
    {
      header: "Severidad",
      field: "severidad",
      render: (item: any) => {
        const esCritico = item.severidad?.toUpperCase() === 'CRITICAL';
        const esWarning = item.severidad?.toUpperCase() === 'WARNING';
        return (
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight ${
            esCritico ? 'bg-rose-100 text-rose-700 border border-rose-200' : 
            esWarning ? 'bg-amber-100 text-amber-700 border border-amber-200' : 
            'bg-emerald-100 text-emerald-700 border border-emerald-200'
          }`}>
            {item.severidad || 'INFO'}
          </span>
        );
      }
    },
    {
      header: "Detalles Técnicos de la Operación",
      field: "detalles",
      render: (item: any) => <p className="text-slate-600 font-medium max-w-md break-words">{item.detalles}</p>
    }
  ];

  return (
    <ContenedorVista titulo="📋 Registro Avanzado de Auditoría Interna" subtitulo="Control estricto de transacciones de hardware. Historial limitado dinámicamente a los últimos 300 eventos clave.">
      <div className="h-full flex flex-col space-y-3 overflow-hidden">
        <div className="bg-white border p-3 rounded-xl shadow-xs flex justify-between items-center">
          <input 
            type="text" 
            value={filtro} 
            onChange={(e) => setFiltro(e.target.value)} 
            placeholder="Buscar por operador, acción, módulo o detalle..." 
            className="w-full md:w-1/3 p-2 border border-slate-200 bg-slate-50 rounded-lg text-xs outline-none font-bold"
          />
          <span className="text-[10px] font-bold text-slate-400 uppercase">Capacidad Máxima: 300 registros FIFO</span>
        </div>
        <div className="flex-1 flex flex-col bg-white rounded-xl border overflow-hidden">
          <TablaControl tituloSeccion="Trazabilidad de Consola" badgeCount={logsFiltrados.length} data={logsFiltrados} loading={loading} columnas={columnasConfig} />
        </div>
      </div>
    </ContenedorVista>
  );
}