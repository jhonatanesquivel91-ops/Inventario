import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Sesión cerrada" });
  
  // Borramos la cookie de sesión poniéndole tiempo de vida cero
  response.cookies.set('admin_session', '', { maxAge: 0 });
  return response;
}