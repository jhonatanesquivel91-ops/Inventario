'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { TablaActivos } from '../../components/TablaActivos';
import * as XLSX from 'xlsx';

// Datos estáticos para simular la estructura en cascada: Tipo > Marca > Modelo
const ESTRUCTURA_HARDWARE: Record<string, Record<string, string[]>> = {
  Laptop: {
    Lenovo: ['ThinkPad T14', 'ThinkPad L14', 'Legion 5'],
    HP: ['ProBook 450 G8', 'EliteBook 840', 'ZBook Firefly'],
    Dell: ['Latitude 5420', 'XPS 13', 'Precision 3560']
  },
  Monitor: {
    LG: ['24MK430H', '27UL500-W'],
    Samsung: ['T35F', 'Odyssey G3'],
    Dell: ['P2422H', 'U2422H']
  },
  Celular: {
    Samsung: ['Galaxy S23', 'Galaxy A54'],
    Apple: ['iPhone 14 Pro', 'iPhone 15']
  },
  Teclado: {
    Logitech: ['K120', 'MX Keys', 'G213'],
    Genius: ['Smart KB-100']
  },
  Mouse: {
    Logitech: ['M170', 'MX Master 3S'],
    Genius: ['DX-120']
  },
  Impresora: {
    HP: ['LaserJet Pro M404dn'],
    Epson: ['EcoTank L3250']
  }
};

