'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { ContenedorVista } from '@/components/ContenedorVista';
import { TablaControl } from '@/components/TablaControl';
import { ModalBase } from '@/components/ModalBase';
import { BitacoraNotas } from '@/components/BitacoraNotas';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

type CriterioSort = 'area' | 'cargo' | 'persona' | 'categoria' | 'marca' | 'serial' | 'caf' | 'conservacion' | 'propiedad';
type DireccionSort = 'asc' | 'desc';

interface ModalComentariosState {
  open: boolean;
  activoId: number | null;
  numeroSerie: string;
}

export default function PaginaReportes() {
  const [loading, setLoading] = useState(false);

  const [activos, setActivos] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [cargos, setCargos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);

  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroArea, setFiltroArea] = useState('Todos');
  const [filtroCargo, setFiltroCargo] = useState('Todos');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [filtroConservacion, setFiltroConservacion] = useState('Todos');
  const [filtroPropiedad, setFiltroPropiedad] = useState('Todos');

  const [criterioSort, setCriterioSort] = useState<CriterioSort>('area');
  const [direccionSort, setDireccionSort] = useState<DireccionSort>('asc');

  const [modalComentarios, setModalComentarios] = useState<ModalComentariosState>({ open: false, activoId: null, numeroSerie: '' });
  const [listaComentarios, setListaComentarios] = useState<any[]>([]);
  const [tipoObs, setTipoObs] = useState('General');
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  // 🆕 CONTROL DE PESTAÑAS DENTRO DEL INFORME TÉCNICO
  const [tabInforme, setTabInforme] = useState<'ia' | 'manual'>('ia');
  const [contextoAdicional, setContextoAdicional] = useState('');
  const [analizandoIA, setAnalizandoIA] = useState(false);

  // Estados core del documento final
  const [modalInforme, setModalInforme] = useState<{ open: boolean; activo: any | null }>({ open: false, activo: null });
  const [infAsunto, setInfAsunto] = useState('');
  const [infEvaluacion, setInfEvaluacion] = useState('');
  const [infConclusiones, setInfConclusiones] = useState('');
  const [infRecomendaciones, setInfRecomendaciones] = useState('');

  const evaluarAlertaAlquiler = (fechaFinStr: string) => {
    if (!fechaFinStr) return { urgente: false, vencido: false, diasRestantes: null };
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const fechaFin = new Date(fechaFinStr); fechaFin.setHours(0, 0, 0, 0);
    const diferenciaTiempo = fechaFin.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diferenciaTiempo / (1000 * 60 * 60 * 24));
    return { urgente: diasRestantes <= 10, vencido: diasRestantes < 0, diasRestantes };
  };

  const cargarDatosAuditoria = async () => {
    try {
      setLoading(true);
      const [rAct, rFisica, rArea, rCargo, rCat] = await Promise.all([
        supabase.from('vista_activos_completa').select('*'),
        supabase.from('activos').select('id, tipo_propiedad, fecha_fin_alquiler'),
        supabase.from('areas').select('*'),
        supabase.from('cargos').select('*'),
        supabase.from('categorias_activo').select('*')
      ]);

      const datosVista = rAct.data || [];
      const datosFisicos = rFisica.data || [];

      const registrosProcesados = datosVista.map(item => {
        const matchingFisico = datosFisicos.find(f => Number(f.id) === Number(item.activo_id));
        return {
          ...item,
          id: item.activo_id,
          tipo_propiedad: matchingFisico?.tipo_propiedad || 'Compra',
          fecha_fin_alquiler: matchingFisico?.fecha_fin_alquiler || null
        };
      });

      setActivos(registrosProcesados);
      if (rArea.data) setAreas(rArea.data);
      if (rCargo.data) setCargos(rCargo.data);
      if (rCat.data) setCategorias(rCat.data);
    } catch (err: any) {
      console.error("Error cargando auditoría:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatosAuditoria();
  }, []);

  const cargarHistorialComentarios = async (activoId: number) => {
    try {
      const { data, error } = await supabase
        .from('observaciones_activos')
        .select('*')
        .eq('activo_id', activoId)
        .order('fecha_registro', { ascending: false });

      if (error) throw error;
      setListaComentarios(data || []);
      return data || [];
    } catch (err: any) {
      console.error("Error al cargar notas:", err.message);
      return [];
    }
  };

  const abrirModalNotas = async (item: any) => {
    setModalComentarios({ open: true, activoId: item.id, numeroSerie: item.serial_id || 'N/A' });
    setNuevoComentario('');
    setTipoObs('General');
    await cargarHistorialComentarios(item.id);
  };

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
      await cargarHistorialComentarios(modalComentarios.activoId);
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setEnviandoComentario(false);
    }
  };

  const abrirModalParaInforme = async (item: any) => {
    setTabInforme('ia'); // Iniciamos en la pestaña de la IA por defecto
    setContextoAdicional('');
    setInfAsunto('');
    setInfEvaluacion('');
    setInfConclusiones('');
    setInfRecomendaciones('');
    setModalInforme({ open: true, activo: item });
    
    // Forzamos la carga inmediata de la bitácora histórica de este activo
    await cargarHistorialComentarios(item.id);
  };

  // 🤖 PROCESADOR CORE DE IA INTELIGENTE CON NOTAS REALES VINCULADAS
  const procesarInformeConIA = async () => {
    if (!modalInforme.activo) return;
    try {
      setAnalizandoIA(true);
      const res = await fetch('/api/generar-diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activo: modalInforme.activo,
          notas: listaComentarios,
          contextoAdicional: contextoAdicional.trim()
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // 🛠️ CORREGIDO: Mapeo exacto de las claves en español que devuelve el backend
      setInfAsunto(data.asunto);
      setInfEvaluacion(data.evaluacion);
      setInfConclusiones(data.conclusiones);
      setInfRecomendaciones(data.recomendaciones); // 👈 ¡Cambiado de data.recommendations a data.recomendaciones!

      setTabInforme('manual');
    } catch (err: any) {
      alert(`❌ Error al invocar el motor de IA: ${err.message}`);
    } finally {
      setAnalizandoIA(false);
    }
  };

  const exportarPdfInformeTecnico = (e: React.FormEvent) => {
    e.preventDefault();
    const act = modalInforme.activo;
    if (!act || !infAsunto || !infEvaluacion) return alert("⚠️ Debe generar o rellenar el informe antes de exportar.");

    const doc = new jsPDF();
    const fechaHoy = new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });

    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(`INFORME TÉCNICO N.º 000${act.id || '101'}`, 20, 25);
    
    doc.setFontSize(10); doc.text("ASUNTO:", 20, 35);
    doc.setFont("helvetica", "normal");
    const asuntoLineas = doc.splitTextToSize(infAsunto, 150);
    doc.text(asuntoLineas, 40, 35);
    
    const yOffsetFecha = 35 + (asuntoLineas.length * 5);
    doc.setFont("helvetica", "bold"); doc.text("FECHA:", 20, yOffsetFecha);
    doc.setFont("helvetica", "normal"); doc.text(fechaHoy, 40, yOffsetFecha);

    doc.line(20, yOffsetFecha + 5, 190, yOffsetFecha + 5);

    let currentY = yOffsetFecha + 15;

    // I. DATOS
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("I. DATOS DEL EQUIPO", 20, currentY);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); currentY += 7;
    doc.text(`• Tipo de equipo: ${act.categoria || 'Hardware'}`, 25, currentY); currentY += 6;
    doc.text(`• Service Tag / Serie: ${act.serial_id || 'N/A'}`, 25, currentY); currentY += 6;
    doc.text(`• Marca / Modelo: ${act.marca || ''} ${act.modelo || ''}`, 25, currentY); currentY += 6;
    doc.text(`• Código Patrimonial CAF: ${act.caf || 'N/R'}`, 25, currentY); currentY += 6;
    doc.text(`• Especificaciones: ${act.especificaciones || 'Sin detalles'}`, 25, currentY);

    // II. RESPONSABLE
    // II. RESPONSABLE Y CARGO
    currentY += 12;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("II. USUARIO RESPONSABLE DEL EQUIPO", 20, currentY);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); currentY += 7;
    if (act.nombre_completo) {
      doc.text(`• Nombre Custodio: ${act.nombre_completo}`, 25, currentY); currentY += 6;
      doc.text(`• Cargo Perfil: ${act.nombre_cargo || 'No especificado'}`, 25, currentY); currentY += 6; // 👈 ¡CARGO AGREGADO AL PDF!
      doc.text(`• Área / Oficina: ${act.nombre_area || 'Sede Central'}`, 25, currentY);
    } else {
      doc.text(`• Custodio: En resguardo y stock del Almacén Central de TI.`, 25, currentY);
    }

    // III. ANTECEDENTES
    currentY += 12;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("III. ANTECEDENTES", 20, currentY);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); currentY += 7;
    const anteLineas = doc.splitTextToSize("En atención a los controles del ciclo de vida del equipamiento de la institución, el Área de Soporte TI de Posgrado efectuó la auditoría técnica correspondiente, con la finalidad de certificar la continuidad operativa o proponer las acciones de regularización patrimonial que correspondan.", 170);
    doc.text(anteLineas, 20, currentY);

    // IV. EVALUACIÓN
    currentY += (anteLineas.length * 5) + 5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("IV. EVALUACIÓN TÉCNICA", 20, currentY);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); currentY += 7;
    const evalLineas = doc.splitTextToSize(infEvaluacion, 170);
    doc.text(evalLineas, 20, currentY);

    // V. CONCLUSIONES
    currentY += (evalLineas.length * 5) + 5;
    if (currentY > 230) { doc.addPage(); currentY = 25; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("V. CONCLUSIONES", 20, currentY);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); currentY += 7;
    const concLineas = doc.splitTextToSize(infConclusiones, 170);
    doc.text(concLineas, 20, currentY);

    // VI. RECOMENDACIONES
    currentY += (concLineas.length * 5) + 5;
    if (currentY > 230) { doc.addPage(); currentY = 25; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("VI. RECOMENDACIONES", 20, currentY);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); currentY += 7;
    const recLineas = doc.splitTextToSize(infRecomendaciones, 170);
    doc.text(recLineas, 20, currentY);

    // FIRMA
    currentY += (recLineas.length * 5) + 20;
    if (currentY > 260) { doc.addPage(); currentY = 40; }
    doc.line(60, currentY, 150, currentY);
    doc.setFont("helvetica", "bold"); doc.text("Área de Soporte TI - Posgrado UPeU", 78, currentY + 6);

    doc.save(`INFORME_TI_${act.serial_id}.pdf`);
    setModalInforme({ open: false, activo: null });
  };

  const ejecutarExportacionExcel = async () => {
    if (activosFiltrados.length === 0) return alert("⚠️ No hay datos para exportar.");
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
          'Área Asignada': a.nombre_area || 'Almacén Central TI',
          'Cargo Técnico': a.nombre_cargo || 'N/A',
          'Custodio Asignado': a.nombre_completo || 'Almacén Central TI',
          'DNI': a.dni || '',
          'Categoría': a.categoria,
          'Marca': a.marca,
          'Modelo': a.modelo,
          'Número de Serie': a.serial_id,
          'Código CAF': a.caf || 'N/A',
          'Régimen Propiedad': a.tipo_propiedad || 'Compra',
          'Fin Contrato Alquiler': a.fecha_fin_alquiler ? new Date(a.fecha_fin_alquiler).toLocaleDateString('es-PE') : 'N/A',
          'Condición Física': a.nombre_estado || 'Excelente',
          'Especificaciones': a.especificaciones || 'Sin detalles',
          'Historial de Observaciones': celdaComentarios, 
          'Fecha Registro': a.fecha_registro ? new Date(a.fecha_registro).toLocaleDateString('es-PE') : new Date().toLocaleDateString('es-PE')
        };
      });
      const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(dataPlana);
      XLSX.utils.book_append_sheet(wb, ws, "Inventario_Reportes"); XLSX.writeFile(wb, `Reporte_TI_Posgrado_Filtros.xlsx`);
    } catch (err: any) { alert(`❌ Error: ${err.message}`); } finally { setLoading(false); }
  };

  const manejarSort = (criterio: CriterioSort) => {
    if (criterioSort === criterio) { setDireccionSort(direccionSort === 'asc' ? 'desc' : 'asc'); } 
    else { setCriterioSort(criterio); setDireccionSort('asc'); }
  };

  const activosFiltrados = useMemo(() => {
    return activos.filter(a => {
      const term = filtroTexto.toLowerCase().trim();
      const cumpleTexto = !term || String(a.serial_id || '').toLowerCase().includes(term) || String(a.caf || '').toLowerCase().includes(term) || String(a.nombre_completo || '').toLowerCase().includes(term) || String(a.dni || '').toLowerCase().includes(term) || String(a.marca || '').toLowerCase().includes(term) || String(a.modelo || '').toLowerCase().includes(term) || String(a.nombre_estado || '').toLowerCase().includes(term) || String(a.tipo_propiedad || '').toLowerCase().includes(term) || String(a.nombre_cargo || '').toLowerCase().includes(term);
      const cumpleArea = filtroArea === 'Todos' || String(a.nombre_area) === filtroArea;
      const cumpleCargo = filtroCargo === 'Todos' || String(a.nombre_cargo) === filtroCargo;
      const cumpleCategoria = filtroCategoria === 'Todos' || String(a.categoria) === filtroCategoria;
      const cumpleConservacion = filtroConservacion === 'Todos' || String(a.nombre_estado) === filtroConservacion;
      const cumplePropiedad = filtroPropiedad === 'Todos' || String(a.tipo_propiedad) === filtroPropiedad;
      return cumpleTexto && cumpleArea && cumpleCargo && cumpleCategoria && cumpleConservacion && cumplePropiedad;
    }).sort((a, b) => {
      let valorA = '', valorB = '';
      if (criterioSort === 'area') { valorA = a.nombre_area || '🖨️ Almacén TI'; valorB = b.nombre_area || '🖨️ Almacén TI'; }
      if (criterioSort === 'cargo') { valorA = a.nombre_cargo || ''; valorB = b.nombre_cargo || ''; }
      if (criterioSort === 'persona') { valorA = a.nombre_completo || ''; valorB = b.nombre_completo || ''; }
      if (criterioSort === 'categoria') { valorA = a.categoria || ''; valorB = b.categoria || ''; }
      if (criterioSort === 'marca') { valorA = a.marca || ''; valorB = b.marca || ''; }
      if (criterioSort === 'serial') { valorA = a.serial_id || ''; valorB = b.serial_id || ''; }
      if (criterioSort === 'caf') { valorA = a.caf || ''; valorB = b.caf || ''; }
      if (criterioSort === 'conservacion') { valorA = a.nombre_estado || ''; valorB = b.nombre_estado || ''; }
      if (criterioSort === 'propiedad') { valorA = a.tipo_propiedad || ''; valorB = b.tipo_propiedad || ''; }
      return direccionSort === 'asc' ? valorA.localeCompare(valorB) : valorB.localeCompare(valorA);
    });
  }, [activos, filtroTexto, filtroArea, filtroCargo, filtroCategoria, filtroConservacion, filtroPropiedad, criterioSort, direccionSort]);

  const renderFlechaSort = (criterio: CriterioSort) => {
    if (criterioSort !== criterio) return ' ↕';
    return direccionSort === 'asc' ? ' 🔼' : ' 🔽';
  };

  const columnasConfig: any[] = useMemo(() => [
    {
      header: <span onClick={() => manejarSort('area')} className="cursor-pointer select-none block w-full h-full">Área Asignada{renderFlechaSort('area')}</span>,
      field: "nombre_area",
      render: (item: any) => item.nombre_area ? (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full border shadow-xs" style={{ backgroundColor: item.color_hex || '#114776' }} />
          <span className="px-2 py-0.5 rounded text-white font-black text-[9px] uppercase tracking-wider shadow-xs" style={{ backgroundColor: item.color_hex || '#114776' }}>{item.nombre_area}</span>
        </div>
      ) : <span className="text-slate-400 font-bold italic">Almacén Central TI</span>
    },
    {
      header: <span onClick={() => manejarSort('cargo')} className="cursor-pointer select-none block w-full h-full">Cargo Perfil{renderFlechaSort('cargo')}</span>,
      field: "nombre_cargo",
      render: (item: any) => item.nombre_cargo ? <span className="font-bold text-slate-700 text-xs">💼 {item.nombre_cargo}</span> : <span className="text-slate-400 italic text-[11px]">Ninguno</span>
    },
    {
      header: <span onClick={() => manejarSort('persona')} className="cursor-pointer select-none block w-full h-full">Colaborador / Custodio{renderFlechaSort('persona')}</span>,
      field: "nombre_completo",
      render: (item: any) => item.nombre_completo ? (
        <div>
          <div className="font-bold text-slate-900 text-xs">👤 {item.nombre_completo}</div>
          {item.dni && <div className="text-[10px] text-slate-400 font-mono mt-0.5">DNI: {item.dni}</div>}
        </div>
      ) : <span className="text-blue-800 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100 text-[10px] uppercase tracking-wider">Disponible Almacén</span>
    },
    {
      header: "Información del Activo / Identificadores",
      field: "serial_id",
      render: (item: any) => (
        <div className="max-w-xs">
          <div className="font-black text-slate-900 text-xs">[{item.categoria || 'N/A'}] {item.marca} — {item.modelo}</div>
          <div className="mt-1 flex gap-3 font-mono text-[10px]">
            <div><span className="text-slate-400 font-bold">S/N:</span> <span className="font-bold text-slate-700">{item.serial_id}</span></div>
            <div><span className="text-slate-400 font-bold">CAF:</span> <span className="bg-slate-100 border px-1.5 rounded font-bold text-slate-600 text-[9px]">{item.caf || 'N/A'}</span></div>
          </div>
        </div>
      )
    },
    {
      header: "Especificaciones Técnicas",
      field: "especificaciones",
      render: (item: any) => item.especificaciones ? (
        <div className="text-[11px] text-slate-600 font-medium max-w-xs truncate" title={item.especificaciones}>
          💻 {item.especificaciones}
        </div>
      ) : <span className="text-slate-400 italic text-[10px]">Sin detalles técnicos</span>
    },
    {
      header: <span onClick={() => manejarSort('propiedad')} className="cursor-pointer select-none block w-full h-full">Régimen{renderFlechaSort('propiedad')}</span>,
      field: "tipo_propiedad",
      render: (item: any) => {
        const esAlquiler = item.tipo_propiedad === 'Alquiler';
        const { urgente, vencido, diasRestantes } = evaluarAlertaAlquiler(item.fecha_fin_alquiler);
        return (
          <div className="space-y-1">
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${esAlquiler ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{esAlquiler ? '租 Alquiler' : '💼 Compra'}</span>
            {esAlquiler && item.fecha_fin_alquiler && (
              <div className="text-[10px] font-mono leading-tight mt-0.5">
                <div className="text-slate-500 font-bold">{new Date(item.fecha_fin_alquiler).toLocaleDateString('es-PE')}</div>
                {urgente && <span className={`text-[8px] font-black uppercase tracking-tight block mt-0.5 ${vencido ? 'text-red-600 animate-pulse' : 'text-amber-600'}`}>{vencido ? `⚠️ Vencido` : `⏳ ${diasRestantes} días`}</span>}
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: "Asignado Desde",
      field: "fecha_registro",
      render: (item: any) => (
        <div className="font-mono text-[10px] text-slate-600 font-bold leading-tight">
          📅 {item.fecha_registro ? new Date(item.fecha_registro).toLocaleDateString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }) : '—'}
        </div>
      )
    },
    {
      header: <span onClick={() => manejarSort('conservacion')} className="cursor-pointer select-none block w-full h-full">Condición Física{renderFlechaSort('conservacion')}</span>,
      field: "nombre_estado",
      className: "w-36 text-center",
      render: (item: any) => (
        <span className="px-2 py-0.5 rounded text-[10px] text-white font-black uppercase tracking-wider shadow-xs border border-black/10" style={{ backgroundColor: item.color_alerta || '#64748b' }}>⚙️ {item.nombre_estado || 'Excelente'}</span>
      )
    },
    {
      header: "Acciones",
      className: "text-center w-24",
      render: (item: any) => (
        <div className="flex justify-center gap-2.5">
          <button type="button" onClick={() => abrirModalParaInforme(item)} className="text-sm hover:scale-120 transition-all" title="Generar Informe Técnico PDF">📄</button>
          <button type="button" onClick={() => abrirModalNotas(item)} className="text-sm hover:scale-120 transition-all" title="Ver Historial">💬</button>
        </div>
      )
    }
  ], [activos, criterioSort, direccionSort, listaComentarios]);

  return (
    <ContenedorVista titulo="📊 Consola Analítica y Auditoría de Stock" subtitulo="Filtre, ordene y genere reportes técnicos globales." badgeStatus="online">
      <div className="h-full flex flex-col space-y-3 overflow-hidden">
        {/* Barra de Filtros */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs grid grid-cols-1 md:grid-cols-6 gap-3 text-xs font-bold text-slate-500">
          <div className="flex flex-col space-y-1">
            <span className="uppercase text-[9px] text-slate-400 block tracking-wider">🔍 Búsqueda:</span>
            <input type="text" value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} placeholder="S/N, CAF, Nombre..." className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg outline-none text-slate-800 text-xs font-bold" />
          </div>
          <div className="flex flex-col space-y-1">
            <span className="uppercase text-[9px] text-slate-400 block tracking-wider">🏢 Área:</span>
            <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)} className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg text-xs outline-none text-slate-700 cursor-pointer">
              <option value="Todos">Todas las Áreas</option>
              {areas.map(ar => <option key={ar.id} value={ar.nombre_area}>{ar.nombre_area}</option>)}
            </select>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="uppercase text-[9px] text-slate-400 block tracking-wider">💼 Cargo:</span>
            <select value={filtroCargo} onChange={(e) => setFiltroCargo(e.target.value)} className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg text-xs outline-none text-slate-700 cursor-pointer">
              <option value="Todos">Todos los Cargos</option>
              {cargos.map(ca => <option key={ca.id} value={ca.nombre_cargo}>{ca.nombre_cargo}</option>)}
            </select>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="uppercase text-[9px] text-slate-400 block tracking-wider">📁 Familia:</span>
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg text-xs outline-none text-slate-700 cursor-pointer">
              <option value="Todos">Todas las Familias</option>
              {categorias.map(cat => <option key={cat.id} value={cat.nombre_categoria}>{cat.nombre_categoria}</option>)}
            </select>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="uppercase text-[9px] text-slate-400 block tracking-wider">⚖️ Régimen:</span>
            <select value={filtroPropiedad} onChange={(e) => setFiltroPropiedad(e.target.value)} className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg text-xs outline-none text-slate-700 cursor-pointer">
              <option value="Todos">Todos los Regímenes</option>
              <option value="Compra">💼 Compra Propia</option>
              <option value="Alquiler">租 Alquiler / Renting</option>
            </select>
          </div>
          <div className="flex flex-col space-y-1 justify-end">
            <button type="button" onClick={ejecutarExportacionExcel} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg shadow-md uppercase transition-all flex items-center justify-center gap-1.5 active:scale-95">📥 Generar Informe (.xlsx)</button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border overflow-hidden">
          <TablaControl tituloSeccion="Bitácora y Malla de Activos" badgeCount={activosFiltrados.length} data={activosFiltrados} loading={loading} columnas={columnasConfig} />
        </div>
      </div>

      {/* 📋 MODAL DE CONFIGURACIÓN DE INFORME TÉCNICO CON DOS PESTAÑAS INTEGRADAS */}
      <ModalBase isOpen={modalInforme.open} onClose={() => setModalInforme({ open: false, activo: null })} titulo="📋 Consola Unificada de Informes Técnicos TI">
        
        {/* Selector de Pestañas */}
        <div className="flex bg-slate-100 p-1 rounded-xl border text-[11px] font-black gap-1 mb-3">
          <button type="button" onClick={() => setTabInforme('ia')} className={`flex-1 py-2 rounded-lg transition-all ${tabInforme === 'ia' ? 'bg-white shadow-sm text-blue-900' : 'text-slate-500'}`}>✨ Redacción Inteligente (IA)</button>
          <button type="button" onClick={() => setTabInforme('manual')} className={`flex-1 py-2 rounded-lg transition-all ${tabInforme === 'manual' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>✍️ Redacción Manual (Contingencia)</button>
        </div>

        {/* CONTENIDO PESTAÑA 1: MOTOR INTELIGENTE GEMINI */}
        {tabInforme === 'ia' && (
          <div className="space-y-3 text-xs font-bold text-slate-500 animate-fade-in">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
              <span className="text-blue-900 block font-black uppercase text-[10px]">Análisis Contextual de Bitácoras</span>
              <p className="text-slate-400 font-medium mt-0.5">La IA escaneará los datos del hardware junto a las <code className="bg-blue-100 text-blue-800 px-1 rounded font-bold">{listaComentarios.length} notas</code> históricas registradas en la base de datos de este bien.</p>
            </div>
            
            <div>
              <label className="block text-[10px] uppercase text-slate-400 mb-1">Anotación o Contexto Adicional (Opcional)</label>
              <textarea 
                value={contextoAdicional} 
                onChange={(e) => setContextoAdicional(e.target.value)} 
                placeholder="Ej: El custodio indica urgencia por cierre de ciclo / Se detectó daño accidental por derrame..." 
                rows={3} 
                className="w-full p-2 border border-slate-200 bg-white rounded-lg font-medium text-slate-800 outline-none"
              />
            </div>

            <button 
              type="button" 
              onClick={procesarInformeConIA} 
              disabled={analizandoIA}
              style={{ backgroundColor: 'rgb(1, 71, 118)' }}
              className="w-full py-3 text-white uppercase font-black rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {analizandoIA ? '🤖 Analizando Historial Completo...' : '✨ Generar Redacción Profesional Completa'}
            </button>
          </div>
        )}

        {/* CONTENIDO PESTAÑA 2: EDICIÓN MANUAL / CLÁSICA */}
        {tabInforme === 'manual' && (
          <form onSubmit={exportarPdfInformeTecnico} className="space-y-3 text-xs font-bold text-slate-500 animate-fade-in">
            <div>
              <label className="block text-[10px] uppercase text-slate-400 mb-1">Asunto Administrativo</label>
              <input type="text" value={infAsunto} onChange={(e) => setInfAsunto(e.target.value)} className="w-full p-2 border rounded-lg bg-slate-50 text-slate-800 outline-none" required />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-slate-400 mb-1">IV. Detalle de Evaluación Técnica (Basado en bitácora)</label>
              <textarea value={infEvaluacion} onChange={(e) => setInfEvaluacion(e.target.value)} rows={5} className="w-full p-2 border rounded-lg bg-slate-50 font-mono text-slate-700 outline-none leading-normal" required />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-slate-400 mb-1">V. Conclusiones Oficiales</label>
              <textarea value={infConclusiones} onChange={(e) => setInfConclusiones(e.target.value)} rows={3} className="w-full p-2 border rounded-lg bg-slate-50 text-slate-700 outline-none leading-normal" required />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-slate-400 mb-1">VI. Recomendaciones TI</label>
              <textarea value={infRecomendaciones} onChange={(e) => setInfRecomendaciones(e.target.value)} rows={3} className="w-full p-2 border rounded-lg bg-slate-50 text-slate-700 outline-none leading-normal" required />
            </div>
            
            <button type="submit" className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white uppercase tracking-wider font-black rounded-xl shadow-md transition-all">
              💾 Descargar Informe PDF Estructurado
            </button>
          </form>
        )}
      </ModalBase>

      <ModalBase isOpen={modalComentarios.open} onClose={() => setModalComentarios({ open: false, activoId: null, numeroSerie: '' })} titulo="💬 Historial de Observaciones de Hardware">
        <BitacoraNotas numeroSerie={modalComentarios.numeroSerie} tipoObs={tipoObs} setTipoObs={setTipoObs} nuevoComentario={nuevoComentario} setNuevoComentario={setNuevoComentario} enviandoComentario={enviandoComentario} onGuardarComentario={guardarComentarioNuevo} listaComentarios={listaComentarios} />
      </ModalBase>
    </ContenedorVista>
  );
}