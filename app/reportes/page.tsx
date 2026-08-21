'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { crearFiltro } from '@/lib/busqueda';
import { ContenedorVista } from '@/components/ContenedorVista';
import { TablaControl } from '@/components/TablaControl';
import { useDestacar } from '@/lib/useDestacar';
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
  const idDestacado = useDestacar();
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
      
      // 1. Llamamos al mismo RPC optimizado que ya funciona en Activos
      const { data: dataRpc, error: errorRpc } = await supabase.rpc('obtener_reporte_activos');
      if (errorRpc) throw errorRpc;

      // 2. Traemos el resto de catálogos para los Selects de los filtros externos
      const [rArea, rCargo, rCat] = await Promise.all([
        supabase.from('areas').select('*'),
        supabase.from('cargos').select('*'),
        supabase.from('categorias_activo').select('*')
      ]);

      // 3. Seteamos la data limpia y directa de la BD
      setActivos(dataRpc || []);
      
      if (rArea.data) setAreas(rArea.data);
      if (rCargo.data) setCargos(rCargo.data);
      if (rCat.data) setCategorias(rCat.data);

    } catch (err: any) {
      console.error("Error cargando auditoría mediante RPC:", err.message);
      alert(`❌ Error al sincronizar con la base de datos: ${err.message}`);
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
      XLSX.utils.book_append_sheet(wb, ws, "Reporte de Oficina"); XLSX.writeFile(wb, `Reporte_de_Oficina_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) { alert(`❌ Error: ${err.message}`); } finally { setLoading(false); }
  };

  /**
   * Reporte General Extenso.
   *
   * A diferencia del Reporte de Oficina, este IGNORA los filtros de pantalla y
   * baja todo el sistema en un libro de varias hojas: activos, historial de
   * custodia, prestamos, licencias, personal y bitacora. Es el respaldo
   * completo, para auditoria o para entregar a Direccion.
   */
  const exportarReporteGeneralExtenso = async () => {
    try {
      setLoading(true);

      const [resActivos, resAsign, resPrest, resObs, resUsuarios] = await Promise.all([
        supabase.from('vista_activos_completa').select('*').order('categoria'),
        supabase.from('asignaciones').select('*, usuarios(nombre_completo, dni)').order('id', { ascending: false }),
        supabase.from('prestamos').select('*').order('id', { ascending: false }),
        supabase.from('observaciones_activos').select('*').order('fecha_registro', { ascending: false }),
        supabase.from('usuarios').select('*, areas(nombre_area), cargos(nombre_cargo)').order('nombre_completo'),
      ]);

      // Las licencias pueden no existir si no se ejecuto su migracion.
      const resLic = await supabase.from('vista_licencias_completa').select('*').order('nombre_servicio');
      const resLicAsig = await supabase
        .from('licencias_asignaciones')
        .select('*, licencias(nombre_servicio), usuarios(nombre_completo, dni)');

      const activos = resActivos.data || [];
      const asignaciones = resAsign.data || [];
      const prestamos = resPrest.data || [];
      const observaciones = resObs.data || [];
      const usuarios = resUsuarios.data || [];
      const licencias = resLic.error ? [] : (resLic.data || []);
      const licAsignaciones = resLicAsig.error ? [] : (resLicAsig.data || []);

      const dia = (v: any) =>
        v ? new Date(String(v).length === 10 ? `${v}T00:00:00` : v).toLocaleDateString('es-PE') : '';

      const wb = XLSX.utils.book_new();
      const agregar = (nombre: string, filas: any[]) => {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(filas.length ? filas : [{ 'Sin registros': '' }]),
          nombre
        );
      };

      // 1. Resumen ejecutivo
      const enCustodia = activos.filter((a: any) => a.nombre_completo).length;
      agregar('Resumen', [
        { Indicador: 'Total de activos', Valor: activos.length },
        { Indicador: 'En custodia de personal', Valor: enCustodia },
        { Indicador: 'En almacen', Valor: activos.length - enCustodia },
        { Indicador: 'Equipos en alquiler', Valor: activos.filter((a: any) => a.tipo_propiedad === 'Alquiler').length },
        { Indicador: 'Prestamos pendientes', Valor: prestamos.filter((p: any) => String(p.estado_prestamo || '').trim() === 'Pendiente').length },
        { Indicador: 'Colaboradores registrados', Valor: usuarios.length },
        { Indicador: 'Licencias activas', Valor: licencias.filter((l: any) => l.estado === 'Activa').length },
        { Indicador: 'Asientos de licencia libres', Valor: licencias.reduce((t: number, l: any) => t + (l.asientos_libres || 0), 0) },
        { Indicador: 'Anotaciones en bitacora', Valor: observaciones.length },
        { Indicador: 'Generado el', Valor: new Date().toLocaleString('es-PE') },
      ]);

      // 2. Activos, con todo lo que se conoce de cada uno
      agregar('Activos', activos.map((a: any) => ({
        'ID': a.id,
        'Categoria': a.categoria,
        'Marca': a.marca,
        'Modelo': a.modelo,
        'Numero de Serie': a.serial_id,
        'Codigo CAF': a.caf || '',
        'Linea Telefonica': a.linea_telefonica || '',
        'Especificaciones': a.especificaciones || '',
        'Condicion Fisica': a.nombre_estado || '',
        'Estado Operativo': a.estado_actual || '',
        'Regimen': a.tipo_propiedad || 'Compra',
        'Fin de Alquiler': dia(a.fecha_fin_alquiler),
        'Custodio': a.nombre_completo || 'Almacen Central TI',
        'DNI Custodio': a.dni || '',
        'Area': a.nombre_area || '',
        'Cargo': a.nombre_cargo || '',
        'Fecha de Registro': dia(a.fecha_registro),
      })));

      const porActivo = new Map(activos.map((a: any) => [Number(a.id), a]));

      // 3. Cadena de custodia completa
      agregar('Historial de Custodia', asignaciones.map((c: any) => {
        const eq: any = porActivo.get(Number(c.activo_id));
        return {
          'Activo ID': c.activo_id,
          'Equipo': eq ? `${eq.categoria} ${eq.marca} ${eq.modelo}` : '',
          'Numero de Serie': eq?.serial_id || '',
          'Codigo CAF': eq?.caf || '',
          'Responsable': c.usuarios?.nombre_completo || '',
          'DNI': c.usuarios?.dni || '',
          'Estado': c.estado_asignacion,
          'Devolucion': dia(c.fecha_devolucion),
          'Origen': c.text_asignacion || '',
        };
      }));

      // 4. Prestamos
      agregar('Prestamos', prestamos.map((p: any) => {
        const eq: any = porActivo.get(Number(p.activo_id));
        const pendiente = String(p.estado_prestamo || '').trim() === 'Pendiente';
        const vencido = pendiente && p.fecha_devolucion_estimada && new Date(p.fecha_devolucion_estimada) < new Date();
        return {
          'Responsable': p.nombre_prestatario || '',
          'Contacto': p.celular_contacto || '',
          'Equipo': eq ? `${eq.categoria} ${eq.marca} ${eq.modelo}` : (p.nombre_activo || ''),
          'Numero de Serie': eq?.serial_id || '',
          'Estado': p.estado_prestamo,
          'Situacion': vencido ? 'VENCIDO' : pendiente ? 'Pendiente' : 'Cerrado',
          'Devolucion Estimada': dia(p.fecha_devolucion_estimada),
          'Observaciones': p.observaciones || '',
        };
      }));

      // 5. Licencias y sus ocupantes
      agregar('Licencias', licencias.map((l: any) => ({
        'Servicio': l.nombre_servicio,
        'Proveedor': l.proveedor || '',
        'Plan': l.plan || '',
        'Tipo': l.tipo,
        'Asientos': l.cantidad_asientos,
        'Ocupados': l.asientos_usados,
        'Libres': l.asientos_libres,
        'Costo': l.costo ?? '',
        'Moneda': l.moneda || '',
        'Ciclo': l.ciclo_facturacion || '',
        'Renovacion': dia(l.fecha_renovacion),
        'Dias para Renovar': l.dias_para_renovar ?? '',
        'Renovacion Automatica': l.renovacion_automatica ? 'Si' : 'No',
        'Estado': l.estado,
        'Notas': l.notas || '',
      })));

      agregar('Asientos de Licencia', licAsignaciones.map((a: any) => ({
        'Servicio': a.licencias?.nombre_servicio || '',
        'Colaborador': a.usuarios?.nombre_completo || '',
        'DNI': a.usuarios?.dni || '',
        'Cuenta de Activacion': a.cuenta_activacion || '',
        'Estado': a.estado_asignacion,
        'Asignado el': dia(a.fecha_asignacion),
        'Liberado el': dia(a.fecha_baja),
      })));

      // 6. Personal
      agregar('Colaboradores', usuarios.map((u: any) => ({
        'Nombre': u.nombre_completo,
        'DNI': u.dni || '',
        'Area': u.areas?.nombre_area || u.nombre_area || '',
        'Cargo': u.cargos?.nombre_cargo || '',
        'Estado': u.estado || '',
        'Equipos en Custodia': activos.filter((a: any) => Number(a.asignado_usuario_id) === Number(u.id)).length,
        'Licencias Activas': licAsignaciones.filter((a: any) => Number(a.usuario_id) === Number(u.id) && a.estado_asignacion === 'Activo').length,
      })));

      // 7. Bitacora tecnica
      agregar('Bitacora', observaciones.map((o: any) => {
        const eq: any = porActivo.get(Number(o.activo_id));
        return {
          'Activo ID': o.activo_id,
          'Equipo': eq ? `${eq.categoria} ${eq.marca} ${eq.modelo}` : '',
          'Numero de Serie': eq?.serial_id || '',
          'Tipo': o.tipo_observacion || '',
          'Comentario': o.comentario || '',
          'Fecha': dia(o.fecha_registro),
        };
      }));

      XLSX.writeFile(wb, `Reporte_General_Extenso_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) {
      alert(`Error al generar el reporte: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const manejarSort = (criterio: CriterioSort) => {
    if (criterioSort === criterio) { setDireccionSort(direccionSort === 'asc' ? 'desc' : 'asc'); }
    else { setCriterioSort(criterio); setDireccionSort('asc'); }
  };

  const activosFiltrados = useMemo(() => {
    const coincideTexto = crearFiltro<any>(filtroTexto, [
      'serial_id', 'caf', 'nombre_completo', 'dni', 'marca', 'modelo',
      'nombre_estado', 'tipo_propiedad', 'nombre_cargo', 'especificaciones', 'linea_telefonica',
      'categoria', 'nombre_area'
    ]);

    return activos.filter(a => {
      const cumpleTexto = coincideTexto(a);

      // Plan de rescate: un activo en almacén no tiene área ni cargo asignado.
      const areaActivo = a.nombre_area || 'Almacén Central TI';
      const cargoActivo = a.nombre_cargo || 'Ninguno';

      const cumpleArea = filtroArea === 'Todos' || String(areaActivo) === filtroArea;
      const cumpleCargo = filtroCargo === 'Todos' || String(cargoActivo) === filtroCargo;
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
      // Quitamos el onClick manual y las flechas nativas del archivo reportes
      header: "Área Asignada",
      field: "nombre_area",
      render: (item: any) => item.nombre_area ? (
        <div className="flex items-center gap-2">
          {/* 🛠️ Usa el color institucional inyectado o el azul por defecto */}
          <span className="w-2 h-2 rounded-full border shadow-xs" style={{ backgroundColor: item.color_hex || '#114776' }} />
          <span className="px-2 py-0.5 rounded text-white font-black text-[9px] uppercase tracking-wider shadow-xs" style={{ backgroundColor: item.color_hex || '#114776' }}>{item.nombre_area}</span>
        </div>
      ) : <span className="text-slate-400 font-bold italic">Almacén Central TI</span>
    },
    {
      header: "Cargo Perfil",
      field: "nombre_cargo",
      render: (item: any) => item.nombre_cargo ? <span className="font-bold text-slate-700 text-xs">💼 {item.nombre_cargo}</span> : <span className="text-slate-400 italic text-[11px]">Ninguno</span>
    },
    {
      header: "Colaborador / Custodio",
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
      header: "Régimen",
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
      header: "Condición Física",
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
  ], []); // Simplificado sin dependencias extras en el useMemo

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
            <div className="space-y-1.5">
              <button type="button" onClick={ejecutarExportacionExcel} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg shadow-md uppercase transition-all flex items-center justify-center gap-1.5 active:scale-95">📥 Reporte de Oficina (.xlsx)</button>
              <p className="text-[10px] text-slate-400 font-medium leading-tight text-center">Respeta los filtros de esta pantalla.</p>

              <button type="button" onClick={exportarReporteGeneralExtenso} style={{ backgroundColor: 'var(--color-upeu)' }} className="w-full py-2 mt-2 text-white font-black text-xs rounded-lg shadow-md uppercase transition-all flex items-center justify-center gap-1.5 active:scale-95 hover:brightness-110">📚 Reporte General Extenso</button>
              <p className="text-[10px] text-slate-400 font-medium leading-tight text-center">Todo el sistema, sin filtros: activos, custodia, prestamos, licencias, personal y bitacora.</p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border overflow-hidden">
          <TablaControl tituloSeccion="Bitácora y Malla de Activos" badgeCount={activosFiltrados.length} data={activosFiltrados} loading={loading} columnas={columnasConfig} idDestacado={idDestacado} onRefresh={cargarDatosAuditoria} />
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
              style={{ backgroundColor: 'var(--color-upeu)' }}
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