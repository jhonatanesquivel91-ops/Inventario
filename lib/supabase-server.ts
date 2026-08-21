import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Cliente para Route Handlers y Server Components: hereda la sesión del usuario
 * desde las cookies, por lo que respeta las políticas RLS.
 */
export async function crearClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ocurre al llamarse desde un Server Component; el proxy ya refresca la sesión.
        }
      },
    },
  });
}

/**
 * Devuelve la sesión del usuario o null. Úsalo para cerrar toda ruta de API
 * que lea o escriba en la base de datos.
 */
export async function obtenerUsuario() {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
