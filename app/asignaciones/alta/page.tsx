'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ContenedorVista } from '@/components/ContenedorVista';
import { TablaControl } from '@/components/TablaControl';

export default function AsignacionExpress() {
  const [loading, setLoading] = useState(false);
  const [loadingCustodia, setLoadingCustodia] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Estados base
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [activosDisponibles, setActivosDisponibles] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);

  // Custodia focus
  const [usuarioFocus, setUsuarioFocus] = useState<any | null>(null);
  const [equiposCustodia, setEquiposCustodia] = useState<any[]>([]);

  // Filtros unificados sugeridos por Jonathan
  const [areaFiltroId, setAreaFiltroId] = useState('Todos');
  const [busquedaPredictivaUsr, setBusquedaPredictivaUsr] = useState('');

  // Filtros embebidos de la tabla Almacén
  const [busquedaHw, setBusquedaHw] = useState('');
  const [catHw, setCatHw] = useState('Todos');

  const [alerta, setAlerta] = useState<string | null>(null);

  const lanzarAlerta = (msg: string) => {
    setAlerta(msg);
    setTimeout(() => setAlerta(null), 3000);
  };

  const cargarInformacionBase = async () => {
    try {
      setLoading(true);
      const [rUsr, rAct, rArea, rCat] = await Promise.all([
        supabase.from('usuarios').select('*, areas(*), cargos(*)').order('nombre_completo'),
        supabase.from('vista_activos_completa').select('*').eq('estado_actual', 'Disponible en Almacén TI'),
        supabase.from('areas').select('*').order('nombre_area'),
        supabase.from('categorias_activo').select('*').order('nombre_categoria')
      ]);

      if (rUsr.data) setUsuarios(rUsr.data);
      if (rArea.data) setAreas(rArea.data);
      if (rCat.data) setCategorias(rCat.data);

      // 🛠️ MAPEADO BLINDADO: Forzamos a que tanto id como activo_id existan en el objeto
      if (rAct.data) {
        setActivosDisponibles(rAct.data.map(i => ({
          ...i,
          id: i.activo_id || i.id,
          activo_id: i.activo_id || i.id
        })));
      }
    } catch (err: any) {
      lanzarAlerta(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarInformacionBase();
  }, []);

  const cargarCustodiaPersona = async (userId: number) => {
    try {
      setLoadingCustodia(true);
      const { data, error } = await supabase
        .from('vista_activos_completa')
        .select('*')
        .eq('asignado_usuario_id', userId) // 👈 Ahora sí va a existir
        .neq('estado_actual', 'Dado de Baja');

      console.log("Datos brutos devueltos por la vista:", data);

      setEquiposCustodia((data || []).map(i => ({ 
        ...i, 
        id: i.activo_id || i.id 
      })));
    } catch (err: any) {
      lanzarAlerta(`❌ Error: ${err.message}`);
    } finally {
      setLoadingCustodia(false);
    }
  };

  const ejecutarAsignacion = async (activoId: number) => {
    if (!usuarioFocus) return lanzarAlerta("⚠️ Fije un beneficiario primero.");
    try {
      setGuardando(true);
      await supabase.from('asignaciones').insert([{ activo_id: activoId, usuario_id: usuarioFocus.id, estado_asignacion: 'Activo', text_asignacion: 'Asignacion Express' }]);
      await supabase.from('activos').update({ estado_actual: 'Asignado', asignado_usuario_id: usuarioFocus.id }).eq('id', activoId);

      lanzarAlerta("✅ Dispositivo asignado correctamente.");
      await cargarInformacionBase();
      await cargarCustodiaPersona(usuarioFocus.id);
    } catch (err: any) { lanzarAlerta(`❌ Error: ${err.message}`); } finally { setGuardando(false); }
  };

  const ejecutarLiberacion = async (activoId: number) => {
    if (!usuarioFocus) return;
    try {
      setGuardando(true);
      await supabase.from('asignaciones').update({ fecha_devolucion: new Date().toISOString(), estado_asignacion: 'Devuelto' }).eq('activo_id', activoId).eq('usuario_id', usuarioFocus.id).eq('estado_asignacion', 'Activo');
      await supabase.from('activos').update({ estado_actual: 'Disponible en Almacén TI', asignado_usuario_id: null }).eq('id', activoId);

      lanzarAlerta("🔄 Activo devuelto al stock.");
      await cargarInformacionBase();
      await cargarCustodiaPersona(usuarioFocus.id);
    } catch (err: any) { lanzarAlerta(`❌ Error: ${err.message}`); } finally { setGuardando(false); }
  };

  // 🔍 FILTRADO INTELIGENTE PREDICTIVO DEL SELECTOR SUPERIOR
  const colaboradoresFiltrados = usuarios.filter(u => {
    const coincideArea = areaFiltroId === 'Todos' || String(u.area_id) === areaFiltroId;
    const term = busquedaPredictivaUsr.toLowerCase().trim();
    const coincideTexto = !term || String(u.nombre_completo).toLowerCase().includes(term) || String(u.dni).includes(term);
    return coincideArea && coincideTexto;
  });

  // Filtrado de la tabla Almacén
  const activosFiltrados = activosDisponibles.filter(a => {
    const term = busquedaHw.toLowerCase().trim();
    return (catHw === 'Todos' || String(a.categoria) === catHw) &&
      (!term || String(a.serial_id).toLowerCase().includes(term) || String(a.marca).toLowerCase().includes(term) || String(a.modelo).toLowerCase().includes(term) || String(a.caf).toLowerCase().includes(term));
  });

  return (
    <ContenedorVista
      titulo="📥 Módulo de Asignación Express"
      subtitulo="Asigne equipamiento disponible de TI o retire responsabilidades de custodia física de inmediato."
      badgeStatus="online"
    >
      {alerta && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xl">
          {alerta}
        </div>
      )}

      <div className="flex flex-col h-full space-y-3 overflow-hidden">

        {/* CRITERIO DE BUSQUEDA PREMIUM FLUIDO (Sugerido por Jonathan) */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex-shrink-0 flex flex-col sm:flex-row items-center gap-3 text-xs">
          <div className="w-full sm:w-1/4 flex flex-col space-y-1">
            <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Filtrar por Área:</span>
            <select
              value={areaFiltroId}
              onChange={(e) => { setAreaFiltroId(e.target.value); setUsuarioFocus(null); setEquiposCustodia([]); }}
              className="p-2 border border-slate-200 font-bold text-slate-700 bg-slate-50 focus:bg-white rounded-lg outline-none cursor-pointer transition-all w-full"
            >
              <option value="Todos">Todas las Áreas de la Universidad</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.nombre_area}</option>)}
            </select>
          </div>

          <div className="w-full sm:w-3/4 flex flex-col space-y-1">
            <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Escribe Nombre o DNI para Fijar Colaborador:</span>
            <select
              value={usuarioFocus?.id || ''}
              onChange={(e) => {
                const u = usuarios.find(usr => usr.id === Number(e.target.value));
                setUsuarioFocus(u || null);
                if (u) cargarCustodiaPersona(u.id); else setEquiposCustodia([]);
              }}
              className="w-full p-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-lg font-black text-slate-800 outline-none cursor-pointer transition-all"
            >
              <option value="">{colaboradoresFiltrados.length === 0 ? "⚠️ NO SE ENCONTRARON COLABORADORES EN ESTA ÁREA" : "🔍 ESCRIBE O SELECCIONA AQUÍ..."}</option>
              {colaboradoresFiltrados.map(u => (
                <option key={u.id} value={u.id}>{u.nombre_completo} (🪪 DNI: {u.dni || 'S/D'})</option>
              ))}
            </select>
          </div>
        </div>

        {/* CONTENEDOR EN ESPEJO SIMÉTRICO DE DOS TABLAS */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 flex-1 overflow-hidden h-full items-stretch">

          {/* COLUMNA 1 & 2: LA CUSTODIA CON SORT */}
          <div className="xl:col-span-2 h-full min-h-0">
            <TablaControl
              tituloSeccion={usuarioFocus ? `Custodia de ${usuarioFocus.nombre_completo.split(' ')[0]}` : "Custodia Actual"}
              badgeCount={usuarioFocus ? equiposCustodia.length : 0}
              data={usuarioFocus ? equiposCustodia : []}
              loading={loadingCustodia}
              msgVacio={usuarioFocus ? "Este colaborador no registra bienes bajo su nombre." : "Fije un colaborador en la barra de arriba para auditar su stock."}
              columnas={[
                {
                  header: "Categoría / Hardware",
                  field: "categoria", // Habilita Sort al hacer clic
                  render: (eq: any) => (
                    <div>
                      <div className="font-bold text-slate-900">[{eq.categoria}] {eq.marca}</div>
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5">S/N: <b className="text-slate-600">{eq.serial_id}</b></div>
                    </div>
                  )
                },
                {
                  header: "Patrimonio CAF",
                  field: "caf", // Habilita Sort
                  render: (eq: any) => <code className="bg-slate-100 border px-1.5 py-0.5 rounded font-mono font-bold text-slate-700 text-[10px]">{eq.caf || '—'}</code>
                },
                {
                  header: "Operación",
                  className: "text-right w-16",
                  render: (eq: any) => (
                    <button type="button" onClick={() => ejecutarLiberacion(eq.id)} disabled={guardando} className="px-2 py-0.5 text-red-600 hover:bg-red-50 border border-red-100 font-bold rounded-md text-[10px] transition-all active:scale-95">
                      Quitar
                    </button>
                  )
                }
              ]}
            />
          </div>

          {/* COLUMNA 3, 4 & 5: EL ALMACÉN TI CON FILTROS INTERNOS Y SORT */}
          <div className="xl:col-span-3 h-full min-h-0">
            <TablaControl
              tituloSeccion="Inventario Disponible en Almacén TI"
              badgeCount={activosFiltrados.length}
              data={activosFiltrados}
              loading={loading}
              columnas={[
                {
                  header: "Categoría / Modelo",
                  field: "categoria", // Habilita Sort al hacer clic
                  render: (a: any) => (
                    <div>
                      <span className="font-black text-blue-900">[{a.categoria}]</span>
                      <span className="text-slate-800 ml-1.5 font-bold">{a.marca} {a.modelo}</span>
                    </div>
                  )
                },
                {
                  header: "Número de Serie",
                  field: "serial_id", // Habilita Sort
                  render: (a: any) => <code className="bg-slate-50 border px-1.5 py-0.5 rounded font-mono font-bold text-slate-600 text-[10px]">{a.serial_id}</code>
                },
                {
                  header: "Código CAF",
                  field: "caf", // Habilita Sort
                  render: (a: any) => <span className="font-mono font-bold text-slate-500 text-[10px]">{a.caf || '—'}</span>
                },
                {
                  header: "Acción",
                  className: "text-right w-20",
                  render: (a: any) => (
                    <button
                      type="button"
                      onClick={() => ejecutarAsignacion(a.id)}
                      disabled={guardando || !usuarioFocus}
                      className="px-2.5 py-1 text-white text-[10px] font-bold rounded-lg shadow disabled:opacity-30 transition-all active:scale-95"
                      style={{ backgroundColor: 'rgb(1, 71, 118)' }}
                    >
                      Asignar
                    </button>
                  )
                }
              ]}
            >
              {/* Filtros horizontales acoplados estrictamente dentro del Almacén */}
              <input
                type="text"
                value={busquedaHw}
                onChange={(e) => setBusquedaHw(e.target.value)}
                placeholder="Buscar por S/N o marca..."
                className="p-1.5 text-[11px] font-medium border rounded-md bg-white outline-none w-44 focus:ring-1 focus:ring-blue-800 transition-all"
              />
              <select
                value={catHw}
                onChange={(e) => setCatHw(e.target.value)}
                className="p-1.5 border rounded-md bg-white text-[11px] font-bold text-slate-600 outline-none w-36 cursor-pointer"
              >
                <option value="Todos">Todas las Familias</option>
                {categorias.map(c => <option key={c.id} value={c.nombre_categoria}>{c.nombre_categoria}</option>)}
              </select>
            </TablaControl>
          </div>

        </div>

      </div>
    </ContenedorVista>
  );
}