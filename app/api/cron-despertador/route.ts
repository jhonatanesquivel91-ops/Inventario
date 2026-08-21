import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Mantiene despierto el proyecto de Supabase (el plan gratuito lo pausa tras
 * varios días sin actividad).
 *
 * Llama a la función `latido()`, que solo devuelve la hora del servidor: genera
 * tráfico real contra Postgres sin leer ninguna tabla. Por eso basta la anon key
 * pública y el proyecto no necesita manejar una llave maestra.
 *
 * El acceso a la ruta se protege con CRON_SECRET, que Vercel envía en la
 * cabecera Authorization al disparar el cron.
 */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  const cabecera = request.headers.get('authorization');

  if (!secreto || cabecera !== `Bearer ${secreto}`) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const { error } = await supabase.rpc('latido');
    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Base de datos de la Universidad despertada con éxito.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
