'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { crearFiltro } from '@/lib/busqueda';
import { HeaderVista } from '@/components/HeaderVista';
import { TablaControl } from '@/components/TablaControl';
import { useDestacar } from '@/lib/useDestacar';
import { BuscadorControl } from '@/components/BuscadorControl';
import { PanelFormulario } from '@/components/PanelFormulario';
import { ModalBase } from '@/components/ModalBase'; // 👈 Tus modals corporativos

export default function ModuloPrestamos() {
  const idDestacado = useDestacar();
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');

  // Catálogos
  const [usuariosSistema, setUsuariosSistema] = useState<any[]>([]);
  const [activosSistema, setActivosSistema] = useState<any[]>([]);

  // Formulario States
  const [idUsuario, setIdUsuario] = useState<number | null>(null);
  const [txtUsuario, setTxtUsuario] = useState('');
  const [celular, setCelular] = useState('');
  const [idActivo, setIdActivo] = useState<number | null>(null);
  const [txtActivo, setTxtActivo] = useState('');
  const [fechaEstimada, setFechaEstimada] = useState('');
  const [alertaActiva, setAlertaActiva] = useState(true);
  const [observaciones, setObservaciones] = useState('');

  // Orquestador de Alertas y Modals Dinámicos
  const [alerta, setAlerta] = useState<string | null>(null);
  const [modalSeguridad, setModalSeguridad] = useState<{
    open: boolean;
    tipo: 'recibir' | 'revertir' | 'eliminar' | null;
    id: number | null;
  }>({ open: false, tipo: null, id: null });

  const lanzarAlerta = (msg: string) => {
    setAlerta(msg);
    setTimeout(() => setAlerta(null), 3000);
  };

  const cargarModulos = async () => {
    try {
      setLoading(true);
      const [rPrest, rUsr, rAct] = await Promise.all([
        supabase.from('prestamos').select('*').order('estado_prestamo', { ascending: false }).order('id', { ascending: false }),
        supabase.from('usuarios').select('id, nombre_completo'),
        supabase.from('vista_activos_completa').select('*')
      ]);

      if (rPrest.data) setPrestamos(rPrest.data);
      if (rUsr.data) setUsuariosSistema(rUsr.data);
      if (rAct.data) setActivosSistema(rAct.data);
    } catch (err: any) {
      lanzarAlerta(`❌ Error al cargar datos: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarModulos();
  }, []);

  // --- AUTOCOMPLETADO Y EXTRACCIÓN AUTOMÁTICA DE CELULAR ---
  const seleccionarUsuarioPredicho = async (usr: any) => {
    setIdUsuario(usr.id);
    setTxtUsuario(usr.nombre_completo);

    try {
      const { data } = await supabase
        .from('vista_activos_completa')
        .select('especificaciones, linea_telefonica')
        .eq('asignado_usuario_id', usr.id) // 🛠️ CORREGIDO: Apunta al campo real de la vista
        .ilike('categoria', '%celular%')
        .limit(1);

      if (data && data.length > 0) {
        const equipo: any = data[0];

        // Se prefiere la columna dedicada. Si el equipo todavía guarda el
        // número dentro de las especificaciones (porque no se migró), se
        // mantiene la extracción original para no perder el autocompletado.
        const desdeColumna = String(equipo.linea_telefonica || '').replace(/\D/g, '');
        const desdeSpecs = String(equipo.especificaciones || '').match(/\d{9,11}/);

        if (desdeColumna.length >= 9) {
          setCelular(desdeColumna.slice(-9));
        } else if (desdeSpecs) {
          setCelular(desdeSpecs[0]);
        } else {
          setCelular('');
        }
      } else {
        setCelular('');
      }
    } catch (err) {
      console.error("Error al predecir celular:", err);
      setCelular('');
    }
  };
  const seleccionarActivoPredicho = (act: any) => {
    setIdActivo(act.activo_id || act.id);

    // Formato exacto: Categoria : Marca Modelo — CAF: XXXX - S/N: XXXX
    const cafTexto = act.caf ? ` — CAF: ${act.caf}` : '';
    setTxtActivo(`${act.categoria || 'Equipo'} : ${act.marca || ''} ${act.modelo || ''}${cafTexto} - S/N: ${act.serial_id || 'N/R'}`);
  };

  const limpiarCampos = () => {
    setIdUsuario(null); setTxtUsuario(''); setCelular(''); setIdActivo(null); setTxtActivo(''); setFechaEstimada(''); setAlertaActiva(true); setObservaciones('');
  };

  const registrarSalidaHardware = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txtUsuario.trim() || !txtActivo.trim()) return lanzarAlerta('⚠️ Completa prestatario y equipo.');

    try {
      setGuardando(true);
      const payload = {
        usuario_id: idUsuario,
        activo_id: idActivo,
        nombre_prestatario: txtUsuario.trim(),
        celular_contacto: celular.trim() || null,
        nombre_activo: txtActivo.trim(),
        fecha_devolucion_estimada: fechaEstimada ? new Date(fechaEstimada).toISOString() : null,
        alerta_activa: alertaActiva,
        observaciones: observaciones.trim() || null,
        estado_prestamo: 'Pendiente'
      };

      const { error } = await supabase.from('prestamos').insert([payload]);
      if (error) throw error;

      lanzarAlerta("🚀 Préstamo registrado en retén.");
      limpiarCampos(); cargarModulos();
    } catch (err: any) { lanzarAlerta(`❌ Error: ${err.message}`); } finally { setGuardando(false); }
  };

  const procesarAccionSegura = async () => {
    if (!modalSeguridad.id || !modalSeguridad.tipo) return;
    try {
      setGuardando(true);
      const targetId = modalSeguridad.id;

      if (modalSeguridad.tipo === 'recibir') {
        // 🧽 Removida la columna inexistente para evitar el Bad Request
        const { error } = await supabase
          .from('prestamos')
          .update({ estado_prestamo: 'Devuelto' }) 
          .eq('id', targetId);
          
        if (error) throw error;
        lanzarAlerta("✅ Equipo recibido en almacén.");
      }
      else if (modalSeguridad.tipo === 'revertir') {
        // 🧽 Removida la columna inexistente aquí también
        const { error } = await supabase
          .from('prestamos')
          .update({ estado_prestamo: 'Pendiente' }) 
          .eq('id', targetId);
          
        if (error) throw error;
        lanzarAlerta("🔄 Estado de retén revertido a Pendiente.");
      }
      else if (modalSeguridad.tipo === 'eliminar') {
        const { error } = await supabase.from('prestamos').delete().eq('id', targetId);
        if (error) throw error;
        lanzarAlerta("🗑️ Registro de préstamo eliminado.");
      }

      setModalSeguridad({ open: false, tipo: null, id: null });
      cargarModulos();
    } catch (err: any) {
      lanzarAlerta(`❌ Error operativo: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const abrirWhatsappExpress = (item: any) => {
    if (!item.celular_contacto) return lanzarAlerta('No hay teléfono registrado.');
    const fechaTexto = item.fecha_devolucion_estimada ? new Date(item.fecha_devolucion_estimada).toLocaleDateString('es-PE', { day: 'numeric', month: 'long' }) : 'la brevedad';
    const msg = `*NOTIFICACIÓN DE DEVOLUCIÓN PENDIENTE*\n\nEstimado(a) *${item.nombre_prestatario}*,\n\nLe saluda el área de *Soporte Técnico TI - Posgrado*.\n\nSe le solicita la devolución del siguiente equipo:\n• *Equipo:* ${item.nombre_activo}\n• *Fecha límite:* ${fechaTexto}\n\nPor favor, acérquese al *Almacén de TI de Posgrado* para regularizar el bien.\n\nAtentamente,\n*Área de TI - Posgrado UPeU*`;
    window.open(`https://wa.me/${item.celular_contacto.replace(/\D/g, '').startsWith('51') ? item.celular_contacto.replace(/\D/g, '') : `51${item.celular_contacto.replace(/\D/g, '')}`}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const datasetFiltrado = useMemo(() => {
    const term = busqueda.toLowerCase().trim();
    if (!term) return prestamos;
    return prestamos.filter(crearFiltro<any>(busqueda, ['nombre_prestatario', 'nombre_activo', 'estado_prestamo', 'observaciones', 'fecha_devolucion_estimada']));
  }, [prestamos, busqueda]);

  const columnasConfig = useMemo(() => [
    {
      header: "Prestatario",
      field: "nombre_prestatario",
      render: (item: any) => (
        <div>
          <div className="font-bold text-slate-900 text-xs">👤 {item.nombre_prestatario}</div>
          {item.celular_contacto && <div className="text-[10px] text-slate-400 font-mono mt-0.5">📱 {item.celular_contacto}</div>}
        </div>
      )
    },
    {
      header: "Activo de Retén Asignado",
      field: "nombre_activo",
      render: (item: any) => {
        // El préstamo guarda `nombre_activo` como texto, copiado al registrarlo.
        // Si después se edita la marca, el modelo o la serie del equipo, ese
        // texto queda obsoleto y contradice al inventario. Por eso, cuando el
        // préstamo apunta a un activo existente se arma el nombre desde la
        // fuente viva; el texto guardado solo cubre los registros antiguos que
        // no tienen `activo_id`.
        const activoVinculado = activosSistema.find(a => Number(a.activo_id || a.id) === Number(item.activo_id));

        const textoMostrar = activoVinculado
          ? [
              `[${activoVinculado.categoria || 'Equipo'}]`,
              [activoVinculado.marca, activoVinculado.modelo].filter(Boolean).join(' '),
              activoVinculado.caf ? `— CAF: ${activoVinculado.caf}` : '',
              activoVinculado.serial_id ? `- S/N: ${activoVinculado.serial_id}` : '',
            ].filter(Boolean).join(' ')
          : (item.nombre_activo || '—');

        return (
          <div className="max-w-xs">
            <div className="font-medium text-slate-700 text-xs truncate">
              {textoMostrar}
            </div>
            {item.observaciones && <div className="text-[10px] text-slate-400 italic mt-0.5">Destino: {item.observaciones}</div>}
          </div>
        );
      }
    },
    {
      header: "Fechas Trazo",
      field: "fecha_salida",
      render: (item: any) => (
        <div className="font-mono text-[10px] space-y-0.5 text-slate-500">
          <div>🛫 {new Date(item.fecha_salida || item.created_at).toLocaleDateString('es-PE')}</div>
          <div className="text-slate-400">🏁 {item.fecha_devolucion_estimada ? new Date(item.fecha_devolucion_estimada).toLocaleDateString('es-PE') : 'Abierto'}</div>
        </div>
      )
    },
    {
      header: "Estado",
      field: "estado_prestamo",
      className: "text-center w-24",
      render: (item: any) => {
        const esVencido = item.estado_prestamo === 'Pendiente' && item.fecha_devolucion_estimada && new Date(item.fecha_devolucion_estimada) < new Date();
        if (item.estado_prestamo === 'Devuelto') return <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">Devuelto</span>;
        if (esVencido && item.alerta_activa) return <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider animate-pulse">Vencido</span>;
        return <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">Pendiente</span>;
      }
    },
    {
      header: "Acciones",
      className: "text-center w-36",
      render: (item: any) => (
        <div className="flex items-center justify-center gap-2.5">
          {item.estado_prestamo === 'Pendiente' ? (
            <button type="button" onClick={() => setModalSeguridad({ open: true, tipo: 'recibir', id: item.id })} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded border border-slate-200 text-[10px] font-black uppercase transition-all">
              Recibir
            </button>
          ) : (
            // 🔄 BOTÓN DE REVERSIÓN DINÁMICO
            <button type="button" onClick={() => setModalSeguridad({ open: true, tipo: 'revertir', id: item.id })} className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-2 py-0.5 rounded border border-amber-200 text-[10px] font-black uppercase transition-all" title="Revertir Devolución">
              Revertir
            </button>
          )}
          {item.estado_prestamo === 'Pendiente' && item.celular_contacto && (
            <button type="button" onClick={() => abrirWhatsappExpress(item)} className="text-xs hover:scale-120 transition-transform" title="Notificar por WhatsApp">🟢</button>
          )}
          {/* ❌ BOTÓN DE ELIMINAR */}
          <button type="button" onClick={() => setModalSeguridad({ open: true, tipo: 'eliminar', id: item.id })} className="text-slate-400 hover:text-red-600 text-xs transition-colors" title="Eliminar Registro">❌</button>
        </div>
      )
    }
  ], [prestamos]);

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col justify-between space-y-3 font-sans overflow-hidden text-slate-700 animate-fade-in">
      {alerta && <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-slate-900 text-white text-xs font-black rounded-xl shadow-2xl">{alerta}</div>}

      <HeaderVista titulo="📋 Panel de Control y Préstamos de Retén" subtitulo="Gestión dinámica de salidas temporales, control de vencimientos y tracking físico de alertas." badgeStatus="online" />

      <BuscadorControl value={busqueda} onChange={setBusqueda} placeholder="Buscar préstamo por prestatario, equipo asignado o estado..." />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-0 overflow-hidden items-stretch">

        <div className="lg:col-span-2 flex flex-col min-h-0 bg-white rounded-xl border overflow-hidden">
          <TablaControl tituloSeccion="Historial de Salidas Retén TI" badgeCount={datasetFiltrado.length} data={datasetFiltrado} loading={loading} columnas={columnasConfig} idDestacado={idDestacado} />
        </div>

        <PanelFormulario idEditando={null} onCancelar={limpiarCampos} onSubmit={registrarSalidaHardware} guardando={guardando}>
          <div className="relative space-y-1">
            <label className="block font-bold text-slate-500 uppercase text-[10px]">Prestatario *</label>
            <input type="text" value={txtUsuario} onChange={(e) => { setTxtUsuario(e.target.value); if (idUsuario) setIdUsuario(null); }} placeholder="Busca o escribe un colaborador..." className="w-full p-2 border border-slate-200 bg-white rounded-lg outline-none font-bold text-slate-800 text-xs shadow-inner" required />
            {txtUsuario.trim() && !idUsuario && usuariosSistema.filter(crearFiltro<any>(txtUsuario, ['nombre_completo', 'dni', 'areas.nombre_area'])).length > 0 && (
              <div className="absolute left-0 right-0 bg-white border rounded-lg max-h-28 overflow-y-auto z-50 mt-1 shadow-xl divide-y">
                {usuariosSistema.filter(crearFiltro<any>(txtUsuario, ['nombre_completo', 'dni', 'areas.nombre_area'])).slice(0, 4).map(u => (
                  <div key={u.id} onClick={() => seleccionarUsuarioPredicho(u)} className="p-2 hover:bg-slate-50 cursor-pointer font-bold text-slate-700 text-xs">{u.nombre_completo}</div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-slate-500 uppercase text-[10px]">Número Celular de Contacto</label>
            <input type="text" value={celular} onChange={(e) => setCelular(e.target.value)} placeholder="Ej: 987654321" className="w-full p-2 border border-slate-200 bg-white rounded-lg outline-none font-mono text-slate-800 font-bold text-xs shadow-inner" maxLength={9} />
          </div>

          <div className="relative space-y-1">
            <label className="block font-bold text-slate-500 uppercase text-[10px]">Hardware / Ítem de Almacén *</label>
            <input type="text" value={txtActivo} onChange={(e) => { setTxtActivo(e.target.value); if (idActivo) setIdActivo(null); }} placeholder="Busca por S/N, Marca o Categoría..." className="w-full p-2 border border-slate-200 bg-white rounded-lg outline-none font-bold text-slate-800 text-xs shadow-inner" required />
            {txtActivo.trim() && !idActivo && activosSistema.filter(crearFiltro<any>(txtActivo, ['serial_id', 'marca', 'modelo', 'categoria', 'caf', 'especificaciones'])).length > 0 && (
              <div className="absolute left-0 right-0 bg-white border rounded-lg max-h-28 overflow-y-auto z-50 mt-1 shadow-xl divide-y text-[11px]">
                {activosSistema.filter(crearFiltro<any>(txtActivo, ['serial_id', 'marca', 'modelo', 'categoria', 'caf', 'especificaciones'])).slice(0, 4).map(a => (
                  <div
                    key={a.activo_id || a.id}
                    onClick={() => seleccionarActivoPredicho(a)}
                    className="p-2 hover:bg-slate-50 cursor-pointer text-slate-700 font-bold"
                  >
                    {a.categoria || 'Equipo'} : {a.marca || ''} {a.modelo || ''}{a.caf ? ` — CAF: ${a.caf}` : ''} - S/N: {a.serial_id || 'N/R'}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-slate-500 uppercase text-[10px]">Fecha de Devolución Estimada (Opcional)</label>
            <input type="date" value={fechaEstimada} onChange={(e) => setFechaEstimada(e.target.value)} className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold outline-none text-slate-700 text-xs" />
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-slate-500 uppercase text-[10px]">Observaciones / Destino</label>
            <input type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Ej: Auditoría Aula Magna..." className="w-full p-2 border border-slate-200 bg-white rounded-lg outline-none font-bold text-slate-800 text-xs shadow-inner" />
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 flex items-center gap-2 mt-1 shadow-inner">
            <input type="checkbox" checked={alertaActiva} onChange={(e) => setAlertaActiva(e.target.checked)} id="boxAlerta" className="rounded text-blue-800 cursor-pointer w-4 h-4" />
            <label htmlFor="boxAlerta" className="text-slate-600 font-bold text-[10px] uppercase cursor-pointer select-none">Habilitar tracking de alertas físicas</label>
          </div>
        </PanelFormulario>
      </div>

      {/* 🔐 MODAL DE CONFIRMACIÓN DE SEGURIDAD POLIMÓRFICO */}
      <ModalBase
        isOpen={modalSeguridad.open}
        onClose={() => setModalSeguridad({ open: false, tipo: null, id: null })}
        titulo={
          modalSeguridad.tipo === 'recibir' ? "📥 Confirmar Recepción de Hardware" :
            modalSeguridad.tipo === 'revertir' ? "🔄 Confirmar Reversión de Estado" : "⚠️ Eliminar Registro de Préstamo"
        }
      >
        <div className="text-center space-y-3 font-medium text-xs">
          <p className="text-slate-500 text-[11px] leading-normal">
            {modalSeguridad.tipo === 'recibir' && "¿Estás seguro de registrar el retorno físico de este activo al almacén de Posgrado?"}
            {modalSeguridad.tipo === 'revertir' && "¿Deseas reabrir este préstamo? El estado del hardware volverá a 'Pendiente' y se limpiará la fecha de entrega real."}
            {modalSeguridad.tipo === 'eliminar' && "Esta acción borrará de forma permanente el registro de la bitácora de retén. Esta operación es irreversible."}
          </p>
          <div className="flex justify-center gap-2 pt-2 border-t">
            <button type="button" onClick={() => setModalSeguridad({ open: false, tipo: null, id: null })} className="px-3 py-1.5 bg-slate-100 rounded-lg font-bold text-slate-700">Cancelar</button>
            <button
              type="button"
              onClick={procesarAccionSegura}
              disabled={guardando}
              className={`px-3 py-1.5 text-white rounded-lg font-bold shadow-md ${modalSeguridad.tipo === 'eliminar' ? 'bg-red-600' : 'bg-blue-800'}`}
              style={modalSeguridad.tipo !== 'eliminar' ? { backgroundColor: 'var(--color-upeu)' } : {}}
            >
              {guardando ? 'Sincronizando...' : 'Confirmar Transacción'}
            </button>
          </div>
        </div>
      </ModalBase>

    </div>
  );
}