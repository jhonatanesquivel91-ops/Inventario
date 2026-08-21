import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const RUTAS_PUBLICAS = ['/login'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // El cron corre sin navegador ni sesión; se autentica con su propio secreto.
  if (pathname.startsWith('/api/cron-despertador')) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() valida el token contra Supabase; getSession() solo lee la cookie
  // y por eso no sirve para autorizar.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const esRutaPublica = RUTAS_PUBLICAS.includes(pathname);

  if (!user && !esRutaPublica) {
    // Las rutas de API responden con 401 en JSON: un redirect a HTML rompería
    // el fetch del cliente cuando la sesión expira.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Sesión expirada.' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && esRutaPublica) {
    return NextResponse.redirect(new URL('/activos', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo-upeu.png|.*\.svg).*)'],
};
