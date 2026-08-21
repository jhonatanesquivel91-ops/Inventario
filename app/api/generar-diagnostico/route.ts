import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { obtenerUsuario } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const usuario = await obtenerUsuario();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesión expirada.' }, { status: 401 });
    }

    const { activo, notas, contextoAdicional } = await req.json();

    // Mapeamos las notas con su tipo y fecha para el análisis de la IA
    const historialNotas = notas && notas.length > 0
      ? notas.map((n: any) => `- [Bitácora / Tipo: ${n.tipo_observacion || 'General'}] "${n.comentario}" (Registrado el: ${new Date(n.fecha_registro).toLocaleDateString('es-PE')})`).join('\n')
      : 'No registra observaciones previas en la bitácora.';

    const prompt = `
      Actúa como el Responsable del Área de Soporte TI de Postgrado en la Universidad Peruana Unión.
      Tu tarea es redactar un INFORME TÉCNICO OFICIAL con un lenguaje equilibrado: profesional pero perfectamente entendible por personal administrativo (Finanzas, Dirección).

      DATOS DEL ACTIVO Y CUSTODIO:
      - Categoría: ${activo.categoria || 'Hardware'}
      - Marca/Modelo: ${activo.marca} ${activo.modelo}
      - S/N (Serie): ${activo.serial_id}
      - Código Patrimonial CAF: ${activo.caf || 'No registrado'}
      - Especificaciones de Fábrica: ${activo.especificaciones || 'No detalladas'}
      - Condición Física Actual: ${activo.nombre_estado || 'Evaluación Pendiente'}
      - Custodio Asignado: ${activo.nombre_completo || 'Almacén Central TI'}
      - Cargo del Custodio: ${activo.nombre_cargo || 'N/A'} 

      HISTORIAL DE LA BITÁCORA TÉCNICA A EVALUAR:
      ${historialNotas}

      CONTEXTO ADICIONAL DEL OPERADOR (Opcional):
      ${contextoAdicional || 'Ninguno.'}

      INSTRUCCIONES CRÍTICAS DE REDACCIÓN PARA "evaluacion":
      1. Comienza SIEMPRE con una breve premisa inicial introductoria que resuma el propósito de la inspección sobre el equipo y la situación del custodio (mencionando su cargo: ${activo.nombre_cargo || 'N/A'}).
      2. Luego, realiza un desglose punto por punto (usando viñetas o numeración) para cada nota de la bitácora técnica.
      3. CRÍTICO (Toma tus propias decisiones): Analiza cada nota de forma independiente. Si una nota aporta valor técnico real (fallas de hardware, lentitud, cambios de piezas), detállala y explica el porqué de su impacto. Si detectas que una nota fue un error de registro, una prueba aislada, o no aporta valor al estado actual del bien, descártala sutilmente indicando que "no representa un impacto crítico o corresponde a un evento subsanado".
      4. NO incluyas subtítulos como "Sección IV:" o "EVALUACIÓN TÉCNICA" dentro del texto.

      Devuelve estrictamente un objeto JSON válido con la siguiente estructura (sin bloques markdown \`\`\`json, solo el JSON puro):
      {
        "asunto": "Asunto formal, corto y directo relacionado al estado actual del equipo.",
        "evaluacion": "Aplica aquí la estructura estricta: Premisa inicial + Puntos de análisis crítico por cada nota de la bitácora.",
        "conclusiones": "Escribe DIRECTAMENTE las conclusiones en viñetas claras ('•'). NO agregues títulos. Detalla si el equipo es apto o no para continuar en servicio.",
        "recomendaciones": "Escribe DIRECTAMENTE las recomendaciones en viñetas claras ('•'). NO agregues títulos. Detalla las acciones técnicas/administrativas concretas (baja, mantenimiento, repuestos)."
      }
    `;

    const apiKey = process.env.GEMINI_API_KEY || '';
    const genAI = new GoogleGenerativeAI(apiKey);
    
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent(prompt);
    let textoRespuesta = result.response.text().trim();
    
    if (textoRespuesta.startsWith("```json")) {
      textoRespuesta = textoRespuesta.substring(7);
    }
    if (textoRespuesta.endsWith("```")) {
      textoRespuesta = textoRespuesta.substring(0, textoRespuesta.length - 3);
    }

    return NextResponse.json(JSON.parse(textoRespuesta.trim()));

  } catch (error: any) {
    console.error("Error en IA:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}