'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import '@/app/globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const currentPath = usePathname();
  
  // Estado para controlar el Modal personalizado de Cerrar Sesión
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const isLoginPage = currentPath === '/login';

  // Tus subcategorías originales intactas y ordenadas
  const menuItems = [
    { category: 'INVENTARIO', items: [
      { name: '📦 Stock de Activos', path: '/activos' },
    ]},
    { category: 'OPERACIONES CUSTODIA', items: [
      { name: '📥 Asignación Express', path: '/asignaciones/alta' },
      { name: '🔄 Transferencias Espejo', path: '/asignaciones/traspaso' },
      { name: '📋 Préstamos Equipos', path: '/prestamos' },
    ]},
    { category: 'CONTROL', items: [
      { name: '👥 Gestión de Personal', path: '/personal' },
      { name: '📊 Reportes de Oficina', path: '/reportes' },
      { name: '⚙️ Configuración Sistema', path: '/configuracion' },
    ]}
  ];

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
            
            {/* NAVBAR LATERAL ORIGINAL CON AZUL INSTITUCIONAL */}
            <aside 
              className="w-64 flex-shrink-0 text-white flex flex-col justify-between shadow-xl z-20"
              style={{ backgroundColor: 'rgb(1, 71, 118)' }}
            >
              <div>
                <div className="p-5 border-b border-blue-800 flex flex-col items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
                            className={`flex items-center px-3 py-2 rounded-lg text-[11px] font-bold transition-all duration-150 border-l-2 ${
                              isActive 
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

              {/* Tu pie original con el botón rojo llamativo de salida */}
              <div className="p-4 border-t border-blue-800 bg-blue-900/40 flex flex-col gap-1.5">
                <div className="text-center">
                  <p className="text-[10px] text-blue-200 font-bold">Jonathan (Admin)</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(true)}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-bold transition-all shadow-md active:scale-95"
                >
                   Navarre🚪 Cerrar Sesión
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
              </header>

              <main className="flex-1 overflow-y-auto bg-slate-50 p-4">
                {children}
              </main>
            </div>

          </div>
        )}

        {/* MODAL PERSONALIZADO DE CIERRE DE SESIÓN */}
        {showLogoutModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden p-5 space-y-4 animate-fade-in">
              <div className="flex items-center gap-3 text-red-600">
                <div className="bg-red-50 p-2.5 rounded-xl text-base">⚠️</div>
                <div className="text-left">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">¿Cerrar sesión del sistema?</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Tendrás que volver a ingresar tus credenciales de Administrador para acceder.</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={ejecutarCerrarSesion}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-md transition-all"
                >
                  Sí, Salir
                </button>
              </div>
            </div>
          </div>
        )}

      </body>
    </html>
  );
}