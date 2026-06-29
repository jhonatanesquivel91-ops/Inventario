import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const aiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request) {
  try {
    if (!aiKey) return NextResponse.json({ texto: "❌ Configura tu API Key." }, { status: 500 });

    const { messages } = await request.json();
    const genAI = new GoogleGenerativeAI(aiKey);

    // CONFIGURACIÓN CON EL MODELO 1.5-FLASH (Cuota independiente y estable)
    // CAMBIO DE MODELO: Usamos el alias dinámico oficial 'gemini-1.5-flash-latest'
    // CAMBIO DEFINITIVO: Usamos la versión nativa del ecosistema actual de Google
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash', // ← Este es el modelo correcto y vigente
      systemInstruction: `Eres el Asistente Experto de Soporte Técnico TI - Posgrado UPeU. 
      Tienes la capacidad de consultar el inventario real en cualquier momento usando la herramienta 'consultarInventarioReal'. 
      Si el usuario te pregunta por stock, disponibilidad o quiere un análisis, usa SIEMPRE la herramienta primero para tener los datos reales del segundo exacto.
      Responde siempre de forma ejecutiva, ordenando todo con viñetas y negritas.`,
      tools: [{ 
        functionDeclarations: [{
          name: "consultarInventarioReal",
          description: "Consulta la base de datos de Supabase en tiempo real para obtener el listado de activos, laptops, proyectores, estados y stock de Posgrado UPeU.",
          parameters: {
            type: "OBJECT", 
            properties: {
              filtroEstado: { 
                type: "STRING", 
                description: "Opcional. Filtrar por estado: 'Disponible', 'Asignado', 'En Soporte', 'Baja'." 
              }
            },
          },
        }]
      }] as any
    });

    const chatHistory = messages.slice(0, -1).map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));
    const ultimoMensaje = messages[messages.length - 1].content;

    const chat = model.startChat({ history: chatHistory });
    let result = await chat.sendMessage(ultimoMensaje);
    let response = await result.response;

    const part = response.candidates?.[0]?.content?.parts?.[0] as any;
    const functionCall = part?.functionCall;

    if (functionCall && functionCall.name === "consultarInventarioReal") {
      let query = supabase.from('vista_activos_completa').select('*');
      const args = functionCall.args as any;
      if (args?.filtroEstado) {
        query = query.eq('estado', args.filtroEstado);
      }
      
      const { data: datosReales } = await query;

      result = await chat.sendMessage([
        {
          functionResponse: {
            name: "consultarInventarioReal",
            response: { data: datosReales || [] }
          }
        }
      ] as any);
      response = await result.response;
    }

    return NextResponse.json({ texto: response.text() });

  } catch (error: any) {
    console.error("🚨 ERROR EN CHAT EN TIEMPO REAL:", error);
    
    // DETECTOR DE AGOTAMIENTO DE CRÉDITOS / CUOTA (ERROR 429)
    if (error.message && (error.message.includes('429') || error.message.includes('quota') || error.message.includes('Quota exceeded'))) {
      return NextResponse.json({ 
        texto: "⚠️ **Jonathan, se han agotado los créditos diarios gratuitos de Google para este modelo.**\n\nEl límite de consultas de la capa gratuita se ha completado por hoy. Para solucionar esto de forma permanente y seguir chateando sin límites con el inventario, considera activar el plan **Pay-as-you-go** en tu consola de Google AI Studio." 
      });
    }

    return NextResponse.json({ texto: `❌ Error en el servidor de IA: ${error.message}` }, { status: 500 });
  }
}