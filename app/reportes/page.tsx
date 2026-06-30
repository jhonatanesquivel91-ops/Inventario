'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { ContenedorVista } from '@/components/ContenedorVista';
import { TablaControl } from '@/components/TablaControl';
import { ModalBase } from '@/components/ModalBase';
import { BitacoraNotas } from '@/components/BitacoraNotas'; // 👈 Importamos tu nuevo componente modular
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

  const [activos, setActivos] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [cargos, setCargos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);

  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroArea, setFiltroArea] = useState('Todos');
  const [filtroCargo, setFiltroCargo] = useState('Todos');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [filtroConservacion, setFiltroConservacion] = useState('Todos');

  const [criterioSort, setCriterioSort] = useState<CriterioSort>('area');
  const [direccionSort, setDireccionSort] = useState<DireccionSort>('asc');

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
    } catch (err: any) {
      console.error("Error al cargar notas:", err.message);
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

  // 📊 MIGRACIÓN: Tu lógica exacta de recolección y formateo con barras '|'
  const ejecutarExportacionExcel = async () => {
    if (activosFiltrados.length === 0) return alert("⚠️ No hay datos para exportar.");
    try {
      setLoading(true);
      const { data: allComments } = await supabase
        .from('observaciones_activos')
        .select('*')
        .order('fecha_registro', { ascending: false });

      const dataPlana = activosFiltrados.map(a => {
        const comentariosDelActivo = (allComments || []).filter(c => c.activo_id === a.id);
        let celdaComentarios = "No hay comentarios";
        
        if (comentariosDelActivo.length > 0) {
          celdaComentarios = comentariosDelActivo
            .map(c => `${c.tipo_observacion}: ${c.comentario} (${new Date(c.fecha_registro).toLocaleDateString('es-PE')})`)
            .join(' | ');
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
          'Condición Física': a.nombre_estado || 'Excelente',
          'Especificaciones': a.especificaciones || '',
          'Historial de Observaciones': celdaComentarios, // 👈 Tu columna de auditoría unificada con '|'
          'Fecha Registro': a.fecha_registro ? new Date(a.fecha_registro).toLocaleDateString('es-PE') : new Date().toLocaleDateString('es-PE')
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataPlana);
      XLSX.utils.book_append_sheet(wb, ws, "Inventario_Reportes");
      XLSX.writeFile(wb, `Reporte_TI_Posgrado_Filtros.xlsx`);
    } catch (err: any) { 
      alert(`❌ Error: ${err.message}`); 
    } finally { 
      setLoading(false); 
    }
  };

  const manejarSort = (criterio: CriterioSort) => {
    if (criterioSort === criterio) {
      setDireccionSort(direccionSort === 'asc' ? 'desc' : 'asc');
    } else {
      setCriterioSort(criterio);
      setDireccionSort('asc');
    }
  };

  const activosFiltrados = useMemo(() => {
    return activos.filter(a => {
      const term = filtroTexto.toLowerCase().trim();
      
      const cumpleTexto = !term ||
        String(a.serial_id || '').toLowerCase().includes(term) ||
        String(a.caf || '').toLowerCase().includes(term) ||
        String(a.nombre_completo || '').toLowerCase().includes(term) ||
        String(a.dni || '').toLowerCase().includes(term) ||
        String(a.marca || '').toLowerCase().includes(term) ||
        String(a.modelo || '').toLowerCase().includes(term) ||
        String(a.nombre_estado || '').toLowerCase().includes(term) ||
        String(a.nombre_cargo || '').toLowerCase().includes(term);

      const cumpleArea = filtroArea === 'Todos' || String(a.nombre_area) === filtroArea;
      const cumpleCargo = filtroCargo === 'Todos' || String(a.nombre_cargo) === filtroCargo;
      const cumpleCategoria = filtroCategoria === 'Todos' || String(a.categoria) === filtroCategoria;
      const cumpleConservacion = filtroConservacion === 'Todos' || String(a.nombre_estado) === filtroConservacion;

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
      if (criterioSort === 'conservacion') { valorA = a.nombre_estado || ''; valorB = b.nombre_estado || ''; }

      return direccionSort === 'asc' ? valorA.localeCompare(valorB) : valorB.localeCompare(valorA);
    });
  }, [activos, filtroTexto, filtroArea, filtroCargo, filtroCategoria, filtroConservacion, criterioSort, direccionSort]);

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
          {/* 🎨 CORREGIDO: Jala el color HEX dinámico directo de la base de datos */}
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
        <div className="max-w-md">
          <div className="font-black text-slate-900 text-xs">[{item.categoria || 'N/A'}] {item.marca} — {item.modelo}</div>
          <div className="mt-1 flex gap-3 font-mono text-[10px]">
            <div><span className="text-slate-400 font-bold">S/N:</span> <span className="font-bold text-slate-700">{item.serial_id}</span></div>
            <div><span className="text-slate-400 font-bold">CAF:</span> <span className="bg-slate-100 border px-1.5 rounded font-bold text-slate-600 text-[9px]">{item.caf || 'N/A'}</span></div>
          </div>
        </div>
      )
    },
    {
      header: <span onClick={() => manejarSort('conservacion')} className="cursor-pointer select-none block w-full h-full">Condición Física{renderFlechaSort('conservacion')}</span>,
      field: "nombre_estado",
      className: "w-36 text-center",
      render: (item: any) => (
        <span className="px-2 py-0.5 rounded text-[10px] text-white font-black uppercase tracking-wider shadow-xs border border-black/10" style={{ backgroundColor: item.color_alerta || '#64748b' }}>
          ⚙️ {item.nombre_estado || 'Excelente'}
        </span>
      )
    },
    {
      header: "Notas",
      className: "text-center w-20",
      render: (item: any) => (
        <button type="button" onClick={() => abrirModalNotas(item)} className="text-base hover:scale-120 transition-all" title="Ver Historial">
          💬
        </button>
      )
    }
  ], [activos, criterioSort, direccionSort]);

  return (
    <ContenedorVista titulo="📊 Consola Analítica y Auditoría de Stock" subtitulo="Filtre, ordene y genere reportes técnicos globales." badgeStatus="online">
      <div className="h-full flex flex-col space-y-3 overflow-hidden">
        
        {/* Filtros */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs grid grid-cols-1 md:grid-cols-5 gap-3 text-xs font-bold text-slate-500">
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
          <div className="flex flex-col space-y-1 justify-end">
            <button type="button" onClick={ejecutarExportacionExcel} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg shadow-md uppercase transition-all flex items-center justify-center gap-1.5 active:scale-95">
              📥 Generar Informe (.xlsx)
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border overflow-hidden">
          <TablaControl tituloSeccion="Bitácora y Malla de Activos" badgeCount={activosFiltrados.length} data={activosFiltrados} loading={loading} columnas={columnasConfig} />
        </div>
      </div>

      {/* 🔐 MODAL CARGANDO TU NUEVO COMPONENTE MODULAR */}
      <ModalBase isOpen={modalComentarios.open} onClose={() => setModalComentarios({ open: false, activoId: null, numeroSerie: '' })} titulo="💬 Historial de Observaciones de Hardware">
        <BitacoraNotas 
          numeroSerie={modalComentarios.numeroSerie}
          tipoObs={tipoObs}
          setTipoObs={setTipoObs}
          nuevoComentario={nuevoComentario}
          setNuevoComentario={setNuevoComentario}
          enviandoComentario={enviandoComentario}
          onGuardarComentario={guardarComentarioNuevo}
          listaComentarios={listaComentarios}
        />
      </ModalBase>
    </ContenedorVista>
  );
}