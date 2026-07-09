'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { HeaderVista } from '@/components/HeaderVista';
import { TablaControl } from '@/components/TablaControl';
import { BuscadorControl } from '@/components/BuscadorControl';
import { FiltroSelect } from '@/components/FiltroSelect';
import { ModalBase } from '@/components/ModalBase';
import { BitacoraNotas } from '@/components/BitacoraNotas';
import { ModalFormularioActivo } from '@/components/ModalFormularioActivo';
import * as XLSX from 'xlsx';

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

export default function StockActivosPage() {
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Estados de datos
  const [activos, setActivos] = useState<any[]>([]);
  const [categoriasCatalogo, setCategoriasCatalogo] = useState<any[]>([]);
  const [marcasCatalogo, setMarcasCatalogo] = useState<any[]>([]); // 👈 NUEVO
  const [modelosCatalogo, setModelosCatalogo] = useState<any[]>([]); // 👈 NUEVO
  const [listaComentarios, setListaComentarios] = useState<any[]>([]);

  // Estados para capturar valores nuevos ingresados sobre la marcha
  const [creandoNuevaFamilia, setCreandoNuevaFamilia] = useState(false);
  const [nuevaFamiliaNombre, setNuevaFamiliaNombre] = useState('');

  const [creandoNuevaMarca, setCreandoNuevaMarca] = useState(false);
  const [nuevaMarcaNombre, setNuevaMarcaNombre] = useState('');

  const [creandoNuevoModelo, setCreandoNuevoModelo] = useState(false);
  const [nuevoModeloNombre, setNuevoModeloNombre] = useState('');

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [seleccionados, setSeleccionados] = useState<number[]>([]);

  // Modales
  const [modalForm, setModalForm] = useState<{ open: boolean; modo: 'alta' | 'edicion'; activo?: any }>({ open: false, modo: 'alta' });
  const [modalConfirmarBaja, setModalConfirmarBaja] = useState<{ open: boolean; id: number | null; masivo: boolean; restaurar: boolean }>({ open: false, id: null, masivo: false, restaurar: false });
  const [modalConfirmarEliminar, setModalConfirmarEliminar] = useState<{ open: boolean; id: number | null; masivo: boolean }>({ open: false, id: null, masivo: false });
  const [modalExcel, setModalExcel] = useState(false);
  const [modalComments, setModalComments] = useState<{ open: boolean; id: number | null; serie: string }>({ open: false, id: null, serie: '' });

  // Formulario Estados (Campos Automatizados)
  const [formTipo, setFormTipo] = useState('Laptop');
  const [formMarca, setFormMarca] = useState('');
  const [formModelo, setFormModelo] = useState('');
  const [formSerie, setFormSerie] = useState('');
  const [formCaf, setFormCaf] = useState('');
  const [formSpecs, setFormSpecs] = useState('');
  const [formCondicion, setFormCondicion] = useState('Excelente');

  // 🆕 NUEVOS ESTADOS DE PROPIEDAD Y ADQUISICIÓN
  const [formTipoPropiedad, setFormTipoPropiedad] = useState<'Compra' | 'Alquiler'>('Compra');
  const [formFechaFinAlquiler, setFormFechaFinAlquiler] = useState('');

  const [condicionesCatalogo, setCondicionesCatalogo] = useState<any[]>([]);

  const [nuevoComentario, setNuevoComentario] = useState('');
  const [tipoObs, setTipoObs] = useState('General');
  const [archivoExcel, setArchivoExcel] = useState<File | null>(null);
  const [alerta, setAlerta] = useState<string | null>(null);

  const lanzarAlerta = (msg: string) => {
    setAlerta(msg);
    setTimeout(() => setAlerta(null), 3500);
  };

  // 🆕 HELPER PARA EVALUAR ALERTAS DE ALQUILER (10 DÍAS ANTES)
  const evaluarAlertaAlquiler = (fechaFinStr: string) => {
    if (!fechaFinStr) return { urgente: false, diasRestantes: null };
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaFin = new Date(fechaFinStr);
    fechaFin.setHours(0, 0, 0, 0);

    const diferenciaTiempo = fechaFin.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diferenciaTiempo / (1000 * 60 * 60 * 24));

    // Alerta si faltan 10 días o menos, o si ya venció
    return {
      urgente: diasRestantes <= 10,
      vencido: diasRestantes < 0,
      diasRestantes
    };
  };

  const cargarDatos = async () => {
    try {
      setLoading(true);

      // 1. Consultamos el RPC que ya junta áreas y colores planos en el servidor
      const { data: dataRpc, error: errorRpc } = await supabase.rpc('obtener_reporte_activos');
      if (errorRpc) throw errorRpc;

      // 2. Traemos el resto de catálogos para los formularios
      const [rCondiciones, rCategorias, rMarcas, rModelos] = await Promise.all([
        supabase.from('estados_conservacion').select('*').order('nombre_estado'),
        supabase.from('categorias_activo').select('*').order('nombre_categoria'),
        supabase.from('marcas').select('*').order('nombre_marca'),
        supabase.from('modelos').select('*').order('nombre_modelo')
      ]);

      if (rCondiciones.error) throw rCondiciones.error;

      // 3. Seteamos la data limpia directamente
      setActivos(dataRpc || []);
      setCondicionesCatalogo(rCondiciones.data || []);

      if (rCategorias.data) setCategoriasCatalogo(rCategorias.data);
      if (rMarcas.data) setMarcasCatalogo(rMarcas.data);
      if (rModelos.data) setModelosCatalogo(rModelos.data);

    } catch (err: any) {
      lanzarAlerta(`❌ Error de carga: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    cargarDatos();
  }, []);
  // 💡 Nota: Los dos useEffect viejos que monitoreaban formTipo y formMarca se eliminaron para que no limpien tu formulario.

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    // SOLO autoselecciona la primera marca si estamos registrando un alta nueva
    if (modalForm.open && modalForm.modo === 'alta') {
      const marcas = Object.keys(ESTRUCTURA_HARDWARE[formTipo] || {});
      setFormMarca(marcas[0] || '');
    }
  }, [formTipo, modalForm.modo, modalForm.open]);

  useEffect(() => {
    // SOLO autoselecciona el primer modelo si estamos registrando un alta nueva
    if (modalForm.open && modalForm.modo === 'alta') {
      const models = ESTRUCTURA_HARDWARE[formTipo]?.[formMarca] || [];
      setFormModelo(models[0] || '');
    }
  }, [formMarca, formTipo, modalForm.modo, modalForm.open]);

  const descargarPlantillaModelo = () => {
    const estructura = [{ 'Número de Serie': 'SNDEMO123', 'Tipo de Hardware': 'Laptop', 'Marca': 'Lenovo', 'Modelo': 'ThinkPad T14', 'Especificaciones': '16GB RAM', 'Código Patrimonial': 'CAF-01' }];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(estructura);
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "Plantilla_Importacion_TI.xlsx");
  };

  const manejarProcesarPlantillaExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivoExcel) return;
    try {
      setGuardando(true);
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const workbook = XLSX.read(evt.target?.result, { type: 'binary' });
        const filas: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        for (const f of filas) {
          const serie = f.serial_id || f['Número de Serie'];
          const cat = f.categoria || f['Tipo de Hardware'];
          if (serie && cat) {
            await supabase.rpc('ingresar_o_actualizar_activo', {
              p_id: null,
              p_serial_id: String(serie).trim(),
              p_nombre_categoria: String(cat).trim(),
              p_nombre_marca: String(f.Marca || f.marca || ''),
              p_nombre_modelo: String(f.Modelo || f.modelo || ''),
              p_caf: f.caf || f['Código Patrimonial'] || null,
              p_especificaciones: f.especificaciones || f['Especificaciones'] || null,
              p_estado_actual: 'Disponible en Almacén TI'
            });
          }
        }
        lanzarAlerta("🚀 Carga masiva completada con éxito.");
        setArchivoExcel(null); setModalExcel(false); cargarDatos();
      };
      reader.readAsBinaryString(archivoExcel);
    } catch (err: any) { lanzarAlerta(`❌ Error: ${err.message}`); } finally { setGuardando(false); }
  };

  const metricasTI = useMemo(() => {
    return {
      total: activos.length,
      
      // 1. En custodia: Tiene un custodio asignado en la BD
      asignados: activos.filter(a => a.nombre_completo && a.nombre_completo.trim() !== '').length,

      // 2. Stock Disponible: No tiene dueño Y su estado de conservación NO es 'Dado de Baja'
      disponibles: activos.filter(a => !a.nombre_completo && a.nombre_estado !== 'Dado de Baja').length,

      // 3. Dados de Baja: Su estado de conservación en Postgres es explícitamente 'Dado de Baja'
      bajas: activos.filter(a => a.nombre_estado === 'Dado de Baja').length
    };
  }, [activos]);

  const activosFiltrados = useMemo(() => {
    return activos.filter((item) => {
      const coincideCategoria = filtroCategoria === 'Todos' || item.categoria === filtroCategoria;
      const term = busqueda.toLowerCase().trim();
      if (!term) return coincideCategoria;
      return coincideCategoria && (
        String(item.serial_id || '').toLowerCase().includes(term) ||
        String(item.marca || '').toLowerCase().includes(term) ||
        String(item.modelo || '').toLowerCase().includes(term) ||
        String(item.categoria || '').toLowerCase().includes(term) ||
        String(item.caf || '').toLowerCase().includes(term) ||
        String(item.nombre_completo || '').toLowerCase().includes(term)
      );
    });
  }, [activos, busqueda, filtroCategoria]);

  // 1. FILTRO REAL: Familia Hardware ➡️ Fabricante (Marca)
  const marcasFiltradasBD = useMemo(() => {
    if (!formTipo) return [];

    const categoriaSeleccionadaObj = categoriasCatalogo.find(
      cat => String(cat.nombre_categoria).toLowerCase().trim() === formTipo.toLowerCase().trim()
    );

    if (!categoriaSeleccionadaObj) return [];

    const filtradas = marcasCatalogo
      .filter(m => Number(m.categoria_id) === Number(categoriaSeleccionadaObj.id))
      .map(m => m.nombre_marca);

    return Array.from(new Set(filtradas)).sort();
  }, [marcasCatalogo, categoriasCatalogo, formTipo]);

  // 2. FILTRO REAL CORREGIDO: Filtra los modelos cruzando Marca Y el ID de la Familia seleccionada
  const modelosFiltradosBD = useMemo(() => {
    if (!formMarca || !formTipo) return [];

    // Buscamos el ID de la familia actual
    const categoriaSeleccionadaObj = categoriasCatalogo.find(
      cat => String(cat.nombre_categoria).toLowerCase().trim() === formTipo.toLowerCase().trim()
    );
    if (!categoriaSeleccionadaObj) return [];

    // Buscamos la marca que coincide con el nombre Y que además pertenece a la familia seleccionada (Solución para Samsung Celular vs Monitor)
    const marcaSeleccionadaObj = marcasCatalogo.find(
      m => String(m.nombre_marca).toLowerCase().trim() === formMarca.toLowerCase().trim() &&
        Number(m.categoria_id) === Number(categoriaSeleccionadaObj.id)
    );

    if (!marcaSeleccionadaObj) return [];

    const filtrados = modelosCatalogo
      .filter(mod => Number(mod.marca_id) === Number(marcaSeleccionadaObj.id))
      .map(mod => mod.nombre_modelo);

    return Array.from(new Set(filtrados)).sort();
  }, [modelosCatalogo, marcasCatalogo, formMarca, formTipo, categoriasCatalogo]);
  const ejecutarExportacionExcel = async () => {
    if (activosFiltrados.length === 0) return lanzarAlerta("⚠️ No hay datos para exportar.");
    try {
      setLoading(true);
      const { data: allComments } = await supabase.from('observaciones_activos').select('*').order('fecha_registro', { ascending: false });

      const dataPlana = activosFiltrados.map(a => {
        const comentariosDelActivo = (allComments || []).filter(c => c.activo_id === a.id);
        let celdaComentarios = "No hay comentarios";
        if (comentariosDelActivo.length > 0) {
          celdaComentarios = comentariosDelActivo.map(c => `${c.tipo_observacion}: ${c.comentario} (${new Date(c.fecha_registro).toLocaleDateString('es-PE')})`).join(' | ');
        }

        return {
          'Categoría': a.categoria,
          'Marca': a.marca,
          'Modelo': a.modelo,
          'Número de Serie': a.serial_id,
          'Código CAF': a.caf || 'N/A',
          'Especificaciones Técnicas': a.especificaciones || 'Sin detalles', // 👈 ¡COLUMNA RESTAURADA AQUÍ!
          'Régimen Propiedad': a.tipo_propiedad || 'Compra',
          'Vencimiento Alquiler': a.fecha_fin_alquiler ? new Date(a.fecha_fin_alquiler).toLocaleDateString('es-PE') : 'N/A',
          'Condición Física': a.condicion || 'Excelente',
          'Estado Operativo': a.estado_actual,
          'Custodio Asignado': a.nombre_completo || 'Almacén Central TI',
          'Fecha Registro': a.fecha_registro ? new Date(a.fecha_registro).toLocaleDateString('es-PE') : new Date().toLocaleDateString('es-PE'),
          'Historial Comentarios': celdaComentarios
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataPlana);
      XLSX.utils.book_append_sheet(wb, ws, "Inventario_Malla");
      XLSX.writeFile(wb, `Reporte_TI_Posgrado.xlsx`);
      lanzarAlerta("📊 Reporte descargado.");
    } catch (err: any) { lanzarAlerta(`❌ Error: ${err.message}`); } finally { setLoading(false); }
  };

  const manejarAlternarTodos = (checked: boolean) => {
    setSeleccionados(checked ? activosFiltrados.map(a => a.id) : []);
  };

  const abrirModalAlta = () => {
    setFormTipo(''); setFormMarca(''); setFormModelo(''); setFormSerie(''); setFormCaf(''); setFormSpecs('');
    setFormTipoPropiedad('Compra'); setFormFechaFinAlquiler('');
    // Reseteamos estados inline
    setCreandoNuevaFamilia(false); setNuevaFamiliaNombre('');
    setCreandoNuevaMarca(false); setNuevaMarcaNombre('');
    setCreandoNuevoModelo(false); setNuevoModeloNombre('');
    setModalForm({ open: true, modo: 'alta' });
  };

  const abrirModalEdicion = (item: any) => {
    setFormTipo(item.categoria || 'Laptop');
    setFormMarca(item.marca || '');
    setFormModelo(item.modelo || '');
    setFormSerie(item.serial_id || '');
    setFormCaf(item.caf || '');
    setFormSpecs(item.especificaciones || '');
    setFormCondicion(item.nombre_estado || item.condicion || condicionesCatalogo[0]?.nombre_estado || 'Excelente');

    // 🆕 CARGAR VALORES ADQUIRIDOS DE LA BD
    setFormTipoPropiedad(item.tipo_propiedad === 'Alquiler' ? 'Alquiler' : 'Compra');
    setFormFechaFinAlquiler(item.fecha_fin_alquiler || '');

    setModalForm({ open: true, modo: 'edicion', activo: item });
  };

  const manejarGuardarOActualizar = async (e: React.FormEvent) => {
    e.preventDefault();

    // Resolvemos los textos finales que se enviarán a la base de datos
    let categoriaFinal = creandoNuevaFamilia ? nuevaFamiliaNombre.trim() : formTipo.trim();
    let marcaFinal = creandoNuevaMarca ? nuevaMarcaNombre.trim() : formMarca.trim();
    let modeloFinal = creandoNuevoModelo ? nuevoModeloNombre.trim() : formModelo.trim();

    if (!formSerie.trim()) return lanzarAlerta("La serie es requerida.");
    if (!categoriaFinal) return lanzarAlerta("Especifique la familia del hardware.");
    if (!marcaFinal) return lanzarAlerta("Especifique el fabricante o marca.");
    if (!modeloFinal) return lanzarAlerta("Especifique el modelo técnico.");

    try {
      setGuardando(true);

      // --- INYECCIÓN EN CASCADA INTELIGENTE DIRECTO EN LAS TABLAS ---

      // 1. Si creó una familia nueva, la insertamos primero en categorias_activo
      if (creandoNuevaFamilia) {
        const { error: errCat } = await supabase
          .from('categorias_activo')
          .insert([{ nombre_categoria: categoriaFinal }]);
        if (errCat && !errCat.message.includes('duplicate')) throw errCat;
      }

      // Volvemos a consultar la categoría de forma segura usando .maybeSingle() para evitar el error 406
      const { data: catActual } = await supabase
        .from('categorias_activo')
        .select('id')
        .eq('nombre_categoria', categoriaFinal)
        .maybeSingle();

      // 2. Si creó una marca nueva, la asociamos directamente al ID de la familia activa
      if (creandoNuevaMarca && catActual) {
        const { error: errMar } = await supabase
          .from('marcas')
          .insert([{ nombre_marca: marcaFinal, categoria_id: catActual.id }]);
        if (errMar && !errMar.message.includes('duplicate')) throw errMar;
      }

      // Consultamos la marca de forma segura
      const { data: marcaActual } = await supabase
        .from('marcas')
        .select('id')
        .eq('nombre_marca', marcaFinal)
        .maybeSingle();

      // 3. Si creó un modelo nuevo, lo asociamos directamente al ID de la marca activa
      if (creandoNuevoModelo && marcaActual) {
        const { error: errMod } = await supabase
          .from('modelos')
          .insert([{ nombre_modelo: modeloFinal, marca_id: marcaActual.id }]);
        if (errMod && !errMod.message.includes('duplicate')) throw errMod;
      }

      // --- ENVIAR AL RPC ORIGINAL ---
      const estadoCalculado = modalForm.modo === 'alta' ? 'Disponible en Almacén TI' : modalForm.activo.estado_actual;

      const payload = {
        p_id: modalForm.modo === 'alta' ? null : modalForm.activo.id,
        p_serial_id: formSerie.trim(),
        p_nombre_categoria: categoriaFinal,
        p_nombre_marca: marcaFinal,
        p_nombre_modelo: modeloFinal,
        p_caf: formCaf.trim() || null,
        p_especificaciones: formSpecs.trim() || null,
        p_estado_actual: estadoCalculado
      };

      // Guardamos / Actualizamos la entidad base a través del RPC
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

      // 🛟 PLAN DE RESCATE (Jonathan): Si es alta y el RPC devolvió null, rescatamos el ID usando el número de serie único
      if (modalForm.modo === 'alta' && !idDesenvuelto) {
        const { data: activoRescatado } = await supabase
          .from('activos')
          .select('id')
          .eq('serial_id', formSerie.trim())
          .maybeSingle();

        if (activoRescatado) {
          idDesenvuelto = activoRescatado.id;
        }
      }

      // Determinamos el ID real final con el que operaremos
      const activoIdReal = modalForm.modo === 'alta' ? idDesenvuelto : modalForm.activo.id;

      if (activoIdReal) {
        // --- ACTUALIZACIÓN DE PROPIEDAD Y ADQUISICIÓN CONTROLADA ---
        const { error: propiedadError } = await supabase
          .from('activos')
          .update({
            tipo_propiedad: formTipoPropiedad,
            fecha_fin_alquiler: formTipoPropiedad === 'Alquiler' ? formFechaFinAlquiler || null : null
          })
          .eq('id', activoIdReal);

        if (propiedadError) throw propiedadError;

        // Actualizamos también el estado de conservación si es necesario
        const condicionSeleccionadaObj = condicionesCatalogo.find(c => c.nombre_estado === formCondicion);
        if (condicionSeleccionadaObj) {
          await supabase
            .from('activos')
            .update({ estado_conservacion_id: condicionSeleccionadaObj.id })
            .eq('id', activoIdReal);
        }
      } else {
        console.warn("⚠️ No se pudo determinar el ID del activo ni con el plan de rescate.");
      }

      // Limpiamos los estados de creación rápida al finalizar con éxito
      setCreandoNuevaFamilia(false); setNuevaFamiliaNombre('');
      setCreandoNuevaMarca(false); setNuevaMarcaNombre('');
      setCreandoNuevoModelo(false); setNuevoModeloNombre('');

      setModalForm({ open: false, modo: 'alta' });
      lanzarAlerta("✅ Activo y parámetros de régimen guardados correctamente.");
      cargarDatos();
    } catch (err: any) {
      if (err.message?.includes('activos_serial_id_key') || err.details?.includes('already exists')) {
        lanzarAlerta(`⚠️ El número de serie "${formSerie.trim()}" ya está registrado en el sistema.`);
      } else {
        lanzarAlerta(`❌ Error al guardar parámetros: ${err.message}`);
      }
    } finally {
      setGuardando(false);
    }
  };
  const ejecutarBajaORestauracion = async () => {
    try {
      setGuardando(true);
      const targets = modalConfirmarBaja.masivo ? seleccionados : [modalConfirmarBaja.id];
      const nuevoEstado = modalConfirmarBaja.restaurar ? 'Disponible en Almacén TI' : 'Dado de Baja';
      // 🛠️ Si es baja, ponemos asignado_usuario_id en null para que ya no le pertenezca a nadie
      const payloadUpdate: any = { estado_actual: nuevoEstado };
      if (!modalConfirmarBaja.restaurar) {
        payloadUpdate.asignado_usuario_id = null;
      }

      const { error } = await supabase.from('activos').update(payloadUpdate).in('id', targets);
      if (error) throw error;

      setSeleccionados([]);
      setModalConfirmarBaja({ open: false, id: null, masivo: false, restaurar: false });
      lanzarAlerta(modalConfirmarBaja.restaurar ? "🔄 Hardware restaurado en stock." : "✅ Registro enviado a bajas.");
      cargarDatos();
    } catch (err: any) { lanzarAlerta(`❌ Error: ${err.message}`); } finally { setGuardando(false); }
  };

  const ejecutarLiberacionMasiva = async () => {
    if (seleccionados.length === 0) return;
    try {
      setGuardando(true);

      // 1. Terminamos las asignaciones activas de los equipos seleccionados
      await supabase.from('asignaciones')
        .update({ fecha_devolucion: new Date().toISOString(), estado_asignacion: 'Devuelto' })
        .in('activo_id', seleccionados)
        .eq('estado_asignacion', 'Activo');

      // 2. Regresamos los activos físicos al Almacén y limpiamos sus custodios
      const { error } = await supabase.from('activos')
        .update({ estado_actual: 'Disponible en Almacén TI', asignado_usuario_id: null })
        .in('id', seleccionados);

      if (error) throw error;

      lanzarAlerta(`🔓 Lote de ${seleccionados.length} equipos liberado correctamente.`);
      setSeleccionados([]); // Limpiamos los checkboxes
      cargarDatos();
    } catch (err: any) {
      lanzarAlerta(`❌ Error al liberar lote: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const ejecutarEliminacion = async () => {
    try {
      setGuardando(true);
      const targets = modalConfirmarEliminar.masivo ? seleccionados : [modalConfirmarEliminar.id];
      await supabase.from('activos').delete().in('id', targets);
      setSeleccionados([]);
      setModalConfirmarEliminar({ open: false, id: null, masivo: false });
      lanzarAlerta("🗑️ Elementos eliminados.");
      cargarDatos();
    } catch (err: any) { lanzarAlerta(`⚠️ ${err.message}`); } finally { setGuardando(false); }
  };

  const ejecutarLiberacionCustodia = async (activoId: number) => {
    try {
      setGuardando(true);
      // Rompemos la asignación activa y regresamos el equipo al stock disponible
      await supabase.from('asignaciones').update({ fecha_devolucion: new Date().toISOString(), estado_asignacion: 'Devuelto' }).eq('activo_id', activoId).eq('estado_asignacion', 'Activo');
      const { error } = await supabase.from('activos').update({ estado_actual: 'Disponible en Almacén TI', asignado_usuario_id: null }).eq('id', activoId);

      if (error) throw error;
      lanzarAlerta("🔄 Custodia liberada. El equipo regresó al Almacén TI.");
      cargarDatos();
    } catch (err: any) { lanzarAlerta(`❌ Error al liberar: ${err.message}`); } finally { setGuardando(false); }
  };

  const abrirHistorialComentarios = async (id: number, serie: string) => {
    setModalComments({ open: true, id, serie });
    const { data } = await supabase.from('observaciones_activos').select('*').eq('activo_id', id).order('fecha_registro', { ascending: false });
    setListaComentarios(data || []);
  };

  const guardarComentario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoComentario.trim() || !modalComments.id) return;
    try {
      await supabase.from('observaciones_activos').insert([{
        activo_id: modalComments.id,
        comentario: nuevoComentario.trim(),
        tipo_observacion: tipoObs,
        fecha_registro: new Date().toISOString()
      }]);
      setNuevoComentario('');
      abrirHistorialComentarios(modalComments.id, modalComments.serie);
    } catch (err: any) { lanzarAlerta(`❌ Error: ${err.message}`); }
  };

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col justify-between space-y-4 font-sans overflow-hidden text-slate-700 bg-slate-50/40 p-1">
      {alerta && <div className="fixed top-4 right-4 z-[100] px-4 py-2 bg-slate-900 text-white text-xs font-black rounded-xl shadow-2xl">{alerta}</div>}

      <HeaderVista titulo="📦 Almacén de Activos TI" subtitulo="Control físico general, bitácoras de fallas técnicas e inyección masiva." badgeStatus="online">
        <button onClick={abrirModalAlta} className="px-3 py-1.5 text-white text-[11px] font-black uppercase rounded-lg shadow transition-all bg-blue-800" style={{ backgroundColor: 'rgb(1, 71, 118)' }}>➕ Nuevo Activo</button>
        <button onClick={() => setModalExcel(true)} className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-black uppercase border rounded-lg shadow-sm transition-all">📥 Importar Excel</button>
        <button onClick={ejecutarExportacionExcel} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase rounded-lg shadow transition-all">🖨️ Exportar Malla</button>
      </HeaderVista>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-shrink-0">
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl shadow-sm relative overflow-hidden"><div className="absolute top-0 left-0 w-1 h-full bg-slate-400"></div><p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Total Hardware</p><p className="text-base font-black text-slate-800 mt-1">{metricasTI.total} <span className="text-[9px] text-slate-400 font-medium">unidades</span></p></div>
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl shadow-sm relative overflow-hidden"><div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: 'rgb(1, 71, 118)' }}></div><p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">En Custodia / Uso</p><p className="text-base font-black mt-1" style={{ color: 'rgb(1, 71, 118)' }}>{metricasTI.asignados} <span className="text-[9px] text-slate-400 font-medium">bienes</span></p></div>
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl shadow-sm relative overflow-hidden"><div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div><p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Stock Disponible</p><p className="text-base font-black text-emerald-600 mt-1">{metricasTI.disponibles} <span className="text-[9px] text-emerald-400 font-medium">libres</span></p></div>
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl shadow-sm relative overflow-hidden"><div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div><p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Dados de Baja</p><p className="text-base font-black text-red-600 mt-1">{metricasTI.bajas} <span className="text-[9px] text-red-400 font-medium">inactivos</span></p></div>
      </div>

      {/* CONTROLES MASIVOS */}
      {seleccionados.length > 0 && (
        <div className="bg-slate-900 border px-4 py-2 rounded-xl flex items-center justify-between text-white flex-shrink-0 animate-fade-in">
          <span className="text-[11px] font-bold uppercase tracking-wider">
            📦 Bloque Seleccionado: <code className="bg-blue-600 px-2 py-0.5 rounded text-[10px] ml-1">{seleccionados.length} u</code>
          </span>
          <div className="flex gap-2">
            {/* 🔓 NUEVO BOTÓN MASIVO: Liberar Custodia de los seleccionados */}
            <button
              onClick={ejecutarLiberacionMasiva}
              disabled={guardando}
              className="px-3 py-1 bg-sky-600 text-white font-black text-[10px] uppercase rounded-lg hover:bg-sky-700 transition-all active:scale-95 disabled:opacity-50"
            >
              Liberar Lote
            </button>

            <button
              onClick={() => setModalConfirmarBaja({ open: true, id: null, masivo: true, restaurar: true })}
              className="px-3 py-1 bg-emerald-600 text-white font-black text-[10px] uppercase rounded-lg hover:bg-emerald-700 transition-all"
            >
              Restaurar Stock
            </button>

            <button
              onClick={() => setModalConfirmarBaja({ open: true, id: null, masivo: true, restaurar: false })}
              className="px-3 py-1 bg-amber-500 text-slate-900 font-black text-[10px] uppercase rounded-lg hover:bg-amber-600 transition-all"
            >
              Cambiar a Baja
            </button>

            <button
              onClick={() => setModalConfirmarEliminar({ open: true, id: null, masivo: true })}
              className="px-3 py-1 bg-red-600 text-white font-black text-[10px] uppercase rounded-lg hover:bg-red-700 transition-all"
            >
              Eliminar Lote
            </button>
          </div>
        </div>
      )}

      {/* TABLA PRINCIPAL */}
      <div className="flex-1 min-h-0 overflow-hidden bg-white rounded-xl border flex flex-col">
        <TablaControl tituloSeccion="Malla General de Activos" badgeCount={activosFiltrados.length} data={activosFiltrados} loading={loading} onRefresh={cargarDatos} columnas={[
          {
            header: "✓",
            className: "w-12 text-center",
            render: (a) => <input type="checkbox" checked={seleccionados.includes(a.id)} onChange={() => setSeleccionados(prev => prev.includes(a.id) ? prev.filter(id => id !== a.id) : [...prev, a.id])} className="w-4 h-4 accent-slate-900 cursor-pointer" />
          },
          {
            header: "Hardware / Especificación",
            field: "categoria",
            render: (a) => (
              <div>
                <span className="font-black text-xs" style={{ color: 'rgb(1, 71, 118)' }}>[{a.categoria}]</span>
                <span className="text-slate-800 ml-1.5 font-bold text-xs">{a.marca} {a.modelo}</span>
                {a.especificaciones && <div className="text-[10px] text-slate-400 font-medium mt-0.5">{a.especificaciones}</div>}
              </div>
            )
          },
          {
            header: "Identificadores TI",
            field: "serial_id",
            render: (a) => (
              <div className="font-mono text-[10px] font-bold leading-tight">
                <div>S/N: <span className="text-slate-900 font-black">{a.serial_id}</span></div>
                {a.caf && <div style={{ color: 'rgb(1, 71, 118)' }}>CAF: {a.caf}</div>}
              </div>
            )
          },
          {
            // 🆕 COLUMNA DE ADQUISICIÓN / ALERTA DE VENCIMIENTO REESTRUCTURADA
            header: "Régimen / Vencimiento",
            field: "tipo_propiedad",
            render: (a) => {
              const esAlquiler = a.tipo_propiedad === 'Alquiler';
              const { urgente, vencido, diasRestantes } = evaluarAlertaAlquiler(a.fecha_fin_alquiler);

              return (
                <div className="space-y-1">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${esAlquiler ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-slate-100 text-slate-700'
                    }`}>
                    {esAlquiler ? '💼 Alquiler' : '💼 Compra'}
                  </span>

                  {esAlquiler && a.fecha_fin_alquiler && (
                    <div className="font-mono text-[10px] leading-none mt-1">
                      <div className="text-slate-600 font-bold">{new Date(a.fecha_fin_alquiler).toLocaleDateString('es-PE')}</div>
                      {urgente && (
                        <div className={`text-[9px] font-black uppercase tracking-tight mt-0.5 animate-pulse ${vencido ? 'text-rose-600' : 'text-amber-600'
                          }`}>
                          {vencido ? `🚨 VENCIDO HACE ${Math.abs(diasRestantes!)} DÍAS` : `⏳ VENCE EN ${diasRestantes} DÍAS`}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }
          },
          {
            header: "Condición",
            field: "nombre_estado",
            render: (a) => {
              const condNombre = a.nombre_estado;
              const colorHex = a.color_alerta || '#64748B';
              return (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider text-white border border-black/10 shadow-sm" style={{ backgroundColor: colorHex }}>
                  {condNombre || 'Excelente'}
                </span>
              );
            }
          },
          {
            header: "Asignación Custodia",
            field: "nombre_completo",
            render: (a) => a.nombre_completo ? (
              <div className="space-y-1.5">
                <div className="font-bold text-slate-900 text-xs">👤 {a.nombre_completo}</div>
                {a.nombre_area ? (
                  <div className="flex items-center gap-1.5">
                    {/* Círculo indicador con el color de su área corporativa real */}
                    <span 
                      className="w-1.5 h-1.5 rounded-full border shadow-xs flex-shrink-0" 
                      style={{ backgroundColor: a.color_hex || '#114776' }} 
                    />
                    {/* Badge dinámico con el color correspondiente */}
                    <span 
                      className="px-2 py-0.5 rounded text-white font-black text-[9px] uppercase tracking-wider shadow-xs block w-fit border border-black/5" 
                      style={{ backgroundColor: a.color_hex || '#114776' }}
                    >
                      {a.nombre_area}
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-400 font-bold italic text-[10px]">Sin Área Vinculada</span>
                )}
              </div>
            ) : (
              <span className="text-slate-400 font-bold italic text-[11px]">📦 Almacén TI</span>
            )
          },
          {
            header: "Estado",
            field: "estado_actual",
            className: "w-28",
            render: (a) => {
              // 1. Si el activo está marcado como Baja, se queda como Baja pase lo que pase
              if (a.estado_actual === 'Dado de Baja') {
                return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border bg-red-50 border-red-100 text-red-700">Baja</span>;
              }
              
              // 2. 🛠️ CORREGIDO: Si tiene un custodio asignado, forzamos a que marque "Asignado" con su estilo azul
              if (a.nombre_completo || a.asignado_usuario_id) {
                return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border bg-blue-50 border-blue-100 text-slate-600">Asignado</span>;
              }

              // 3. Plan B: Si no tiene dueño, es stock libre en el almacén
              return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border bg-emerald-50 border-emerald-100 text-emerald-700">Almacén TI</span>;
            }
          },
          {
            header: "Fecha Registro",
            field: "fecha_registro",
            render: (a) => (
              <div className="font-mono text-[10px] text-slate-600 font-bold">
                📅 {a.fecha_registro ? new Date(a.fecha_registro).toLocaleDateString('es-PE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                }) : '—'}
              </div>
            )
          },
          {
            header: "Acciones",
            className: "text-right w-24",
            render: (a) => {
              const esBaja = a.estado_actual === 'Dado de Baja';
              const esAsignado = a.estado_actual === 'Asignado';
              return (
                <div className="flex justify-end gap-3 px-1">
                  <button type="button" onClick={() => abrirHistorialComentarios(a.id, a.serial_id)} className="text-xs" title="Bitácora">💬</button>
                  <button type="button" onClick={() => abrirModalEdicion(a)} className="text-xs" title="Editar">✏️</button>

                  {/* 🔓 NUEVO BOTÓN: Liberar Custodia rápido si el equipo está asignado */}
                  {esAsignado && (
                    <button type="button" onClick={() => ejecutarLiberacionCustodia(a.id)} disabled={guardando} className="text-xs hover:scale-110 transition-transform" title="Liberar Custodia (Regresar a Almacén)">🔓</button>
                  )}

                  <button type="button" onClick={() => setModalConfirmarBaja({ open: true, id: a.id, masivo: false, restaurar: esBaja })} className="text-xs" title={esBaja ? "Restaurar Activo" : "Dar de Baja"}>
                    {esBaja ? "🔄" : "📉"}
                  </button>
                  <button type="button" onClick={() => setModalConfirmarEliminar({ open: true, id: a.id, masivo: false })} className="text-xs" title="Eliminar">❌</button>
                </div>
              );
            }
          }
        ]}>
          <BuscadorControl value={busqueda} onChange={setBusqueda} placeholder="Buscar serie, modelo, CAF o custodio..." />
          <FiltroSelect value={filtroCategoria} onChange={setFiltroCategoria} options={[{ value: 'Todos', label: '📦 Todas las Familias' }, ...categoriasCatalogo.map(c => ({ value: c.nombre_categoria, label: c.nombre_categoria }))]} />
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white px-3 h-[34px] border border-slate-200 rounded-xl cursor-pointer select-none shadow-sm hover:bg-slate-50 transition-all">
            <input type="checkbox" checked={activosFiltrados.length > 0 && seleccionados.length === activosFiltrados.length} onChange={(e) => manejarAlternarTodos(e.target.checked)} className="w-3.5 h-3.5 accent-slate-900 rounded" />
            <span>Marcar Todo</span>
          </label>
        </TablaControl>
      </div>

      {/* MODAL FORMULARIO ALTA Y EDICIÓN EXTENDIDO */}
      <ModalFormularioActivo
        isOpen={modalForm.open}
        onClose={() => setModalForm({ open: false, modo: 'alta' })}
        modo={modalForm.modo}
        activo={modalForm.activo}
        onSubmit={manejarGuardarOActualizar}
        guardando={guardando}
        condicionesCatalogo={condicionesCatalogo}
        categoriasCatalogo={categoriasCatalogo}
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

      {/* --- MODAL EXCEL --- */}
      <ModalBase isOpen={modalExcel} onClose={() => setModalExcel(false)} titulo="📥 Carga Inteligente desde Archivos Excel" subtitulo="Inyección en lote masivo para el Almacén General de TI de la Universidad.">
        <div className="space-y-4">
          <div className="bg-slate-50 border p-3 rounded-xl flex items-center justify-between">
            <div>
              <span className="font-black text-slate-700 block text-[11px] uppercase">¿No tienes la plantilla modelo?</span>
              <p className="text-[10px] text-slate-400 font-medium">Descarga el esquema oficial con las cabeceras preconfiguradas de fábrica.</p>
            </div>
            <button type="button" onClick={descargarPlantillaModelo} className="px-3 py-1.5 bg-white border hover:bg-slate-100 text-[10px] font-black text-slate-700 rounded-lg shadow-sm uppercase">Descargar Leyenda</button>
          </div>
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[11px] font-medium leading-normal text-amber-900">
            ⚠️ <b>Mapeo Estricto de Celdas:</b> El motor lee obligatoriamente las columnas tituladas <b>"Número de Serie"</b> y <b>"Tipo de Hardware"</b>. No modifiques las mayúsculas ni espacios.
          </div>
          <form onSubmit={manejarProcesarPlantillaExcel} className="space-y-3">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 bg-slate-50/50 text-center">
              <input type="file" accept=".xlsx, .xls" onChange={(e) => setArchivoExcel(e.target.files?.[0] || null)} className="text-xs text-slate-500 bg-white p-2 border rounded-lg w-full max-w-xs" required />
              {archivoExcel && <p className="text-xs text-emerald-700 font-black mt-2">📎 Archivo cargado: {archivoExcel.name}</p>}
            </div>
            <button type="submit" disabled={guardando || !archivoExcel} style={{ backgroundColor: 'rgb(1, 71, 118)' }} className="w-full py-2.5 text-white font-black rounded-xl uppercase tracking-wider shadow">{guardando ? "Sincronizando Libro..." : "🚀 Iniciar Carga Masiva"}</button>
          </form>
        </div>
      </ModalBase>

      {/* --- CONFIRMAR BAJA --- */}
      <ModalBase isOpen={modalConfirmarBaja.open} onClose={() => setModalConfirmarBaja({ open: false, id: null, masivo: false, restaurar: false })} titulo={modalConfirmarBaja.restaurar ? "🔄 ¿Restaurar Hardware Activo?" : "☣️ ¿Procesar Inactivación de Hardware?"}>
        <div className="text-center space-y-3">
          <p className="text-slate-500 text-[11px] leading-normal">{modalConfirmarBaja.restaurar ? "El equipo seleccionado volverá a estar operativo y disponible en el Almacén central de TI de forma inmediata." : "Los equipos seleccionados saldrán de la grilla activa y se enviarán al Depósito Histórico de Bajas TI."}</p>
          <div className="flex justify-center gap-2 pt-2 border-t">
            <button onClick={() => setModalConfirmarBaja({ open: false, id: null, masivo: false, restaurar: false })} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">Cancelar</button>
            <button onClick={ejecutarBajaORestauracion} disabled={guardando} className={`px-3 py-1.5 text-white text-xs font-bold rounded-lg shadow ${modalConfirmarBaja.restaurar ? 'bg-emerald-600' : 'bg-amber-600'}`}>{modalConfirmarBaja.restaurar ? "Restaurar" : "Inactivar"}</button>
          </div>
        </div>
      </ModalBase>

      {/* --- CONFIRMAR ELIMINAR --- */}
      <ModalBase isOpen={modalConfirmarEliminar.open} onClose={() => setModalConfirmarEliminar({ open: false, id: null, masivo: false })} titulo="⚠️ ¿Destruir Filas Físicas de la Base de Datos?">
        <div className="text-center space-y-3">
          <p className="text-slate-500 text-[11px] leading-normal">Esta acción es destructiva e irreversible. Remueve las filas del servidor de Supabase de forma definitiva. No procederá si el activo cuenta con relaciones vigentes.</p>
          <div className="flex justify-center gap-2 pt-2 border-t">
            <button onClick={() => setModalConfirmarEliminar({ open: false, id: null, masivo: false })} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">Cancelar</button>
            <button onClick={ejecutarEliminacion} disabled={guardando} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg shadow">Eliminar</button>
          </div>
        </div>
      </ModalBase>

      {/* --- BITÁCORA DE COMENTARIOS UNIFICADA --- */}
      <ModalBase isOpen={modalComments.open} onClose={() => setModalComments({ open: false, id: null, serie: '' })} titulo="💬 Historial de Observaciones de Hardware">
        <BitacoraNotas
          numeroSerie={modalComments.serie}
          tipoObs={tipoObs}
          setTipoObs={setTipoObs}
          nuevoComentario={nuevoComentario}
          setNuevoComentario={setNuevoComentario}
          enviandoComentario={false}
          onGuardarComentario={guardarComentario}
          listaComentarios={listaComentarios}
        />
      </ModalBase>
    </div>
  );
}