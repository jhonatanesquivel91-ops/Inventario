'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Al ser correcto, redirige de inmediato al inventario
        router.push('/activos');
        router.refresh(); // Refresca el estado global de las rutas
      } else {
        setErrorMsg(`❌ ${data.message || 'Credenciales incorrectas.'}`);
      }
    } catch (err) {
      setErrorMsg('❌ Ocurrió un error al conectar con el servicio de autenticación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 px-4 fixed inset-0 z-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        
        {/* Encabezado Principal */}
        <div className="p-8 text-white text-center flex flex-col items-center gap-3" style={{ backgroundColor: 'rgb(1, 71, 118)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-upeu.png" alt="Logo UPeU" className="h-16 w-auto object-contain" />
          <div>
            <h1 className="text-base font-bold tracking-wider">SISTEMA DE INVENTARIO TI</h1>
            <p className="text-[11px] text-blue-200 font-medium">Consola Administrativa - Posgrado</p>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="p-8 space-y-5">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-[11px] font-semibold p-3 rounded-xl text-center">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Usuario Administrador</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@upeu.edu.pe"
              className="w-full px-4 py-2.5 text-xs border rounded-xl bg-slate-50 focus:bg-white outline-none text-slate-800 font-medium transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 text-xs border rounded-xl bg-slate-50 focus:bg-white outline-none text-slate-800 font-medium transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ backgroundColor: 'rgb(1, 71, 118)' }}
            className="w-full mt-2 py-3 text-white text-xs font-bold rounded-xl shadow transition-all hover:brightness-110 disabled:opacity-50"
          >
            {loading ? 'Validando Administrador...' : 'Ingresar al Sistema'}
          </button>
        </form>

      </div>
    </div>
  );
}