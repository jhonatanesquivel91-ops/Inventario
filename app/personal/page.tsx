'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { HeaderVista } from '@/components/HeaderVista';
import { TablaControl } from '@/components/TablaControl';
import { BuscadorControl } from '@/components/BuscadorControl';
import { ModalBase } from '@/components/ModalBase';
import { PanelFormulario } from '@/components/PanelFormulario';

export default function GestionPersonalPage() {
  const [subTab, setSubTab] = useState<'colaboradores' | 'areas' | 'cargos'>('colaboradores');
  const [loading, setLoading] = useState(false);

  // Estados maestros
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [cargos, setCargos] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');

  // Formulario único reactivo
  const [idEditando, setIdEditando] = useState<number | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formDni, setFormDni] = useState('');
  const [selectAreaId, setSelectAreaId] = useState('');
  const [selectCargoId, setSelectCargoId] = useState('');
  const [formEstado, setFormEstado] = useState<'Activo' | 'Inactivo'>('Activo');
  const [colorHex, setColorHex] = useState('#114776');

  const [guardando, setGuardando] = useState(false);
  const [modalEliminar, setModalEliminar] = useState<{ open: boolean; id: number | null; tabla: string }>({ open: false, id: null, tabla: '' });
  const [alerta, setAlerta] = useState<string | null>(null);

  const lanzarAlerta = (msg: string) => {
    setAlerta(msg);
    setTimeout(() => setAlerta(null), 3000);
  };

  const cargarCatalogos = async () => {
    try {
      setLoading(true);
      const [rUsr, rArea, rCargo] = await Promise.all([
        supabase.from('usuarios').select('*, areas(*), cargos(*)').order('nombre_completo'),
        supabase.from('areas').select('*').order('nombre_area'),
        supabase.from('cargos').select('*').order('nombre_cargo')
      ]);

      if (rUsr.data) setUsuarios(rUsr.data);
      if (rArea.data) setAreas(rArea.data);
      if (rCargo.data) setCargos(rCargo.data);
    } catch (err: any) {
      lanzarAlerta(`❌ Error al sincronizar base de datos: ${err.message}`);
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
    setFormDni('');
    setSelectAreaId('');
    setSelectCargoId('');
    setFormEstado('Activo'); // 👈 Resetea a Activo por defecto
    setColorHex('#114776');
  };

  // --- FILTRADOS EN CALIENTE ---
  const datasetFiltrado = React.useMemo(() => {
    const termino = busqueda.toLowerCase().trim();
    if (subTab === 'colaboradores') {
      return usuarios.filter(u =>
        !termino ||
        String(u.nombre_completo || '').toLowerCase().includes(termino) ||
        String(u.dni || '').toLowerCase().includes(termino) ||
        String(u.estado || '').toLowerCase().includes(termino) ||
        String(u.areas?.nombre_area || '').toLowerCase().includes(termino) ||
        String(u.cargos?.nombre_cargo || '').toLowerCase().includes(termino)
      );
    }
    if (subTab === 'areas') {
      return areas.filter(a => !termino || String(a.nombre_area || '').toLowerCase().includes(termino));
    }
    return cargos.filter(c => !termino || String(c.nombre_cargo || '').toLowerCase().includes(termino));
  }, [subTab, usuarios, areas, cargos, busqueda]);

  // --- CONFIGURACIÓN DE COLUMNAS DE LA TABLA CORE ---
  const columnasConfig: any[] = React.useMemo(() => {
    if (subTab === 'colaboradores') {
      return [
        {
          header: "Colaborador",
          field: "nombre_completo",
          render: (u: any) => (
            <div>
              <div className="font-bold text-slate-900 text-xs">👤 {u.nombre_completo}</div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">DNI: {u.dni}</div>
            </div>
          )
        },
        {
          header: "Estructura Laboral",
          field: "areas.nombre_area",
          render: (u: any) => (
            <div className="space-y-1">
              {u.areas ? (
                <span className="px-2 py-0.5 rounded text-white font-black text-[9px] uppercase tracking-wider block w-fit shadow-xs border border-black/10" style={{ backgroundColor: u.areas.color_hex }}>
                  {u.areas.nombre_area}
                </span>
              ) : <span className="text-slate-400 text-[10px] font-bold italic">Sin Área Asignada</span>}
              <div className="text-[10px] text-slate-500 font-bold">Cargo: <span className="font-mono text-slate-700">{u.cargos?.nombre_cargo || '—'}</span></div>
            </div>
          )
        },
        {
          header: "Estado Operativo",
          field: "estado",
          render: (u: any) => {
            const esActivo = u.estado === 'Activo';
            return (
              <div className="space-y-0.5">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${esActivo ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}>
                  {esActivo ? '● Activo' : '○ Inactivo'}
                </span>
                {!esActivo && (
                  <div className="text-[9px] text-rose-600 font-black tracking-tight uppercase animate-pulse">
                    🚨 Custodia a TI
                  </div>
                )}
              </div>
            );
          }
        },
        {
          header: "Acciones",
          className: "text-right w-20",
          render: (u: any) => (
            <div className="flex justify-end gap-3 px-1">
              <button type="button" onClick={() => abrirEditor(u)} className="text-xs hover:scale-110 transition-transform" title="Editar">✏️</button>
              <button type="button" onClick={() => setModalEliminar({ open: true, id: u.id, tabla: 'usuarios' })} className="text-xs hover:scale-110 transition-transform" title="Eliminar">❌</button>
            </div>
          )
        }
      ];
    }

    if (subTab === 'areas') {
      return [
        { header: "Área Corporativa", field: "nombre_area", render: (a: any) => <span className="font-bold text-slate-800 text-xs">🏢 {a.nombre_area}</span> },
        {
          header: "Identificador Visual",
          field: "color_hex",
          render: (a: any) => (
            <div className="flex items-center gap-2 font-mono text-[10px] font-bold">
              <span className="w-3 h-3 rounded-full border shadow-xs" style={{ backgroundColor: a.color_hex }} />
              <code>{a.color_hex}</code>
            </div>
          )
        },
        {
          header: "Acciones",
          className: "text-right w-20",
          render: (a: any) => (
            <div className="flex justify-end gap-3 px-1">
              <button type="button" onClick={() => abrirEditor(a)} className="text-xs hover:scale-110 transition-transform" title="Editar">✏️</button>
              <button type="button" onClick={() => setModalEliminar({ open: true, id: a.id, tabla: 'areas' })} className="text-xs hover:scale-110 transition-transform" title="Eliminar">❌</button>
            </div>
          )
        }
      ];
    }

    return [
      { header: "Cargo Técnico Configurado", field: "nombre_cargo", render: (c: any) => <span className="font-bold text-slate-800 text-xs">💼 {c.nombre_cargo}</span> },
      {
        header: "Acciones",
        className: "text-right w-20",
        render: (c: any) => (
          <div className="flex justify-end gap-3 px-1">
            <button type="button" onClick={() => abrirEditor(c)} className="text-xs hover:scale-110 transition-transform" title="Editar">✏️</button>
            <button type="button" onClick={() => setModalEliminar({ open: true, id: c.id, tabla: 'cargos' })} className="text-xs hover:scale-110 transition-transform" title="Eliminar">❌</button>
          </div>
        )
      }
    ];
  }, [subTab]);

  // --- CRUD OPERACIONES ---
  const manejarGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) return lanzarAlerta("⚠️ El campo descriptivo es requerido.");

    try {
      setGuardando(true);
      let tablaDestino = subTab === 'colaboradores' ? 'usuarios' : subTab;
      let payload: any = {};

      if (subTab === 'colaboradores') {
        payload = {
          nombre_completo: formNombre.trim(),
          dni: formDni.trim(),
          area_id: selectAreaId ? Number(selectAreaId) : null,
          cargo_id: selectCargoId ? Number(selectCargoId) : null,
          estado: formEstado // 👈 Inyección del estado real en Supabase
        };
      } else if (subTab === 'areas') {
        payload = { nombre_area: formNombre.trim(), color_hex: colorHex };
      } else if (subTab === 'cargos') {
        payload = { nombre_cargo: formNombre.trim() };
      }

      const { error } = idEditando
        ? await supabase.from(tablaDestino).update(payload).eq('id', idEditando)
        : await supabase.from(tablaDestino).insert([payload]);

      if (error) throw error;
      lanzarAlerta(idEditando ? "✨ Ficha actualizada con éxito." : "🚀 Registro inyectado al catálogo.");
      limpiarFormulario();
      cargarCatalogos();
    } catch (err: any) {
      lanzarAlerta(`❌ Error: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const ejecutarEliminar = async () => {
    if (!modalEliminar.id) return;
    try {
      setGuardando(true);
      const { error } = await supabase.from(modalEliminar.tabla).delete().eq('id', modalEliminar.id);
      if (error) throw new Error("Restricción: El elemento posee dependencias o activos tecnológicos asignados.");

      setModalEliminar({ open: false, id: null, tabla: '' });
      lanzarAlerta("🗑️ Elemento removido físicamente.");
      limpiarFormulario();
      cargarCatalogos();
    } catch (err: any) {
      lanzarAlerta(`⚠️ ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const abrirEditor = (item: any) => {
    setIdEditando(item.id);
    if (subTab === 'colaboradores') {
      setFormNombre(item.nombre_completo);
      setFormDni(item.dni || '');
      setSelectAreaId(item.area_id ? String(item.area_id) : '');
      setSelectCargoId(item.cargo_id ? String(item.cargo_id) : '');
      setFormEstado(item.estado === 'Inactivo' ? 'Inactivo' : 'Activo'); // 👈 Mapeo de estado al editar
    } else if (subTab === 'areas') {
      setFormNombre(item.nombre_area);
      setColorHex(item.color_hex || '#114776');
    } else {
      setFormNombre(item.nombre_cargo);
    }
  };

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col justify-between space-y-3 font-sans overflow-hidden text-slate-700 animate-fade-in">
      {alerta && <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-slate-900 text-white text-xs font-black rounded-xl shadow-2xl">{alerta}</div>}

      <HeaderVista
        titulo="👥 Catálogo Maestro de Personal"
        subtitulo="Administración estructural y fichas de Colaboradores, Áreas de Posgrado y Cargos Técnicos."
        badgeStatus="online"
      >
        <div className="flex bg-slate-100 p-1 rounded-xl border text-[11px] font-black gap-1">
          <button onClick={() => setSubTab('colaboradores')} className={`px-3 py-1.5 rounded-lg transition-all ${subTab === 'colaboradores' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`} style={subTab === 'colaboradores' ? { color: 'rgb(1, 71, 118)' } : {}}>Colaboradores</button>
          <button onClick={() => setSubTab('areas')} className={`px-3 py-1.5 rounded-lg transition-all ${subTab === 'areas' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`} style={subTab === 'areas' ? { color: 'rgb(1, 71, 118)' } : {}}>Áreas</button>
          <button onClick={() => setSubTab('cargos')} className={`px-3 py-1.5 rounded-lg transition-all ${subTab === 'cargos' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`} style={subTab === 'cargos' ? { color: 'rgb(1, 71, 118)' } : {}}>Cargos</button>
        </div>
      </HeaderVista>

      <BuscadorControl
        value={busqueda}
        onChange={setBusqueda}
        placeholder={`Buscar de forma rápida dentro de los registros de ${subTab}...`}
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-0 overflow-hidden items-stretch">

        {/* GRILLA DE LA TABLA (IZQUIERDA - 2/3) */}
        <div className="lg:col-span-2 flex flex-col min-h-0 bg-white rounded-xl border overflow-hidden">
          <TablaControl
            tituloSeccion="Eje Organizacional de Personal"
            badgeCount={datasetFiltrado.length}
            data={datasetFiltrado}
            loading={loading}
            msgVacio="No se encontraron registros activos en la base de datos."
            columnas={columnasConfig}
          />
        </div>

        {/* FORMULARIO DE EDICIÓN / ALTA (DERECHA - 1/3) */}
        <PanelFormulario
          idEditando={idEditando}
          onCancelar={limpiarFormulario}
          onSubmit={manejarGuardar}
          guardando={guardando}
        >
          {subTab === 'colaboradores' && (
            <>
              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase text-[10px]">Nombres y Apellidos *</label>
                <input type="text" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Ej: Jonathan Esquivel" className="w-full p-2 border border-slate-200 bg-white rounded-lg outline-none font-bold text-slate-800 text-xs shadow-inner" required />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase text-[10px]">Número de DNI *</label>
                <input type="text" value={formDni} onChange={(e) => setFormDni(e.target.value)} maxLength={8} placeholder="8 dígitos obligatorios" className="w-full p-2 border border-slate-200 bg-white rounded-lg outline-none font-mono text-slate-800 font-bold text-xs shadow-inner" required />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase text-[10px]">Área de Trabajo Destino *</label>
                <select value={selectAreaId} onChange={(e) => setSelectAreaId(e.target.value)} className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold text-slate-700 outline-none text-xs cursor-pointer shadow-sm" required>
                  <option value="">Seleccione un área...</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.nombre_area}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase text-[10px]">Cargo Técnico Asignado *</label>
                <select value={selectCargoId} onChange={(e) => setSelectCargoId(e.target.value)} className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold text-slate-700 outline-none text-xs cursor-pointer shadow-sm" required>
                  <option value="">Seleccione un cargo...</option>
                  {cargos.map(c => <option key={c.id} value={c.id}>{c.nombre_cargo}</option>)}
                </select>
              </div>

              {/* 🛡️ SELECTOR DE ESTADO OPERATIVO CORREGIDO */}
              <div className="space-y-1 bg-slate-50 border p-2 rounded-xl animate-fade-in mt-2">
                <label className="block font-bold text-slate-500 uppercase text-[10px]">Estado de Disponibilidad *</label>
                <select
                  value={formEstado}
                  onChange={(e) => setFormEstado(e.target.value as 'Activo' | 'Inactivo')}
                  className={`w-full p-2 border rounded-lg font-black outline-none text-xs cursor-pointer shadow-xs ${formEstado === 'Activo' ? 'bg-white text-emerald-700 border-slate-200' : 'bg-rose-50 text-rose-700 border-rose-300'
                    }`}
                  required
                >
                  <option value="Activo">🟢 Personal en Funciones (Activo)</option>
                  <option value="Inactivo">🔴 Baja Laboral (Activos a Custodia TI)</option>
                </select>
              </div>
            </>
          )}

          {subTab === 'areas' && (
            <>
              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase text-[10px]">Nombre del Área Organizacional *</label>
                <input type="text" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Ej: Dirección de Posgrado" className="w-full p-2 border border-slate-200 bg-white rounded-lg outline-none font-bold text-slate-800 text-xs shadow-inner" required />
              </div>
              <div className="space-y-1.5 bg-slate-50 border p-2.5 rounded-xl animate-fade-in">
                <label className="block font-bold text-slate-500 uppercase text-[10px]">Color Identificador Institucional</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)} className="w-8 h-8 rounded border cursor-pointer bg-transparent" />
                  <code className="font-mono text-xs text-slate-700 bg-white px-2 py-1 border rounded-lg font-bold shadow-xs uppercase">{colorHex}</code>
                </div>
              </div>
            </>
          )}

          {subTab === 'cargos' && (
            <div className="space-y-1">
              <label className="block font-bold text-slate-500 uppercase text-[10px]">Nombre del Cargo Técnico *</label>
              <input type="text" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Ej: Especialista de Soporte TI" className="w-full p-2 border border-slate-200 bg-white rounded-lg outline-none font-bold text-slate-800 text-xs shadow-inner" required />
            </div>
          )}
        </PanelFormulario>

      </div>

      {/* MODAL DE SEGURIDAD ELIMINAR BAJO PLANTILLA CORE */}
      <ModalBase isOpen={modalEliminar.open} onClose={() => setModalEliminar({ open: false, id: null, tabla: '' })} titulo="⚠️ Confirmar Eliminación Permanente">
        <div className="text-center space-y-3">
          <p className="text-slate-500 text-[11px] leading-normal">¿Estás seguro de destruir esta fila física de la base de datos de personal? Si el colaborador posee activos tecnológicos en custodia o el área tiene personal activo vinculado, la transacción se cancelará automáticamente por integridad.</p>
          <div className="flex justify-center gap-2 pt-2 border-t">
            <button type="button" onClick={() => setModalEliminar({ open: false, id: null, tabla: '' })} className="px-3 py-1.5 bg-slate-100 rounded-lg font-bold text-slate-700">Cancelar</button>
            <button type="button" onClick={ejecutarEliminar} disabled={guardando} className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-bold shadow-md">Sí, Eliminar de Raíz</button>
          </div>
        </div>
      </ModalBase>
    </div>
  );
}