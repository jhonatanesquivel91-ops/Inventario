'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { HeaderVista } from '@/components/HeaderVista';
import { TablaControl } from '@/components/TablaControl';
import { BuscadorControl } from '@/components/BuscadorControl';
import { ModalBase } from '@/components/ModalBase';
import { PanelFormulario } from '@/components/PanelFormulario';

// Catálogo exclusivo de Hardware y Conservación
type SubTabType = 'categorias' | 'marcas' | 'modelos' | 'condiciones';

export default function ConfiguracionPage() {
  const [subTab, setSubTab] = useState<SubTabType>('categorias');
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  // --- ARREGLOS DE DATOS MAESTROS ---
  const [categorias, setCategorias] = useState<any[]>([]);
  const [marcas, setMarcas] = useState<any[]>([]);
  const [modelos, setModelos] = useState<any[]>([]);
  const [condiciones, setCondiciones] = useState<any[]>([]);

  // --- ESTADOS DEL FORMULARIO REUTILIZABLE ---
  const [idEditando, setIdEditando] = useState<number | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formPadreId, setFormPadreId] = useState(''); 
  const [colorHex, setColorHex] = useState('#1E293B');

  const [modalEliminar, setModalEliminar] = useState<{ open: boolean; id: number | null; tabla: string }>({ open: false, id: null, tabla: '' });
  const [alerta, setAlerta] = useState<string | null>(null);

  const lanzarAlerta = (msg: string) => {
    setAlerta(msg);
    setTimeout(() => setAlerta(null), 3000);
  };

  const cargarCatalogos = async () => {
    try {
      setLoading(true);
      const [rCat, rMar, rMod, rCond] = await Promise.all([
        supabase.from('categorias_activo').select('*').order('nombre_categoria'),
        supabase.from('marcas').select('*, categorias_activo(nombre_categoria)').order('nombre_marca'),
        supabase.from('modelos').select('*, marcas(nombre_marca, categoria_id, categorias_activo(nombre_categoria))').order('nombre_modelo'),
        supabase.from('estados_conservacion').select('*').order('nombre_estado')
      ]);

      if (rCat.data) setCategorias(rCat.data.map(i => ({ ...i, id: i.id })));
      
      if (rMar.data) {
        setMarcas(rMar.data.map(i => ({ 
          ...i, 
          id: i.id, 
          categoria_nombre: i.categorias_activo?.nombre_categoria || 'N/A' 
        })));
      }
      
      if (rMod.data) {
        setModelos(rMod.data.map(i => ({ 
          ...i, 
          id: i.id, 
          marca_nombre: i.marcas?.nombre_marca || 'N/A', 
          categoria_nombre: i.marcas?.categorias_activo?.nombre_categoria || 'N/A' 
        })));
      }

      if (rCond.data) setCondiciones(rCond.data.map(i => ({ ...i, id: i.id })));
    } catch (err: any) {
      lanzarAlerta(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCatalogos();
    limpiarFormulario();
    setBusqueda('');
  }, [subTab]);

  const limpiarFormulario = () => {
    setIdEditando(null);
    setFormNombre('');
    setFormPadreId('');
    setColorHex('#1E293B');
  };

  const datasetFiltrado = useMemo(() => {
    const term = busqueda.toLowerCase().trim();
    let fuente: any[] = [];

    if (subTab === 'categorias') fuente = categorias;
    else if (subTab === 'marcas') fuente = marcas;
    else if (subTab === 'modelos') fuente = modelos;
    else if (subTab === 'condiciones') fuente = condiciones;

    if (!term) return fuente;

    return fuente.filter(item => {
      return (
        String(item.nombre_categoria || '').toLowerCase().includes(term) ||
        String(item.nombre_marca || '').toLowerCase().includes(term) ||
        String(item.nombre_modelo || '').toLowerCase().includes(term) ||
        String(item.categoria_nombre || '').toLowerCase().includes(term) ||
        String(item.marca_nombre || '').toLowerCase().includes(term) ||
        String(item.nombre_estado || '').toLowerCase().includes(term)
      );
    });
  }, [subTab, categorias, marcas, modelos, condiciones, busqueda]);

  const activarEdicion = (item: any) => {
    setIdEditando(item.id);
    if (subTab === 'categorias') setFormNombre(item.nombre_categoria);
    else if (subTab === 'marcas') { setFormNombre(item.nombre_marca); setFormPadreId(String(item.categoria_id)); }
    else if (subTab === 'modelos') { setFormNombre(item.nombre_modelo); setFormPadreId(String(item.marca_id)); }
    else if (subTab === 'condiciones') { setFormNombre(item.nombre_estado); setColorHex(item.color_alerta || '#1E293B'); }
  };

  const manejarGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) return lanzarAlerta("⚠️ El nombre es obligatorio.");

    try {
      setGuardando(true);
      let tablaDestino = subTab === 'categorias' ? 'categorias_activo' : subTab === 'condiciones' ? 'estados_conservacion' : subTab;
      let payload: any = {};

      if (subTab === 'categorias') payload = { nombre_categoria: formNombre.trim() };
      else if (subTab === 'marcas') payload = { nombre_marca: formNombre.trim(), categoria_id: Number(formPadreId) };
      else if (subTab === 'modelos') payload = { nombre_modelo: formNombre.trim(), marca_id: Number(formPadreId) };
      else if (subTab === 'condiciones') payload = { nombre_estado: formNombre.trim(), color_alerta: colorHex };

      if (idEditando) {
        const { error } = await supabase.from(tablaDestino).update(payload).eq('id', idEditando);
        if (error) throw error;
        lanzarAlerta("✨ Registro actualizado.");
      } else {
        const { error } = await supabase.from(tablaDestino).insert([payload]);
        if (error) throw error;
        lanzarAlerta("🚀 Registro insertado con éxito.");
      }

      limpiarFormulario();
      cargarCatalogos();
    } catch (err: any) {
      lanzarAlerta(`❌ Error: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const confirmarBorrado = async () => {
    if (!modalEliminar.id) return;
    try {
      setGuardando(true);
      const { error } = await supabase.from(modalEliminar.tabla).delete().eq('id', modalEliminar.id);
      if (error) throw new Error("Restricción de integridad: Este parámetro está asignado a equipos en el almacén.");
      
      setModalEliminar({ open: false, id: null, tabla: '' });
      lanzarAlerta("🗑️ Registro eliminado de la base de datos.");
      limpiarFormulario();
      cargarCatalogos();
    } catch (err: any) {
      lanzarAlerta(`⚠️ ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const columnasConfig = useMemo(() => {
    const defaultActions = (item: any, tabla: string) => (
      <div className="flex justify-end gap-3 px-1">
        <button type="button" onClick={() => activarEdicion(item)} className="text-xs hover:scale-110 transition-transform" title="Editar">✏️</button>
        <button type="button" onClick={() => setModalEliminar({ open: true, id: item.id, tabla })} className="text-xs hover:scale-110 transition-transform" title="Eliminar">❌</button>
      </div>
    );

    switch (subTab) {
      case 'categorias':
        return [
          { header: "Familia Hardware", field: "nombre_categoria", render: (i: any) => <span className="font-bold text-slate-800 text-xs">📦 {i.nombre_categoria}</span> },
          { header: "Acciones", className: "text-right w-20", render: (i: any) => defaultActions(i, 'categorias_activo') }
        ];
      case 'marcas':
        return [
          { header: "Fabricante", field: "nombre_marca", render: (i: any) => <span className="font-bold text-slate-800 text-xs">🏷️ {i.nombre_marca}</span> },
          { header: "Familia Vinculada", field: "categoria_nombre", render: (i: any) => <span className="font-mono text-[11px] text-blue-800 font-bold">[{i.categoria_nombre}]</span> },
          { header: "Acciones", className: "text-right w-20", render: (i: any) => defaultActions(i, 'marcas') }
        ];
      case 'modelos':
        return [
          { header: "Modelo Técnico", field: "nombre_modelo", render: (i: any) => <span className="font-bold text-slate-900 text-xs">⚙️ {i.nombre_modelo}</span> },
          { header: "Marca", field: "marca_nombre", render: (i: any) => <span className="text-slate-500 font-bold">{i.marca_nombre}</span> },
          { header: "Familia", field: "categoria_nombre", render: (i: any) => <span className="text-slate-400 font-medium text-[11px]">{i.categoria_nombre}</span> },
          { header: "Acciones", className: "text-right w-20", render: (i: any) => defaultActions(i, 'modelos') }
        ];
      case 'condiciones':
        return [
          { header: "Estado Conservación", field: "nombre_estado", render: (i: any) => <span className="px-2 py-0.5 text-white text-[10px] font-black uppercase tracking-wider rounded border border-black/10 shadow-sm" style={{ backgroundColor: i.color_alerta }}>{i.nombre_estado}</span> },
          { header: "Código de Color Hex", field: "color_alerta", render: (i: any) => <code className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold border">{i.color_alerta}</code> },
          { header: "Acciones", className: "text-right w-20", render: (i: any) => defaultActions(i, 'estados_conservacion') }
        ];
    }
  }, [subTab]);

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col justify-between space-y-3 font-sans overflow-hidden text-slate-700 animate-fade-in">
      {alerta && <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-slate-900 text-white text-xs font-black rounded-xl shadow-2xl">{alerta}</div>}

      <HeaderVista titulo="⚙️ Consola de Configuración Global" subtitulo="Mantenimiento de catálogos jerárquicos de hardware y estados de conservación dinámicos." badgeStatus="online">
        <div className="flex bg-slate-100 p-1 rounded-xl border text-[11px] font-black gap-1">
          {(['categorias', 'marcas', 'modelos', 'condiciones'] as const).map((tab) => (
            <button 
              key={tab}
              onClick={() => setSubTab(tab)} 
              className={`px-3 py-1.5 rounded-lg transition-all capitalize ${subTab === tab ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
              style={subTab === tab ? { color: 'rgb(1, 71, 118)' } : {}}
            >
              {tab === 'categorias' ? 'Familias' : tab === 'condiciones' ? 'Estados' : tab}
            </button>
          ))}
        </div>
      </HeaderVista>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-0 overflow-hidden">
        
        {/* COLUMNA IZQUIERDA (2/3) */}
        <div className="lg:col-span-2 flex flex-col min-h-0 bg-white rounded-xl border overflow-hidden">
          <TablaControl tituloSeccion={`Registros en Malla`} badgeCount={datasetFiltrado.length} data={datasetFiltrado} loading={loading} columnas={columnasConfig}>
            <BuscadorControl value={busqueda} onChange={setBusqueda} placeholder={`Buscar dentro de este catálogo técnico...`} />
          </TablaControl>
        </div>

        {/* COLUMNA DERECHA (1/3) - TU PANEL COMPONENTE REUTILIZABLE */}
        <PanelFormulario 
          idEditando={idEditando} 
          onCancelar={limpiarFormulario} 
          onSubmit={manejarGuardar} 
          guardando={guardando}
        >
          {/* INPUT DINÁMICO */}
          <div className="space-y-1">
            <label className="block font-bold text-slate-500 uppercase text-[10px]">
              {subTab === 'categorias' ? 'Nombre de Familia Hardware *' :
               subTab === 'marcas' ? 'Nombre de la Marca / Fabricante *' :
               subTab === 'modelos' ? 'Nombre del Modelo Técnico *' : 'Nombre del Estado de Conservación *'}
            </label>
            <input 
              type="text" 
              value={formNombre} 
              onChange={(e) => setFormNombre(e.target.value)} 
              placeholder="Ingresa el valor descriptivo aquí..." 
              className="w-full p-2 border border-slate-200 rounded-lg outline-none font-bold text-slate-800 bg-white text-xs" 
              required 
            />
          </div>

          {subTab === 'marcas' && (
            <div className="space-y-1 animate-fade-in">
              <label className="block font-bold text-slate-500 uppercase text-[10px]">Asociar a Familia Core *</label>
              <select value={formPadreId} onChange={(e) => setFormPadreId(e.target.value)} className="w-full p-2 border rounded-lg bg-white font-bold text-slate-700 text-xs" required>
                <option value="">-- Selecciona una Familia --</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre_categoria}</option>)}
              </select>
            </div>
          )}

          {subTab === 'modelos' && (
            <div className="space-y-1 animate-fade-in">
              <label className="block font-bold text-slate-500 uppercase text-[10px]">Asociar a Marca Fabricante *</label>
              <select value={formPadreId} onChange={(e) => setFormPadreId(e.target.value)} className="w-full p-2 border rounded-lg bg-white font-bold text-slate-700 text-xs" required>
                <option value="">-- Selecciona una Marca --</option>
                {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre_marca}</option>)}
              </select>
            </div>
          )}

          {subTab === 'condiciones' && (
            <div className="space-y-1.5 bg-slate-50 border p-2.5 rounded-xl animate-fade-in">
              <label className="block font-bold text-slate-500 uppercase text-[10px]">Identificador Visual / Alerta</label>
              <div className="flex items-center gap-3">
                <input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)} className="w-8 h-8 rounded border cursor-pointer bg-transparent" />
                <code className="font-mono text-xs text-slate-700 bg-white px-2 py-1 border rounded-lg font-bold shadow-xs">{colorHex}</code>
              </div>
            </div>
          )}
        </PanelFormulario>

      </div>

      <ModalBase isOpen={modalEliminar.open} onClose={() => setModalEliminar({ open: false, id: null, tabla: '' })} titulo="⚠️ Confirmar Eliminación Permanente">
        <div className="text-center space-y-3">
          <p className="text-slate-500 text-[11px] leading-normal">¿Estás seguro de destruir esta fila física de la tabla de configuración? Si existen activos tecnológicos vinculados a este parámetro, la base de datos de Supabase rechazará la transacción por seguridad.</p>
          <div className="flex justify-center gap-2 pt-2 border-t">
            <button type="button" onClick={() => setModalEliminar({ open: false, id: null, tabla: '' })} className="px-3 py-1.5 bg-slate-100 rounded-lg font-bold text-slate-700">Cancelar</button>
            <button type="button" onClick={confirmarBorrado} disabled={guardando} className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-bold shadow-md">Sí, Eliminar</button>
          </div>
        </div>
      </ModalBase>
    </div>
  );
}