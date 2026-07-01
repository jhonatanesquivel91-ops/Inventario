'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { HeaderVista } from '@/components/HeaderVista';
import { TablaControl } from '@/components/TablaControl';
import { BuscadorControl } from '@/components/BuscadorControl';
import { FiltroSelect } from '@/components/FiltroSelect';
import { ModalBase } from '@/components/ModalBase';
import { BitacoraNotas } from '@/components/BitacoraNotas';
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
  const [categoriasCatalogo] = useState<string[]>(Object.keys(ESTRUCTURA_HARDWARE));
  const [listaComentarios, setListaComentarios] = useState<any[]>([]);

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

      // 1. Consultamos la vista original y la tabla física en paralelo
      const [rVista, rFisica, rCondiciones] = await Promise.all([
        supabase.from('vista_activos_completa').select('*').order('activo_id', { ascending: false }),
        supabase.from('activos').select('id, tipo_propiedad, fecha_fin_alquiler'), // 👈 Traemos los datos nuevos directo de la tabla física
        supabase.from('estados_conservacion').select('*').order('nombre_estado')
      ]);

      if (rVista.error) throw rVista.error;
      if (rFisica.error) throw rFisica.error;
      if (rCondiciones.error) throw rCondiciones.error;

      const datosVista = rVista.data || [];
      const datosFisicos = rFisica.data || [];

      // 2. 🔀 FUSIÓN SENIOR: Cruzamos la data de la vista con los atributos nuevos de la tabla física
      const registrosCombinados = datosVista.map(item => {
        const coincidenciaFisica = datosFisicos.find(f => Number(f.id) === Number(item.activo_id));
        
        return {
          ...item,
          id: item.activo_id,
          // Inyectamos los valores reales de la tabla física
          tipo_propiedad: coincidenciaFisica?.tipo_propiedad || 'Compra', 
          fecha_fin_alquiler: coincidenciaFisica?.fecha_fin_alquiler || null
        };
      });

      setActivos(registrosCombinados);
      setCondicionesCatalogo(rCondiciones.data || []);

    } catch (err: any) {
      lanzarAlerta(`❌ Error de carga: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (modalForm.modo === 'alta') {
      const marcas = Object.keys(ESTRUCTURA_HARDWARE[formTipo] || {});
      setFormMarca(marcas[0] || '');
    }
  }, [formTipo, modalForm.modo]);

  useEffect(() => {
    if (modalForm.modo === 'alta') {
      const models = ESTRUCTURA_HARDWARE[formTipo]?.[formMarca] || [];
      setFormModelo(models[0] || '');
    }
  }, [formMarca, formTipo, modalForm.modo]);

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
      asignados: activos.filter(a => a.estado_actual === 'Asignado').length,
      disponibles: activos.filter(a => a.estado_actual === 'Disponible en Almacén TI').length,
      bajas: activos.filter(a => a.estado_actual === 'Dado de Baja').length
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
    setFormTipo('Laptop'); setFormSerie(''); setFormCaf(''); setFormSpecs(''); setFormCondicion('Excelente');
    setFormTipoPropiedad('Compra'); setFormFechaFinAlquiler(''); // 🆕 Reset alta
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
    if (!formSerie.trim()) return lanzarAlerta("La serie es requerida.");
    if (formTipoPropiedad === 'Alquiler' && !formFechaFinAlquiler) return lanzarAlerta("Especifique la fecha de fin del alquiler.");
    
    try {
      setGuardando(true);
      const hoy = new Date().toISOString();
      const estadoCalculado = modalForm.modo === 'alta' ? 'Disponible en Almacén TI' : modalForm.activo.estado_actual;

      const payload = {
        p_id: modalForm.modo === 'alta' ? null : modalForm.activo.id,
        p_serial_id: formSerie.trim(),
        p_nombre_categoria: formTipo,
        p_nombre_marca: formMarca,
        p_nombre_modelo: formModelo,
        p_caf: formCaf.trim() || null,
        p_especificaciones: formSpecs.trim() || null,
        p_estado_actual: estadoCalculado
      };

      // 1. Ejecuta tu RPC normal para mapear categorías/marcas/modelos internos
      const { data: idGenerado, error: rpcError } = await supabase.rpc('ingresar_o_actualizar_activo', payload);
      if (rpcError) throw rpcError;

      if (modalForm.modo === 'alta') {
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      // 2. Resolvemos el ID real del activo
      let idReal = modalForm.modo === 'alta' ? idGenerado : modalForm.activo.id;

      if (!idReal) {
        const { data: activoRescatado } = await supabase
          .from('activos')
          .select('id')
          .eq('serial_id', formSerie.trim())
          .single();
        if (activoRescatado) idReal = activoRescatado.id;
      }

      // 3. 🛡️ SECCIÓN CORE: Forzamos la actualización de datos extendidos (Alta y Edición)
      if (idReal) {
        const objEstado = condicionesCatalogo.find(c => c.nombre_estado === formCondicion);
        
        const payloadExtendida: any = {
          estado_conservacion_id: objEstado ? Number(objEstado.id) : null,
          tipo_propiedad: formTipoPropiedad,
          fecha_fin_alquiler: formTipoPropiedad === 'Alquiler' ? formFechaFinAlquiler : null
        };
        
        if (modalForm.modo === 'alta') {
          payloadExtendida.fecha_registro = hoy;
        }

        // Esta petición directo a la tabla inserta o sobreescribe Alquiler/Compra y la Fecha sin importar el RPC
        const { error: updateError } = await supabase
          .from('activos')
          .update(payloadExtendida)
          .eq('id', Number(idReal));

        if (updateError) throw updateError;
      }

      setModalForm({ open: false, modo: 'alta' });
      lanzarAlerta("✅ Activo sincronizado correctamente con sus parámetros de propiedad.");
      cargarDatos();
    } catch (err: any) { 
      lanzarAlerta(`❌ Error de sincronización: ${err.message}`); 
    }  finally { 
      setGuardando(false); 
    }
  };

  const ejecutarBajaORestauracion = async () => {
    try {
      setGuardando(true);
      const targets = modalConfirmarBaja.masivo ? seleccionados : [modalConfirmarBaja.id];
      const nuevoEstado = modalConfirmarBaja.restaurar ? 'Disponible en Almacén TI' : 'Dado de Baja';

      const { error } = await supabase.from('activos').update({ estado_actual: nuevoEstado }).in('id', targets);
      if (error) throw error;

      setSeleccionados([]);
      setModalConfirmarBaja({ open: false, id: null, masivo: false, restaurar: false });
      lanzarAlerta(modalConfirmarBaja.restaurar ? "🔄 Hardware restaurado en stock." : "✅ Registro enviado a bajas.");
      cargarDatos();
    } catch (err: any) { lanzarAlerta(`❌ Error: ${err.message}`); } finally { setGuardando(false); }
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
      {alerta && <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-slate-900 text-white text-xs font-black rounded-xl shadow-2xl">{alerta}</div>}

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
          <span className="text-[11px] font-bold uppercase tracking-wider">📦 Bloque Seleccionado: <code className="bg-blue-600 px-2 py-0.5 rounded text-[10px] ml-1">{seleccionados.length} u</code></span>
          <div className="flex gap-2">
            <button onClick={() => setModalConfirmarBaja({ open: true, id: null, masivo: true, restaurar: false })} className="px-3 py-1 bg-amber-500 text-slate-900 font-black text-[10px] uppercase rounded-lg">Cambiar a Baja</button>
            <button onClick={() => setModalConfirmarEliminar({ open: true, id: null, masivo: true })} className="px-3 py-1 bg-red-600 text-white font-black text-[10px] uppercase rounded-lg">Eliminar Lote</button>
          </div>
        </div>
      )}

      {/* TABLA PRINCIPAL */}
      <div className="flex-1 min-h-0 overflow-hidden bg-white rounded-xl border flex flex-col">
        <TablaControl tituloSeccion="Malla General de Activos" badgeCount={activosFiltrados.length} data={activosFiltrados} loading={loading} columnas={[
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
            render: (a) => a.estado_actual === 'Asignado' ? <div><div className="font-bold text-slate-900">👤 {a.nombre_completo.split(' ')[0]}</div><div className="text-[9px] text-slate-400">{a.nombre_area}</div></div> : <span className="text-slate-400 font-bold italic text-[11px]">📦 Almacén TI</span>
          },
          {
            header: "Estado",
            field: "estado_actual",
            render: (a) => <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${a.estado_actual === 'Asignado' ? 'bg-blue-50 border-blue-100 text-slate-600' : a.estado_actual === 'Dado de Baja' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>{a.estado_actual.replace('Disponible en ', '')}</span>
          },
          {
            header: "Acciones",
            className: "text-right w-24",
            render: (a) => {
              const esBaja = a.estado_actual === 'Dado de Baja';
              return (
                <div className="flex justify-end gap-3 px-1">
                  <button type="button" onClick={() => abrirHistorialComentarios(a.id, a.serial_id)} className="text-xs" title="Bitácora">💬</button>
                  <button type="button" onClick={() => abrirModalEdicion(a)} className="text-xs" title="Editar">✏️</button>
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
          <FiltroSelect value={filtroCategoria} onChange={setFiltroCategoria} options={[{ value: 'Todos', label: '📦 Todas las Familias' }, ...categoriasCatalogo.map(c => ({ value: c, label: c }))]} />
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white px-3 h-[34px] border border-slate-200 rounded-xl cursor-pointer select-none shadow-sm hover:bg-slate-50 transition-all">
            <input type="checkbox" checked={activosFiltrados.length > 0 && seleccionados.length === activosFiltrados.length} onChange={(e) => manejarAlternarTodos(e.target.checked)} className="w-3.5 h-3.5 accent-slate-900 rounded" />
            <span>Marcar Todo</span>
          </label>
        </TablaControl>
      </div>

      {/* MODAL FORMULARIO ALTA Y EDICIÓN EXTENDIDO */}
      <ModalBase isOpen={modalForm.open} onClose={() => setModalForm({ open: false, modo: 'alta' })} titulo={modalForm.modo === 'alta' ? "➕ Registrar Nuevo Activo" : "✏️ Modificar Parámetros de Activo"}>
        <form onSubmit={manejarGuardarOActualizar} className="space-y-4 text-xs font-medium text-slate-600">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">Familia Hardware *</label>
              <select value={formTipo} onChange={(e) => setFormTipo(e.target.value)} className="w-full p-2 border rounded-lg bg-white font-bold text-slate-700 outline-none">
                {categoriasCatalogo.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select></div>
            <div><label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">Fabricante *</label>
              {modalForm.modo === 'alta' ? (
                <select value={formMarca} onChange={(e) => setFormMarca(e.target.value)} className="w-full p-2 border rounded-lg bg-white font-bold text-slate-700 outline-none">
                  {Object.keys(ESTRUCTURA_HARDWARE[formTipo] || {}).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : <input type="text" value={formMarca} onChange={(e) => setFormMarca(e.target.value)} className="w-full p-2 border rounded-lg outline-none font-bold text-slate-800 bg-slate-50" required />}</div>
          </div>
          <div><label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">Modelo Técnico *</label>
            {modalForm.modo === 'alta' ? (
              <select value={formModelo} onChange={(e) => setFormModelo(e.target.value)} className="w-full p-2 border rounded-lg bg-white font-bold text-slate-700 outline-none">
                {(ESTRUCTURA_HARDWARE[formTipo]?.[formMarca] || []).map((mod) => <option key={mod} value={mod}>{mod}</option>)}
              </select>
            ) : <input type="text" value={formModelo} onChange={(e) => setFormModelo(e.target.value)} className="w-full p-2 border rounded-lg outline-none font-bold text-slate-800 bg-slate-50" required />}</div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">Número de Serie *</label>
              <input type="text" value={formSerie} onChange={(e) => setFormSerie(e.target.value)} placeholder="S/N único" className="w-full p-2 border rounded-lg outline-none font-mono font-bold text-slate-800 bg-white" required /></div>
            <div><label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">Código CAF</label>
              <input type="text" value={formCaf} onChange={(e) => setFormCaf(e.target.value)} placeholder="Ej: CAF-021" className="w-full p-2 border rounded-lg outline-none font-mono font-bold text-slate-800" /></div>
          </div>

          {/* 🆕 SECCIÓN DE TIPO DE PROPIEDAD E INPUT DINÁMICO */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2.5 border rounded-xl">
            <div>
              <label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">Régimen Inmueble/Bien *</label>
              <select
                value={formTipoPropiedad}
                onChange={(e) => setFormTipoPropiedad(e.target.value as 'Compra' | 'Alquiler')}
                className="w-full p-2 border rounded-lg bg-white font-bold text-slate-700 outline-none"
              >
                <option value="Compra">💼 Compra</option>
                <option value="Alquiler">💼 Alquiler</option>
              </select>
            </div>
            <div>
              <label className={`block font-bold uppercase text-[10px] mb-1 ${formTipoPropiedad === 'Alquiler' ? 'text-purple-600 font-black' : 'text-slate-400'}`}>
                Fin de Contrato {formTipoPropiedad === 'Alquiler' && '*'}
              </label>
              <input
                type="date"
                value={formFechaFinAlquiler}
                onChange={(e) => setFormFechaFinAlquiler(e.target.value)}
                disabled={formTipoPropiedad === 'Compra'}
                className={`w-full p-1.5 border rounded-lg outline-none font-mono font-bold text-xs ${formTipoPropiedad === 'Compra' ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'bg-white text-purple-900 border-purple-300'
                  }`}
                required={formTipoPropiedad === 'Alquiler'}
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">Estado de Conservación Física</label>
            <select value={formCondicion} onChange={(e) => setFormCondicion(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg bg-white font-bold text-slate-700 outline-none text-xs shadow-sm">
              {condicionesCatalogo.map((c) => (<option key={c.id} value={c.nombre_estado}>{c.nombre_estado}</option>))}
            </select>
          </div>

          <div><label className="block font-bold text-slate-500 uppercase text-[10px] mb-1">Especificaciones Técnicas</label>
            <input type="text" value={formSpecs} onChange={(e) => setFormSpecs(e.target.value)} placeholder="Ej: Core i5, 16GB RAM, 512GB SSD" className="w-full p-2 border rounded-lg outline-none text-slate-800" /></div>

          <button type="submit" disabled={guardando} style={{ backgroundColor: 'rgb(1, 71, 118)' }} className="w-full py-2.5 text-white font-black rounded-xl uppercase tracking-wider">
            {guardando ? "Sincronizando..." : "💾 Sincronizar Registro"}
          </button>
        </form>
      </ModalBase>

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