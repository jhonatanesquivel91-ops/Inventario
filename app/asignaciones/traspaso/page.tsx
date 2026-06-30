'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ContenedorVista } from '@/components/ContenedorVista';
import { TablaControl } from '@/components/TablaControl';

export default function TransferenciasEspejo() {
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Cátalogo base
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  
  // Equipos cargados en tiempo real
  const [equiposPersonaA, setEquiposPersonaA] = useState<any[]>([]);
  const [equiposPersonaB, setEquiposPersonaB] = useState<any[]>([]);

  // Cuentas fijadas en el eje
  const [usuarioA, setUsuarioA] = useState<any | null>(null);
  const [usuarioB, setUsuarioB] = useState<any | null>(null);

  // Checkboxes de lote
  const [marcadosA, setMarcadosA] = useState<number[]>([]);
  const [marcadosB, setMarcadosB] = useState<number[]>([]);

  // 1. FILTROS INDEPENDIENTES REQUERIDOS POR JONATHAN
  const [areaFiltroA, setAreaFiltroA] = useState('Todos');
  const [areaFiltroB, setAreaFiltroB] = useState('Todos');

  const [alerta, setAlerta] = useState<string | null>(null);

  const lanzarAlerta = (msg: string) => {
    setAlerta(msg);
    setTimeout(() => setAlerta(null), 3000);
  };

  const cargarDatosEjes = async () => {
    try {
      setLoading(true);
      const [rUsr, rArea] = await Promise.all([
        supabase.from('usuarios').select('*, areas(*), cargos(*)').order('nombre_completo'),
        supabase.from('areas').select('*').order('nombre_area')
      ]);

      if (rUsr.data) setUsuarios(rUsr.data);
      if (rArea.data) setAreas(rArea.data);
    } catch (err: any) {
      lanzarAlerta(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatosEjes();
  }, []);

  const cargarEquiposPersona = async (userId: number, tipo: 'A' | 'B') => {
    const { data } = await supabase.from('vista_activos_completa').select('*').eq('usuario_id', userId).neq('estado_actual', 'Dado de Baja');
    const normalizados = (data || []).map(item => ({ ...item, id: item.activo_id }));
    if (tipo === 'A') setEquiposPersonaA(normalizados); else setEquiposPersonaB(normalizados);
  };

  // Lógica de Traspaso (Masivo o Individual)
  const ejecutarTraspaso = async (idsA_Transferir: number[], deA_haciaB: boolean) => {
    const emisor = deA_haciaB ? usuarioA : usuarioB;
    const receptor = deA_haciaB ? usuarioB : usuarioA;

    if (!emisor || !receptor || idsA_Transferir.length === 0) return;
    try {
      setGuardando(true);
      for (const activoId of idsA_Transferir) {
        await supabase.from('asignaciones').update({ fecha_devolucion: new Date().toISOString(), estado_asignacion: 'Devuelto' }).eq('activo_id', activoId).eq('usuario_id', emisor.id).eq('estado_asignacion', 'Activo');
        await supabase.from('asignaciones').insert([{ activo_id: activoId, usuario_id: receptor.id, estado_asignacion: 'Activo' }]);
        await supabase.from('activos').update({ asignado_usuario_id: receptor.id }).eq('id', activoId);
      }
      
      if (deA_haciaB) {
        setMarcadosA(prev => prev.filter(id => !idsA_Transferir.includes(id)));
      } else {
        setMarcadosB(prev => prev.filter(id => !idsA_Transferir.includes(id)));
      }
      
      lanzarAlerta("✅ Custodia transferida exitosamente.");
      await cargarEquiposPersona(usuarioA.id, 'A'); 
      await cargarEquiposPersona(usuarioB.id, 'B');
    } catch (err: any) { lanzarAlerta(`❌ Error: ${err.message}`); } finally { setGuardando(false); }
  };

  const ejecutarLiberacionDirecta = async (activoId: number, tipo: 'A' | 'B') => {
    const usuario = tipo === 'A' ? usuarioA : usuarioB;
    try {
      setGuardando(true);
      await supabase.from('asignaciones').update({ fecha_devolucion: new Date().toISOString(), estado_asignacion: 'Devuelto' }).eq('activo_id', activoId).eq('usuario_id', usuario.id).eq('estado_asignacion', 'Activo');
      await supabase.from('activos').update({ estado_actual: 'Disponible en Almacén TI', asignado_usuario_id: null }).eq('id', activoId);
      
      lanzarAlerta("🔄 Bien liberado al Stock Central de TI.");
      if (tipo === 'A') setMarcadosA(prev => prev.filter(id => id !== activoId));
      else setMarcadosB(prev => prev.filter(id => id !== activoId));
      
      await cargarEquiposPersona(usuario.id, tipo);
    } catch (err: any) { lanzarAlerta(`❌ Error: ${err.message}`); } finally { setGuardando(false); }
  };

  // --- SELECT ALL LOGIC ---
  const handleSelectAll = (tipo: 'A' | 'B', checked: boolean) => {
    if (tipo === 'A') {
      setMarcadosA(checked ? equiposPersonaA.map(e => e.id) : []);
    } else {
      setMarcadosB(checked ? equiposPersonaB.map(e => e.id) : []);
    }
  };

  // Filtrados predictivos independientes por lado
  const filtradosUsrA = usuarios.filter(u => areaFiltroA === 'Todos' || String(u.area_id) === areaFiltroA);
  const filtradosUsrB = usuarios.filter(u => areaFiltroB === 'Todos' || String(u.area_id) === areaFiltroB);

  return (
    <ContenedorVista
      titulo="🔄 Matriz de Transferencias Espejo"
      subtitulo="Intercambio cruzado de responsabilidades de hardware entre personal de la universidad sin retornar a almacén."
      badgeStatus="online"
    >
      {alerta && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xl">
          {alerta}
        </div>
      )}

      <div className="flex flex-col h-full space-y-3 overflow-hidden">
        
        {/* PANEL DE CONFIGURACIÓN DE EJES CON FILTROS INDEPENDIENTES (HORIZONTAL) */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex-shrink-0 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          
          {/* CONTROL DE SELECCIÓN LADO A */}
          <div className="flex items-center gap-2 w-full">
            <select
              value={areaFiltroA}
              onChange={(e) => { setAreaFiltroA(e.target.value); setUsuarioA(null); setEquiposPersonaA([]); setMarcadosA([]); }}
              className="p-2 border border-slate-200 font-bold text-slate-600 bg-slate-50 focus:bg-white rounded-lg outline-none cursor-pointer w-1/3"
            >
              <option value="Todos">Área A (Todas)</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.nombre_area}</option>)}
            </select>
            <select
              value={usuarioA?.id || ''}
              onChange={(e) => {
                const u = usuarios.find(usr => usr.id === Number(e.target.value));
                setUsuarioA(u || null);
                if (u) cargarEquiposPersona(u.id, 'A'); else setEquiposPersonaA([]);
                setMarcadosA([]);
              }}
              className="p-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-lg font-black text-xs text-slate-800 outline-none cursor-pointer flex-1"
            >
              <option value="">🔍 Seleccionar colaborador del lado A...</option>
              {filtradosUsrA.map(u => (
                <option key={u.id} value={u.id}>{u.nombre_completo}</option>
              ))}
            </select>
          </div>

          {/* CONTROL DE SELECCIÓN LADO B */}
          <div className="flex items-center gap-2 w-full">
            <select
              value={areaFiltroB}
              onChange={(e) => { setAreaFiltroB(e.target.value); setUsuarioB(null); setEquiposPersonaB([]); setMarcadosB([]); }}
              className="p-2 border border-slate-200 font-bold text-slate-600 bg-slate-50 focus:bg-white rounded-lg outline-none cursor-pointer w-1/3"
            >
              <option value="Todos">Área B (Todas)</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.nombre_area}</option>)}
            </select>
            <select
              value={usuarioB?.id || ''}
              onChange={(e) => {
                const u = usuarios.find(usr => usr.id === Number(e.target.value));
                setUsuarioB(u || null);
                if (u) cargarEquiposPersona(u.id, 'B'); else setEquiposPersonaB([]);
                setMarcadosB([]);
              }}
              className="p-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-lg font-black text-xs text-slate-800 outline-none cursor-pointer flex-1"
            >
              <option value="">🔍 Seleccionar colaborador del lado B...</option>
              {filtradosUsrB.map(u => (
                <option key={u.id} value={u.id}>{u.nombre_completo}</option>
              ))}
            </select>
          </div>
        </div>

        {/* REJILLA COMPARTIDA EN ESPEJO SIMÉTRICO */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 overflow-hidden h-full items-stretch">
          
          {/* ESPEJO LADO A */}
          <div className="h-full min-h-0 flex flex-col justify-between">
            <div className="flex-1 min-h-0">
              <TablaControl
                tituloSeccion={usuarioA ? `Custodia de: ${usuarioA.nombre_completo.split(' ')[0]}` : "Eje Custodia A"}
                badgeCount={usuarioA ? equiposPersonaA.length : 0}
                data={usuarioA ? equiposPersonaA : []}
                loading={loading}
                msgVacio={usuarioA ? "Sin equipos bajo cargo corporativo." : "Fije un colaborador en el Lado A superior."}
                columnas={[
                  {
                    header: "✓",
                    className: "w-10 text-center",
                    render: (eq: any) => (
                      <input 
                        type="checkbox" 
                        checked={marcadosA.includes(eq.id)} 
                        onChange={() => setMarcadosA(prev => prev.includes(eq.id) ? prev.filter(i => i !== eq.id) : [...prev, eq.id])} 
                        className="w-3.5 h-3.5 accent-blue-800 cursor-pointer" 
                      />
                    )
                  },
                  {
                    header: "Bienes en Posesión",
                    field: "categoria",
                    render: (eq: any) => (
                      <div>
                        <div className="font-bold text-slate-900">[{eq.categoria}] {eq.marca}</div>
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5">S/N: <b className="text-slate-600">{eq.serial_id}</b></div>
                      </div>
                    )
                  },
                  {
                    header: "Patrimonio CAF",
                    field: "caf",
                    render: (eq: any) => <code className="bg-slate-50 border px-1.5 py-0.5 rounded font-mono font-bold text-slate-600 text-[10px]">{eq.caf || '—'}</code>
                  },
                  {
                    header: "Acciones",
                    className: "text-right w-28",
                    render: (eq: any) => (
                      <div className="flex gap-1 justify-end">
                        <button type="button" onClick={() => ejecutarTraspaso([eq.id], true)} disabled={guardando || !usuarioB} className="px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded text-[10px] font-bold border border-blue-100 transition-all active:scale-95 disabled:opacity-30">
                          Traspasar
                        </button>
                        <button type="button" onClick={() => ejecutarLiberacionDirecta(eq.id, 'A')} disabled={guardando} className="px-1.5 py-0.5 text-red-600 hover:bg-red-50 border border-red-100 font-bold rounded text-[10px] transition-all">
                          Liberar
                        </button>
                      </div>
                    )
                  }
                ]}
              >
                {/* 🔳 SELECT ALL INCUSTADO EN LA BARRA DE LA TABLA A */}
                {usuarioA && equiposPersonaA.length > 0 && (
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-white px-2 py-1 rounded-md border cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={equiposPersonaA.length > 0 && marcadosA.length === equiposPersonaA.length}
                      onChange={(e) => handleSelectAll('A', e.target.checked)}
                      className="w-3.5 h-3.5 accent-blue-800" 
                    />
                    <span>Marcar Todos</span>
                  </label>
                )}
              </TablaControl>
            </div>
            {marcadosA.length > 0 && usuarioB && (
              <button type="button" onClick={() => ejecutarTraspaso(marcadosA, true)} disabled={guardando} className="w-full py-2.5 mt-2 bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs uppercase rounded-xl tracking-wider shadow transition-all active:scale-95" style={{ backgroundColor: 'rgb(1, 71, 118)' }}>
                Transferir bloque marcado hacia Lado B ➔ ({marcadosA.length})
              </button>
            )}
          </div>

          {/* ESPEJO LADO B */}
          <div className="h-full min-h-0 flex flex-col justify-between">
            <div className="flex-1 min-h-0">
              <TablaControl
                tituloSeccion={usuarioB ? `Custodia de: ${usuarioB.nombre_completo.split(' ')[0]}` : "Eje Custodia B"}
                badgeCount={usuarioB ? equiposPersonaB.length : 0}
                data={usuarioB ? equiposPersonaB : []}
                loading={loading}
                msgVacio={usuarioB ? "Sin equipos bajo cargo corporativo." : "Fije un colaborador en el Lado B superior."}
                columnas={[
                  {
                    header: "✓",
                    className: "w-10 text-center",
                    render: (eq: any) => (
                      <input 
                        type="checkbox" 
                        checked={marcadosB.includes(eq.id)} 
                        onChange={() => setMarcadosB(prev => prev.includes(eq.id) ? prev.filter(i => i !== eq.id) : [...prev, eq.id])} 
                        className="w-3.5 h-3.5 accent-blue-800 cursor-pointer" 
                      />
                    )
                  },
                  {
                    header: "Bienes en Posesión",
                    field: "categoria",
                    render: (eq: any) => (
                      <div>
                        <div className="font-bold text-slate-900">[{eq.categoria}] {eq.marca}</div>
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5">S/N: <b className="text-slate-600">{eq.serial_id}</b></div>
                      </div>
                    )
                  },
                  {
                    header: "Patrimonio CAF",
                    field: "caf",
                    render: (eq: any) => <code className="bg-slate-50 border px-1.5 py-0.5 rounded font-mono font-bold text-slate-600 text-[10px]">{eq.caf || '—'}</code>
                  },
                  {
                    header: "Acciones",
                    className: "text-right w-28",
                    render: (eq: any) => (
                      <div className="flex gap-1 justify-end">
                        <button type="button" onClick={() => ejecutarTraspaso([eq.id], false)} disabled={guardando || !usuarioA} className="px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded text-[10px] font-bold border border-blue-100 transition-all active:scale-95 disabled:opacity-30">
                          Traspasar
                        </button>
                        <button type="button" onClick={() => ejecutarLiberacionDirecta(eq.id, 'B')} disabled={guardando} className="px-1.5 py-0.5 text-red-600 hover:bg-red-50 border border-red-100 font-bold rounded text-[10px] transition-all">
                          Liberar
                        </button>
                      </div>
                    )
                  }
                ]}
              >
                {/* 🔳 SELECT ALL INCRUSTADO EN LA BARRA DE LA TABLA B (CORREGIDO) */}
                {usuarioB && equiposPersonaB.length > 0 && (
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-white px-2 py-1 rounded-md border cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={equiposPersonaB.length > 0 && marcadosB.length === equiposPersonaB.length}
                      onChange={(e) => handleSelectAll('B', e.target.checked)}
                      className="w-3.5 h-3.5 accent-blue-800" 
                    />
                    <span>Marcar Todos</span>
                  </label>
                )}
              </TablaControl>
            </div>
            {marcadosB.length > 0 && usuarioA && (
              <button type="button" onClick={() => ejecutarTraspaso(marcadosB, false)} disabled={guardando} className="w-full py-2.5 mt-2 bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs uppercase rounded-xl tracking-wider shadow transition-all active:scale-95" style={{ backgroundColor: 'rgb(1, 71, 118)' }}>
                ◀ Transferir bloque marcado hacia Lado A ({marcadosB.length})
              </button>
            )}
          </div>

        </div>

      </div>
    </ContenedorVista>
  );
}