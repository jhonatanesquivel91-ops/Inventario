import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    // Validación directa contra las variables del archivo .env.local
    if (email === adminEmail && password === adminPassword) {
      // Creamos una respuesta exitosa
      const response = NextResponse.json({ success: true, message: "Sesión iniciada con éxito" });
      
      // Guardamos una cookie de sesión simple en el navegador para recordar que ya entraste
      response.cookies.set('admin_session', 'active', {
        httpOnly: true, // Por seguridad, impide que scripts externos lean la cookie
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 // La sesión durará activa 24 horas
      });

      return response;
    }

    return NextResponse.json({ success: false, message: "Credenciales incorrectas" }, { status: 401 });

  } catch (error) {
    return NextResponse.json({ success: false, message: "Error en el servidor" }, { status: 500 });
  }
}