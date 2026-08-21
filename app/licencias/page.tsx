'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { crearFiltro } from '@/lib/busqueda';
import { useDestacar } from '@/lib/useDestacar';
import { ContenedorVista } from '@/components/ContenedorVista';
import { TablaControl } from '@/components/TablaControl';
import { BuscadorControl } from '@/components/BuscadorControl';
import { FiltroSelect } from '@/components/FiltroSelect';
import { ModalBase } from '@/components/ModalBase';

const FORM_VACIO = {
  nombre_servicio: '',
  proveedor: '',
  tipo: 'Suscripción',
  plan: '',
  cantidad_asientos: 1,
  fecha_inicio: '',
  fecha_renovacion: '',
  ciclo_facturacion: 'Anual',
  costo: '',
  moneda: 'USD',
  renovacion_automatica: false,
  estado: 'Activa',
  notas: '',
};

const campo = 'w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all';
const etiqueta = 'text-[10px] font-black text-slate-500 uppercase tracking-wider';

export default function ModuloLicencias() {
  const idDestacado = useDestacar();

  const [licencias, setLicencias] = useState<any[]>([]);
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [alerta, setAlerta] = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('Todos');

  const [modalForm, setModalForm] = useState(false);
  const [idEditando, setIdEditando] = useState<number | null>(null);
  const [form, setForm] = useState<any>(FORM_VACIO);

  const [modalAsientos, setModalAsientos] = useState<any | null>(null);
  const [usuarioAAsignar, setUsuarioAAsignar] = useState('');
  const [cuentaActivacion, setCuentaActivacion] = useState('');

  const [modalEliminar, setModalEliminar] = useState<any | null>(null);

  const lanzarAlerta = (msg: string) => {
    setAlerta(msg);
    setTimeout(() => setAlerta(''), 3500);
  };

  const cargarTodo = async () => {
    try {
      setLoading(true);
      const [resLic, resAsig, resUsr] = await Promise.all([
        supabase.from('vista_licencias_completa').select('*').order('nombre_servicio'),
        supabase
          .from('licencias_asignaciones')
          .select('*, usuarios(id, nombre_completo, dni)')
          .eq('estado_asignacion', 'Activo'),
        supabase.from('usuarios').select('id, nombre_completo, dni').order('nombre_completo'),
      ]);

      if (resLic.error) throw resLic.error;
      setLicencias(resLic.data || []);
      setAsignaciones(resAsig.data || []);
      setUsuarios(resUsr.data || []);
    } catch (err: any) {
      lanzarAlerta(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTodo();
  }, []);

  const datasetFiltrado = useMemo(() => {
    const coincide = crearFiltro<any>(busqueda, [
      'nombre_servicio', 'proveedor', 'plan', 'tipo',
      'ciclo_facturacion', 'estado', 'notas', 'moneda',
    ]);
    return licencias.filter(
      (l) => (filtroEstado === 'Todos' || l.estado === filtroEstado) && coincide(l)
    );
  }, [licencias, busqueda, filtroEstado]);

  // Gasto comprometido al año, normalizando los ciclos mensuales.
  const resumen = useMemo(() => {
    const activas = licencias.filter((l) => l.estado === 'Activa');
    const anualizar = (l: any) => {
      const costo = Number(l.costo) || 0;
      if (l.ciclo_facturacion === 'Mensual') return costo * 12;
      if (l.ciclo_facturacion === 'Único') return 0;
      return costo;
    };
    return {
      activas: activas.length,
      asientos: activas.reduce((s, l) => s + (l.cantidad_asientos || 0), 0),
      libres: activas.reduce((s, l) => s + (l.asientos_libres || 0), 0),
      gastoUSD: activas.filter((l) => l.moneda === 'USD').reduce((s, l) => s + anualizar(l), 0),
      gastoPEN: activas.filter((l) => l.moneda === 'PEN').reduce((s, l) => s + anualizar(l), 0),
      porVencer: activas.filter(
        (l) => l.dias_para_renovar !== null && l.dias_para_renovar <= 30
      ).length,
    };
  }, [licencias]);

  const abrirAlta = () => {
    setIdEditando(null);
    setForm(FORM_VACIO);
    setModalForm(true);
  };

  const abrirEdicion = (l: any) => {
    setIdEditando(l.id);
    setForm({
      nombre_servicio: l.nombre_servicio || '',
      proveedor: l.proveedor || '',
      tipo: l.tipo || 'Suscripción',
      plan: l.plan || '',
      cantidad_asientos: l.cantidad_asientos ?? 1,
      fecha_inicio: l.fecha_inicio || '',
      fecha_renovacion: l.fecha_renovacion || '',
      ciclo_facturacion: l.ciclo_facturacion || 'Anual',
      costo: l.costo ?? '',
      moneda: l.moneda || 'USD',
      renovacion_automatica: !!l.renovacion_automatica,
      estado: l.estado || 'Activa',
      notas: l.notas || '',
    });
    setModalForm(true);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre_servicio.trim()) return lanzarAlerta('⚠️ El servicio necesita un nombre.');

    try {
      setGuardando(true);
      const payload = {
        ...form,
        cantidad_asientos: Number(form.cantidad_asientos) || 1,
        costo: form.costo === '' ? null : Number(form.costo),
        fecha_inicio: form.fecha_inicio || null,
        fecha_renovacion: form.fecha_renovacion || null,
      };

      const { error } = idEditando
        ? await supabase.from('licencias').update(payload).eq('id', idEditando)
        : await supabase.from('licencias').insert([payload]);
      if (error) throw error;

      setModalForm(false);
      lanzarAlerta(idEditando ? '✅ Licencia actualizada.' : '✅ Licencia registrada.');
      await cargarTodo();
    } catch (err: any) {
      lanzarAlerta(`❌ ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!modalEliminar) return;
    try {
      setGuardando(true);
      const { error } = await supabase.from('licencias').delete().eq('id', modalEliminar.id);
      if (error) throw error;
      setModalEliminar(null);
      lanzarAlerta('🗑️ Licencia eliminada.');
      await cargarTodo();
    } catch (err: any) {
      lanzarAlerta(`❌ ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const asignarAsiento = async () => {
    if (!modalAsientos || !usuarioAAsignar) return lanzarAlerta('⚠️ Elige un colaborador.');
    if (modalAsientos.asientos_libres <= 0) return lanzarAlerta('⚠️ No quedan asientos libres.');

    try {
      setGuardando(true);
      const { error } = await supabase.from('licencias_asignaciones').insert([{
        licencia_id: modalAsientos.id,
        usuario_id: Number(usuarioAAsignar),
        cuenta_activacion: cuentaActivacion.trim() || null,
      }]);
      if (error) throw error;

      setUsuarioAAsignar('');
      setCuentaActivacion('');
      lanzarAlerta('✅ Asiento asignado.');
      await cargarTodo();
      setModalAsientos((prev: any) =>
        prev ? { ...prev, asientos_libres: prev.asientos_libres - 1, asientos_usados: (prev.asientos_usados ?? 0) + 1 } : prev
      );
    } catch (err: any) {
      lanzarAlerta(
        err.code === '23505' ? '⚠️ Ese colaborador ya ocupa un asiento.' : `❌ ${err.message}`
      );
    } finally {
      setGuardando(false);
    }
  };

  const liberarAsiento = async (asignacionId: number) => {
    try {
      setGuardando(true);
      const { error } = await supabase
        .from('licencias_asignaciones')
        .update({ estado_asignacion: 'Liberado', fecha_baja: new Date().toISOString().slice(0, 10) })
        .eq('id', asignacionId);
      if (error) throw error;
      lanzarAlerta('✅ Asiento liberado.');
      await cargarTodo();
      setModalAsientos((prev: any) =>
        prev ? { ...prev, asientos_libres: prev.asientos_libres + 1, asientos_usados: Math.max(0, (prev.asientos_usados ?? 1) - 1) } : prev
      );
    } catch (err: any) {
      lanzarAlerta(`❌ ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const ocupantesDe = (licenciaId: number) =>
    asignaciones.filter((a) => a.licencia_id === licenciaId);

  return (
    <ContenedorVista
      titulo="🔑 Licencias de Software"
      subtitulo="Suscripciones, asientos ocupados y fechas de renovación."
      badgeStatus="ok"
    >
      {alerta && (
        <div className="fixed top-20 right-4 z-[100] px-4 py-2 bg-slate-900 text-white text-xs font-black rounded-xl shadow-2xl">
          {alerta}
        </div>
      )}

      {/* Resumen ejecutivo */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-3 flex-shrink-0">
        {[
          { rotulo: 'Licencias activas', valor: resumen.activas, tono: 'text-slate-900' },
          { rotulo: 'Asientos totales', valor: resumen.asientos, tono: 'text-slate-900' },
          { rotulo: 'Asientos libres', valor: resumen.libres, tono: resumen.libres > 0 ? 'text-amber-600' : 'text-emerald-600' },
          { rotulo: 'Renuevan en 30 días', valor: resumen.porVencer, tono: resumen.porVencer > 0 ? 'text-rose-600' : 'text-slate-900' },
          {
            rotulo: 'Gasto anual',
            valor: `$${resumen.gastoUSD.toFixed(0)}${resumen.gastoPEN > 0 ? ` · S/${resumen.gastoPEN.toFixed(0)}` : ''}`,
            tono: 'text-slate-900',
          },
        ].map((m, i) => (
          <div key={i} className="bg-white border border-slate-200/80 p-2.5 rounded-xl shadow-sm">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold leading-tight">{m.rotulo}</p>
            <p className={`text-base font-black mt-0.5 ${m.tono}`}>{m.valor}</p>
          </div>
        ))}
      </div>

      {/* Controles */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3 flex-shrink-0">
        <div className="flex-1">
          <BuscadorControl
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por servicio, proveedor, plan o notas..."
          />
        </div>
        <div className="flex gap-2">
          <FiltroSelect
            value={filtroEstado}
            onChange={setFiltroEstado}
            options={[
              { value: 'Todos', label: 'Todos los estados' },
              { value: 'Activa', label: 'Activas' },
              { value: 'Vencida', label: 'Vencidas' },
              { value: 'Cancelada', label: 'Canceladas' },
            ]}
          />
          <button
            type="button"
            onClick={abrirAlta}
            style={{ backgroundColor: 'var(--color-upeu)' }}
            className="px-3 py-1.5 text-white text-[11px] font-black uppercase rounded-lg shadow whitespace-nowrap active:scale-95 transition-all"
          >
            ➕ Nueva
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <TablaControl
          tituloSeccion="Contratos de Software"
          badgeCount={datasetFiltrado.length}
          data={datasetFiltrado}
          loading={loading}
          idDestacado={idDestacado}
          msgVacio="No hay licencias registradas todavía."
          columnas={[
            {
              header: 'Servicio',
              field: 'nombre_servicio',
              movil: 'titulo' as const,
              render: (l: any) => (
                <div>
                  <div className="font-black text-slate-900 text-xs">{l.nombre_servicio}</div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {[l.proveedor, l.plan].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
              ),
            },
            {
              header: 'Asientos',
              field: 'asientos_usados',
              render: (l: any) => {
                const usados = l.asientos_usados ?? 0;
                const total = l.cantidad_asientos ?? 0;
                const lleno = usados >= total;
                return (
                  <div className="font-mono text-[11px]">
                    <span className={`font-black ${lleno ? 'text-rose-600' : 'text-slate-900'}`}>
                      {usados}/{total}
                    </span>
                    {!lleno && (
                      <span className="text-[9px] text-amber-600 font-bold block">
                        {l.asientos_libres} libre{l.asientos_libres === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                );
              },
            },
            {
              header: 'Renovación',
              field: 'fecha_renovacion',
              render: (l: any) => {
                if (l.tipo === 'Perpetua') {
                  return <span className="text-[10px] font-bold text-slate-400">Perpetua</span>;
                }
                if (!l.fecha_renovacion) return <span className="text-slate-400">—</span>;

                const dias = l.dias_para_renovar;
                const urgente = dias !== null && dias <= 30;
                const vencida = dias !== null && dias < 0;
                return (
                  <div className="font-mono text-[10px] leading-tight">
                    <div className="text-slate-600 font-bold">
                      {new Date(`${l.fecha_renovacion}T00:00:00`).toLocaleDateString('es-PE')}
                    </div>
                    {urgente && (
                      <div className={`text-[9px] font-black uppercase ${vencida ? 'text-rose-600' : 'text-amber-600'}`}>
                        {vencida ? `Vencida hace ${Math.abs(dias)} d` : `Vence en ${dias} d`}
                      </div>
                    )}
                    {l.renovacion_automatica && (
                      <div className="text-[9px] text-slate-400 font-bold">Auto</div>
                    )}
                  </div>
                );
              },
            },
            {
              header: 'Costo',
              field: 'costo',
              render: (l: any) =>
                l.costo === null || l.costo === undefined ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  <div className="font-mono text-[11px] tabular-nums">
                    <span className="font-black text-slate-800">
                      {l.moneda === 'PEN' ? 'S/' : '$'}{Number(l.costo).toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-400 block">{l.ciclo_facturacion}</span>
                  </div>
                ),
            },
            {
              header: 'Estado',
              field: 'estado',
              render: (l: any) => {
                const tono =
                  l.estado === 'Activa' ? 'bg-emerald-600'
                  : l.estado === 'Vencida' ? 'bg-rose-600'
                  : 'bg-slate-400';
                return (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase text-white ${tono}`}>
                    {l.estado}
                  </span>
                );
              },
            },
            {
              header: 'Acciones',
              className: 'text-right',
              movil: 'accion' as const,
              render: (l: any) => (
                <div className="flex gap-1.5 justify-end flex-wrap">
                  <button
                    type="button"
                    onClick={() => { setModalAsientos(l); setUsuarioAAsignar(''); setCuentaActivacion(''); }}
                    className="px-2 py-0.5 border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold rounded-md text-[10px] transition-all"
                  >
                    Asientos
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirEdicion(l)}
                    className="px-2 py-0.5 border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold rounded-md text-[10px] transition-all"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalEliminar(l)}
                    className="px-2 py-0.5 text-red-600 hover:bg-red-50 border border-red-100 font-bold rounded-md text-[10px] transition-all"
                  >
                    Borrar
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* ---------- Alta y edición ---------- */}
      <ModalBase
        isOpen={modalForm}
        onClose={() => setModalForm(false)}
        titulo={idEditando ? 'Editar licencia' : 'Nueva licencia'}
        subtitulo="Contrato de software y su ciclo de renovación"
        maxWithClass="max-w-lg"
      >
        <form onSubmit={guardar} className="space-y-3">
          <div>
            <label className={etiqueta}>Servicio *</label>
            <input
              className={campo} required autoFocus
              value={form.nombre_servicio}
              onChange={(e) => setForm({ ...form, nombre_servicio: e.target.value })}
              placeholder="ChatGPT Plus, Zoom Pro, Microsoft 365..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={etiqueta}>Proveedor</label>
              <input
                className={campo} value={form.proveedor}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
                placeholder="OpenAI, Zoom, distribuidor..."
              />
            </div>
            <div>
              <label className={etiqueta}>Plan</label>
              <input
                className={campo} value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value })}
                placeholder="Business, Team, Pro..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={etiqueta}>Tipo</label>
              <select
                className={campo} value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                <option value="Suscripción">Suscripción</option>
                <option value="Perpetua">Perpetua</option>
              </select>
            </div>
            <div>
              <label className={etiqueta}>Asientos</label>
              <input
                type="number" min={1} className={campo}
                value={form.cantidad_asientos}
                onChange={(e) => setForm({ ...form, cantidad_asientos: e.target.value })}
              />
            </div>
          </div>

          {form.tipo === 'Suscripción' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={etiqueta}>Inicio</label>
                <input
                  type="date" className={campo} value={form.fecha_inicio}
                  onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                />
              </div>
              <div>
                <label className={etiqueta}>Renovación</label>
                <input
                  type="date" className={campo} value={form.fecha_renovacion}
                  onChange={(e) => setForm({ ...form, fecha_renovacion: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={etiqueta}>Costo</label>
              <input
                type="number" step="0.01" min={0} className={campo}
                value={form.costo}
                onChange={(e) => setForm({ ...form, costo: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={etiqueta}>Moneda</label>
              <select
                className={campo} value={form.moneda}
                onChange={(e) => setForm({ ...form, moneda: e.target.value })}
              >
                <option value="USD">USD</option>
                <option value="PEN">PEN</option>
              </select>
            </div>
            <div>
              <label className={etiqueta}>Ciclo</label>
              <select
                className={campo} value={form.ciclo_facturacion}
                onChange={(e) => setForm({ ...form, ciclo_facturacion: e.target.value })}
              >
                <option value="Anual">Anual</option>
                <option value="Mensual">Mensual</option>
                <option value="Único">Único</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className={etiqueta}>Estado</label>
              <select
                className={campo} value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              >
                <option value="Activa">Activa</option>
                <option value="Vencida">Vencida</option>
                <option value="Cancelada">Cancelada</option>
              </select>
            </div>
            <label className="flex items-center gap-2 pb-2 cursor-pointer">
              <input
                type="checkbox" className="w-4 h-4 accent-slate-900"
                checked={form.renovacion_automatica}
                onChange={(e) => setForm({ ...form, renovacion_automatica: e.target.checked })}
              />
              <span className="text-[11px] font-bold text-slate-600">Se renueva sola</span>
            </label>
          </div>

          <div>
            <label className={etiqueta}>Notas</label>
            <textarea
              className={campo} rows={2} value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Número de factura, contacto del proveedor..."
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button" onClick={() => setModalForm(false)}
              className="flex-1 py-2 bg-slate-100 text-slate-700 font-black rounded-lg text-[11px] uppercase tracking-wider"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={guardando}
              style={{ backgroundColor: 'var(--color-upeu)' }}
              className="flex-[2] py-2 text-white font-black rounded-lg text-[11px] uppercase tracking-wider shadow disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : idEditando ? '💾 Actualizar' : '➕ Registrar'}
            </button>
          </div>
        </form>
      </ModalBase>

      {/* ---------- Asientos ---------- */}
      <ModalBase
        isOpen={!!modalAsientos}
        onClose={() => setModalAsientos(null)}
        titulo={modalAsientos ? `Asientos de ${modalAsientos.nombre_servicio}` : ''}
        subtitulo={
          modalAsientos
            ? `${modalAsientos.asientos_usados ?? 0} de ${modalAsientos.cantidad_asientos} ocupados`
            : ''
        }
        maxWithClass="max-w-lg"
      >
        {modalAsientos && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className={etiqueta}>Quién lo usa</p>
              {ocupantesDe(modalAsientos.id).length === 0 ? (
                <p className="text-[11px] text-slate-400 font-medium py-2">
                  Nadie ocupa esta licencia todavía.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {ocupantesDe(modalAsientos.id).map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 text-[11px] truncate">
                          {a.usuarios?.nombre_completo || 'Colaborador'}
                        </div>
                        {a.cuenta_activacion && (
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            {a.cuenta_activacion}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => liberarAsiento(a.id)}
                        disabled={guardando}
                        className="px-2 py-0.5 text-red-600 hover:bg-red-50 border border-red-100 font-bold rounded-md text-[10px] whitespace-nowrap"
                      >
                        Liberar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className={etiqueta}>Asignar un asiento</p>
              {modalAsientos.asientos_libres <= 0 ? (
                <p className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  No quedan asientos libres. Libera uno o amplía el contrato.
                </p>
              ) : (
                <>
                  <select
                    className={campo}
                    value={usuarioAAsignar}
                    onChange={(e) => setUsuarioAAsignar(e.target.value)}
                  >
                    <option value="">Elige un colaborador...</option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre_completo}
                      </option>
                    ))}
                  </select>
                  <input
                    className={campo}
                    value={cuentaActivacion}
                    onChange={(e) => setCuentaActivacion(e.target.value)}
                    placeholder="Cuenta con la que se activó (opcional)"
                  />
                  <button
                    type="button"
                    onClick={asignarAsiento}
                    disabled={guardando}
                    style={{ backgroundColor: 'var(--color-upeu)' }}
                    className="w-full py-2 text-white font-black rounded-lg text-[11px] uppercase tracking-wider shadow disabled:opacity-50"
                  >
                    Asignar asiento
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </ModalBase>

      {/* ---------- Eliminar ---------- */}
      <ModalBase
        isOpen={!!modalEliminar}
        onClose={() => setModalEliminar(null)}
        titulo="Eliminar licencia"
      >
        {modalEliminar && (
          <div className="space-y-4">
            <p className="text-[11px] text-slate-600 font-medium">
              Se eliminará <strong className="text-slate-900">{modalEliminar.nombre_servicio}</strong> y
              el registro de quién la ocupaba. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                type="button" onClick={() => setModalEliminar(null)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 font-black rounded-lg text-[11px] uppercase"
              >
                Cancelar
              </button>
              <button
                type="button" onClick={eliminar} disabled={guardando}
                className="flex-1 py-2 bg-red-600 text-white font-black rounded-lg text-[11px] uppercase shadow disabled:opacity-50"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        )}
      </ModalBase>
    </ContenedorVista>
  );
}
