import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { crearClienteServidor, obtenerUsuario } from '@/lib/supabase-server';

const aiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

export async function POST(request: Request) {
  try {
    // Esta ruta puede modificar activos, así que exige sesión antes de nada.
    const usuario = await obtenerUsuario();
    if (!usuario) {
      return NextResponse.json({ texto: "Sesión expirada. Vuelve a iniciar sesión." }, { status: 401 });
    }

    // Cliente con la sesión del usuario: las consultas pasan por RLS.
    const supabase = await crearClienteServidor();

    if (!aiKey) return NextResponse.json({ texto: "❌ Configura tu API Key." }, { status: 500 });

    const { messages } = await request.json();
    const genAI = new GoogleGenerativeAI(aiKey);

    // CONFIGURAMOS EL MODELO CON LAS DOS HERRAMIENTAS (LEER Y ESCRIBIR)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash', 
      systemInstruction: `Eres el Asistente Experto de Soporte Técnico TI - Posgrado UPeU.
      Tienes dos herramientas disponibles para interactuar con la base de datos en tiempo real:
      1. 'consultarInventarioReal': Úsala cuando el usuario pregunte por stock, marcas, modelos o disponibilidad.
      2. 'actualizarEstadoActivo': Úsala ÚNICAMENTE cuando el usuario te ordene explícitamente cambiar, actualizar o modificar el estado de un equipo (Ej: 'pásalo a Soporte', 'ponlo como Disponible', 'da de baja el equipo X').
      
      Responde siempre de forma ejecutiva, ordenada, usando viñetas y negritas.`,
      tools: [{ 
        functionDeclarations: [
          {
            name: "consultarInventarioReal",
            description: "Consulta la base de datos de Supabase para obtener el listado de activos, laptops, proyectores y stock actual.",
            parameters: {
              type: "OBJECT", 
              properties: {
                filtroEstado: { type: "STRING", description: "Opcional. 'Disponible', 'Asignado', 'En Soporte', 'Baja'." }
              },
            },
          },
          {
            name: "actualizarEstadoActivo",
            description: "Modifica el estado físico de un activo específico en la base de datos de Supabase.",
            parameters: {
              type: "OBJECT",
              properties: {
                idActivo: { type: "STRING", description: "El ID o código del activo a modificar (Ej: 'ACT-01')." },
                nuevoEstado: { type: "STRING", description: "El nuevo estado: 'Disponible', 'Asignado', 'En Soporte', 'Baja'." }
              },
              required: ["idActivo", "nuevoEstado"]
            }
          }
        ]
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

    // INTERCEPTOR DINÁMICO DE FUNCIONES
    const part = response.candidates?.[0]?.content?.parts?.[0] as any;
    const functionCall = part?.functionCall;

    if (functionCall) {
      let respuestaHerramienta = null;

      // ACCIÓN 1: LEER BASE DE DATOS
      if (functionCall.name === "consultarInventarioReal") {
        let query = supabase.from('vista_activos_completa').select('*');
        const args = functionCall.args as any;
        if (args?.filtroEstado) query = query.eq('estado', args.filtroEstado);
        
        const { data } = await query;
        respuestaHerramienta = { data: data || [] };
      } 
      
      // ACCIÓN 2: ESCRIBIR / ACTUALIZAR BASE DE DATOS
      else if (functionCall.name === "actualizarEstadoActivo") {
        const args = functionCall.args as any;
        
        const { data, error } = await supabase
          .from('activos') // Ajusta al nombre real de tu tabla de edición si no es 'activos'
          .update({ estado: args.nuevoEstado })
          .eq('id', args.idActivo)
          .select();

        if (error) {
          respuestaHerramienta = { error: `No se pudo actualizar: ${error.message}` };
        } else {
          respuestaHerramienta = { operacion: "Exitosa", detalle: `Activo ${args.idActivo} cambiado a ${args.nuevoEstado}` };
        }
      }

      // Devolvemos el resultado de la base de datos a Gemini para que redacte su respuesta final
      if (respuestaHerramienta) {
        result = await chat.sendMessage([
          {
            functionResponse: {
              name: functionCall.name,
              response: respuestaHerramienta
            }
          }
        ] as any);
        response = await result.response;
      }
    }

    return NextResponse.json({ texto: response.text() });

  } catch (error: any) {
    console.error("🚨 ERROR EN CONSOLA TI:", error);
    
    if (error.message && (error.message.includes('429') || error.message.includes('quota') || error.message.includes('Quota exceeded'))) {
      return NextResponse.json({ 
        texto: "⚠️ **Jonathan, se han agotado los créditos diarios gratuitos de Google para este modelo.**\n\nEl límite de la capa gratuita se completó por hoy. Mañana temprano podrás continuar interactuando y modificando tu inventario en tiempo real." 
      });
    }

    return NextResponse.json({ texto: `❌ Error en el servidor de IA: ${error.message}` }, { status: 500 });
  }
}