export default function PaginaActivos() {
  const [tabActivo, setTabActivo] = useState<'malla' | 'importador'>('malla');
  const [activos, setActivos] = useState<any[]>([]);
  const [activosDadosBaja, setActivosDadosBaja] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [categoriasCatalogo] = useState<string[]>(Object.keys(ESTRUCTURA_HARDWARE));

  // Filtros y Paginación
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [ordenarPor, setOrdenarPor] = useState('categoria');
  const [registrosPorPagina, setRegistrosPorPagina] = useState(10);
  const [paginaActual, setPaginaActual] = useState(1);
  const [seleccionados, setSeleccionados] = useState<number[]>([]);

  // Estados de Modales Dinámicos
  const [modalFormulario, setModalFormulario] = useState<{ open: boolean; modo: 'alta' | 'edicion'; activo?: any }>({ open: false, modo: 'alta' });
  const [modalConfirmarBaja, setModalConfirmarBaja] = useState<{ open: boolean; id: number | null; masivo: boolean }>({ open: false, id: null, masivo: false });
  const [modalConfirmarEliminar, setModalConfirmarEliminar] = useState<{ open: boolean; id: number | null; masivo: boolean }>({ open: false, id: null, masivo: false });

  // Estado del Formulario Unificado (Modal)
  const [formTipo, setFormTipo] = useState('Laptop');
  const [formMarca, setFormMarca] = useState('');
  const [formModelo, setFormModelo] = useState('');
  const [formSerie, setFormSerie] = useState('');
  const [formCaf, setFormCaf] = useState('');
  const [formSpecs, setFormSpecs] = useState('');
  const [formEstado, setFormEstado] = useState('Disponible en Almacén TI');
  const [guardando, setGuardando] = useState(false);

  // Estados para el Módulo de Observaciones / Comentarios
  const [modalComentarios, setModalComentarios] = useState<{ open: boolean; activoId: number | null; numeroSerie: string }>({ open: false, activoId: null, numeroSerie: '' });
  const [listaComentarios, setListaComentarios] = useState<any[]>([]);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [tipoObs, setTipoObs] = useState('General');
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  // Estado dinámico real para categorías de la BD
  const [categoriasDinamicas, setCategoriasDinamicas] = useState<string[]>([]);
  const [nuevaCategoriaInput, setNuevaCategoriaInput] = useState(''); // Para agregar nuevas al vuelo

  // Estado Carga Masiva Archivo
  const [archivoExcel, setArchivoExcel] = useState<File | null>(null);
  const [procesandoMasivo, setProcesandoMasivo] = useState(false);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const resOperativos = await supabase.from('vista_activos_completa').select('*').neq('estado_actual', 'Dado de Baja');
      const resBajas = await supabase.from('vista_activos_completa').select('*').eq('estado_actual', 'Dado de Baja');
      // Traer las categorías reales de la tabla maestra
      const resCategorias = await supabase.from('categorias_activo').select('nombre_categoria');

      if (resOperativos.error) throw resOperativos.error;
      if (resBajas.error) throw resBajas.error;

      setActivos((resOperativos.data || []).map(item => ({ ...item, id: item.activo_id })));
      setActivosDadosBaja((resBajas.data || []).map(item => ({ ...item, id: item.activo_id })));

      if (resCategorias.data) {
        setCategoriasDinamicas(resCategorias.data.map(c => c.nombre_categoria));
      }
    } catch (err: any) {
      alert(`Error de sincronización: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const abrirHistorialComentarios = async (id: number, serie: string) => {
    setModalComentarios({ open: true, activoId: id, numeroSerie: serie });
    try {
      const { data, error } = await supabase
        .from('comentarios_activo')
        .select('*')
        .eq('activo_id', id)
        .order('fecha_registro', { ascending: false });
      if (error) throw error;
      setListaComentarios(data || []);
    } catch (err: any) { alert(err.message); }
  };

  const guardarComentario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoComentario.trim() || !modalComentarios.activoId) return;

    try {
      setEnviandoComentario(true);
      const { error } = await supabase.from('comentarios_activo').insert([{
        activo_id: modalComentarios.activoId,
        comentario: nuevoComentario.trim(),
        tipo_observacion: tipoObs,
        creado_por: 'Jonathan (Admin TI)'
      }]);

      if (error) throw error;

      setNuevoComentario('');
      // Recargar la lista de comentarios de este activo
      abrirHistorialComentarios(modalComentarios.activoId, modalComentarios.numeroSerie);
    } catch (err: any) { alert(err.message); } finally { setEnviandoComentario(false); }
  };
  const manejarAlternarTodos = () => {
    const idsPagina = datosPaginaActual.map(a => a.id);
    const todosMarcados = idsPagina.every(id => seleccionados.includes(id));
    if (todosMarcados) {
      setSeleccionados(prev => prev.filter(id => !idsPagina.includes(id)));
    } else {
      setSeleccionados(prev => [...Array.from(new Set([...prev, ...idsPagina]))]);
    }
  };
  useEffect(() => {
    cargarDatos();
  }, []);

  // Manejo de la Cascada en el Formulario
  useEffect(() => {
    if (modalFormulario.modo === 'alta') {
      const marcasDisponibles = Object.keys(ESTRUCTURA_HARDWARE[formTipo] || {});
      setFormMarca(marcasDisponibles[0] || '');
    }
  }, [formTipo, modalFormulario.modo]);

  useEffect(() => {
    if (modalFormulario.modo === 'alta') {
      const modelosDisponibles = ESTRUCTURA_HARDWARE[formTipo]?.[formMarca] || [];
      setFormModelo(modelosDisponibles[0] || '');
    }
  }, [formMarca, formTipo, modalFormulario.modo]);

  const abrirModalAlta = () => {
    setFormTipo('Laptop');
    setFormMarca(Object.keys(ESTRUCTURA_HARDWARE['Laptop'])[0]);
    setFormModelo(ESTRUCTURA_HARDWARE['Laptop'][Object.keys(ESTRUCTURA_HARDWARE['Laptop'])[0]][0]);
    setFormSerie('');
    setFormCaf('');
    setFormSpecs('');
    setFormEstado('Disponible en Almacén TI');
    setModalFormulario({ open: true, modo: 'alta' });
  };

  const abrirModalEdicion = (id: number) => {
    const item = activos.find(a => a.id === id);
    if (item) {
      setFormTipo(item.categoria || 'Laptop');
      setFormMarca(item.marca || '');
      setFormModelo(item.modelo || '');
      setFormSerie(item.serial_id || '');
      setFormCaf(item.caf || '');
      setFormSpecs(item.especificaciones || '');
      setFormEstado(item.estado_actual || 'Disponible en Almacén TI');
      setModalFormulario({ open: true, modo: 'edicion', activo: item });
    }
  };

  const manejarGuardarOActualizar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSerie.trim()) return alert("El Número de Serie es obligatorio.");

    try {
      setGuardando(true);

      // Creamos el objeto limpio con los parámetros requeridos por tu RPC
      const payload = {
        p_id: modalFormulario.modo === 'alta' ? null : modalFormulario.activo.id,
        p_serial_id: formSerie.trim(),
        p_nombre_categoria: formTipo,
        p_nombre_marca: formMarca,
        p_nombre_modelo: formModelo,
        p_caf: formCaf.trim() || null,
        p_especificaciones: formSpecs.trim() || null,
        p_estado_actual: formEstado
      };

      // Llamamos a la función inteligente de la base de datos
      const { error } = await supabase.rpc('ingresar_o_actualizar_activo', payload);

      if (error) throw error;

      // Cierre silencioso y recarga automática sin molestos popups arriba
      setModalFormulario({ open: false, modo: 'alta' });
      cargarDatos();
    } catch (err: any) {
      alert(`❌ Error en Base de Datos: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const ejecutarBaja = async () => {
    try {
      if (modalConfirmarBaja.masivo) {
        const { error } = await supabase.from('activos').update({ estado_actual: 'Dado de Baja' }).in('id', seleccionados);
        if (error) throw error;
        setSeleccionados([]);
      } else {
        const { error } = await supabase.from('activos').update({ estado_actual: 'Dado de Baja' }).eq('id', modalConfirmarBaja.id);
        if (error) throw error;
      }
      setModalConfirmarBaja({ open: false, id: null, masivo: false });
      cargarDatos();
    } catch (err: any) { alert(err.message); }
  };

  const ejecutarEliminacion = async () => {
    try {
      if (modalConfirmarEliminar.masivo) {
        const { error } = await supabase.from('activos').delete().in('id', seleccionados);
        if (error) throw error;
        setSeleccionados([]);
      } else {
        const { error } = await supabase.from('activos').delete().eq('id', modalConfirmarEliminar.id);
        if (error) throw error;
      }
      setModalConfirmarEliminar({ open: false, id: null, masivo: false });
      cargarDatos();
    } catch (err: any) { alert(err.message); }
  };

  const manejarReactivarHardware = async (id: number) => {
    try {
      const { error } = await supabase.from('activos').update({ estado_actual: 'Disponible en Almacén TI' }).eq('id', id);
      if (error) throw error;
      alert("🔄 El equipo ha sido reactivado y devuelto al inventario operativo.");
      cargarDatos();
    } catch (err: any) { alert(err.message); }
  };

  const descargarPlantilla = () => {
    const estructura = [
      { 'Número de Serie': 'SNDEMO123', 'Tipo de Hardware': 'Laptop', 'Marca': 'Lenovo', 'Modelo': 'ThinkPad T14', 'Especificaciones': '16GB RAM, 512GB SSD', 'Código Patrimonial': 'CAF-00921' }
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(estructura);
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Inventario");
    XLSX.writeFile(wb, "Plantilla_Importacion_Activos.xlsx");
  };

  const manejarProcesarPlantillaExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivoExcel) return alert("Por favor, selecciona un archivo de Excel primero.");

    try {
      setProcesandoMasivo(true);
      const reader = new FileReader();

      reader.onload = async (evt) => {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const nombreHoja = workbook.SheetNames[0];
        const hoja = workbook.Sheets[nombreHoja];

        const filasJson: any[] = XLSX.utils.sheet_to_json(hoja);
        const loteTransaccional: any[] = [];

        filasJson.forEach((row: any) => {
          const serie = row.serial_id || row['Número de Serie'] || row['serial'];
          const tipo = row.tipo_activo || row['Tipo de Hardware'] || row['categoria'];
          const marcaExcel = row.marca || row['Marca'] || '';
          const modeloExcel = row.modelo || row['Modelo'] || '';

          if (serie && tipo) {
            loteTransaccional.push({
              serial_id: String(serie).trim(),
              categoria: String(tipo).trim(),
              marca: String(marcaExcel).trim(),
              modelo: String(modeloExcel).trim(),
              especificaciones: row.especificaciones || row['Especificaciones'] || null,
              caf: row.caf || row['Código Patrimonial'] || null,
              estado_actual: 'Disponible en Almacén TI',
              anio_fabricacion: 2026,
              tipo_propiedad: 'Compra'
            });
          }
        });

        if (loteTransaccional.length === 0) {
          alert("❌ Formato de plantilla incorrecto.");
          setProcesandoMasivo(false);
          return;
        }

        for (const fila of loteTransaccional) {
          const { error } = await supabase.rpc('ingresar_o_actualizar_activo', {
            p_id: null,
            p_serial_id: fila.serial_id,
            p_nombre_categoria: fila.categoria,
            p_nombre_marca: fila.marca,
            p_nombre_modelo: fila.modelo,
            p_caf: fila.caf,
            p_especificaciones: fila.especificaciones,
            p_estado_actual: fila.estado_actual
          });
          if (error) throw error;
        }

        alert(`🚀 Sincronización masiva exitosa! Se procesaron ${loteTransaccional.length} registros desde el archivo.`);
        setArchivoExcel(null);
        setTabActivo('malla');
        cargarDatos();
      };

      reader.readAsBinaryString(archivoExcel);
    } catch (err: any) {
      alert(`Error al procesar el archivo Excel: ${err.message}`);
    } finally {
      setProcesandoMasivo(false);
    }
  };

  // Filtrado y paginación
  const activosFiltrados = activos.filter((item) => {
    const coincideEstado = filtroEstado === 'Todos' || item.estado_actual === filtroEstado;

    const termino = busqueda.toLowerCase().trim();
    if (!termino) return coincideEstado;

    // Si hay término, evaluamos coincidencia en cualquier columna crítica
    const coincideFiltroGlobal =
      String(item.serial_id || '').toLowerCase().includes(termino) ||
      String(item.marca || '').toLowerCase().includes(termino) ||
      String(item.modelo || '').toLowerCase().includes(termino) ||
      String(item.categoria || '').toLowerCase().includes(termino) ||
      String(item.caf || '').toLowerCase().includes(termino) ||
      String(item.especificaciones || '').toLowerCase().includes(termino) || // 👈 Permite buscar "i7", "16GB", etc.
      String(item.asignado_a_persona || '').toLowerCase().includes(termino) || // 👈 Permite buscar por nombre de usuario asignado
      String(item.area_asignada || '').toLowerCase().includes(termino);

    return coincideEstado && coincideFiltroGlobal;
  });

  const activosOrdenados = [...activosFiltrados].sort((a, b) =>
    String(a[ordenarPor] || '').toLowerCase().localeCompare(String(b[ordenarPor] || '').toLowerCase())
  );

  const totalFilas = activosOrdenados.length;
  const paginasTotales = Math.max(1, Math.ceil(totalFilas / registrosPorPagina));
  const paginaSegura = paginaActual > paginasTotales ? paginasTotales : paginaActual;
  const inicioIdx = (paginaSegura - 1) * registrosPorPagina;
  const finIdx = inicioIdx + registrosPorPagina;
  const datosPaginaActual = activosOrdenados.slice(inicioIdx, finIdx);

  return (
    <main className="min-h-screen bg-white p-8 text-slate-800">
      <div className="flex border-b border-slate-200 mb-6 gap-2 bg-slate-50 p-2 rounded-xl">
        <button onClick={() => setTabActivo('malla')} className={`px-4 py-2 font-semibold text-sm rounded-lg transition-all ${tabActivo === 'malla' ? 'bg-white border shadow-sm text-blue-800 font-bold' : 'text-slate-500 hover:text-slate-800'}`} style={tabActivo === 'malla' ? { borderColor: 'rgb(1, 71, 118)' } : {}}>📋 Consola de Stock Integrada</button>
        <button onClick={() => setTabActivo('importador')} className={`px-4 py-2 font-semibold text-sm rounded-lg transition-all ${tabActivo === 'importador' ? 'bg-white border shadow-sm text-blue-800 font-bold' : 'text-slate-500 hover:text-slate-800'}`} style={tabActivo === 'importador' ? { borderColor: 'rgb(1, 71, 118)' } : {}}>📥 Importador Express (Excel)</button>
      </div>

      {tabActivo === 'malla' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-1" style={{ color: 'rgb(1, 71, 118)' }}>📦 Almacén Central de Stock TI</h1>
              <p className="text-slate-500">Consola maestra modular para la administración física de hardware.</p>
            </div>
            <button onClick={abrirModalAlta} className="px-5 py-2.5 text-white text-sm font-semibold rounded-xl shadow transition-all hover:bg-opacity-90" style={{ backgroundColor: 'rgb(1, 71, 118)' }}>
              ➕ Registrar Activo Manual
            </button>
          </div>

          {/* FILTROS SUPERIORES */}
          <div className="mb-6 bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Barra de Búsqueda Inteligente:</label>
              <input type="text" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }} placeholder="Escribe para buscar..." className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-sm font-semibold text-slate-700 mb-1">Disponibilidad de Stock:</label><select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setPaginaActual(1); }} className="w-full p-2 border rounded-lg bg-white text-slate-800"><option value="Todos">Todos los estados</option><option value="Disponible en Almacén TI">Disponible en Almacén TI</option><option value="Asignado">Asignado</option><option value="En Soporte">En Soporte</option></select></div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-1">Ordenamiento:</label><select value={ordenarPor} onChange={(e) => setOrdenarPor(e.target.value)} className="w-full p-2 border rounded-lg bg-white text-slate-800"><option value="categoria">Categoría</option><option value="serial_id">Número de Serie</option><option value="caf">Código CAF</option></select></div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-1">Filas por Página:</label><select value={registrosPorPagina} onChange={(e) => { setRegistrosPorPagina(Number(e.target.value)); setPaginaActual(1); }} className="w-full p-2 border rounded-lg bg-white text-slate-800"><option value={10}>10 Registros</option><option value={30}>30 Registros</option><option value={50}>50 Registros</option></select></div>
            </div>
          </div>

          {/* BARRA ACCIONES MASIVAS */}
          {seleccionados.length > 0 && (
            <div className="mb-4 bg-blue-50 border border-blue-200 p-4 rounded-xl flex justify-between items-center">
              <span className="text-sm font-semibold text-blue-800">Elementos marcados: <b>{seleccionados.length}</b></span>
              <div className="flex gap-3">
                <button onClick={() => setModalConfirmarBaja({ open: true, id: null, masivo: true })} className="px-4 py-2 bg-amber-600 text-white font-medium text-xs rounded-lg hover:bg-amber-700">Dar de Baja Seleccionados</button>
                <button onClick={() => setModalConfirmarEliminar({ open: true, id: null, masivo: true })} className="px-4 py-2 bg-red-600 text-white font-medium text-xs rounded-lg hover:bg-red-700">Eliminar Permanentemente</button>
              </div>
            </div>
          )}

          {/* TABLA PRINCIPAL */}
          {loading ? (
            <div className="text-center py-10 text-slate-500 font-medium">⏳ Conectando con Supabase...</div>
          ) : totalFilas > 0 ? (
            <>
              <TablaActivos
                activos={datosPaginaActual}
                seleccionados={seleccionados}
                onAlternarSeleccion={(id) => setSeleccionados(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])}
                onAlternarTodos={manejarAlternarTodos} // 👈 Ahora que ya existe la función, la pasas así de limpio
                onEditar={abrirModalEdicion}
                onBaja={(id) => setModalConfirmarBaja({ open: true, id, masivo: false })}
                onEliminar={(id) => setModalConfirmarEliminar({ open: true, id, masivo: false })}
                onVerComentarios={abrirHistorialComentarios}
              />
              <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <button onClick={() => setPaginaActual(p => Math.max(1, p - 1))} disabled={paginaSegura === 1} className="px-4 py-2 bg-white border rounded-lg font-medium hover:bg-slate-100 disabled:opacity-50">Anterior</button>
                <span className="text-sm font-semibold text-slate-600">Registros {inicioIdx + 1} al {Math.min(finIdx, totalFilas)} de {totalFilas} (Página {paginaSegura} de {paginasTotales})</span>
                <button onClick={() => setPaginaActual(p => Math.min(paginasTotales, p + 1))} disabled={paginaSegura === paginasTotales} className="px-4 py-2 bg-white border rounded-lg font-medium hover:bg-slate-100 disabled:opacity-50">Siguiente</button>
              </div>
            </>
          ) : (
            <div className="bg-slate-50 border border-dashed rounded-lg p-8 text-center text-slate-500">No se encontraron registros activos.</div>
          )}

          {/* HISTÓRICO DE BAJAS */}
          <div className="mt-12 border-t border-slate-200 pt-6">
            <h3 className="text-xl font-bold text-red-700 mb-2">Módulo de Rescate Histórico de Bajas TI</h3>
            <p className="text-sm text-slate-500 mb-4">Equipos retirados del inventario activo. Puedes reactivarlos en caso de error.</p>
            {activosDadosBaja.length > 0 ? (
              <div className="space-y-2">
                {activosDadosBaja.map((b) => (
                  <div key={b.id} className="flex flex-col sm:flex-row items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100 gap-4">
                    <span className="text-xs sm:text-sm text-red-900 font-medium">
                      💀 <b>[{b.categoria}]</b> {b.marca || 'Genérica'} {b.modelo || 'Estándar'} ── Serie: <code className="bg-white/80 px-1.5 py-0.5 rounded border text-red-800">{b.serial_id}</code>
                    </span>
                    <button onClick={() => manejarReactivarHardware(b.id)} className="px-3 py-1 bg-white border border-red-200 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm">
                      🔄 Reactivar Hardware
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400 bg-slate-50 p-4 rounded-xl border border-dashed text-center">No hay equipos dados de baja.</div>
            )}
          </div>
        </>
      )}

      {/* IMPORTADOR MASIVO */}
      {tabActivo === 'importador' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold mb-1" style={{ color: 'rgb(1, 71, 118)' }}>📥 Módulo de Carga Inteligente desde Archivos de Excel</h1>
              <p className="text-slate-500 text-sm">Sube tu archivo oficial completado para sincronizar el inventario en bloque.</p>
            </div>
            <button onClick={descargarPlantilla} className="px-4 py-2 border font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 bg-white border-slate-300 text-slate-700 hover:bg-slate-50">
              📥 Descargar Plantilla Excel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form onSubmit={manejarProcesarPlantillaExcel} className="border-2 border-dashed border-slate-300 rounded-xl p-8 bg-slate-50 text-center flex flex-col justify-center items-center">
              <span className="text-4xl mb-2 block">📊</span>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Selecciona tu archivo .xlsx o .xls</label>
              <input type="file" accept=".xlsx, .xls" onChange={(e) => setArchivoExcel(e.target.files?.[0] || null)} className="block text-xs text-slate-500 mx-auto mb-4 bg-white p-2 border rounded-lg" />
              {archivoExcel && <p className="text-xs text-green-700 font-semibold mb-4">📎 Archivo cargado: {archivoExcel.name}</p>}
              <button type="submit" disabled={procesandoMasivo || !archivoExcel} style={{ backgroundColor: 'rgb(1, 71, 118)' }} className="px-6 py-2.5 text-white font-semibold rounded-lg text-sm w-full shadow disabled:opacity-50">
                {procesandoMasivo ? '⚙️ Inyectando filas...' : '🚀 Iniciar Subida'}
              </button>
            </form>

            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-sm text-slate-600">
              <span className="font-bold text-slate-800 block mb-3 text-base">📋 Columnas requeridas en la plantilla:</span>
              <div className="space-y-2">
                <div className="bg-white p-2.5 rounded border border-slate-200 font-mono text-xs"><b>Número de Serie</b> (Obligatorio)</div>
                <div className="bg-white p-2.5 rounded border border-slate-200 font-mono text-xs"><b>Tipo de Hardware</b> (Obligatorio)</div>
                <div className="bg-white p-2.5 rounded border border-slate-200 font-mono text-xs"><b>Marca</b> | <b>Modelo</b> | <b>Especificaciones</b> | <b>Código Patrimonial</b></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================================
          MODAL UNIFICADO: FORMULARIO ALTA Y EDICIÓN TOTAL DEL ACTIVO
          ============================================================================= */}
      {modalFormulario.open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'rgb(1, 71, 118)' }}>
              {modalFormulario.modo === 'alta' ? '➕ Registrar Nuevo Hardware' : '✏️ Editar Todo del Activo'}
            </h2>
            <form onSubmit={manejarGuardarOActualizar} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tipo de Hardware *</label>
                <select value={formTipo} onChange={(e) => setFormTipo(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white text-sm">
                  {categoriasCatalogo.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Marca Fabricante *</label>
                {modalFormulario.modo === 'alta' ? (
                  <select value={formMarca} onChange={(e) => setFormMarca(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white text-sm">
                    {Object.keys(ESTRUCTURA_HARDWARE[formTipo] || {}).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input type="text" value={formMarca} onChange={(e) => setFormMarca(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm" required />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Modelo Técnico *</label>
                {modalFormulario.modo === 'alta' ? (
                  <select value={formModelo} onChange={(e) => setFormModelo(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white text-sm">
                    {(ESTRUCTURA_HARDWARE[formTipo]?.[formMarca] || []).map(mod => <option key={mod} value={mod}>{mod}</option>)}
                  </select>
                ) : (
                  <input type="text" value={formModelo} onChange={(e) => setFormModelo(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm" required />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Número de Serie *</label>
                <input type="text" value={formSerie} onChange={(e) => setFormSerie(e.target.value)} placeholder="Serie única de fábrica" className="w-full p-2.5 border rounded-lg text-sm" required />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Código Patrimonial (CAF)</label>
                <input type="text" value={formCaf} onChange={(e) => setFormCaf(e.target.value)} placeholder="Código interno" className="w-full p-2.5 border rounded-lg text-sm" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Especificaciones Técnicas</label>
                <input type="text" value={formSpecs} onChange={(e) => setFormSpecs(e.target.value)} placeholder="Ej: 16GB RAM, 512GB SSD" className="w-full p-2.5 border rounded-lg text-sm" />
              </div>

              {modalFormulario.modo === 'edicion' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Estado Operativo</label>
                  <select value={formEstado} onChange={(e) => setFormEstado(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white text-sm">
                    <option value="Disponible en Almacén TI">Disponible en Almacén TI</option>
                    <option value="Asignado">Asignado</option>
                    <option value="En Soporte">En Soporte</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setModalFormulario({ open: false, modo: 'alta' })} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm">Cancelar</button>
                <button type="submit" disabled={guardando} style={{ backgroundColor: 'rgb(1, 71, 118)' }} className="px-5 py-2 text-white font-semibold rounded-lg text-sm disabled:opacity-50">
                  {guardando ? 'Guardando...' : '💾 Guardar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR BAJA */}
      {modalConfirmarBaja.open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border p-6 w-full max-w-sm text-center">
            <span className="text-3xl block mb-2">☣️</span>
            <h3 className="text-lg font-bold text-slate-800 mb-2">¿Confirmar Acción de Baja?</h3>
            <p className="text-slate-500 text-sm mb-5">El o los equipos seleccionados se moverán inmediatamente al depósito histórico.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setModalConfirmarBaja({ open: false, id: null, masivo: false })} className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-700">Cancelar</button>
              <button onClick={ejecutarBaja} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold">Sí, Dar de Baja</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINAR */}
      {modalConfirmarEliminar.open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border p-6 w-full max-w-sm text-center">
            <span className="text-3xl block mb-2">⚠️</span>
            <h3 className="text-lg font-bold text-red-700 mb-2">¿Eliminar Permanentemente?</h3>
            <p className="text-slate-500 text-sm mb-5">Esta operación es irreversible. Eliminará el registro físico físico completo de la Base de Datos.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setModalConfirmarEliminar({ open: false, id: null, masivo: false })} className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-700">Cancelar</button>
              <button onClick={ejecutarEliminacion} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold">Sí, Eliminar Registro</button>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================================
          MODAL: BITÁCORA HISTÓRICA DE OBSERVACIONES Y COMENTARIOS DEL ACTIVO
          ============================================================================= */}
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

            {/* FORMULARIO DE NUEVA OBSERVACIÓN */}
            <form onSubmit={guardarComentario} className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex gap-2">
                <select
                  value={tipoObs}
                  onChange={(e) => setTipoObs(e.target.value)}
                  className="p-1.5 border rounded-lg bg-white text-xs font-semibold text-slate-700"
                >
                  <option value="General">📝 General</option>
                  <option value="Repotenciación">🚀 Repotenciación</option>
                  <option value="Falla">⚠️ Falla Técnica</option>
                  <option value="Mantenimiento">🔧 Mantenimiento</option>
                </select>
                <span className="text-xs text-slate-400 flex items-center">Registrar evento</span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevoComentario}
                  onChange={(e) => setNuevoComentario(e.target.value)}
                  placeholder="Ej: Cargador fallando, se cambia por repuesto..."
                  className="flex-1 p-2 border rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-800"
                  required
                />
                <button
                  type="submit"
                  disabled={enviandoComentario}
                  style={{ backgroundColor: 'rgb(1, 71, 118)' }}
                  className="px-4 py-2 text-white font-semibold rounded-lg text-xs disabled:opacity-50 transition-opacity"
                >
                  {enviandoComentario ? 'Guardando...' : 'Añadir'}
                </button>
              </div>
            </form>

            {/* LÍNEA DE TIEMPO (TIMELINE) */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {listaComentarios.length > 0 ? (
                listaComentarios.map((c) => {
                  const esFalla = c.tipo_observacion === 'Falla';
                  const esRepotenciacion = c.tipo_observacion === 'Repotenciación';
                  const esMantenimiento = c.tipo_observacion === 'Mantenimiento';

                  return (
                    <div
                      key={c.id}
                      className={`p-3 rounded-xl border text-xs transition-all ${esFalla ? 'bg-red-50/50 border-red-100' : esRepotenciacion ? 'bg-green-50/50 border-green-100' : esMantenimiento ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100'
                        }`}
                    >
                      <div className="flex justify-between items-center mb-1 text-slate-400 font-medium">
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase ${esFalla ? 'bg-red-100 text-red-800' : esRepotenciacion ? 'bg-green-100 text-green-800' : esMantenimiento ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                          }`}>
                          {c.tipo_observacion}
                        </span>
                        <span>{new Date(c.fecha_registro).toLocaleString('es-PE')}</span>
                      </div>
                      <p className="text-slate-800 font-medium">{c.comentario}</p>
                      <span className="text-[10px] text-slate-400 block mt-1">✍️ Registrado por: {c.creado_por}</span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs border border-dashed rounded-xl">
                  No hay observaciones registradas para este equipo.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}