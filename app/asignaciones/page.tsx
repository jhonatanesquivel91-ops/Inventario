'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function PaginaAsignaciones() {
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // --- ARREGLOS DE DATOS ---
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [activosDisponibles, setActivosDisponibles] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [cargos, setCargos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  
  const [equiposPersonaA, setEquiposPersonaA] = useState<any[]>([]);
  const [equiposPersonaB, setEquiposPersonaB] = useState<any[]>([]);

  // --- SELECCIONES FOCALES ---
  const [usuarioA, setUsuarioA] = useState<any | null>(null);
  const [usuarioB, setUsuarioB] = useState<any | null>(null);

  // --- CHECKBOXES DE SELECCIÓN ---
  const [marcadosA, setMarcadosA] = useState<number[]>([]);
  const [marcadosB, setMarcadosB] = useState<number[]>([]);
  const [activosAlmacenMarcados, setActivosAlmacenMarcados] = useState<number[]>([]);

  // --- FILTROS ---
  const [busquedaUsuario, setBusquedaUsuario] = useState('');
  const [filtroAreaUsuario, setFiltroAreaUsuario] = useState('Todos');
  const [filtroCargoUsuario, setFiltroCargoUsuario] = useState('Todos');
  const [busquedaHardware, setBusquedaHardware] = useState('');
  const [filtroCategoriaAlmacen, setFiltroCategoriaAlmacen] = useState('Todos');
  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(15);

  const cargarDatosIniciales = async () => {
    try {
      setLoading(true);
      const [rUsr, rAct, rArea, rCargo, rCat] = await Promise.all([
        supabase.from('usuarios').select('*, areas(*), cargos(*)').order('nombre_completo'),
        supabase.from('vista_activos_completa').select('*').eq('estado_actual', 'Disponible en Almacén TI'),
        supabase.from('areas').select('*').order('nombre_area'),
        supabase.from('cargos').select('*').order('nombre_cargo'),
        supabase.from('categorias_activo').select('*').order('nombre_categoria')
      ]);

      if (rUsr.data) setUsuarios(rUsr.data);
      if (rArea.data) setAreas(rArea.data);
      if (rCargo.data) setCargos(rCargo.data);
      if (rCat.data) setCategorias(rCat.data);
      if (rAct.data) {
        setActivosDisponibles(rAct.data.map(item => ({ ...item, id: item.activo_id })));
      }
    } catch (err: any) { 
      console.error("Error cargando datos:", err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  const cargarEquiposPersona = async (userId: number, tipo: 'A' | 'B') => {
    const { data } = await supabase.from('vista_activos_completa').select('*').eq('usuario_id', userId).neq('estado_actual', 'Dado de Baja');
    const normalizados = (data || []).map(item => ({ ...item, id: item.activo_id }));
    if (tipo === 'A') setEquiposPersonaA(normalizados); else setEquiposPersonaB(normalizados);
  };

  // --- FUNCIONES DE ACCIÓN ---
  const transferirDeAhaciaB = async () => {
    if (!usuarioA || !usuarioB || marcadosA.length === 0) return;
    setGuardando(true);
    for (const activoId of marcadosA) {
      await supabase.from('asignaciones').update({ fecha_devolucion: new Date().toISOString(), estado_asignacion: 'Devuelto' }).eq('activo_id', activoId).eq('usuario_id', usuarioA.id).eq('estado_asignacion', 'Activo');
      await supabase.from('asignaciones').insert([{ activo_id: activoId, usuario_id: usuarioB.id, estado_asignacion: 'Activo' }]);
      await supabase.from('activos').update({ asignado_usuario_id: usuarioB.id }).eq('id', activoId);
    }
    setMarcadosA([]); await cargarEquiposPersona(usuarioA.id, 'A'); await cargarEquiposPersona(usuarioB.id, 'B'); setGuardando(false);
  };

  const transferirDeBhaciaA = async () => {
    if (!usuarioA || !usuarioB || marcadosB.length === 0) return;
    setGuardando(true);
    for (const activoId of marcadosB) {
      await supabase.from('asignaciones').update({ fecha_devolucion: new Date().toISOString(), estado_asignacion: 'Devuelto' }).eq('activo_id', activoId).eq('usuario_id', usuarioB.id).eq('estado_asignacion', 'Activo');
      await supabase.from('asignaciones').insert([{ activo_id: activoId, usuario_id: usuarioA.id, estado_asignacion: 'Activo' }]);
      await supabase.from('activos').update({ asignado_usuario_id: usuarioA.id }).eq('id', activoId);
    }
    setMarcadosB([]); await cargarEquiposPersona(usuarioA.id, 'A'); await cargarEquiposPersona(usuarioB.id, 'B'); setGuardando(false);
  };

  const devolverAPotestadTI = async (tipo: 'A' | 'B') => {
    const usuario = tipo === 'A' ? usuarioA : usuarioB;
    const marcados = tipo === 'A' ? marcadosA : marcadosB;
    if (!confirm('¿Devolver activos a TI?')) return;
    setGuardando(true);
    for (const activoId of marcados) {
      await supabase.from('asignaciones').update({ fecha_devolucion: new Date().toISOString(), estado_asignacion: 'Devuelto' }).eq('activo_id', activoId).eq('usuario_id', usuario.id).eq('estado_asignacion', 'Activo');
      await supabase.from('activos').update({ estado_actual: 'Disponible en Almacén TI', asignado_usuario_id: null }).eq('id', activoId);
    }
    if (tipo === 'A') setMarcadosA([]); else setMarcadosB([]);
    await cargarDatosIniciales(); await cargarEquiposPersona(usuario.id, tipo); setGuardando(false);
  };

  const otorgarDesdeAlmacen = async (tipo: 'A' | 'B') => {
    const usuario = tipo === 'A' ? usuarioA : usuarioB;
    setGuardando(true);
    for (const activoId of activosAlmacenMarcados) {
      await supabase.from('asignaciones').insert([{ activo_id: activoId, text_asignacion: 'Asignado desde Almacén TI', usuario_id: usuario.id, estado_asignacion: 'Activo' }]);
      await supabase.from('activos').update({ estado_actual: 'Asignado', asignado_usuario_id: usuario.id }).eq('id', activoId);
    }
    setActivosAlmacenMarcados([]); await cargarDatosIniciales(); await cargarEquiposPersona(usuario.id, tipo); setGuardando(false);
  };

  // --- FILTROS DE DATOS CON BÚSQUEDA INTEGRAL POR DNI ---
  const usuariosFiltrados = usuarios.filter(u => {
    const term = busquedaUsuario.toLowerCase().trim();
    const nombre = u.nombre_completo ? u.nombre_completo.toLowerCase() : '';
    const dni = u.dni ? String(u.dni).toLowerCase().trim() : '';
    
    // Evalúa si coincide con el nombre O con el DNI
    return (!term || nombre.includes(term) || dni.includes(term)) &&
           (filtroAreaUsuario === 'Todos' || String(u.area_id) === filtroAreaUsuario) &&
           (filtroCargoUsuario === 'Todos' || String(u.cargo_id) === filtroCargoUsuario);
  });

  const activosAlmacenFiltrados = activosDisponibles.filter(a => {
    const term = busquedaHardware.toLowerCase().trim();
    const marca = a.marca ? a.marca.toLowerCase() : '';
    const modelo = a.modelo ? a.modelo.toLowerCase() : '';
    const serial = a.serial_id ? a.serial_id.toLowerCase() : '';
    const caf = a.caf ? a.caf.toLowerCase() : '';
    return (filtroCategoriaAlmacen === 'Todos' || String(a.categoria) === filtroCategoriaAlmacen) &&
           (!term || serial.includes(term) || marca.includes(term) || modelo.includes(term) || caf.includes(term));
  });

  const totalFilas = usuariosFiltrados.length;
  const paginasTotales = Math.max(1, Math.ceil(totalFilas / registrosPorPagina));
  const datosPaginaUsuarios = usuariosFiltrados.slice((paginaActual - 1) * registrosPorPagina, paginaActual * registrosPorPagina);

  return (
    <main className="min-h-screen bg-white p-6 text-slate-800">
      
      {/* INTERFAZ PRINCIPAL */}
      <div className="print:hidden space-y-4">
        <div>
          <h1 className="text-xl font-bold mb-1" style={{ color: 'rgb(1, 71, 118)' }}>📋 Consola Unificada de Asignaciones e Intercambio TI</h1>
          <p className="text-xs text-slate-500">UpeU Centralized Core Stack</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
          
          {/* LADO 1: SELECTOR DE PERSONAL (BÚSQUEDA NOMBRE + DNI) */}
          <div className="space-y-3 border rounded-xl p-4 bg-slate-50/50 h-[80vh] flex flex-col">
            <h3 className="font-bold text-xs uppercase border-b pb-2 text-slate-700">👥 1. Selector de Personal</h3>
            
            <div className="bg-white p-2.5 rounded border space-y-2 text-xs shadow-sm">
              <input type="text" value={busquedaUsuario} onChange={(e) => { setBusquedaUsuario(e.target.value); setPaginaActual(1); }} placeholder="Buscar por nombre o DNI..." className="w-full p-2 border rounded bg-slate-50 outline-none" />
              <div className="grid grid-cols-2 gap-2">
                <select value={filtroAreaUsuario} onChange={(e) => { setFiltroAreaUsuario(e.target.value); setPaginaActual(1); }} className="p-1.5 border rounded bg-white text-slate-600">
                  <option value="Todos">Todas las Áreas</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.nombre_area}</option>)}
                </select>
                <select value={filtroCargoUsuario} onChange={(e) => { setFiltroCargoUsuario(e.target.value); setPaginaActual(1); }} className="p-1.5 border rounded bg-white text-slate-600">
                  <option value="Todos">Todos los Cargos</option>
                  {cargos.map(c => <option key={c.id} value={c.id}>{c.nombre_cargo}</option>)}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border rounded bg-white shadow-inner">
              {loading ? (
                <div className="text-center py-8 text-xs text-slate-400">Cargando personal corporativo...</div>
              ) : datosPaginaUsuarios.length > 0 ? (
                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] uppercase text-slate-500 border-b">
                      <th className="p-2">Colaborador</th>
                      <th className="p-2 text-center w-20">Fijar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {datosPaginaUsuarios.map(u => (
                      <tr key={u.id} className={`hover:bg-slate-50 ${usuarioA?.id === u.id || usuarioB?.id === u.id ? 'bg-blue-50/40' : ''}`}>
                        <td className="p-2">
                          <div className="font-bold text-slate-900">{u.nombre_completo}</div>
                          <div className="text-[10px] text-slate-500 font-mono">🪪 DNI: {u.dni || 'N/A'}</div>
                          <div className="text-[10px] text-slate-500">💼 {u.cargos?.nombre_cargo || 'Sin cargo'}</div>
                          {u.areas && <span className="inline-block px-1.5 py-0.5 text-[9px] rounded text-white mt-0.5 font-bold" style={{ backgroundColor: u.areas.color_hex || '#64748b' }}>{u.areas.nombre_area}</span>}
                        </td>
                        <td className="p-2 text-center">
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => { setUsuarioA(u); cargarEquiposPersona(u.id, 'A'); }} className={`px-2 py-0.5 text-[10px] rounded border font-semibold ${usuarioA?.id === u.id ? 'bg-blue-800 text-white' : 'bg-white hover:bg-slate-100'}`}>A</button>
                            <button onClick={() => { setUsuarioB(u); cargarEquiposPersona(u.id, 'B'); }} className={`px-2 py-0.5 text-[10px] rounded border font-semibold ${usuarioB?.id === u.id ? 'bg-blue-800 text-white' : 'bg-white hover:bg-slate-100'}`}>B</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">No se encontraron resultados.</div>
              )}
            </div>

            <div className="flex items-center justify-between bg-white p-2 border rounded text-[11px]">
              <span className="font-medium text-slate-500">Pág {paginaActual} de {paginasTotales}</span>
              <div className="flex gap-1">
                <button type="button" onClick={() => setPaginaActual(p => Math.max(1, p - 1))} disabled={paginaActual === 1} className="px-2 py-1 bg-white border rounded disabled:opacity-50">←</button>
                <button type="button" onClick={() => setPaginaActual(p => Math.min(paginasTotales, p + 1))} disabled={paginaActual === paginasTotales} className="px-2 py-1 bg-white border rounded disabled:opacity-50">→</button>
              </div>
            </div>
          </div>

          {/* LADO 2: MATRIZ DE TRANSFERENCIA EN ESPEJO */}
          <div className="space-y-3 border rounded-xl p-4 bg-white shadow-sm h-[80vh] flex flex-col">
            <h3 className="font-bold text-xs uppercase border-b pb-2 text-slate-700 flex justify-between items-center">
              <span>🔄 2. Matriz De Transferencia</span>
              {equiposPersonaA.length > 0 && (
                <button onClick={() => window.print()} className="bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] px-2.5 py-1 rounded shadow-sm">🖨️ Imprimir Acta</button>
              )}
            </h3>

            <div className="grid grid-cols-2 gap-3 flex-1 overflow-hidden h-full">
              {/* ESPEJO LADO A */}
              <div className="border rounded-lg p-2.5 bg-slate-50 flex flex-col h-full overflow-hidden justify-between">
                <div>
                  <div className="flex justify-between items-center border-b pb-1.5 mb-2">
                    <span className="text-[11px] font-bold text-slate-800 truncate block max-w-[110px]">🅰️ LADO A: {usuarioA ? usuarioA.nombre_completo.split(' ')[0] : 'N/A'}</span>
                    {marcadosA.length > 0 && <button onClick={() => devolverAPotestadTI('A')} className="text-[9px] bg-red-50 text-red-600 border px-1 py-0.5 rounded font-bold">🛑 Quitar</button>}
                  </div>
                  
                  <div className="space-y-1.5 overflow-y-auto max-h-[48vh] pr-0.5">
                    {usuarioA && equiposPersonaA.map(eq => (
                      <div key={eq.id} className="flex items-center gap-2 bg-white p-2 border rounded text-[10px]">
                        <input type="checkbox" checked={marcadosA.includes(eq.id)} onChange={() => setMarcadosA(prev => prev.includes(eq.id) ? prev.filter(i => i !== eq.id) : [...prev, eq.id])} className="w-3 h-3 cursor-pointer" />
                        <span className="truncate"><b>[{eq.categoria}]</b> {eq.marca} {eq.modelo}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {marcadosA.length > 0 && usuarioB && (
                  <button type="button" onClick={transferirDeAhaciaB} className="w-full py-1.5 mt-2 bg-blue-800 hover:bg-blue-900 text-white font-bold rounded text-[10px] uppercase">Mover a B ➔</button>
                )}
              </div>

              {/* ESPEJO LADO B */}
              <div className="border rounded-lg p-2.5 bg-slate-50 flex flex-col h-full overflow-hidden justify-between">
                <div>
                  <div className="flex justify-between items-center border-b pb-1.5 mb-2">
                    <span className="text-[11px] font-bold text-slate-800 truncate block max-w-[110px]">🅱️ LADO B: {usuarioB ? usuarioB.nombre_completo.split(' ')[0] : 'N/A'}</span>
                    {marcadosB.length > 0 && <button onClick={() => devolverAPotestadTI('B')} className="text-[9px] bg-red-50 text-red-600 border px-1 py-0.5 rounded font-bold">🛑 Quitar</button>}
                  </div>

                  <div className="space-y-1.5 overflow-y-auto max-h-[48vh] pr-0.5">
                    {usuarioB && equiposPersonaB.map(eq => (
                      <div key={eq.id} className="flex items-center gap-2 bg-white p-2 border rounded text-[10px]">
                        <input type="checkbox" checked={marcadosB.includes(eq.id)} onChange={() => setMarcadosB(prev => prev.includes(eq.id) ? prev.filter(i => i !== eq.id) : [...prev, eq.id])} className="w-3 h-3 cursor-pointer" />
                        <span className="truncate"><b>[{eq.categoria}]</b> {eq.marca} {eq.modelo}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {marcadosB.length > 0 && usuarioA && (
                  <button type="button" onClick={transferirDeBhaciaA} className="w-full py-1.5 mt-2 bg-blue-800 hover:bg-blue-900 text-white font-bold rounded text-[10px] uppercase">⬅ Mover a A</button>
                )}
              </div>
            </div>
          </div>

          {/* LADO 3: ALMACÉN CENTRAL DE TI */}
          <div className="space-y-3 border rounded-xl p-4 bg-slate-50/50 h-[80vh] flex flex-col">
            <h3 className="font-bold text-xs uppercase border-b pb-2 text-slate-700 flex justify-between items-center">
              <span>📦 3. Almacén Central TI</span>
              <span className="bg-blue-100 text-blue-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">Libres: {activosAlmacenFiltrados.length}</span>
            </h3>

            <div className="bg-white p-2.5 rounded border space-y-2 text-xs shadow-sm">
              <select value={filtroCategoriaAlmacen} onChange={(e) => setFiltroCategoriaAlmacen(e.target.value)} className="w-full p-1.5 border rounded bg-white text-slate-600 font-medium">
                <option value="Todos">Todas las Familias</option>
                {categorias.map(c => <option key={c.id} value={c.nombre_categoria}>{c.nombre_categoria}</option>)}
              </select>
              <input type="text" value={busquedaHardware} onChange={(e) => setBusquedaHardware(e.target.value)} placeholder="Buscar por S/N, Marca, Modelo o CAF..." className="w-full p-2 border rounded bg-slate-50 outline-none" />
            </div>

            {activosAlmacenMarcados.length > 0 && (
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-white border border-blue-200 rounded shadow-sm">
                <button type="button" onClick={() => otorgarDesdeAlmacen('A')} disabled={!usuarioA || guardando} className="py-1 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded text-[10px] uppercase disabled:opacity-40">➔ Lado A</button>
                <button type="button" onClick={() => otorgarDesdeAlmacen('B')} disabled={!usuarioB || guardando} className="py-1 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded text-[10px] uppercase disabled:opacity-40">➔ Lado B</button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto border rounded bg-white p-1 shadow-inner">
              {activosAlmacenFiltrados.length > 0 ? (
                activosAlmacenFiltrados.map(a => (
                  <div key={a.id} className="text-[11px] p-2 border-b flex items-start gap-2 hover:bg-slate-50 transition-colors">
                    <input type="checkbox" checked={activosAlmacenMarcados.includes(a.id)} onChange={() => setActivosAlmacenMarcados(prev => prev.includes(a.id) ? prev.filter(id => id !== a.id) : [...prev, a.id])} className="w-3.5 h-3.5 mt-0.5 cursor-pointer" />
                    <div className="flex-1">
                      <span className="font-bold text-slate-900">[{a.categoria}]</span> {a.marca} {a.modelo}
                      <div className="font-mono text-[9px] text-slate-400 mt-0.5">S/N: {a.serial_id}</div>
                      <div className="mt-1"><span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[9px] border font-mono font-bold">CAF: {a.caf || 'N/A'}</span></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">No hay hardware libre disponible.</div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* DOCUMENTO MEMBRETADO PARA IMPRESIÓN */}
      {usuarioA && (
        <div className="hidden print:block p-10 font-serif text-black bg-white">
          <div className="text-center mb-6">
            <h2 className="font-bold text-xl uppercase tracking-wide">UNIVERSIDAD PERUANA UNIÓN</h2>
            <p className="text-xs font-mono mt-0.5">RUC: 20138122256</p>
            <p className="text-xs">Dirección General de TI — Lima, Ñaña, Perú</p>
            <hr className="my-3 border-black"/>
          </div>
          
          <div className="text-xs bg-slate-50 p-3 border border-slate-300 rounded mb-4 space-y-1">
            <p><b>Colaborador Custodio:</b> {usuarioA.nombre_completo}</p>
            <p><b>DNI / Identificación:</b> {usuarioA.dni || 'N/A'}</p>
            <p><b>Área Solicitante:</b> {usuarioA.areas?.nombre_area || 'TI'}</p>
          </div>

          <table className="w-full border-collapse border border-black text-[10px] text-center mb-12">
            <thead>
              <tr className="bg-gray-100 font-bold border-b border-black">
                <th className="border border-black p-2">Categoría</th>
                <th className="border border-black p-2 text-left">Descripción del Bien</th>
                <th className="border border-black p-2">Número de Serie</th>
                <th className="border border-black p-2">Código Patrimonial (CAF)</th>
              </tr>
            </thead>
            <tbody>
              {equiposPersonaA.map(eq => (
                <tr key={eq.id} className="border-b border-black">
                  <td className="border border-black p-2 font-bold">{eq.categoria}</td>
                  <td className="border border-black p-2 text-left">{eq.marca} {eq.modelo}</td>
                  <td className="border border-black p-2 font-mono">{eq.serial_id}</td>
                  <td className="border border-black p-2 font-mono font-bold">{eq.caf || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-20 text-center text-xs mt-16">
            <div>
              <div className="border-t border-black w-44 mx-auto mb-1"></div>
              <p className="font-bold">{usuarioA.nombre_completo}</p>
              <p className="text-[10px] text-slate-500">Firma del Trabajador</p>
            </div>
            <div>
              <div className="border-t border-black w-44 mx-auto mb-1"></div>
              <p className="font-bold">Dirección de Soporte TI</p>
              <p className="text-[10px] text-slate-500">UpeU Ñaña</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}