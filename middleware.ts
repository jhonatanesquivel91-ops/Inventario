import { NextResponse } from 'next/server';
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get('admin_session');
  const { pathname } = request.nextUrl;

  // 1. Si NO está logueado e intenta entrar al sistema, lo mandamos al login
  if (!session && pathname !== '/login' && !pathname.startsWith('/api/auth')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. Si YA está logueado e intenta ir al login, lo mandamos directo a activos
  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/activos', request.url));
  }

  return NextResponse.next();
}

// Indicamos qué rutas debe proteger el middleware (básicamente todo excepto archivos públicos)
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo-upeu.png).*)'],
};