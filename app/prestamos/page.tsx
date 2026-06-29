'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function ModuloPrestamos() {
    const [loading, setLoading] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [prestamos, setPrestamos] = useState<any[]>([]);

    // Catálogos del sistema
    const [usuariosSistema, setUsuariosSistema] = useState<any[]>([]);
    const [activosSistema, setActivosSistema] = useState<any[]>([]);

    // Formulario Inteligente Unificado
    const [idUsuario, setIdUsuario] = useState<number | null>(null);
    const [txtUsuario, setTxtUsuario] = useState('');
    const [celular, setCelular] = useState('');

    const [idActivo, setIdActivo] = useState<number | null>(null);
    const [txtActivo, setTxtActivo] = useState('');

    const [fechaEstimada, setFechaEstimada] = useState('');
    const [alertaActiva, setAlertaActiva] = useState(true); // Una sola casilla solicitada
    const [observaciones, setObservaciones] = useState('');

    const cargarModulos = async () => {
        try {
            setLoading(true);
            const [rPrest, rUsr, rAct] = await Promise.all([
                supabase.from('prestamos').select('*').order('estado_prestamo', { ascending: false }).order('id', { ascending: false }),
                supabase.from('usuarios').select('id, nombre_completo'),
                supabase.from('vista_activos_completa').select('*') // Usamos la vista maestra corregida
            ]);

            if (rPrest.data) setPrestamos(rPrest.data);
            if (rUsr.data) setUsuariosSistema(rUsr.data);
            if (rAct.data) setActivosSistema(rAct.data);
        } catch (err: any) {
            console.error(err.message);
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

        // Buscamos si este usuario tiene asignado un celular en el inventario actual
        try {
            const { data } = await supabase
                .from('vista_activos_completa')
                .select('especificaciones')
                .eq('usuario_id', usr.id)
                .ilike('categoria', '%celular%')
                .limit(1);

            if (data && data.length > 0) {
                // Extraemos el número telefónico de 9 dígitos de las especificaciones
                const matchNum = String(data[0].especificaciones || '').match(/\d{9,11}/);
                if (matchNum) setCelular(matchNum[0]);
            } else {
                setCelular('');
            }
        } catch {
            setCelular('');
        }
    };

    const seleccionarActivoPredicho = (act: any) => {
        setIdActivo(act.activo_id || act.id);
        setTxtActivo(`[${act.categoria}] ${act.marca} ${act.modelo} — S/N: ${act.serial_id}`);
    };

    const limpiarCampos = () => {
        setIdUsuario(null);
        setTxtUsuario('');
        setCelular('');
        setIdActivo(null);
        setTxtActivo('');
        setFechaEstimada('');
        setAlertaActiva(true);
        setObservaciones('');
    };

    // --- GUARDAR EN BD ---
    const registrarSalidaHardware = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!txtUsuario.trim() || !txtActivo.trim()) return alert('Debes rellenar los campos de prestatario y equipo.');

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

            limpiarCampos();
            cargarModulos();
        } catch (err: any) {
            alert(`❌ Error al registrar préstamo: ${err.message}`);
        } finally {
            setGuardando(false);
        }
    };

    const ejecutarRetorno = async (id: number) => {
        await supabase.from('prestamos').update({ estado_prestamo: 'Devuelto', fecha_devolucion_real: new Date().toISOString() }).eq('id', id);
        cargarModulos();
    };

    const abrirWhatsappExpress = (item: any) => {
        if (!item.celular_contacto) return alert('No hay teléfono registrado para enviar la alerta.');

        const fechaTexto = item.fecha_devolucion_estimada
            ? new Date(item.fecha_devolucion_estimada).toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })
            : 'la brevedad';

        // Mensaje directo, formal y estructurado con negritas
        const msg = `*NOTIFICACIÓN DE DEVOLUCIÓN PENDIENTE*\n\n` +
            `Estimado(a) *${item.nombre_prestatario}*,\n\n` +
            `Le saluda el área de *Soporte Técnico TI - Posgrado*.\n\n` +
            `Se le solicita la devolución del siguiente equipo que mantiene en calidad de préstamo:\n` +
            `• *Equipo:* ${item.nombre_activo}\n` +
            `• *Fecha límite de retorno:* ${fechaTexto}\n\n` +
            `Por favor, acérquese al *Almacén de TI de Posgrado* para regularizar la entrega física del bien.\n\n` +
            `Atentamente,\n` +
            `*Área de TI - Posgrado UPeU*`;

        const numeroLimpio = item.celular_contacto.replace(/\D/g, '');
        const prefijoPeru = numeroLimpio.startsWith('51') ? numeroLimpio : `51${numeroLimpio}`;

        window.open(`https://wa.me/${prefijoPeru}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    return (
        <main className="min-h-screen bg-white p-6 text-slate-800">
            <div className="border-b pb-4 mb-6">
                <h1 className="text-2xl font-bold" style={{ color: 'rgb(1, 71, 118)' }}>📋 Panel de Control y Préstamos de Retén</h1>
                <p className="text-xs text-slate-500">Universidad Peruana Unión — Gestión Dinámica Híbrida</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

                {/* TABLA DE HISTORIAL DE SALIDAS (IZQUIERDA) */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <table className="w-full text-left border-collapse text-xs text-slate-600">
                            <thead style={{ backgroundColor: 'rgb(1, 71, 118)' }} className="text-white uppercase font-semibold text-[10px]">
                                <tr>
                                    <th className="px-4 py-3">Prestatario</th>
                                    <th className="px-4 py-3">Activo Asignado</th>
                                    <th className="px-4 py-3">Fechas</th>
                                    <th className="px-4 py-3 text-center">Estado</th>
                                    <th className="px-4 py-3 text-center w-24">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {loading ? (
                                    <tr><td colSpan={5} className="text-center py-10 font-medium text-slate-400">⏳ Conectando con la bitácora de retén...</td></tr>
                                ) : prestamos.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-10 text-slate-400 border-dashed">Sin préstamos activos registrados.</td></tr>
                                ) : (
                                    prestamos.map((item) => {
                                        const esVencido = item.estado_prestamo === 'Pendiente' && item.fecha_devolucion_estimada && new Date(item.fecha_devolucion_estimada) < new Date();
                                        return (
                                            <tr key={item.id} className={`hover:bg-slate-50/60 transition-colors ${esVencido && item.alerta_activa ? 'bg-red-50/60' : ''}`}>
                                                <td className="px-4 py-3 border-r">
                                                    <div className="font-bold text-slate-900">{item.nombre_prestatario}</div>
                                                    {item.celular_contacto && <div className="text-[10px] text-slate-500 font-mono mt-0.5">📱 {item.celular_contacto}</div>}
                                                </td>
                                                <td className="px-4 py-3 border-r font-medium max-w-xs truncate">
                                                    <div>{item.nombre_activo}</div>
                                                    {item.observaciones && <div className="text-[10px] text-slate-400 italic font-normal mt-0.5">Nota: {item.observaciones}</div>}
                                                </td>
                                                <td className="px-4 py-3 border-r font-mono text-[10px]">
                                                    <div>🛫 {new Date(item.fecha_salida).toLocaleDateString('es-PE')}</div>
                                                    <div className="text-slate-400 mt-0.5">🏁 {item.fecha_devolucion_estimada ? new Date(item.fecha_devolucion_estimada).toLocaleDateString('es-PE') : 'Abierto'}</div>
                                                </td>
                                                <td className="px-4 py-3 border-r text-center font-bold">
                                                    {item.estado_prestamo === 'Devuelto' ? (
                                                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px]">Devuelto</span>
                                                    ) : esVencido ? (
                                                        <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] animate-pulse">Vencido</span>
                                                    ) : (
                                                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px]">Pendiente</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {item.estado_prestamo === 'Pendiente' && (
                                                            <button onClick={() => ejecutarRetorno(item.id)} className="bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded border font-bold text-[10px]">Recibir</button>
                                                        )}
                                                        {item.estado_prestamo === 'Pendiente' && item.celular_contacto && (
                                                            <button onClick={() => abrirWhatsappExpress(item)} className="p-1 text-base hover:scale-110 transition-transform" title="Lanzar WhatsApp">🟢</button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* REGISTRO RÁPIDO (DERECHA) */}
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm text-xs font-semibold">
                    <h3 className="font-bold text-slate-800 mb-3 uppercase border-b pb-2">➕ Registrar Préstamo</h3>
                    <form onSubmit={registrarSalidaHardware} className="space-y-3">

                        {/* INPUT INTEGRADO BUSCADOR DE COLABORADORES */}
                        <div className="relative">
                            <label className="block font-bold text-slate-600 uppercase mb-1">Prestatario (Busca o escribe uno nuevo)</label>
                            <input type="text" value={txtUsuario} onChange={(e) => { setTxtUsuario(e.target.value); if (idUsuario) setIdUsuario(null); }} placeholder="Escribe el nombre..." className="w-full p-2 border rounded bg-white text-slate-800 outline-none font-medium" required />
                            {txtUsuario.trim() && !idUsuario && usuariosSistema.filter(u => u.nombre_completo.toLowerCase().includes(txtUsuario.toLowerCase())).length > 0 && (
                                <div className="absolute left-0 right-0 bg-white border rounded-lg max-h-28 overflow-y-auto z-10 mt-1 shadow-lg divide-y">
                                    {usuariosSistema.filter(u => u.nombre_completo.toLowerCase().includes(txtUsuario.toLowerCase())).slice(0, 4).map(u => (
                                        <div key={u.id} onClick={() => seleccionarUsuarioPredicho(u)} className="p-2 hover:bg-slate-50 cursor-pointer font-medium text-slate-700">{u.nombre_completo}</div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* CELULAR EXTRAÍBLE */}
                        <div>
                            <label className="block font-bold text-slate-600 uppercase mb-1">Número Celular de Contacto</label>
                            <input type="text" value={celular} onChange={(e) => setCelular(e.target.value)} placeholder="Ej: 987654321" className="w-full p-2 border rounded bg-white font-mono outline-none text-slate-800" maxLength={9} />
                        </div>

                        {/* INPUT INTEGRADO BUSCADOR DE HARDWARE */}
                        <div className="relative">
                            <label className="block font-bold text-slate-600 uppercase mb-1">Hardware / Ítem (Busca S/N, CAF o escribe descripción)</label>
                            <input type="text" value={txtActivo} onChange={(e) => { setTxtActivo(e.target.value); if (idActivo) setIdActivo(null); }} placeholder="Escribe marca, serie o nombre..." className="w-full p-2 border rounded bg-white text-slate-800 outline-none font-medium" required />
                            {txtActivo.trim() && !idActivo && activosSistema.filter(a => String(a.serial_id || '').toLowerCase().includes(txtActivo.toLowerCase()) || String(a.marca || '').toLowerCase().includes(txtActivo.toLowerCase()) || String(a.categoria || '').toLowerCase().includes(txtActivo.toLowerCase())).length > 0 && (
                                <div className="absolute left-0 right-0 bg-white border rounded-lg max-h-28 overflow-y-auto z-10 mt-1 shadow-lg divide-y text-[11px]">
                                    {activosSistema.filter(a => String(a.serial_id || '').toLowerCase().includes(txtActivo.toLowerCase()) || String(a.marca || '').toLowerCase().includes(txtActivo.toLowerCase()) || String(a.categoria || '').toLowerCase().includes(txtActivo.toLowerCase())).slice(0, 4).map(a => (
                                        <div key={a.activo_id || a.id} onClick={() => seleccionarActivoPredicho(a)} className="p-2 hover:bg-slate-50 cursor-pointer text-slate-700 font-medium">[{a.categoria}] {a.marca} — S/N: {a.serial_id}</div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* FECHA LÍMITE */}
                        <div>
                            <label className="block font-bold text-slate-600 uppercase mb-1">Fecha de Devolución Estimada (Opcional)</label>
                            <input type="date" value={fechaEstimada} onChange={(e) => setFechaEstimada(e.target.value)} className="w-full p-2 border rounded bg-white font-medium outline-none text-slate-700" />
                        </div>

                        {/* NOTAS */}
                        <div>
                            <label className="block font-bold text-slate-600 uppercase mb-1">Observaciones / Destino</label>
                            <input type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Ej: Préstamo para Auditoría Aula Magna..." className="w-full p-2 border rounded bg-white font-medium text-slate-800 outline-none" />
                        </div>

                        {/* UNIFICACIÓN DE CASILLA REQUERIDA */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center gap-2">
                            <input type="checkbox" checked={alertaActiva} onChange={(e) => setAlertaActiva(e.target.checked)} id="boxAlerta" className="rounded text-blue-800 cursor-pointer" />
                            <label htmlFor="boxAlerta" className="text-slate-700 cursor-pointer select-none">Habilitar tracking de alertas físicas</label>
                        </div>

                        <button type="submit" disabled={guardando} style={{ backgroundColor: 'rgb(1, 71, 118)' }} className="w-full py-2.5 text-white font-bold rounded shadow disabled:opacity-50 text-xs">
                            {guardando ? 'Sincronizando...' : '💾 Registrar Préstamo'}
                        </button>
                    </form>
                </div>

            </div>
        </main>
    );
}