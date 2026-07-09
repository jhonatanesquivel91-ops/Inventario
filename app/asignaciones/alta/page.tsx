'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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
        supabase.from('vista_activos_completa').select('*').neq('estado_actual', 'Dado de Baja').order('asignado_usuario_id', { nullsFirst: true }),
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

  const limpiarFormulario = () => {
    setFormTipo('');
    setFormMarca('');
    setFormModelo('');
    setFormSerie('');
    setFormCaf('');
    setFormSpecs('');
    setFormCondicion('Excelente');
    setFormTipoPropiedad('Compra');
    setFormFechaFinAlquiler('');
    setCreandoNuevaFamilia(false); setNuevaFamiliaNombre('');
    setCreandoNuevaMarca(false); setNuevaMarcaNombre('');
    setCreandoNuevoModelo(false); setNuevoModeloNombre('');
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
      const { data: catActual } = await supabase.from('categorias_activo').select('id').eq('nombre_categoria', categoriaFinal).maybeSingle();

      if (creandoNuevaMarca && catActual) {
        await supabase.from('marcas').insert([{ nombre_marca: marcaFinal, categoria_id: catActual.id }]);
      }
      const { data: marcaActual } = await supabase.from('marcas').select('id').eq('nombre_marca', marcaFinal).maybeSingle();

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
        p_estado_actual: 'Disponible en Almacén TI'
      };

      const { data: rpcResponse, error: rpcError } = await supabase.rpc('ingresar_o_actualizar_activo', payload);
      if (rpcError) throw rpcError;

      // 🛠️ DESENVOLVIMIENTO SEGURO DEL ID GENERADO
      let idDesenvuelto = null;
      if (rpcResponse) {
        if (Array.isArray(rpcResponse) && rpcResponse[0]) {
          idDesenvuelto = rpcResponse[0].id || rpcResponse[0];
        } else if (typeof rpcResponse === 'object') {
          idDesenvuelto = rpcResponse.id || rpcResponse;
        } else {
          idDesenvuelto = rpcResponse;
        }
      }

      // 🛟 PLAN DE RESCATE (Jonathan): Si el RPC devolvió null, rescatamos el ID usando el número de serie único
      if (!idDesenvuelto) {
        const { data: activoRescatado } = await supabase
          .from('activos')
          .select('id')
          .eq('serial_id', formSerie.trim())
          .maybeSingle();
        
        if (activoRescatado) {
          idDesenvuelto = activoRescatado.id;
        }
      }

      // Si logramos capturar el ID del nuevo activo, guardamos el Régimen de Propiedad
      if (idDesenvuelto) {
        const { error: propiedadError } = await supabase
          .from('activos')
          .update({
            tipo_propiedad: formTipoPropiedad,
            fecha_fin_alquiler: formTipoPropiedad === 'Alquiler' ? formFechaFinAlquiler || null : null
          })
          .eq('id', idDesenvuelto);

        if (propiedadError) throw propiedadError;

        // Opcional: Guardar también el estado de conservación inicial
        const condicionSeleccionadaObj = condicionesCatalogo.find(c => c.nombre_estado === formCondicion);
        if (condicionSeleccionadaObj) {
          await supabase
            .from('activos')
            .update({ estado_conservacion_id: condicionSeleccionadaObj.id })
            .eq('id', idDesenvuelto);
        }
      }

      lanzarAlerta("✅ Activo creado exitosamente en el Almacén con su régimen.");
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

      // Terminar custodia anterior si el activo ya estaba asignado a alguien
      await supabase
        .from('asignaciones')
        .update({ fecha_devolucion: new Date().toISOString(), estado_asignacion: 'Devuelto' })
        .eq('activo_id', activoId)
        .eq('estado_asignacion', 'Activo');

      // Crear nueva asignación y actualizar el activo
      await supabase.from('asignaciones').insert([{ activo_id: activoId, usuario_id: usuarioFocus.id, estado_asignacion: 'Activo', text_asignacion: 'Asignacion Express' }]);
      await supabase.from('activos').update({ estado_actual: 'Asignado', asignado_usuario_id: usuarioFocus.id }).eq('id', activoId);

      lanzarAlerta("✅ Dispositivo asignado correctamente y custodia actualizada.");
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
    // 🚀 Cambiado de busquedaPredictivaUsr a valorBuscadorUsr para que lea el datalist
    const term = valorBuscadorUsr.toLowerCase().trim();
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

            {/* Indicador visual de verificación exitosa */}
            {usuarioFocus && (
              <span className="text-[10px] text-emerald-600 font-bold animate-fade-in mt-0.5">
                🔒 Colaborador fijado y verificado correctamente.
              </span>
            )}
          </div>
        </div>

        {/* CONTENEDOR EN ESPEJO SIMÉTRICO DE DOS TABLAS */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 flex-1 overflow-hidden h-full items-stretch">

          {/* COLUMNA 1 & 2: LA CUSTODIA CON SORT */}
          <div className="xl:col-span-2 h-full min-h-0">
            <TablaControl
              tituloSeccion={usuarioFocus ? `Custodia de ${usuarioFocus.nombre_completo} (${usuarioFocus.areas?.nombre_area || 'Sin Área'})` : "Custodia Actual"}
              badgeCount={usuarioFocus ? equiposCustodia.length : 0}
              data={usuarioFocus ? equiposCustodia : []}
              loading={loadingCustodia}
              msgVacio={usuarioFocus ? "Este colaborador no registra bienes bajo su nombre." : "Fije un colaborador en la barra de arriba para auditar su stock."}
              columnas={[
                {
                  header: "Categoría / Hardware",
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
              tituloSeccion="Inventario Global de Activos TI"
              badgeCount={activosFiltrados.length}
              data={activosFiltrados}
              loading={loading}
              onRefresh={cargarInformacionBase}
              columnas={[
                {
                  header: "Categoría / Modelo",
                  field: "categoria",
                  render: (a: any) => (
                    <div>
                      <span className="font-black text-blue-900">[{a.categoria}]</span>
                      <span className="text-slate-800 ml-1.5 font-bold">{a.marca} {a.modelo}</span>
                    </div>
                  )
                },
                {
                  header: "Identificadores",
                  field: "serial_id",
                  render: (a: any) => (
                    <div className="flex flex-col space-y-0.5">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase mr-1">S/N:</span>
                        <code className="bg-slate-50 border px-1.5 py-0.5 rounded font-mono font-bold text-slate-600 text-[10px]">{a.serial_id}</code>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase mr-1">CAF:</span>
                        <span className="font-mono font-bold text-slate-500 text-[10px]">{a.caf || '—'}</span>
                      </div>
                    </div>
                  )
                },
                {
                  header: "Custodio / Estado",
                  field: "estado_actual",
                  render: (a: any) => {
                    const esLibre = !a.asignado_usuario_id;
                    
                    // Cruce en el frontend: Buscamos al usuario en la lista local por su ID
                    const usuarioCustodio = !esLibre 
                      ? usuarios.find(u => String(u.id) === String(a.asignado_usuario_id))
                      : null;

                    return (
                      <div className="flex flex-col">
                        <span className={`text-[10px] font-bold ${esLibre ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {esLibre ? '🟢 Disponible en TI' : ' Custodiado'}
                        </span>
                        {!esLibre && (
                          <span 
                            className="text-[9px] text-slate-600 font-black max-w-[180px] truncate mt-0.5" 
                            title={usuarioCustodio ? usuarioCustodio.nombre_completo : `ID: ${a.asignado_usuario_id}`}
                          >
                            👤 {usuarioCustodio ? usuarioCustodio.nombre_completo : `Cargando custodio (ID: ${a.asignado_usuario_id})...`}
                          </span>
                        )}
                      </div>
                    );
                  }
                },
                {
                  header: "Acción",
                  className: "text-right w-20",
                  render: (a: any) => {
                    const esMismoUsuario = usuarioFocus && a.asignado_usuario_id === usuarioFocus.id;
                    return (
                      <button
                        type="button"
                        onClick={() => ejecutarAsignacion(a.id)}
                        disabled={guardando || !usuarioFocus || esMismoUsuario}
                        className="px-2.5 py-1 text-white text-[10px] font-bold rounded-lg shadow disabled:opacity-30 transition-all active:scale-95"
                        style={{ backgroundColor: 'rgb(1, 71, 118)' }}
                      >
                        {a.asignado_usuario_id ? 'Reasignar' : 'Asignar'}
                      </button>
                    );
                  }
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
                  limpiarFormulario(); // 🧽 Limpia todo rastro del registro anterior
                  setModalFormOpen(true);
                }}
                className="p-1.5 text-white font-black text-[11px] uppercase rounded-md shadow-sm transition-all"
                style={{ backgroundColor: 'rgb(1, 71, 118)' }}
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