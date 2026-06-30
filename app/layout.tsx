'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import '@/app/globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const currentPath = usePathname();

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // 🔔 Estados para Alertas en la Campana
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  const isLoginPage = currentPath === '/login';

  // Menú sin la página estática de alertas
  const menuItems = [
    {
      category: 'INVENTARIO',
      items: [
        { name: '📦 Stock de Activos', path: '/activos' },
      ]
    },
    {
      category: 'OPERACIONES CUSTODIA',
      items: [
        { name: '📥 Asignación Express', path: '/asignaciones/alta' },
        { name: '🔄 Transferencias Espejo', path: '/asignaciones/traspaso' },
        { name: '📋 Préstamos Equipos', path: '/prestamos' },
      ]
    },
    {
      category: 'CONTROL',
      items: [
        { name: '👥 Gestión de Personal', path: '/personal' },
        { name: '📊 Reportes de Oficina', path: '/reportes' },
        { name: '📋 Historial / Logs', path: '/logs' },
        { name: '🤖 Asistente IA', path: '/asistente-ia' },
        { name: '⚙️ Configuración Sistema', path: '/configuracion' },
      ]
    }
  ];

  // 📡 Cargar Alertas Críticas y Préstamos Vencidos
  const cargarAlertasGlobales = async () => {
    try {
      const listaAlertas: any[] = [];
      const hoy = new Date().toISOString();

      // 1. Buscar Activos en Falla (Sintaxis CORREGIDA para el .or)
      const { data: activosCriticos, error: errCriticos } = await supabase
        .from('vista_activos_completa')
        .select('*')
        .or('nombre_estado.ilike.%falla%,nombre_estado.ilike.%mantenimiento%');

      if (errCriticos) console.error("⚠️ Error en consulta de activos críticos:", errCriticos.message);

      activosCriticos?.forEach(a => {
        listaAlertas.push({
          id: `activo-${a.activo_id}`,
          tipo: 'critico',
          icono: '⚠️',
          titulo: `Estado Crítico: ${a.nombre_estado}`,
          detalle: `${a.categoria} (${a.serial_id}) — Asignado a: ${a.nombre_completo || 'Almacén'}`
        });
      });

      // 2. Buscar Préstamos Vencidos (Mapeo Inteligente Dinámico)
      const { data: todosPrestamos, error: errPrestamos } = await supabase
        .from('prestamos')
        .select('*');

      if (errPrestamos) console.error("⚠️ Error en consulta de préstamos:", errPrestamos.message);

      const ahora = new Date();

      todosPrestamos?.forEach(p => {
        // 🔍 Busca la columna que contenga la fecha límite de devolución
        const claveFecha = Object.keys(p).find(key =>
          key.toLowerCase().includes('fecha') &&
          !key.toLowerCase().includes('real') &&
          !key.toLowerCase().includes('entrega') &&
          !key.toLowerCase().includes('registro')
        ) || 'fecha_devolucion';

        // 🔍 Busca la columna que tenga el nombre del usuario, personal o alumno
        const claveUsuario = Object.keys(p).find(key =>
          key.toLowerCase().includes('usuario') ||
          key.toLowerCase().includes('nombre') ||
          key.toLowerCase().includes('personal') ||
          key.toLowerCase().includes('alumno') ||
          key.toLowerCase().includes('custodio')
        ) || 'usuario_nombre';

        // 🔍 Busca la columna que tenga el número de serie o ID del activo
        const claveSerial = Object.keys(p).find(key =>
          key.toLowerCase().includes('serial') ||
          key.toLowerCase().includes('serie') ||
          key.toLowerCase().includes('activo_id') ||
          key.toLowerCase().includes('codigo')
        ) || 'serial_id';

        const fechaLimiteRaw = p[claveFecha];

        // Condición para saber si ya fue devuelto (evita falsas alertas)
        const yaDevuelto = p.fecha_entrega || p.fecha_devolucion_real || p.devuelto || p.estado === 'Devuelto' || p.estado_prestamo === 'Devuelto';

        if (fechaLimiteRaw && !yaDevuelto) {
          const fechaLimite = new Date(fechaLimiteRaw);

          if (fechaLimite < ahora) {
            // Extraemos los valores reales dinámicamente
            const personaResponsable = p[claveUsuario] || 'Personal no identificado';
            const identificadorSerie = p[claveSerial] || 'S/N no registrado';

            listaAlertas.push({
              id: `prestamo-${p.id || Math.random()}`,
              tipo: 'vencido',
              icono: '⏳',
              titulo: '⏰ Devolución Vencida',
              detalle: `Activo S/N: ${identificadorSerie} — Retenido por: ${personaResponsable}`
            });
          }
        }
      });

      setNotificaciones(listaAlertas);
    } catch (err: any) {
      console.error("Error al compilar alertas del topbar:", err);
    }
  };

  useEffect(() => {
    if (!isLoginPage) {
      cargarAlertasGlobales();
      // Refrescar alertas silenciosamente cada 30 segundos
      const interval = setInterval(cargarAlertasGlobales, 30000);
      return () => clearInterval(interval);
    }
  }, [isLoginPage]);

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
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) {
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-slate-50 text-slate-800 antialiased font-sans" suppressHydrationWarning>

        {isLoginPage ? (
          <div className="w-full h-screen">{children}</div>
        ) : (
          <div className="flex h-screen overflow-hidden w-full">

            {/* NAVBAR LATERAL ORIGINAL */}
            <aside
              className="w-64 flex-shrink-0 text-white flex flex-col justify-between shadow-xl z-20"
              style={{ backgroundColor: 'rgb(1, 71, 118)' }}
            >
              <div>
                <div className="p-5 border-b border-blue-800 flex flex-col items-center gap-2">
                  <img src="/logo-upeu.png" alt="Logo UPeU" className="h-12 w-auto object-contain" />
                  <div className="text-center">
                    <p className="text-[9px] text-blue-200 font-bold tracking-tight">Soporte Técnico TI</p>
                  </div>
                </div>

                <nav className="p-3 space-y-4 overflow-y-auto max-h-[72vh]">
                  {menuItems.map((group, gIdx) => (
                    <div key={gIdx} className="space-y-1">
                      <span className="text-[9px] font-black text-blue-300 tracking-widest block px-3 mb-1 uppercase">{group.category}</span>
                      {group.items.map((item, idx) => {
                        const isActive = currentPath === item.path;
                        return (
                          <Link
                            key={idx}
                            href={item.path}
                            className={`flex items-center px-3 py-2 rounded-lg text-[11px] font-bold transition-all duration-150 border-l-2 ${isActive
                              ? 'bg-blue-900/60 shadow-inner border-white pl-4 text-white font-black'
                              : 'border-transparent text-blue-100 hover:bg-blue-800/50 hover:pl-4 hover:text-white'
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
                  <p className="text-[10px] text-blue-200 font-bold">Jonathan (Admin)</p>
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
              <header className="h-12 bg-white border-b flex items-center justify-between px-6 shadow-sm z-10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Módulo Administrativo Autenticado</p>
                </div>

                {/* 🔔 TOPBAR INTERACTIVO CON CAMPANA DINÁMICA */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setShowNotifMenu(!showNotifMenu)}
                    className="relative p-2 rounded-full hover:bg-slate-100 transition-all text-sm active:scale-90"
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
                    <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden max-h-[400px] flex flex-col">
                      <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">Alertas TI en Tiempo Real</span>
                        <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-black">{notificaciones.length}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                        {notificaciones.length > 0 ? (
                          notificaciones.map((n) => (
                            <div key={n.id} className="p-3 hover:bg-slate-50/60 transition-all text-[11px] text-left">
                              <div className="flex gap-2 items-start">
                                <span className="text-sm flex-shrink-0">{n.icono}</span>
                                <div className="space-y-0.5">
                                  <p className="font-bold text-slate-800">{n.titulo}</p>
                                  <p className="text-slate-500 leading-normal">{n.detalle}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-6 text-center text-slate-400 font-medium text-[11px]">
                            ✅ Sin novedades críticas pendientes.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </header>

              <main className="flex-1 overflow-y-auto bg-slate-50 p-4">
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