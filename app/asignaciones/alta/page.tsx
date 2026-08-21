'use client';

import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { crearFiltro } from '@/lib/busqueda';
import { useSoportaLineaTelefonica } from '@/lib/capacidades';
import { ContenedorVista } from '@/components/ContenedorVista';
import { TablaControl } from '@/components/TablaControl';
import { ModalFormularioActivo } from '@/components/ModalFormularioActivo';

export default function AsignacionExpress() {

  // ... dentro de AsignacionExpress:
  const [modalFormOpen, setModalFormOpen] = useState(false);
  const [condicionesCatalogo, setCondicionesCatalogo] = useState<any[]>([]);
  const [marcasCatalogo, setMarcasCatalogo] = useState<any[]>([]);
  const [modelosCatalogo, setModelosCatalogo] = useState<any[]>([]);

  // Campos del formulario automatizado
  const [formTipo, setFormTipo] = useState('');
  const [formMarca, setFormMarca] = useState('');
  const [formModelo, setFormModelo] = useState('');
  const [formSerie, setFormSerie] = useState('');
  const [formCaf, setFormCaf] = useState('');
  const [formSpecs, setFormSpecs] = useState('');
  const [formLinea, setFormLinea] = useState('');
  const soportaLinea = useSoportaLineaTelefonica();
  const [formCondicion, setFormCondicion] = useState('Excelente');
  const [formTipoPropiedad, setFormTipoPropiedad] = useState<'Compra' | 'Alquiler'>('Compra');
  const [formFechaFinAlquiler, setFormFechaFinAlquiler] = useState('');

  // Creadores rápidos inline
  const [creandoNuevaFamilia, setCreandoNuevaFamilia] = useState(false);
  const [nuevaFamiliaNombre, setNuevaFamiliaNombre] = useState('');
  const [creandoNuevaMarca, setCreandoNuevaMarca] = useState(false);
  const [nuevaMarcaNombre, setNuevaMarcaNombre] = useState('');
  const [creandoNuevoModelo, setCreandoNuevoModelo] = useState(false);
  const [nuevoModeloNombre, setNuevoModeloNombre] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingCustodia, setLoadingCustodia] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [mostrarDropdownUsr, setMostrarDropdownUsr] = useState(false);

  // Estados base
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [activosDisponibles, setActivosDisponibles] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);

  // Custodia focus
  const [usuarioFocus, setUsuarioFocus] = useState<any | null>(null);
  const [licenciasPersona, setLicenciasPersona] = useState<any[]>([]);
  const [equiposCustodia, setEquiposCustodia] = useState<any[]>([]);

  // Filtros unificados 
  const [areaFiltroId, setAreaFiltroId] = useState('Todos');
  const [valorBuscadorUsr, setValorBuscadorUsr] = useState('');

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
      const [rUsr, rAct, rArea, rCat, rMar, rMod, rCond] = await Promise.all([
        supabase.from('usuarios').select('*, areas(*), cargos(*)').order('nombre_completo'),
        supabase.from('vista_activos_completa').select('*').eq('estado_actual', 'Disponible en Almacén TI'),
        supabase.from('areas').select('*').order('nombre_area'),
        supabase.from('categorias_activo').select('*').order('nombre_categoria'),
        supabase.from('marcas').select('*').order('nombre_marca'),
        supabase.from('modelos').select('*').order('nombre_modelo'),
        supabase.from('estados_conservacion').select('*').order('nombre_estado')
      ]);

      if (rUsr.data) setUsuarios(rUsr.data);
      if (rArea.data) setAreas(rArea.data);
      if (rCat.data) setCategorias(rCat.data);
      if (rMar.data) setMarcasCatalogo(rMar.data);
      if (rMod.data) setModelosCatalogo(rMod.data);
      if (rCond.data) setCondicionesCatalogo(rCond.data);

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

  // Función para guardar desde Asignación Express
  const manejarGuardarOActualizar = async (e: React.FormEvent) => {
    e.preventDefault();
    let categoriaFinal = creandoNuevaFamilia ? nuevaFamiliaNombre.trim() : formTipo.trim();
    let marcaFinal = creandoNuevaMarca ? nuevaMarcaNombre.trim() : formMarca.trim();
    let modeloFinal = creandoNuevoModelo ? nuevoModeloNombre.trim() : formModelo.trim();

    try {
      setGuardando(true);

      if (creandoNuevaFamilia) {
        await supabase.from('categorias_activo').insert([{ nombre_categoria: categoriaFinal }]);
      }
      const { data: catActual } = await supabase.from('categorias_activo').select('id').eq('nombre_categoria', categoriaFinal).single();

      if (creandoNuevaMarca && catActual) {
        await supabase.from('marcas').insert([{ nombre_marca: marcaFinal, categoria_id: catActual.id }]);
      }
      const { data: marcaActual } = await supabase.from('marcas').select('id').eq('nombre_marca', marcaFinal).single();

      if (creandoNuevoModelo && marcaActual) {
        await supabase.from('modelos').insert([{ nombre_modelo: modeloFinal, marca_id: marcaActual.id }]);
      }

      const payload = {
        p_id: null,
        p_serial_id: formSerie.trim(),
        p_nombre_categoria: categoriaFinal,
        p_nombre_marca: marcaFinal,
        p_nombre_modelo: modeloFinal,
        p_caf: formCaf.trim() || null,
        p_especificaciones: formSpecs.trim() || null,
        p_estado_actual: 'Disponible en Almacén TI',
        ...(soportaLinea ? { p_linea_telefonica: formLinea.trim() || null } : {})
      };

      const { error: rpcError } = await supabase.rpc('ingresar_o_actualizar_activo', payload);
      if (rpcError) throw rpcError;

      lanzarAlerta("✅ Activo creado exitosamente en el Almacén.");
      setModalFormOpen(false);
      cargarInformacionBase();
    } catch (err: any) {
      if (err.message?.includes('activos_serial_id_key')) {
        lanzarAlerta(`⚠️ La serie "${formSerie.trim()}" ya existe en la Universidad.`);
      } else {
        lanzarAlerta(`❌ Error: ${err.message}`);
      }
    } finally {
      setGuardando(false);
    }
  };

  useEffect(() => {
    cargarInformacionBase();
  }, []);

  const cargarLicenciasPersona = async (userId: number) => {
    // Si la migración de licencias aún no se ejecutó, la consulta falla: se
    // deja la lista vacía en vez de romper la pantalla de custodia.
    const { data, error } = await supabase
      .from('licencias_asignaciones')
      .select('id, cuenta_activacion, licencias(id, nombre_servicio, proveedor, plan, estado)')
      .eq('usuario_id', userId)
      .eq('estado_asignacion', 'Activo');

    setLicenciasPersona(error ? [] : (data || []));
  };

  const cargarCustodiaPersona = async (userId: number) => {
    try {
      setLoadingCustodia(true);
      void cargarLicenciasPersona(userId);

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

  // 🔍 FILTRADO INTELIGENTE PREDICTIVO DEL SELECTOR SUPERIOR (CORREGIDO)
  const colaboradoresFiltrados = usuarios.filter(u => {
    const coincideArea = areaFiltroId === 'Todos' || String(u.area_id) === areaFiltroId;
    const coincideTexto = crearFiltro<any>(valorBuscadorUsr, ['nombre_completo', 'dni', 'areas.nombre_area', 'cargos.nombre_cargo'])(u);
    return coincideArea && coincideTexto;
  });

  // Filtrado de la tabla Almacén
  const activosFiltrados = activosDisponibles.filter(a => {
    return (catHw === 'Todos' || String(a.categoria) === catHw) &&
      crearFiltro<any>(busquedaHw, ['serial_id', 'marca', 'modelo', 'caf', 'categoria', 'especificaciones', 'linea_telefonica', 'nombre_estado'])(a);
  });

  return (
    <ContenedorVista
      titulo="📥 Módulo de Asignación Express"
      subtitulo="Asigne equipamiento disponible de TI o retire responsabilidades de custodia física de inmediato."
      badgeStatus="online"
    >
      {alerta && (
        <div className="fixed top-4 right-4 z-[100] px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xl">
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

          {/* SELECTOR CON BUSCADOR ESTÁTICO DE ANCHO COMPLETO */}
          <div className="w-full sm:w-3/4 flex flex-col space-y-1 relative">
            <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Escribe Nombre o DNI para Fijar Colaborador:</span>
            
            <div className="relative w-full">
              <input
                type="text"
                value={valorBuscadorUsr}
                onFocus={() => setMostrarDropdownUsr(true)}
                onBlur={() => {
                  // Pequeño delay para permitir que el clic en la opción se procese antes de ocultar el menú
                  setTimeout(() => setMostrarDropdownUsr(false), 200);
                }}
                onChange={(e) => {
                  const entrada = e.target.value;
                  setValorBuscadorUsr(entrada);

                  // Si el usuario borra el texto, rompemos el foco por seguridad estricta
                  const usuarioEncontrado = usuarios.find(
                    u => `${u.nombre_completo} (🪪 DNI: ${u.dni || 'S/D'})` === entrada
                  );
                  if (!usuarioEncontrado) {
                    setUsuarioFocus(null);
                    setEquiposCustodia([]);
                    setLicenciasPersona([]);
                  }
                }}
                placeholder="🔍 Haz clic o escribe para buscar por Nombre o DNI..."
                className="w-full p-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-lg font-black text-slate-800 outline-none text-xs shadow-inner transition-all"
              />

              {/* Menú desplegable estático alineado al 100% del ancho del input */}
              {mostrarDropdownUsr && colaboradoresFiltrados.length > 0 && (
                <div className="absolute left-0 right-0 bg-white border border-slate-200 rounded-lg max-h-48 overflow-y-auto z-[60] mt-1 shadow-xl divide-y w-full">
                  {colaboradoresFiltrados.slice(0, 6).map((u) => (
                    <div
                      key={u.id}
                      onMouseDown={() => {
                        // Usamos onMouseDown porque se ejecuta antes que el onBlur del input
                        const textoOpcion = `${u.nombre_completo} (🪪 DNI: ${u.dni || 'S/D'})`;
                        setValorBuscadorUsr(textoOpcion);
                        setUsuarioFocus(u);
                        cargarCustodiaPersona(u.id);
                        setMostrarDropdownUsr(false);
                      }}
                      className="p-2 hover:bg-slate-100 cursor-pointer font-bold text-slate-700 text-xs transition-colors flex justify-between items-center w-full"
                    >
                      <span>👤 {u.nombre_completo}</span>
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border">
                        🪪 DNI: {u.dni || 'S/D'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Mensaje en caso de que escriba algo que no exista */}
              {mostrarDropdownUsr && valorBuscadorUsr.trim() !== '' && colaboradoresFiltrados.length === 0 && (
                <div className="absolute left-0 right-0 bg-red-50 border border-red-200 text-red-700 p-2 rounded-lg text-[11px] font-bold z-[60] mt-1 shadow-md w-full">
                  ⚠️ El colaborador no existe o no pertenece al área.
                </div>
              )}
            </div>

            {/* Ficha del colaborador fijado. Todos estos datos ya venían en la
                consulta `select('*, areas(*), cargos(*)')`: antes no se pintaban
                y obligaban a consultarlos en otra pantalla. */}
            {usuarioFocus && (
              <div className="mt-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm animate-fade-in">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="font-black text-sm text-slate-900">
                    👤 {usuarioFocus.nombre_completo}
                  </span>

                  <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    DNI {usuarioFocus.dni || 'S/D'}
                  </span>

                  {usuarioFocus.areas?.nombre_area && (
                    <span className="text-[11px] font-bold" style={{ color: 'var(--color-upeu-texto)' }}>
                      🏢 {usuarioFocus.areas.nombre_area}
                    </span>
                  )}

                  {usuarioFocus.cargos?.nombre_cargo && (
                    <span className="text-[11px] font-semibold text-slate-600">
                      💼 {usuarioFocus.cargos.nombre_cargo}
                    </span>
                  )}

                  <span className="ml-auto text-[11px] font-black text-slate-700">
                    {equiposCustodia.length} {equiposCustodia.length === 1 ? 'equipo' : 'equipos'}
                    {licenciasPersona.length > 0 && ` · ${licenciasPersona.length} ${licenciasPersona.length === 1 ? 'licencia' : 'licencias'}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CONTENEDOR EN ESPEJO SIMÉTRICO DE DOS TABLAS */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 flex-1 overflow-hidden h-full items-stretch">

          {/* COLUMNA 1 & 2: LA CUSTODIA CON SORT */}
          <div className="xl:col-span-2 h-full min-h-0 flex flex-col gap-3">
            <div className="flex-1 min-h-0">
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
                  movil: 'titulo' as const,
                  render: (eq: any) => (
                    <div>
                      <Link href={`/activos/${eq.id}`} className="font-bold text-slate-900 hover:underline block">
                        [{eq.categoria}] {eq.marca} {eq.modelo}
                      </Link>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">S/N: <b className="text-slate-600">{eq.serial_id}</b></div>
                      {/* Aquí vive el número de línea en los celulares: era el dato
                          que obligaba a abrir una segunda pestaña. */}
                      {eq.especificaciones && (
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5 leading-tight">
                          {eq.especificaciones}
                        </div>
                      )}
                      {eq.linea_telefonica && (
                        <div className="text-[10px] font-mono font-bold mt-0.5" style={{ color: 'var(--color-upeu-texto)' }}>
                          📱 {eq.linea_telefonica}
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  header: "Patrimonio CAF",
                  field: "caf", // Habilita Sort
                  render: (eq: any) => <code className="bg-slate-100 border px-1.5 py-0.5 rounded font-mono font-bold text-slate-700 text-[10px]">{eq.caf || '—'}</code>
                },
                {
                  // Condición física: es lo que se verifica equipo por equipo
                  // durante la auditoría por áreas.
                  header: "Estado",
                  field: "nombre_estado",
                  render: (eq: any) => (
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide text-white whitespace-nowrap"
                      style={{ backgroundColor: eq.color_alerta || '#64748b' }}
                    >
                      {eq.nombre_estado || 'Sin evaluar'}
                    </span>
                  )
                },
                {
                  header: "Operación",
                  className: "text-right w-16",
                  movil: 'accion' as const,
                  render: (eq: any) => (
                    <button type="button" onClick={() => ejecutarLiberacion(eq.id)} disabled={guardando} className="px-2 py-0.5 text-red-600 hover:bg-red-50 border border-red-100 font-bold rounded-md text-[10px] transition-all active:scale-95">
                      Quitar
                    </button>
                  )
                }
              ]}
            />
            </div>

            {/* Licencias de software del mismo colaborador.
                Es la razón de tener el módulo dentro del inventario: cuando
                alguien se va, aquí se ve de una vez qué equipos recuperar y
                qué accesos desactivar. */}
            {usuarioFocus && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-shrink-0 max-h-[32%] flex flex-col overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200 flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    🔑 Licencias
                  </span>
                  <span className="bg-slate-200/80 text-slate-700 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {licenciasPersona.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                  {licenciasPersona.length === 0 ? (
                    <p className="text-center py-4 text-[11px] font-bold text-slate-400">
                      Sin licencias asignadas.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {licenciasPersona.map((l: any) => (
                        <div key={l.id} className="px-4 py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 text-[11px] truncate">
                              {l.licencias?.nombre_servicio || 'Licencia'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium truncate">
                              {[l.licencias?.proveedor, l.licencias?.plan].filter(Boolean).join(' · ')}
                              {l.cuenta_activacion ? ` · ${l.cuenta_activacion}` : ''}
                            </div>
                          </div>
                          {l.licencias?.estado && l.licencias.estado !== 'Activa' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase text-white bg-rose-600 whitespace-nowrap">
                              {l.licencias.estado}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
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
                      style={{ backgroundColor: 'var(--color-upeu)' }}
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
              <button
                type="button"
                onClick={() => {
                  setFormTipo(''); setFormMarca(''); setFormModelo(''); setFormSerie(''); setFormCaf(''); setFormSpecs('');
                  setModalFormOpen(true);
                }}
                className="p-1.5 bg-blue-800 text-white font-black text-[11px] uppercase rounded-md shadow-sm transition-all"
                style={{ backgroundColor: 'var(--color-upeu)' }}
              >
                ➕ Crear Activo
              </button>
            </TablaControl>
          </div>

        </div>

      </div>
      <ModalFormularioActivo
        isOpen={modalFormOpen}
        onClose={() => setModalFormOpen(false)}
        modo="alta"
        onSubmit={manejarGuardarOActualizar}
        guardando={guardando}
        condicionesCatalogo={condicionesCatalogo}
        categoriasCatalogo={categorias}
        marcasCatalogo={marcasCatalogo}
        modelosCatalogo={modelosCatalogo}
        formTipo={formTipo} setFormTipo={setFormTipo}
        formMarca={formMarca} setFormMarca={setFormMarca}
        formModelo={formModelo} setFormModelo={setFormModelo}
        formSerie={formSerie} setFormSerie={setFormSerie}
        formCaf={formCaf} setFormCaf={setFormCaf}
        formSpecs={formSpecs} setFormSpecs={setFormSpecs}
        formLinea={formLinea} setFormLinea={setFormLinea} soportaLinea={soportaLinea}
        formCondicion={formCondicion} setFormCondicion={setFormCondicion}
        formTipoPropiedad={formTipoPropiedad} setFormTipoPropiedad={setFormTipoPropiedad}
        formFechaFinAlquiler={formFechaFinAlquiler} setFormFechaFinAlquiler={setFormFechaFinAlquiler}
        creandoNuevaFamilia={creandoNuevaFamilia} setCreandoNuevaFamilia={setCreandoNuevaFamilia}
        nuevaFamiliaNombre={nuevaFamiliaNombre} setNuevaFamiliaNombre={setNuevaFamiliaNombre}
        creandoNuevaMarca={creandoNuevaMarca} setCreandoNuevaMarca={setCreandoNuevaMarca}
        nuevaMarcaNombre={nuevaMarcaNombre} setNuevaMarcaNombre={setNuevaMarcaNombre}
        creandoNuevoModelo={creandoNuevoModelo} setCreandoNuevoModelo={setCreandoNuevoModelo}
        nuevoModeloNombre={nuevoModeloNombre} setNuevoModeloNombre={setNuevoModeloNombre}
      />
    </ContenedorVista>
  );
}