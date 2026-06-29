'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function PaginaConfiguracion() {
  const [subTab, setSubTab] = useState<'categorias' | 'marcas' | 'modelos' | 'usuarios' | 'estructura' | 'condiciones'>('categorias');
  const [loading, setLoading] = useState(false);

  // --- ARREGLOS DE DATOS MAESTROS ---
  const [categorias, setCategorias] = useState<any[]>([]);
  const [marcas, setMarcas] = useState<any[]>([]);
  const [modelos, setModelos] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [cargos, setCargos] = useState<any[]>([]);
  const [condiciones, setCondiciones] = useState<any[]>([]); // Inyectado para estados de conservación

  // --- FILTROS, BÚSQUEDA Y PAGINACIÓN DINÁMICA ---
  const [busquedaColaborador, setBusquedaColaborador] = useState('');
  const [filtroCatEnMarca, setFiltroCatEnMarca] = useState('Todos');
  const [filtroCatEnModelo, setFiltroCatEnModelo] = useState('Todos');
  const [filtroMarcaEnModelo, setFiltroMarcaEnModelo] = useState('Todos');
  
  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(15);

  // --- ESTADO ÚNICO DE FORMULARIO (DERECHA) ---
  const [idEditando, setIdEditando] = useState<number | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formPadreId, setFormPadreId] = useState(''); 
  const [formDni, setFormDni] = useState(''); 
  const [selectAreaId, setSelectAreaId] = useState('');
  const [selectCargoId, setSelectCargoId] = useState('');
  
  // Para sub-gestiones en la pestaña de estructura y condiciones
  const [modoEstructura, setModoEstructura] = useState<'area' | 'cargo'>('area');
  const [colorArea, setColorArea] = useState('#1E293B');

  const [guardando, setGuardando] = useState(false);
  const [modalEliminar, setModalEliminar] = useState<{ open: boolean; id: number | null; tabla: string }>({ open: false, id: null, tabla: '' });

  const cargarCatalogos = async () => {
    try {
      setLoading(true);
      const [rCat, rMar, rMod, rUsr, rArea, rCargo, rCond] = await Promise.all([
        supabase.from('categorias_activo').select('*').order('nombre_categoria'),
        supabase.from('marcas').select('*, categorias_activo(nombre_categoria)').order('nombre_marca'),
        supabase.from('modelos').select('*, marcas(nombre_marca, categoria_id)').order('nombre_modelo'),
        supabase.from('usuarios').select('*, areas(*), cargos(*)').order('nombre_completo'),
        supabase.from('areas').select('*').order('nombre_area'),
        supabase.from('cargos').select('*').order('nombre_cargo'),
        supabase.from('estados_conservacion').select('*').order('nombre_estado') // Jalado nativo
      ]);

      if (rCat.data) setCategorias(rCat.data);
      if (rMar.data) setMarcas(rMar.data);
      if (rMod.data) setModelos(rMod.data);
      if (rUsr.data) setUsuarios(rUsr.data);
      if (rArea.data) setAreas(rArea.data);
      if (rCargo.data) setCargos(rCargo.data);
      if (rCond.data) setCondiciones(rCond.data);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCatalogos();
    setPaginaActual(1);
    limpiarFormulario();
  }, [subTab, modoEstructura]);

  const limpiarFormulario = () => {
    setIdEditando(null);
    setFormNombre('');
    setFormPadreId('');
    setFormDni('');
    setSelectAreaId('');
    setSelectCargoId('');
    setColorArea('#1E293B');
  };

  // --- FILTRADOS EN CALIENTE ---
  const marcasFiltradas = marcas.filter(m => filtroCatEnMarca === 'Todos' || String(m.categoria_id) === filtroCatEnMarca);
  const modelosFiltrados = modelos.filter(mod => {
    const cumpleCat = filtroCatEnModelo === 'Todos' || String(mod.marcas?.categoria_id) === filtroCatEnModelo;
    const cumpleMarca = filtroMarcaEnModelo === 'Todos' || String(mod.marca_id) === filtroMarcaEnModelo;
    return cumpleCat && cumpleMarca;
  });
  const usuariosFiltrados = usuarios.filter(u => {
    const termino = busquedaColaborador.toLowerCase().trim();
    if (!termino) return true;
    return (
      String(u.nombre_completo || '').toLowerCase().includes(termino) ||
      String(u.dni || '').toLowerCase().includes(termino) ||
      String(u.areas?.nombre_area || '').toLowerCase().includes(termino) ||
      String(u.cargos?.nombre_cargo || '').toLowerCase().includes(termino)
    );
  });

  const datasetActual = 
    subTab === 'categorias' ? categorias : 
    subTab === 'marcas' ? marcasFiltradas : 
    subTab === 'modelos' ? modelosFiltrados : 
    subTab === 'usuarios' ? usuariosFiltrados : 
    subTab === 'condiciones' ? condiciones :
    modoEstructura === 'area' ? areas : cargos;

  // Paginación Reactiva Flexible
  const totalFilas = datasetActual.length;
  const paginasTotales = Math.max(1, Math.ceil(totalFilas / registrosPorPagina));
  const inicioIdx = (paginaActual - 1) * registrosPorPagina;
  const datosPagina = datasetActual.slice(inicioIdx, inicioIdx + registrosPorPagina);

  // --- CRUD OPERACIONES FINAS ---
  const manejarGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) return;
    try {
      setGuardando(true);
      let tablaDestino = subTab === 'categorias' ? 'categorias_activo' : subTab === 'condiciones' ? 'estados_conservacion' : subTab;
      let payload: any = {};

      if (subTab === 'categorias') payload = { nombre_categoria: formNombre.trim() };
      else if (subTab === 'marcas') payload = { nombre_marca: formNombre.trim(), categoria_id: Number(formPadreId) };
      else if (subTab === 'modelos') payload = { nombre_modelo: formNombre.trim(), marca_id: Number(formPadreId) };
      else if (subTab === 'usuarios') payload = { nombre_completo: formNombre.trim(), dni: formDni.trim(), area_id: selectAreaId ? Number(selectAreaId) : null, cargo_id: selectCargoId ? Number(selectCargoId) : null };
      else if (subTab === 'condiciones') payload = { nombre_estado: formNombre.trim(), color_alerta: colorArea };
      else if (subTab === 'estructura') {
        tablaDestino = modoEstructura === 'area' ? 'areas' : 'cargos';
        payload = modoEstructura === 'area' ? { nombre_area: formNombre.trim(), color_hex: colorArea } : { nombre_cargo: formNombre.trim() };
      }

      const { error } = idEditando 
        ? await supabase.from(tablaDestino).update(payload).eq('id', idEditando) 
        : await supabase.from(tablaDestino).insert([payload]);

      if (error) throw error;
      limpiarFormulario();
      cargarCatalogos();
    } catch (err: any) { alert(`❌ Error: ${err.message}`); } finally { setGuardando(false); }
  };

  const ejecutarEliminar = async () => {
    if (!modalEliminar.id) return;
    const { error } = await supabase.from(modalEliminar.tabla).delete().eq('id', modalEliminar.id);
    if (error) alert(`No se puede borrar. El elemento está asignado o tiene dependencias en el stock.`);
    setModalEliminar({ open: false, id: null, tabla: '' });
    cargarCatalogos();
  };

  const abrirEditor = (item: any) => {
    setIdEditando(item.id);
    setFormNombre(item.nombre_categoria || item.nombre_marca || item.nombre_modelo || item.nombre_completo || item.nombre_area || item.nombre_cargo || item.nombre_estado);
    if (subTab === 'marcas') setFormPadreId(String(item.categoria_id));
    if (subTab === 'modelos') setFormPadreId(String(item.marca_id));
    if (subTab === 'usuarios') {
      setFormDni(item.dni || '');
      setSelectAreaId(item.area_id ? String(item.area_id) : '');
      setSelectCargoId(item.cargo_id ? String(item.cargo_id) : '');
    }
    if (subTab === 'condiciones') {
      setColorArea(item.color_alerta || '#1E293B');
    }
    if (subTab === 'estructura' && modoEstructura === 'area') {
      setColorArea(item.color_hex || '#1E293B');
    }
  };

  return (
    <main className="min-h-screen bg-white p-8 text-slate-800">
      <h1 className="text-3xl font-bold mb-1" style={{ color: 'rgb(1, 71, 118)' }}>⚙️ Consola Unificada de Catálogos TI</h1>
      <p className="text-slate-500 mb-6">Administración simétrica y modular de las tablas maestras del sistema.</p>

      {/* MENÚ DE SECCIONES (TABS) ACTUALIZADO */}
      <div className="flex border-b border-slate-200 mb-6 gap-2 bg-slate-50 p-2 rounded-xl text-sm font-semibold overflow-x-auto">
        <button onClick={() => setSubTab('categorias')} className={`px-4 py-2 rounded-lg transition-all flex-shrink-0 ${subTab === 'categorias' ? 'bg-white border shadow-sm text-blue-800 font-bold' : 'text-slate-500'}`} style={subTab === 'categorias' ? { borderColor: 'rgb(1, 71, 118)' } : {}}>📁 Familias de Hardware</button>
        <button onClick={() => setSubTab('marcas')} className={`px-4 py-2 rounded-lg transition-all flex-shrink-0 ${subTab === 'marcas' ? 'bg-white border shadow-sm text-blue-800 font-bold' : 'text-slate-500'}`} style={subTab === 'marcas' ? { borderColor: 'rgb(1, 71, 118)' } : {}}>🏷️ Marcas Fabricantes</button>
        <button onClick={() => setSubTab('modelos')} className={`px-4 py-2 rounded-lg transition-all flex-shrink-0 ${subTab === 'modelos' ? 'bg-white border shadow-sm text-blue-800 font-bold' : 'text-slate-500'}`} style={subTab === 'modelos' ? { borderColor: 'rgb(1, 71, 118)' } : {}}>📦 Modelos Técnicos</button>
        <button onClick={() => setSubTab('estructura')} className={`px-4 py-2 rounded-lg transition-all flex-shrink-0 ${subTab === 'estructura' ? 'bg-white border shadow-sm text-blue-800 font-bold' : 'text-slate-500'}`} style={subTab === 'estructura' ? { borderColor: 'rgb(1, 71, 118)' } : {}}>🏢 Áreas y Cargos</button>
        {/* REQUERIMIENTO EXTRA: Nueva Pestaña para Estados de Conservación Física */}
        <button onClick={() => setSubTab('condiciones')} className={`px-4 py-2 rounded-lg transition-all flex-shrink-0 ${subTab === 'condiciones' ? 'bg-white border shadow-sm text-blue-800 font-bold' : 'text-slate-500'}`} style={subTab === 'condiciones' ? { borderColor: 'rgb(1, 71, 118)' } : {}}>⚙️ Condiciones Físicas</button>
        <button onClick={() => setSubTab('usuarios')} className={`px-4 py-2 rounded-lg transition-all flex-shrink-0 ${subTab === 'usuarios' ? 'bg-white border shadow-sm text-blue-800 font-bold' : 'text-slate-500'}`} style={subTab === 'usuarios' ? { borderColor: 'rgb(1, 71, 118)' } : {}}>👥 Fichas de Personal</button>
      </div>

      {/* FILTROS / BÚSQUEDAS */}
      {subTab === 'marcas' && (
        <div className="mb-4 bg-slate-50 p-3 rounded-xl border text-xs font-bold flex items-center gap-2">
          <span>Filtrar por Familia:</span>
          <select value={filtroCatEnMarca} onChange={(e) => setFiltroCatEnMarca(e.target.value)} className="p-1 border rounded bg-white font-medium text-slate-700 outline-none">
            <option value="Todos">Todas las familias</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre_categoria}</option>)}
          </select>
        </div>
      )}

      {subTab === 'modelos' && (
        <div className="mb-4 bg-slate-50 p-3 rounded-xl border text-xs font-bold grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <span>1. Familia:</span>
            <select value={filtroCatEnModelo} onChange={(e) => { setFiltroCatEnModelo(e.target.value); setFiltroMarcaEnModelo('Todos'); }} className="p-1 border rounded bg-white flex-1 font-medium outline-none">
              <option value="Todos">Todas</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre_categoria}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span>2. Marca:</span>
            <select value={filtroMarcaEnModelo} onChange={(e) => setFiltroMarcaEnModelo(e.target.value)} className="p-1 border rounded bg-white flex-1 font-medium outline-none">
              <option value="Todos">Todas las marcas</option>
              {marcas.filter(m => filtroCatEnModelo === 'Todos' || String(m.categoria_id) === filtroCatEnModelo).map(m => <option key={m.id} value={m.id}>{m.nombre_marca}</option>)}
            </select>
          </div>
        </div>
      )}

      {subTab === 'estructura' && (
        <div className="mb-4 flex gap-2 text-xs font-bold bg-slate-50 p-1.5 w-fit rounded-lg border">
          <button type="button" onClick={() => setModoEstructura('area')} className={`px-3 py-1.5 rounded ${modoEstructura === 'area' ? 'bg-white shadow-sm text-slate-900 font-bold border' : 'text-slate-500'}`}>🏢 Gestionar Áreas</button>
          <button type="button" onClick={() => setModoEstructura('cargo')} className={`px-3 py-1.5 rounded ${modoEstructura === 'cargo' ? 'bg-white shadow-sm text-slate-900 font-bold border' : 'text-slate-500'}`}>💼 Gestionar Cargos</button>
        </div>
      )}

      {subTab === 'usuarios' && (
        <div className="mb-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">⌨️ Barra de Búsqueda de Colaboradores:</label>
          <input type="text" value={busquedaColaborador} onChange={(e) => { setBusquedaColaborador(e.target.value); setPaginaActual(1); }} placeholder="Escribe el nombre, DNI, área o cargo para buscar..." className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white text-xs text-slate-800 focus:outline-none" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* GRILLA IZQUIERDA */}
        <div className="lg:col-span-2 space-y-4">
          <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-left text-sm text-slate-600">
              <thead style={{ backgroundColor: 'rgb(1, 71, 118)' }} className="text-xs uppercase text-white font-semibold">
                <tr>
                  {subTab === 'categorias' && <th className="px-5 py-3.5">Familia Hardware</th>}
                  {subTab === 'marcas' && <><th className="px-5 py-3.5">Marca</th><th className="px-5 py-3.5">Familia Padre</th></>}
                  {subTab === 'modelos' && <><th className="px-5 py-3.5">Modelo Técnico</th><th className="px-5 py-3.5">Marca Padre</th></>}
                  {subTab === 'estructura' && modoEstructura === 'area' && <><th className="px-5 py-3.5">Área Corporativa</th><th className="px-5 py-3.5">Identificador Visual</th></>}
                  {subTab === 'estructura' && modoEstructura === 'cargo' && <th className="px-5 py-3.5">Cargo Configurado</th>}
                  {subTab === 'usuarios' && <><th className="px-5 py-3.5">Colaborador Autorizado</th><th className="px-5 py-3.5">Área Asignada</th></>}
                  {/* Vista de grilla para condiciones */}
                  {subTab === 'condiciones' && <><th className="px-5 py-3.5">Condición Física</th><th className="px-5 py-3.5">Alerta Color</th></>}
                  <th className="px-5 py-3.5 text-center w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-xs">
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-400 font-medium">⏳ Conectando con base de datos...</td></tr>
                ) : datosPagina.length > 0 ? (
                  datosPagina.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      
                      {subTab === 'categorias' && <td className="px-5 py-3.5 font-semibold text-slate-900 border-r border-slate-200">{item.nombre_categoria}</td>}
                      
                      {subTab === 'marcas' && (
                        <>
                          <td className="px-5 py-3.5 font-semibold text-slate-900 border-r border-slate-200">{item.nombre_marca}</td>
                          <td className="px-5 py-3.5 text-slate-500 font-medium border-r border-slate-200">{item.categorias_activo?.nombre_categoria}</td>
                        </>
                      )}

                      {subTab === 'modelos' && (
                        <>
                          <td className="px-5 py-3.5 font-semibold text-slate-900 border-r border-slate-200">{item.nombre_modelo}</td>
                          <td className="px-5 py-3.5 text-slate-500 font-medium border-r border-slate-200">{item.marcas?.nombre_marca}</td>
                        </>
                      )}

                      {subTab === 'estructura' && modoEstructura === 'area' && (
                        <>
                          <td className="px-5 py-3.5 font-semibold text-slate-900 border-r border-slate-200">{item.nombre_area}</td>
                          <td className="px-5 py-3.5 border-r border-slate-200">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full border shadow-sm" style={{ backgroundColor: item.color_hex }} />
                              <code className="text-[10px] bg-slate-50 border px-1 py-0.5 rounded text-slate-600 font-mono">{item.color_hex}</code>
                            </div>
                          </td>
                        </>
                      )}

                      {subTab === 'estructura' && modoEstructura === 'cargo' && (
                        <td className="px-5 py-3.5 font-semibold text-slate-900 border-r border-slate-200">💼 {item.nombre_cargo}</td>
                      )}

                      {subTab === 'condiciones' && (
                        <>
                          <td className="px-5 py-3.5 font-bold text-slate-900 border-r border-slate-200">⚙️ {item.nombre_estado}</td>
                          <td className="px-5 py-3.5 border-r border-slate-200">
                            <div className="flex items-center gap-2">
                              <span className="w-4 h-4 rounded border" style={{ backgroundColor: item.color_alerta }} />
                              <span className="px-2 py-0.5 rounded text-white font-mono font-bold text-[10px]" style={{ backgroundColor: item.color_alerta }}>{item.color_alerta}</span>
                            </div>
                          </td>
                        </>
                      )}

                      {subTab === 'usuarios' && (
                        <>
                          <td className="px-5 py-3.5 border-r border-slate-200">
                            <div className="font-bold text-slate-900">👤 {item.nombre_completo}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">DNI: {item.dni}</div>
                            <div className="text-[10px] text-slate-500 font-medium mt-0.5">💼 Cargo: {item.cargos?.nombre_cargo || 'Sin Cargo'}</div>
                          </td>
                          <td className="px-5 py-3.5 border-r border-slate-200">
                            {item.areas ? (
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.areas.color_hex }} />
                                <span className="px-2.5 py-0.5 rounded text-white font-bold text-[10px] shadow-sm" style={{ backgroundColor: item.areas.color_hex }}>
                                  {item.areas.nombre_area}
                                </span>
                              </div>
                            ) : <span className="text-slate-400">No vinculada</span>}
                          </td>
                        </>
                      )}

                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-4">
                          <button onClick={() => abrirEditor(item)} className="text-slate-400 hover:text-blue-600 text-sm transition-colors" title="Modificar">✏️</button>
                          <button onClick={() => setModalEliminar({ open: true, id: item.id, tabla: subTab === 'categorias' ? 'categorias_activo' : subTab === 'condiciones' ? 'estados_conservacion' : subTab === 'estructura' ? (modoEstructura === 'area' ? 'areas' : 'cargos') : subTab })} className="text-slate-400 hover:text-red-600 text-sm transition-colors" title="Eliminar">❌</button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-400 border-dashed">No se hallaron registros en esta vista.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* BARRA PAGINACIÓN */}
          <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs gap-3">
            <div className="flex items-center gap-2">
              <span>📄 Mostrar:</span>
              <select value={registrosPorPagina} onChange={(e) => { setRegistrosPorPagina(Number(e.target.value)); setPaginaActual(1); }} className="p-1 border rounded bg-white text-slate-700 outline-none">
                <option value={15}>15 Filas</option>
                <option value={30}>30 Filas</option>
                <option value={50}>50 Filas</option>
              </select>
            </div>
            <span className="font-semibold text-slate-500">Registros {inicioIdx + 1} al {Math.min(inicioIdx + registrosPorPagina, totalFilas)} de {totalFilas} (Página {paginaActual} de {paginasTotales})</span>
            <div className="flex gap-1">
              <button onClick={() => setPaginaActual(p => Math.max(1, p - 1))} disabled={paginaActual === 1} className="px-3 py-1.5 bg-white border rounded font-medium hover:bg-slate-100 disabled:opacity-50">Anterior</button>
              <button onClick={() => setPaginaActual(p => Math.min(paginasTotales, p + 1))} disabled={paginaActual === paginasTotales} className="px-3 py-1.5 bg-white border rounded font-medium hover:bg-slate-100 disabled:opacity-50">Siguiente</button>
            </div>
          </div>
        </div>

        {/* RECUADRO DE FORMULARIO COMPACTO (DERECHA) */}
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-3 text-xs uppercase border-b pb-2 flex justify-between items-center">
            <span>{idEditando ? '✏️ Modificar Atributo' : '➕ Alta Rápida'}</span>
            {idEditando && <button onClick={limpiarFormulario} className="text-[10px] text-red-500 lowercase hover:underline">cancelar</button>}
          </h3>

          <form onSubmit={manejarGuardar} className="space-y-4 text-xs">
            {subTab === 'categorias' && (
              <div>
                <label className="block font-bold text-slate-600 uppercase mb-1">Nombre de Familia Hardware</label>
                <input type="text" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Ej: Pantallas LED" className="w-full p-2 border rounded bg-white outline-none" required />
              </div>
            )}

            {subTab === 'marcas' && (
              <>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Familia Hardware (Padre)</label>
                  <select value={formPadreId} onChange={(e) => setFormPadreId(e.target.value)} className="w-full p-2 border rounded bg-white outline-none" required>
                    <option value="">Seleccione...</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre_categoria}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Nombre de la Marca</label>
                  <input type="text" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Ej: Novastar" className="w-full p-2 border rounded bg-white outline-none" required />
                </div>
              </>
            )}

            {subTab === 'modelos' && (
              <>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Marca Fabricante (Padre)</label>
                  <select value={formPadreId} onChange={(e) => setFormPadreId(e.target.value)} className="w-full p-2 border rounded bg-white outline-none" required>
                    <option value="">Seleccione...</option>
                    {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre_marca}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Nombre del Modelo Técnico</label>
                  <input type="text" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Ej: Taurus T6" className="w-full p-2 border rounded bg-white outline-none" required />
                </div>
              </>
            )}

            {/* Formulario adaptado para condiciones físicas */}
            {subTab === 'condiciones' && (
              <>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Nombre de Condición Física</label>
                  <input type="text" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Ej: Excelente, Moderado, Desgastado" className="w-full p-2 border rounded bg-white outline-none" required />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Color de Alerta Visual</label>
                  <div className="flex gap-2">
                    <input type="color" value={colorArea} onChange={(e) => setColorArea(e.target.value)} className="w-10 h-8 border rounded cursor-pointer bg-white p-1" />
                    <input type="text" value={colorArea} onChange={(e) => setColorArea(e.target.value)} className="flex-1 p-1.5 border rounded bg-white font-mono text-center uppercase" maxLength={7} />
                  </div>
                </div>
              </>
            )}

            {subTab === 'estructura' && modoEstructura === 'area' && (
              <>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Nombre del Área Operativa</label>
                  <input type="text" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Ej: Producción Visual" className="w-full p-2 border rounded bg-white outline-none" required />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Asignar Color Identificador</label>
                  <div className="flex gap-2">
                    <input type="color" value={colorArea} onChange={(e) => setColorArea(e.target.value)} className="w-10 h-8 border rounded cursor-pointer bg-white p-1" />
                    <input type="text" value={colorArea} onChange={(e) => setColorArea(e.target.value)} className="flex-1 p-1.5 border rounded bg-white font-mono text-center uppercase" maxLength={7} />
                  </div>
                </div>
              </>
            )}

            {subTab === 'estructura' && modoEstructura === 'cargo' && (
              <div>
                <label className="block font-bold text-slate-600 uppercase mb-1">Nombre del Cargo Técnico</label>
                <input type="text" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Ej: VJ / Ingeniero de Control" className="w-full p-2 border rounded bg-white outline-none" required />
              </div>
            )}

            {subTab === 'usuarios' && (
              <>
                <div><label className="block font-bold text-slate-600 uppercase mb-1">Colaborador (Nombres y Apellidos)</label><input type="text" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Ej: Jonathan Esquivel" className="w-full p-2 border rounded bg-white outline-none" required /></div>
                <div><label className="block font-bold text-slate-600 uppercase mb-1">Número de DNI</label><input type="text" value={formDni} onChange={(e) => setFormDni(e.target.value)} maxLength={8} placeholder="8 dígitos" className="w-full p-2 border rounded bg-white font-mono outline-none" required /></div>

                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Área Operativa</label>
                  <select value={selectAreaId} onChange={(e) => setSelectAreaId(e.target.value)} className="w-full p-2 border rounded bg-white outline-none" required>
                    <option value="">Seleccione área...</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.nombre_area}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Cargo Corporativo</label>
                  <select value={selectCargoId} onChange={(e) => setSelectCargoId(e.target.value)} className="w-full p-2 border rounded bg-white outline-none" required>
                    <option value="">Seleccione cargo...</option>
                    {cargos.map(c => <option key={c.id} value={c.id}>{c.nombre_cargo}</option>)}
                  </select>
                </div>
              </>
            )}

            <button type="submit" disabled={guardando} style={{ backgroundColor: 'rgb(1, 71, 118)' }} className="w-full py-2.5 text-white font-bold rounded shadow hover:opacity-95 disabled:opacity-50 text-xs">
              {guardando ? 'Sincronizando...' : idEditando ? '💾 Guardar Ficha' : '➕ Confirmar Registro'}
            </button>
          </form>
        </div>
      </div>

      {/* MODAL ELIMINAR */}
      {modalEliminar.open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border p-6 w-full max-w-sm text-center shadow-2xl">
            <span className="text-3xl block mb-2">⚠️</span>
            <h3 className="text-sm font-bold text-slate-800 mb-1">¿Eliminar del Catálogo Maestro?</h3>
            <p className="text-slate-500 text-xs mb-5">Esta operación es irreversible y podría desvincular relaciones del inventario activo.</p>
            <div className="flex justify-center gap-3 text-xs font-bold">
              <button onClick={() => setModalEliminar({ open: false, id: null, tabla: '' })} className="px-4 py-2 bg-slate-100 rounded-lg text-slate-700">Cancelar</button>
              <button onClick={ejecutarEliminar} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">Sí, Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}