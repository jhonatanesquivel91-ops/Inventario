import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    // Hacemos una consulta ultra ligera a la tabla de activos para generar tráfico
    const { data, error } = await supabase
      .from('activos')
      .select('id')
      .limit(1);

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: 'Base de datos de la Universidad despertada con éxito.' 
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}