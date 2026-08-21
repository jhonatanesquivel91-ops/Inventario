'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BitacoraNotas } from '@/components/BitacoraNotas';

/** Fecha corta y segura: las fechas `date` de Postgres no traen zona horaria. */
function fecha(valor: string | null | undefined) {
  if (!valor) return '—';
  const iso = valor.length === 10 ? `${valor}T00:00:00` : valor;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function Dato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] font-black uppercase tracking-wider text-slate-400">{rotulo}</dt>
      <dd className="text-[12px] font-bold text-slate-800 mt-0.5 break-words">{children || '—'}</dd>
    </div>
  );
}

function Panel({
  titulo, contador, children,
}: { titulo: string; contador?: number; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200 flex items-center gap-2">
        <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">{titulo}</h2>
        {contador !== undefined && (
          <span className="bg-slate-200/80 text-slate-700 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
            {contador}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function FichaActivo() {
  const params = useParams();
  const id = Number(params?.id);

  const [activo, setActivo] = useState<any | null>(null);
  const [custodias, setCustodias] = useState<any[]>([]);
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [notas, setNotas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Bitácora
  const [tipoObs, setTipoObs] = useState('General');
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargarNotas = async () => {
    const { data } = await supabase
      .from('observaciones_activos')
      .select('*')
      .eq('activo_id', id)
      .order('fecha_registro', { ascending: false });
    setNotas(data || []);
  };

  const cargar = async () => {
    try {
      setLoading(true);
      setError('');

      // Toda la información del equipo vive repartida en cuatro tablas; la
      // ficha existe para reunirla sin obligar a saltar entre pantallas.
      const [resActivo, resCustodia, resPrestamos, resNotas] = await Promise.all([
        supabase.from('vista_activos_completa').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('asignaciones')
          .select('*, usuarios(nombre_completo, dni, areas(nombre_area), cargos(nombre_cargo))')
          .eq('activo_id', id)
          .order('id', { ascending: false }),
        supabase
          .from('prestamos')
          .select('*')
          .eq('activo_id', id)
          .order('id', { ascending: false }),
        supabase
          .from('observaciones_activos')
          .select('*')
          .eq('activo_id', id)
          .order('fecha_registro', { ascending: false }),
      ]);

      if (resActivo.error) throw resActivo.error;

      // La vista define `a.id AS activo_id` y también `a.id`, así que ambos
      // nombres existen siempre y basta con consultar por `id`.
      const datosActivo = resActivo.data;

      if (!datosActivo) {
        setError('Este activo no existe o fue eliminado.');
        return;
      }

      setActivo(datosActivo);
      setCustodias(resCustodia.data || []);
      setPrestamos(resPrestamos.data || []);
      setNotas(resNotas.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (Number.isFinite(id)) cargar();
    else {
      setError('Identificador de activo inválido.');
      setLoading(false);
    }
  }, [id]);

  const guardarComentario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoComentario.trim()) return;
    try {
      setEnviando(true);
      const { error: err } = await supabase.from('observaciones_activos').insert([{
        activo_id: id,
        comentario: nuevoComentario.trim(),
        tipo_observacion: tipoObs,
        fecha_registro: new Date().toISOString(),
      }]);
      if (err) throw err;
      setNuevoComentario('');
      await cargarNotas();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20 text-xs font-bold text-slate-400 animate-pulse">
        ⏳ Reuniendo el historial del equipo...
      </div>
    );
  }

  if (error || !activo) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
        <p className="text-sm font-black text-slate-800">No se pudo abrir la ficha</p>
        <p className="text-[11px] text-slate-500 font-medium mt-1">{error}</p>
        <Link
          href="/activos"
          className="inline-block mt-4 px-3 py-1.5 text-white text-[11px] font-black uppercase rounded-lg shadow"
          style={{ backgroundColor: 'var(--color-upeu)' }}
        >
          Volver a activos
        </Link>
      </div>
    );
  }

  const custodiaActiva = custodias.find((c) => c.estado_asignacion === 'Activo');
  const prestamosAbiertos = prestamos.filter((p) => String(p.estado_prestamo || '').trim() === 'Pendiente');
  const esAlquiler = String(activo.tipo_propiedad || '').trim() === 'Alquiler';

  return (
    <div className="space-y-3 pb-6 animate-fade-in">
      {/* Cabecera */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
        <Link
          href="/activos"
          className="text-[10px] font-black uppercase tracking-wider hover:underline"
          style={{ color: 'var(--color-upeu-texto)' }}
        >
          ← Activos
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
              <span style={{ color: 'var(--color-upeu-texto)' }}>[{activo.categoria}]</span>{' '}
              {activo.marca} {activo.modelo}
            </h1>
            <p className="text-[11px] text-slate-500 font-mono font-bold mt-0.5">
              S/N: {activo.serial_id || '—'}
              {activo.caf && <> · CAF: {activo.caf}</>}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activo.nombre_estado && (
              <span
                className="px-2 py-0.5 rounded text-[9px] font-black uppercase text-white"
                style={{ backgroundColor: activo.color_alerta || '#64748b' }}
              >
                {activo.nombre_estado}
              </span>
            )}
            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
              {activo.estado_actual || 'Sin estado'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Identidad */}
        <Panel titulo="Identificación">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
            <Dato rotulo="Categoría">{activo.categoria}</Dato>
            <Dato rotulo="Marca">{activo.marca}</Dato>
            <Dato rotulo="Modelo">{activo.modelo}</Dato>
            <Dato rotulo="Número de serie">
              <span className="font-mono">{activo.serial_id}</span>
            </Dato>
            <Dato rotulo="Código CAF">
              <span className="font-mono">{activo.caf}</span>
            </Dato>
            <Dato rotulo="Régimen">{esAlquiler ? '💼 Alquiler' : '💼 Compra'}</Dato>
            {esAlquiler && (
              <Dato rotulo="Fin de alquiler">{fecha(activo.fecha_fin_alquiler)}</Dato>
            )}
            <Dato rotulo="Registrado">{fecha(activo.fecha_registro)}</Dato>
            {activo.linea_telefonica && (
              <Dato rotulo="Línea telefónica">
                <a href={`tel:${activo.linea_telefonica}`} className="font-mono hover:underline" style={{ color: 'var(--color-upeu-texto)' }}>
                  {activo.linea_telefonica}
                </a>
              </Dato>
            )}
          </dl>

          {activo.especificaciones && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <Dato rotulo="Especificaciones">{activo.especificaciones}</Dato>
            </div>
          )}
        </Panel>

        {/* Custodia actual */}
        <Panel titulo="Custodia actual">
          {custodiaActiva || activo.nombre_completo ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Dato rotulo="Responsable">
                {custodiaActiva?.usuarios?.nombre_completo || activo.nombre_completo}
              </Dato>
              <Dato rotulo="DNI">
                <span className="font-mono">
                  {custodiaActiva?.usuarios?.dni || activo.dni}
                </span>
              </Dato>
              <Dato rotulo="Área">
                {custodiaActiva?.usuarios?.areas?.nombre_area || activo.nombre_area}
              </Dato>
              <Dato rotulo="Cargo">
                {custodiaActiva?.usuarios?.cargos?.nombre_cargo || activo.nombre_cargo}
              </Dato>
            </dl>
          ) : (
            <p className="text-[11px] font-bold text-slate-400">
              En Almacén Central TI, sin custodio asignado.
            </p>
          )}

          {prestamosAbiertos.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 bg-amber-50 -mx-4 -mb-4 px-4 py-3 border-t-amber-200">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                Préstamo abierto
              </p>
              {prestamosAbiertos.map((p) => (
                <p key={p.id} className="text-[11px] font-bold text-amber-800 mt-1">
                  {p.nombre_prestatario} · devolución estimada {fecha(p.fecha_devolucion_estimada)}
                </p>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Historial de custodia */}
      <Panel titulo="Historial de custodia" contador={custodias.length}>
        {custodias.length === 0 ? (
          <p className="text-[11px] font-bold text-slate-400">
            Este equipo nunca ha sido asignado.
          </p>
        ) : (
          <ol className="space-y-2">
            {custodias.map((c) => {
              const activa = c.estado_asignacion === 'Activo';
              return (
                <li
                  key={c.id}
                  className={`flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 rounded-lg border ${
                    activa
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-100 bg-slate-50/60'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="text-[12px] font-black text-slate-800">
                      {c.usuarios?.nombre_completo || 'Colaborador retirado'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium ml-2">
                      {c.usuarios?.areas?.nombre_area}
                      {c.usuarios?.cargos?.nombre_cargo ? ` · ${c.usuarios.cargos.nombre_cargo}` : ''}
                    </span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 font-mono">
                    {activa ? (
                      <span className="text-emerald-700 uppercase">En custodia</span>
                    ) : (
                      <>Devuelto {fecha(c.fecha_devolucion)}</>
                    )}
                    {c.text_asignacion && (
                      <span className="text-slate-400 font-medium ml-2">{c.text_asignacion}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>

      {/* Historial de préstamos */}
      <Panel titulo="Historial de préstamos" contador={prestamos.length}>
        {prestamos.length === 0 ? (
          <p className="text-[11px] font-bold text-slate-400">
            Este equipo nunca ha salido en préstamo.
          </p>
        ) : (
          <ol className="space-y-2">
            {prestamos.map((p) => {
              const pendiente = String(p.estado_prestamo || '').trim() === 'Pendiente';
              const vencido =
                pendiente &&
                p.fecha_devolucion_estimada &&
                new Date(p.fecha_devolucion_estimada) < new Date();
              return (
                <li
                  key={p.id}
                  className={`flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 rounded-lg border ${
                    vencido
                      ? 'border-rose-200 bg-rose-50'
                      : pendiente
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-slate-100 bg-slate-50/60'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="text-[12px] font-black text-slate-800">
                      {p.nombre_prestatario || 'Sin responsable'}
                    </span>
                    {p.observaciones && (
                      <span className="text-[10px] text-slate-500 font-medium ml-2 italic">
                        {p.observaciones}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-bold font-mono">
                    {pendiente ? (
                      <span className={vencido ? 'text-rose-700' : 'text-amber-700'}>
                        {vencido ? 'Vencido' : 'Pendiente'} · {fecha(p.fecha_devolucion_estimada)}
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        Devuelto
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>

      {/* Bitácora técnica */}
      <Panel titulo="Bitácora técnica" contador={notas.length}>
        <BitacoraNotas
          numeroSerie={activo.serial_id}
          tipoObs={tipoObs}
          setTipoObs={setTipoObs}
          nuevoComentario={nuevoComentario}
          setNuevoComentario={setNuevoComentario}
          enviandoComentario={enviando}
          onGuardarComentario={guardarComentario}
          listaComentarios={notas}
        />
      </Panel>
    </div>
  );
}
