'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BotonTema } from '@/components/BotonTema';
import { anunciarDestacado } from '@/lib/useDestacar';
import '@/app/globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const currentPath = usePathname();

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // En móvil el menú lateral se oculta y se despliega como panel deslizante.
  const [menuAbierto, setMenuAbierto] = useState(false);

  // 🔔 Estados para Alertas en la Campana
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  const isLoginPage = currentPath === '/login';

  // Ordenado por frecuencia de uso real: lo que se toca a diario va primero.
  const menuItems = [
    {
      category: 'OPERACIÓN DIARIA',
      items: [
        { name: '📥 Asignación y Custodia', path: '/asignaciones/alta' },
        { name: '📋 Préstamos de Equipos', path: '/prestamos' },
        { name: '🔄 Traspasos entre Áreas', path: '/asignaciones/traspaso' },
      ]
    },
    {
      category: 'INVENTARIO',
      items: [
        { name: '📦 Activos', path: '/activos' },
        { name: '🔑 Licencias', path: '/licencias' },
        { name: '👥 Colaboradores', path: '/personal' },
      ]
    },
    {
      category: 'SEGUIMIENTO',
      items: [
        { name: '🔔 Alertas Técnicas', path: '/alertas' },
        { name: '📊 Reportes', path: '/reportes' },
      ]
    },
    {
      category: 'SISTEMA',
      items: [
        { name: '⚙️ Configuración', path: '/configuracion' },
      ]
    }
  ];

  const cargarAlertasGlobales = async () => {
    try {
      const listaAlertas: any[] = [];
      const ahora = new Date();
      ahora.setHours(0, 0, 0, 0);

      // 1. 🛡️ CONSULTA CORREGIDA: Quitamos "marca" y "modelo" que hacían romper la base de datos
      // Solo se traen las filas que pueden generar una alerta, y solo sus
      // columnas. Antes se descargaba el inventario entero cada 30 segundos
      // en todas las pantallas: crecía con el catálogo y consumía cuota de
      // forma continua sin aportar nada.
      const hoyISO = new Date().toISOString().slice(0, 10);

      const limiteAlquiler = new Date();
      limiteAlquiler.setDate(limiteAlquiler.getDate() + 10);
      const limiteAlquilerISO = limiteAlquiler.toISOString().slice(0, 10);

      const [resPrestamos, resActivos, resLicencias] = await Promise.all([
        // El estado NO se filtra en el servidor: el código original hacía
        // `.trim()` sobre `estado_prestamo`, señal de que hay valores con
        // espacios que una comparación exacta descartaría en silencio. Se
        // filtra por fecha, que sí es fiable, y el estado se evalúa abajo.
        supabase
          .from('prestamos')
          .select('id, activo_id, nombre_activo, nombre_prestatario, estado_prestamo, fecha_devolucion_estimada, alerta_activa')
          .not('fecha_devolucion_estimada', 'is', null)
          .lte('fecha_devolucion_estimada', hoyISO),
        supabase
          .from('activos')
          .select('id, caf, tipo_propiedad, fecha_fin_alquiler, serial_id')
          .eq('tipo_propiedad', 'Alquiler')
          .not('fecha_fin_alquiler', 'is', null)
          .lte('fecha_fin_alquiler', limiteAlquilerISO),
        // La tabla puede no existir todavía si no se corrió la migración: se
        // ignora el error para no romper el resto de las alertas.
        supabase
          .from('vista_licencias_completa')
          .select('id, nombre_servicio, proveedor, fecha_renovacion, dias_para_renovar, renovacion_automatica, costo, moneda')
          .eq('estado', 'Activa')
      ]);

      if (resPrestamos.error) console.error("⚠️ Error en préstamos:", resPrestamos.error.message);
      if (resActivos.error) console.error("⚠️ Error en activos:", resActivos.error.message);

      const prestamos = resPrestamos.data || [];
      const activos = resActivos.data || [];
      const licencias = resLicencias.data || [];

      // `activos` ahora solo trae alquileres, así que el CAF de los equipos
      // prestados se pide aparte, y únicamente para los que tienen alerta.
      const idsPrestados = [...new Set(
        prestamos.map(p => p.activo_id).filter(Boolean).map(Number)
      )];

      const cafPorActivo = new Map<number, string>();
      if (idsPrestados.length > 0) {
        const { data: activosPrestados } = await supabase
          .from('activos')
          .select('id, caf')
          .in('id', idsPrestados);

        (activosPrestados || []).forEach(a => {
          if (a.caf) cafPorActivo.set(Number(a.id), a.caf);
        });
      }

      // ==========================================
      // LÓGICA A: PROCESAR PRÉSTAMOS VENCIDOS
      // ==========================================
      prestamos.forEach(p => {
        const estado = String(p.estado_prestamo || '').trim();
        const tieneFechaEstimada = !!p.fecha_devolucion_estimada;
        
        if (estado === 'Pendiente' && tieneFechaEstimada) {
          const fechaLimite = new Date(p.fecha_devolucion_estimada);
          fechaLimite.setHours(0, 0, 0, 0);

          if (fechaLimite < ahora && p.alerta_activa !== false) {
            const fechaFormateada = new Date(p.fecha_devolucion_estimada).toLocaleDateString('es-PE', {
              day: '2-digit', month: '2-digit', year: 'numeric'
            });

            const cafDelActivo = cafPorActivo.get(Number(p.activo_id));
            const identificadorCaf = cafDelActivo ? `[CAF: ${cafDelActivo}] ` : '';
            const textoActivoFinal = `${identificadorCaf}${p.nombre_activo || 'Hardware de Retén'}`;

            listaAlertas.push({
              id: `prestamo-${p.id}`,
              tipo: 'vencido',
              ruta: `/prestamos?destacar=${p.id}`,
              icono: '⏳',
              titulo: '⏰ Devolución Vencida',
              detalle: `Responsable: ${p.nombre_prestatario || 'No asignado'}`,
              activo: textoActivoFinal,
              infoFecha: `Debió devolverse el: ${fechaFormateada}`,
              esCritico: true
            });
          }
        }
      });

      // ==========================================
      // LÓGICA B: PROCESAR CONTRATOS DE ALQUILER (RENTING)
      // ==========================================
      activos.forEach(a => {
        if (String(a.tipo_propiedad).trim() === 'Alquiler' && a.fecha_fin_alquiler) {
          
          // Parseamos la fecha evitando desfases de zonas horarias UTC
          const partesFecha = a.fecha_fin_alquiler.split('-'); 
          const fechaFin = new Date(Number(partesFecha[0]), Number(partesFecha[1]) - 1, Number(partesFecha[2]));
          fechaFin.setHours(0, 0, 0, 0);

          const difTiempo = fechaFin.getTime() - ahora.getTime();
          const diasRestantes = Math.ceil(difTiempo / (1000 * 60 * 60 * 24));

          const fechaFormateada = fechaFin.toLocaleDateString('es-PE', {
            day: '2-digit', month: '2-digit', year: 'numeric'
          });

          const identificadorCaf = a.caf ? `[CAF: ${a.caf}] ` : '';
          // 🛡️ Usamos el S/N (Service Tag) como identificador institucional seguro
          const textoActivoFinal = `${identificadorCaf}Equipo en Alquiler (S/N: ${a.serial_id || '—'})`;

          // Condición 1: Ya vencido
          if (diasRestantes < 0) {
            listaAlertas.push({
              id: `alquiler-vencido-${a.id}`,
              tipo: 'alquiler_vencido',
              ruta: `/reportes?destacar=${a.id}`,
              icono: '🚨',
              titulo: '❌ Contrato Renting Vencido',
              detalle: `El contrato de arrendamiento caducó hace ${Math.abs(diasRestantes)} días.`,
              activo: textoActivoFinal,
              infoFecha: `Venció el: ${fechaFormateada}`,
              esCritico: true
            });
          }
          // Condición 2: Próximo a vencer (10 días o menos)
          else if (diasRestantes <= 10) {
            listaAlertas.push({
              id: `alquiler-alerta-${a.id}`,
              tipo: 'alquiler_alerta',
              ruta: `/reportes?destacar=${a.id}`,
              icono: '📦',
              titulo: '⚠️ Alquiler por Vencer',
              detalle: `Contrato próximo a expirar en ${diasRestantes} días.`,
              activo: textoActivoFinal,
              infoFecha: `Fecha límite: ${fechaFormateada}`,
              esCritico: false
            });
          }
        }
      });

      // ==========================================
      // LÓGICA C: RENOVACIONES DE LICENCIAS DE SOFTWARE
      // ==========================================
      licencias.forEach(l => {
        const dias = l.dias_para_renovar;
        if (dias === null || dias === undefined) return;
        if (dias > 30) return;

        const fechaFormateada = new Date(`${l.fecha_renovacion}T00:00:00`).toLocaleDateString('es-PE', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });

        const importe = l.costo ? ` · ${l.moneda === 'PEN' ? 'S/' : '$'}${Number(l.costo).toFixed(2)}` : '';
        const vencida = dias < 0;

        listaAlertas.push({
          id: `licencia-${l.id}`,
          tipo: vencida ? 'licencia_vencida' : 'licencia_alerta',
          ruta: `/licencias?destacar=${l.id}`,
          icono: vencida ? '🚨' : '🔑',
          titulo: vencida ? '❌ Licencia Vencida' : '⚠️ Licencia por Renovar',
          detalle: l.renovacion_automatica
            ? `Se renueva sola${importe}. Cancela antes si ya no se usa.`
            : `Requiere renovación manual${importe}.`,
          activo: `${l.nombre_servicio}${l.proveedor ? ` (${l.proveedor})` : ''}`,
          infoFecha: vencida
            ? `Venció el: ${fechaFormateada}`
            : `Renueva el: ${fechaFormateada} (${dias} días)`,
          esCritico: vencida
        });
      });

      setNotificaciones(listaAlertas);
    } catch (err) {
      console.error("Error al procesar las alertas globales TI:", err);
    }
  };
  useEffect(() => {
    if (!isLoginPage) {
      cargarAlertasGlobales();
      // Cinco minutos: son vencimientos por día, no datos en tiempo real.
      const interval = setInterval(cargarAlertasGlobales, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [isLoginPage]);

  // Al cambiar de sección, cerrar el panel lateral móvil.
  useEffect(() => {
    setMenuAbierto(false);
  }, [currentPath]);

  // Bloquear el scroll del fondo mientras el panel móvil está abierto.
  useEffect(() => {
    document.body.style.overflow = menuAbierto ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuAbierto]);

  // Cerrar menú al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const ejecutarCerrarSesion = async () => {
    setShowLogoutModal(false);
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('tema');if(t!=='claro'&&t!=='oscuro'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'oscuro':'claro';}if(t==='oscuro'){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="bg-slate-50 text-slate-800 antialiased font-sans" suppressHydrationWarning>

        {isLoginPage ? (
          <div className="w-full h-screen">{children}</div>
        ) : (
          <div className="flex h-screen overflow-hidden w-full">

            {/* Fondo oscuro: solo en móvil, cierra el menú al tocarlo */}
            {menuAbierto && (
              <div
                onClick={() => setMenuAbierto(false)}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 md:hidden"
                aria-hidden="true"
              />
            )}

            {/* NAVBAR LATERAL: panel deslizante en móvil, columna fija desde md */}
            <aside
              className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] z-40 flex flex-col justify-between text-white shadow-2xl
                transition-transform duration-300 ease-out
                md:static md:w-64 md:max-w-none md:flex-shrink-0 md:shadow-xl md:z-20 md:translate-x-0
                ${menuAbierto ? 'translate-x-0' : '-translate-x-full'}`}
              style={{ backgroundColor: 'var(--color-upeu)' }}
            >
              <div>
                <div className="p-5 border-b border-blue-800 flex flex-col items-center gap-2 relative">
                  <button
                    type="button"
                    onClick={() => setMenuAbierto(false)}
                    className="md:hidden absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-lg text-white hover:bg-white/15 active:scale-95 transition-all"
                    aria-label="Cerrar menú"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo-upeu.png" alt="Logo UPeU" className="h-12 w-auto object-contain" />
                  <div className="text-center">
                    <p className="text-[10px] text-blue-100 font-bold tracking-tight">Soporte Técnico TI</p>
                  </div>
                </div>

                <nav className="p-3 space-y-4 overflow-y-auto max-h-[72vh]">
                  {menuItems.map((group, gIdx) => (
                    <div key={gIdx} className="space-y-1">
                      <span className="text-[10px] font-black text-blue-200/90 tracking-widest block px-3 mb-1.5 uppercase">{group.category}</span>
                      {group.items.map((item, idx) => {
                        const isActive = currentPath === item.path;
                        return (
                          <Link
                            key={idx}
                            href={item.path}
                            className={`flex items-center px-3 py-2.5 rounded-lg text-[13px] md:text-[12px] font-semibold transition-all duration-150 border-l-2 ${isActive
                              ? 'bg-white/15 shadow-inner border-white pl-4 text-white font-black'
                              : 'border-transparent text-white/85 hover:bg-white/10 hover:pl-4 hover:text-white'
                              }`}
                          >
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </nav>
              </div>

              <div className="p-4 border-t border-blue-800 bg-blue-900/40 flex flex-col gap-1.5">
                <div className="text-center">
                  <p className="text-[11px] text-blue-50 font-bold">Jonathan (Admin)</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(true)}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-bold transition-all shadow-md active:scale-95"
                >
                  🚪 Cerrar Sesión
                </button>
              </div>
            </aside>

            {/* CONTENEDOR DERECHO VARIABLE BLANCO */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
              <header
                className="h-14 flex items-center justify-between px-3 md:px-6 shadow-md z-10 flex-shrink-0 text-white"
                style={{ backgroundColor: 'var(--color-upeu)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* Abre el menú lateral en móvil */}
                  <button
                    type="button"
                    onClick={() => setMenuAbierto(true)}
                    className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg text-white hover:bg-white/15 active:scale-95 transition-all flex-shrink-0"
                    aria-label="Abrir menú"
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M3 6h18M3 12h18M3 18h18" />
                    </svg>
                  </button>

                  <span className="md:hidden font-bold text-sm tracking-tight truncate">Inventario TI</span>

                  <span className="hidden md:inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
                  <p className="hidden md:block text-[11px] text-blue-50/90 font-bold uppercase tracking-wider truncate">
                    Módulo Administrativo Autenticado
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                <BotonTema />

                {/* 🔔 TOPBAR INTERACTIVO CON CAMPANA DINÁMICA */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setShowNotifMenu(!showNotifMenu)}
                    className="relative p-2 rounded-full hover:bg-white/15 transition-all text-sm active:scale-90"
                    title="Ver incidencias"
                  >
                    🔔
                    {notificaciones.length > 0 && (
                      <span className="absolute top-0 right-0 w-4 h-4 bg-red-600 text-[9px] text-white font-black rounded-full flex items-center justify-center border border-white animate-bounce">
                        {notificaciones.length}
                      </span>
                    )}
                  </button>

                  {/* MENÚ FLOTANTE DE NOTIFICACIONES */}
                  {showNotifMenu && (
                    <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-sm sm:w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden max-h-[70vh] sm:max-h-[400px] flex flex-col">
                      <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">Alertas TI en Tiempo Real</span>
                        <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-black">{notificaciones.length}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                        {notificaciones.length > 0 ? (
                          notificaciones.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => {
                                router.push(n.ruta);
                                setShowNotifMenu(false);
                                // La pantalla destino puede ser la actual: en ese caso
                                // no se remonta y hay que avisarle explícitamente.
                                requestAnimationFrame(anunciarDestacado);
                              }}
                              className={`p-3 cursor-pointer transition-all text-[11px] text-left border-b border-slate-100 last:border-0 ${
                                n.esCritico ? 'hover:bg-red-50/70' : 'hover:bg-amber-50/70'
                              }`}
                            >
                              <div className="flex gap-2 items-start">
                                <span className="text-sm flex-shrink-0">{n.icono}</span>
                                <div className="space-y-1 flex-1">
                                  <p className={`font-make-bold font-bold ${n.esCritico ? 'text-red-700' : 'text-amber-700'}`}>{n.titulo}</p>
                                  <p className="text-slate-700 font-medium leading-tight">
                                    <strong>Activo:</strong> {n.activo} <br />
                                    <span className="text-slate-500 font-normal">{n.detalle}</span>
                                  </p>
                                  <p className={`text-[10px] font-bold ${n.esCritico ? 'text-red-500' : 'text-amber-600'}`}>
                                    🗓️ {n.infoFecha}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-6 text-center text-slate-400 font-medium text-[11px]">
                            ✅ Sin incidencias ni contratos vencidos.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </header>

              <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 p-3 sm:p-4">
                {children}
              </main>
            </div>

          </div>
        )}

        {/* MODAL DE LOGOUT INTACTO */}
        {showLogoutModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden p-5 space-y-4">
              <div className="flex items-center gap-3 text-red-600">
                <div className="bg-red-50 p-2.5 rounded-xl text-base">⚠️</div>
                <div className="text-left">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">¿Cerrar sesión del sistema?</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Tendrás que volver a ingresar tus credenciales para acceder.</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t">
                <button type="button" onClick={() => setShowLogoutModal(false)} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">Cancelar</button>
                <button type="button" onClick={ejecutarCerrarSesion} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg shadow-md">Sí, Salir</button>
              </div>
            </div>
          </div>
        )}

      </body>
    </html>
  );
}