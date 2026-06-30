'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ContenedorVista } from '@/components/ContenedorVista';

export default function PaginaAlertas() {
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const cargarAlertasCriticas = async () => {
    try {
      setLoading(true);
      // Filtramos directamente desde la vista los activos con estado comprometido
      const { data } = await supabase
        .from('vista_activos_completa')
        .select('*')
        .or('nombre_estado.ilike.%falla%,nombre_estado.ilike.%mantenimiento%');

      if (data) setAlertas(data);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarAlertasCriticas();
  }, []);

  return (
    <ContenedorVista titulo="🔔 Panel de Alertas TI y Notificaciones" subtitulo="Detección automática de hardware en estado crítico o con incidencias técnicas pendientes.">
      {loading ? (
        <div className="text-center py-10 font-bold text-slate-400">Analizando registros de hardware...</div>
      ) : alertas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alertas.map((a) => (
            <div key={a.activo_id} className="bg-white border border-rose-100 rounded-xl p-4 shadow-xs flex items-start gap-3 border-l-4 border-l-rose-600">
              <span className="text-xl">⚠️</span>
              <div className="flex-1 text-xs font-semibold">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-black text-slate-900 text-sm">Serie: {a.serial_id}</span>
                  <span className="px-2 py-0.5 rounded text-[9px] font-black text-white uppercase" style={{ backgroundColor: a.color_alerta || '#dc2626' }}>
                    {a.nombre_estado}
                  </span>
                </div>
                <p className="text-slate-500 mb-2">🏷️ {a.categoria} {a.marca} — {a.modelo}</p>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px]">
                  <span className="text-slate-400 block font-bold uppercase text-[9px]">Custodio / Ubicación:</span>
                  <span className="text-slate-700 font-bold">👤 {a.nombre_completo || 'Almacén Central'}</span>
                  <span className="text-slate-400 mx-1">|</span>
                  <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 font-black rounded text-[9px]">{a.nombre_area || 'TI'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center text-emerald-800 font-bold text-xs">
          ✅ ¡Excelente! No se registran alertas de hardware críticas ni anomalías en los activos de Posgrado.
        </div>
      )}
    </ContenedorVista>
  );
}