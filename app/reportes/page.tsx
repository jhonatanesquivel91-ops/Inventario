'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';

type CriterioSort = 'area' | 'cargo' | 'persona' | 'categoria' | 'marca' | 'serial' | 'caf' | 'conservacion';
type DireccionSort = 'asc' | 'desc';

interface ModalComentariosState {
  open: boolean;
  activoId: number | null;
  numeroSerie: string;
}

export default function PaginaReportes() {
  const [loading, setLoading] = useState(false);

  // --- ARREGLOS DE DATOS MAESTROS ---
  const [activos, setActivos] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [cargos, setCargos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);

  // --- MATRIZ DE FILTROS SIMULTÁNEOS ---
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroArea, setFiltroArea] = useState('Todos');
  const [filtroCargo, setFiltroCargo] = useState('Todos');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [filtroConservacion, setFiltroConservacion] = useState('Todos');

  // --- CONTROL DE ORDENAMIENTO (SORT) ---
  const [criterioSort, setCriterioSort] = useState<CriterioSort>('area');
  const [direccionSort, setDireccionSort] = useState<DireccionSort>('asc');

  // --- PAGINACIÓN ---
  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(15);

  // --- ESTADOS DEL MODAL DE NOTAS ---
  const [modalComentarios, setModalComentarios] = useState<ModalComentariosState>({ open: false, activoId: null, numeroSerie: '' });
  const [listaComentarios, setListaComentarios] = useState<any[]>([]);
  const [tipoObs, setTipoObs] = useState('General');
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  const cargarDatosAuditoria = async () => {
    try {
      setLoading(true);
      const [rAct, rArea, rCargo, rCat] = await Promise.all([
        supabase.from('vista_activos_completa').select('*'),
        supabase.from('areas').select('*'),
        supabase.from('cargos').select('*'),
        supabase.from('categorias_activo').select('*')
      ]);

      if (rAct.data) setActivos(rAct.data.map(item => ({ ...item, id: item.activo_id })));
      if (rArea.data) setAreas(rArea.data);
      if (rCargo.data) setCargos(rCargo.data);
      if (rCat.data) setCategorias(rCat.data);
    } catch (err: any) {
      console.error("Error en analítica:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatosAuditoria();
  }, []);

  // --- CARGA DIRECTA DE LA BITÁCORA OFICIAL ---
  const cargarHistorialComentarios = async (activoId: number) => {
    try {
      const { data, error } = await supabase
        .from('observaciones_activos')
        .select('*')
        .eq('activo_id', activoId)
        .order('fecha_registro', { ascending: false });

      if (error) throw error;
      setListaComentarios(data || []);
    } catch (err: any) {
      console.error("Error al cargar notas:", err.message);
      setListaComentarios([]);
    }
  };

  const abrirModalNotas = async (item: any) => {
    setModalComentarios({ open: true, activoId: item.id, numeroSerie: item.serial_id || 'N/A' });
    setNuevoComentario('');
    setTipoObs('General');
    await cargarHistorialComentarios(item.id);
  };

  // --- GRABADO EN LA TABLA DE OBSERVACIONES FIJADAS ---
  const guardarComentarioNuevo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoComentario.trim() || !modalComentarios.activoId) return;

    try {
      setEnviandoComentario(true);

      const { error } = await supabase.from('observaciones_activos').insert([{
        activo_id: modalComentarios.activoId,
        tipo_observacion: tipoObs,
        comentario: nuevoComentario.trim(),
        creado_por: 'Administrador TI',
        fecha_registro: new Date().toISOString()
      }]);

      if (error) throw error;

      setNuevoComentario('');
      // Refrescamos en cascada el modal y la grilla base para el Excel
      await cargarHistorialComentarios(modalComentarios.activoId);
      await cargarDatosAuditoria(); 
    } catch (err: any) {
      alert(`❌ Error en base de datos: ${err.message}`);
    } finally {
      setEnviandoComentario(false);
    }
  };

  const manejarSort = (criterio: CriterioSort) => {
    if (criterioSort === criterio) {
      setDireccionSort(direccionSort === 'asc' ? 'desc' : 'asc');
    } else {
      setCriterioSort(criterio);
      setDireccionSort('asc');
    }
    setPaginaActual(1);
  };

  // --- MOTOR DE FILTRADO ---
  const activosFiltrados = activos.filter(a => {
    const term = filtroTexto.toLowerCase().trim();
    
    const cumpleTexto = !term ||
      String(a.serial_id || '').toLowerCase().includes(term) ||
      String(a.caf || '').toLowerCase().includes(term) ||
      String(a.nombre_completo || '').toLowerCase().includes(term) ||
      String(a.dni || '').toLowerCase().includes(term) ||
      String(a.marca || '').toLowerCase().includes(term) ||
      String(a.modelo || '').toLowerCase().includes(term) ||
      String(a.estado_conservacion || '').toLowerCase().includes(term) ||
      String(a.especificaciones || '').toLowerCase().includes(term);

    const cumpleArea = filtroArea === 'Todos' || String(a.nombre_area) === filtroArea;
    const cumpleCargo = filtroCargo === 'Todos' || String(a.nombre_cargo) === filtroCargo;
    const cumpleCategoria = filtroCategoria === 'Todos' || String(a.categoria) === filtroCategoria;
    const cumpleConservacion = filtroConservacion === 'Todos' || String(a.estado_conservacion) === filtroConservacion;

    return cumpleTexto && cumpleArea && cumpleCargo && cumpleCategoria && cumpleConservacion;
  }).sort((a, b) => {
    let valorA = '';
    let valorB = '';

    if (criterioSort === 'area') { valorA = a.nombre_area || '🖨️ Almacén TI'; valorB = b.nombre_area || '🖨️ Almacén TI'; }
    if (criterioSort === 'cargo') { valorA = a.nombre_cargo || ''; valorB = b.nombre_cargo || ''; }
    if (criterioSort === 'persona') { valorA = a.nombre_completo || ''; valorB = b.nombre_completo || ''; }
    if (criterioSort === 'categoria') { valorA = a.categoria || ''; valorB = b.categoria || ''; }
    if (criterioSort === 'marca') { valorA = a.marca || ''; valorB = b.marca || ''; }
    if (criterioSort === 'serial') { valorA = a.serial_id || ''; valorB = b.serial_id || ''; }
    if (criterioSort === 'caf') { valorA = a.caf || ''; valorB = b.caf || ''; }
    if (criterioSort === 'conservacion') { valorA = a.estado_conservacion || ''; valorB = b.estado_conservacion || ''; }

    return direccionSort === 'asc' ? valorA.localeCompare(valorB) : valorB.localeCompare(valorA);
  });

  const totalFilas = activosFiltrados.length;
  const paginasTotales = Math.max(1, Math.ceil(totalFilas / registrosPorPagina));
  const inicioIdx = (paginaActual - 1) * registrosPorPagina;
  const datosPagina = activosFiltrados.slice(inicioIdx, inicioIdx + registrosPorPagina);

  const kpiTotales = activosFiltrados.length;
  const kpiAsignados = activosFiltrados.filter(a => a.estado_actual === 'Asignado').length;
  const kpiAlmacen = activosFiltrados.filter(a => a.estado_actual === 'Disponible en Almacén TI').length;
  const kpiBaja = activosFiltrados.filter(a => a.estado_actual === 'Dado de Baja').length;

  const exportarAExcel = () => {
    if (activosFiltrados.length === 0) return alert("No hay datos para exportar.");
    const registrosMapeados = activosFiltrados.map((a, index) => ({
      Nro: index + 1,
      Area: a.nombre_area || 'Almacén Central TI',
      Cargo: a.nombre_cargo || '',
      Custodio: a.nombre_completo || 'Almacén Central TI',
      DNI: a.dni || '',
      Familia: a.categoria,
      Marca: a.marca,
      Modelo: a.modelo,
      Serie: a.serial_id,
      CAF: a.caf || 'N/A',
      Specs: a.especificaciones || '',
      Condicion_Fisica: a.estado_conservacion || 'Excelente',
      Ultimo_Comentario: a.ultimo_comentario || 'Sin comentario',
      Fecha_Comentario: a.fecha_comentario ? new Date(a.fecha_comentario).toLocaleDateString('es-PE') : 'N/A'
    }));

    const hojaTrabajo = XLSX.utils.json_to_sheet(registrosMapeados);
    const libroTrabajo = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libroTrabajo, hojaTrabajo, "Audoria_Report");
    XLSX.writeFile(libroTrabajo, `Reporte_TI_UPeU_Filtros.xlsx`);
  };

  const renderFlechaSort = (criterio: CriterioSort) => {
    if (criterioSort !== criterio) return ' ↕';
    return direccionSort === 'asc' ? ' 🔼' : ' 🔽';
  };

  return (
    <main className="min-h-screen bg-white p-6 text-slate-800">
      
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 mb-5 gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(1, 71, 118)' }}>📊 Consola Analítica y Auditoría de Stock</h1>
          <p className="text-xs text-slate-500">Universidad Peruana Unión — Sede Ñaña</p>
        </div>
        <button onClick={exportarAExcel} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow transition-all">
          📥 Exportar a Excel (.xlsx)
        </button>
      </div>

      {/* KPIS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 font-semibold">
        <div className="border rounded-xl p-4 bg-slate-50/60 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">📦 Total Activos</span>
          <span className="text-2xl font-bold text-slate-900">{kpiTotales}</span>
        </div>
        <div className="border rounded-xl p-4 bg-blue-50/50 shadow-sm">
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">👤 En Custodia (Asignados)</span>
          <span className="text-2xl font-bold text-blue-900">{kpiAsignados}</span>
        </div>
        <div className="border rounded-xl p-4 bg-emerald-50/50 shadow-sm">
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">🏢 Stock Disponible Almacén</span>
          <span className="text-2xl font-bold text-emerald-900">{kpiAlmacen}</span>
        </div>
        <div className="border rounded-xl p-4 bg-red-50/50 shadow-sm">
          <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block">🛑 Equipos de Baja / Inactivos</span>
          <span className="text-2xl font-bold text-red-900">{kpiBaja}</span>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm mb-5 grid grid-cols-1 md:grid-cols-5 gap-3 text-xs font-semibold">
        <div>
          <span className="block text-[10px] text-slate-400 uppercase mb-1">🔍 Búsqueda Clave:</span>
          <input type="text" value={filtroTexto} onChange={(e) => { setFiltroTexto(e.target.value); setPaginaActual(1); }} placeholder="S/N, DNI, Nombre..." className="w-full p-2 border rounded-lg bg-white outline-none" />
        </div>
        <div>
          <span className="block text-[10px] text-slate-400 uppercase mb-1">🏢 Área:</span>
          <select value={filtroArea} onChange={(e) => { setFiltroArea(e.target.value); setPaginaActual(1); }} className="w-full p-2 border rounded-lg bg-white outline-none">
            <option value="Todos">Todas las Áreas</option>
            {areas.map(ar => <option key={ar.id} value={ar.nombre_area}>{ar.nombre_area}</option>)}
          </select>
        </div>
        <div>
          <span className="block text-[10px] text-slate-400 uppercase mb-1">💼 Cargo:</span>
          <select value={filtroCargo} onChange={(e) => { setFiltroCargo(e.target.value); setPaginaActual(1); }} className="w-full p-2 border rounded-lg bg-white outline-none">
            <option value="Todos">Todos los Cargos</option>
            {cargos.map(ca => <option key={ca.id} value={ca.nombre_cargo}>{ca.nombre_cargo}</option>)}
          </select>
        </div>
        <div>
          <span className="block text-[10px] text-slate-400 uppercase mb-1">📁 Familia Hardware:</span>
          <select value={filtroCategoria} onChange={(e) => { setFiltroCategoria(e.target.value); setPaginaActual(1); }} className="w-full p-2 border rounded-lg bg-white outline-none">
            <option value="Todos">Todas las Familias</option>
            {categorias.map(cat => <option key={cat.id} value={cat.nombre_categoria}>{cat.nombre_categoria}</option>)}
          </select>
        </div>
        <div>
          <span className="block text-[10px] text-slate-400 uppercase mb-1">⚙️ Condición Física:</span>
          <select value={filtroConservacion} onChange={(e) => { setFiltroConservacion(e.target.value); setPaginaActual(1); }} className="w-full p-2 border rounded-lg bg-white outline-none">
            <option value="Todos">Todas las Condiciones</option>
            <option value="Excelente">Excelente</option>
            <option value="Moderado">Moderado</option>
            <option value="Crítico">Crítico</option>
          </select>
        </div>
      </div>

      {/* GRILLA */}
      <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm mb-4">
        <table className="w-full border-collapse text-left text-sm text-slate-600">
          <thead style={{ backgroundColor: 'rgb(1, 71, 118)' }} className="text-xs uppercase text-white font-semibold select-none">
            <tr>
              <th onClick={() => manejarSort('area')} className="px-5 py-3.5 border-r border-white/10 cursor-pointer hover:bg-blue-900 transition-colors">Área Asignada{renderFlechaSort('area')}</th>
              <th onClick={() => manejarSort('cargo')} className="px-5 py-3.5 border-r border-white/10 cursor-pointer hover:bg-blue-900 transition-colors">Cargo Perfil{renderFlechaSort('cargo')}</th>
              <th onClick={() => manejarSort('persona')} className="px-5 py-3.5 border-r border-white/10 cursor-pointer hover:bg-blue-900 transition-colors">Colaborador / Custodio{renderFlechaSort('persona')}</th>
              <th className="px-5 py-3.5 border-r border-white/10">Información del Activo / Identificadores</th>
              <th onClick={() => manejarSort('conservacion')} className="px-5 py-3.5 border-r border-white/10 cursor-pointer hover:bg-blue-900 transition-colors w-36">Condición Física{renderFlechaSort('conservacion')}</th>
              <th className="px-5 py-3.5 text-center w-24">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white text-xs">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400 font-medium">⏳ Sincronizando datos analíticos...</td></tr>
            ) : datosPagina.length > 0 ? (
              datosPagina.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4 border-r border-slate-200">
                    {item.nombre_area ? (
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full border shadow-sm" style={{ backgroundColor: item.color_hex || '#64748b' }} />
                        <span className="px-2 py-0.5 rounded text-white font-bold text-[10px]" style={{ backgroundColor: item.color_hex || '#64748b' }}>{item.nombre_area}</span>
                      </div>
                    ) : <span className="text-slate-400 italic">Almacén Central TI</span>}
                  </td>
                  <td className="px-5 py-4 border-r border-slate-200 font-medium text-slate-700">{item.nombre_cargo ? `💼 ${item.nombre_cargo}` : 'N/A'}</td>
                  <td className="px-5 py-4 border-r border-slate-200">
                    {item.nombre_completo ? (
                      <div>
                        <div className="font-bold text-slate-900">👤 {item.nombre_completo}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">DNI: {item.dni}</div>
                      </div>
                    ) : <span className="text-slate-400 italic font-medium">Disponible Almacén</span>}
                  </td>
                  <td className="px-5 py-4 border-r border-slate-200">
                    <div className="font-bold text-slate-900">[{item.categoria}] {item.marca} — {item.modelo}</div>
                    {item.especificaciones && <div className="text-[10px] text-slate-400 italic mt-0.5 max-w-xs truncate">{item.especificaciones}</div>}
                    <div className="mt-1.5 flex gap-2 font-mono text-[10px]">
                      <div><span className="text-slate-400">S/N:</span> <span className="font-bold text-slate-800">{item.serial_id}</span></div>
                      <div><span className="text-slate-400">CAF:</span> <span className="bg-slate-100 border px-1.5 rounded font-bold text-slate-700 text-[9px]">{item.caf || 'N/A'}</span></div>
                    </div>
                  </td>
                  <td className="px-5 py-4 border-r border-slate-200 font-bold">
                    <span className="px-2 py-0.5 rounded text-[10px] text-white" style={{ backgroundColor: item.color_conservacion || '#64748b' }}>⚙️ {item.estado_conservacion || 'Excelente'}</span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button onClick={() => abrirModalNotas(item)} className="text-slate-400 hover:text-blue-800 text-lg transition-colors">💬</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400">No hay registros coincidentes.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINACIÓN */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs gap-3 font-semibold">
        <div className="flex items-center gap-2">
          <span>📄 Escala:</span>
          <select value={registrosPorPagina} onChange={(e) => { setREG(Number(e.target.value)); }} className="p-1 border rounded bg-white text-slate-700 outline-none">
            <option value={15}>15 Registros</option>
            <option value={30}>30 Registros</option>
            <option value={50}>50 Registros</option>
          </select>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setPaginaActual(p => Math.max(1, p - 1))} disabled={paginaActual === 1} className="px-3 py-1.5 bg-white border rounded">Anterior</button>
          <button onClick={() => setPaginaActual(p => Math.min(paginasTotales, p + 1))} disabled={paginaActual === paginasTotales} className="px-3 py-1.5 bg-white border rounded">Siguiente</button>
        </div>
      </div>

      {/* MODAL REINTEGRADO VÁLIDO CON CARGA COMPLETA */}
      {modalComentarios.open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-lg flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <div>
                <h2 className="text-lg font-bold text-slate-800">💬 Historial de Observaciones</h2>
                <p className="text-xs text-slate-500">Equipo Serie: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-blue-800 font-bold">{modalComentarios.numeroSerie}</span></p>
              </div>
              <button onClick={() => setModalComentarios({ open: false, activoId: null, numeroSerie: '' })} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            <form onSubmit={guardarComentarioNuevo} className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex gap-2">
                <select value={tipoObs} onChange={(e) => setTipoObs(e.target.value)} className="p-1.5 border rounded-lg bg-white text-xs font-semibold text-slate-700 outline-none">
                  <option value="General">📝 General</option>
                  <option value="Repotenciación">🚀 Repotenciación</option>
                  <option value="Falla">⚠️ Falla Técnica</option>
                  <option value="Mantenimiento">🔧 Mantenimiento</option>
                </select>
                <span className="text-xs text-slate-400 flex items-center">Registrar evento</span>
              </div>
              <div className="flex gap-2">
                <input type="text" value={nuevoComentario} onChange={(e) => setNuevoComentario(e.target.value)} placeholder="Ej: Cargador fallando, se cambia por repuesto..." className="flex-1 p-2 border rounded-lg text-xs focus:outline-none text-slate-700" required />
                <button type="submit" disabled={enviandoComentario} style={{ backgroundColor: 'rgb(1, 71, 118)' }} className="px-4 py-2 text-white font-semibold rounded-lg text-xs disabled:opacity-50 font-bold">
                  {enviandoComentario ? 'Guardando...' : 'Añadir'}
                </button>
              </div>
            </form>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {listaComentarios.length > 0 ? (
                listaComentarios.map((c) => {
                  const esFalla = c.tipo_observacion === 'Falla' || c.tipo_observacion === 'Falla Técnica';
                  const esRepotenciacion = c.tipo_observacion === 'Repotenciación';
                  const esMantenimiento = c.tipo_observacion === 'Mantenimiento';
                  return (
                    <div key={c.id} className={`p-3 rounded-xl border text-xs transition-all ${esFalla ? 'bg-red-50/50 border-red-100' : esRepotenciacion ? 'bg-green-50/50 border-green-100' : esMantenimiento ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex justify-between items-center mb-1 text-slate-400 font-medium">
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase ${esFalla ? 'bg-red-100 text-red-800' : esRepotenciacion ? 'bg-green-100 text-green-800' : esMantenimiento ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>{c.tipo_observacion}</span>
                        <span>{new Date(c.fecha_registro).toLocaleString('es-PE')}</span>
                      </div>
                      <p className="text-slate-800 font-medium">{c.comentario}</p>
                      <span className="text-[10px] text-slate-400 block mt-1">✍️ Registrado por: {c.creado_por}</span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs border border-dashed rounded-xl bg-white">No hay observaciones registradas para este equipo.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );

  function setREG(val: number) {
    setRegistrosPorPagina(val);
    setPaginaActual(1);
  }
}