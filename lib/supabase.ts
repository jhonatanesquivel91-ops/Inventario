'use client';

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan las variables de entorno de Supabase en .env.local');
}

// Cliente de navegador. Guarda la sesión en cookies (no en localStorage) para que
// el proxy del servidor pueda leerla y proteger las rutas antes de renderizar.
// Sin sesión activa, las políticas RLS rechazan cualquier consulta.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
