const Groq = require('groq-sdk');
require('dotenv').config();

if (!process.env.GROQ_API_KEY) {
  throw new Error(
    'GROQ_API_KEY no está configurada en las variables de entorno'
  );
}

// Inicializar cliente de Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Modelo a utilizar (llama-3.1-8b-instant es económico y eficiente)
const MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

/**
 * Evalúa un CV contra una descripción de puesto usando Groq
 * @param {string} cvText - Texto extraído del CV
 * @param {string} jobDescription - Descripción del puesto
 * @returns {Promise<Object>} - Evaluación con puntuación, fortalezas y debilidades
 */
async function evaluateCV(cvText, jobDescription) {
  try {
    const prompt = `
Eres un evaluador senior de recursos humanos, extremadamente estricto y objetivo. Analiza el CV del candidato CONTRA los requisitos específicos del puesto proporcionado. Basa tu evaluación ÚNICAMENTE en la evidencia explícita encontrada en el CV. No inventes, asumas o infieras cualidades.

**METODOLOGÍA DE EVALUACIÓN ESTRICTA:**
1.  **EXPERIENCIA (Peso 50%):** Evalúa la experiencia en este orden de prioridad:
    -   **Experiencia Directa (Máximo puntaje):** Experiencia laboral comprobable en un rol con el MISMO título y funciones.
    -   **Experiencia Transferible (Puntaje Medio):** Experiencia en un área técnica o funcionalmente relacionada (ej: Backend -> Frontend, Soporte Técnico -> Call Center).
    -   **Sin Experiencia Relevante (Puntaje Bajo):** Experiencia en un área no relacionada (ej: Diseño -> Programación, Contabilidad -> Ventas).
2.  **HABILIDADES ESPECÍFICAS:** Identifica las 2-3 habilidades más críticas mencionadas en la descripción del puesto (ej: "programación frontend", "atención al cliente", "ventas"). El candidato debe mencionar explícitamente estas habilidades o herramientas clave en su CV. Si no lo hace, es una falta crítica.
3.  **CANTIDAD DE ELEMENTOS EN LISTAS:** Debes generar **exactamente 3 elementos** para los arrays 'strengths' y 'weaknesses'. Si no encuentras 3 fortalezas, completa con las más relevantes aunque sean débiles. Si no encuentras 3 debilidades, repite las más críticas o usa "No proporciona información sobre [requisito importante]".
4.  **NO INVENTAR:** Si una habilidad, herramienta o experiencia requerida NO está escrita en el CV, se considera que el candidato NO la tiene. No extrapoles.

PUESTO DE TRABAJO:
${jobDescription}

CURRICULUM VITAE:
${cvText}

**INSTRUCCIÓN FINAL:** Genera ÚNICAMENTE un objeto JSON válido, sin ningún texto adicional antes o después. Sé crítico y basado en hechos. Asegúrate de que los arrays 'strengths' y 'weaknesses' tengan EXACTAMENTE 3 elementos cada uno.

{
  "score": 0, // Calculado de forma justa.
  "experience_match": "directa | transferible | no relacionada",
  "strengths": ["", "", ""], // Sé específico y cita la evidencia del CV. Ej: "2 años de experiencia en call center en Empresa X".
  "weaknesses": ["", "", ""], // Sé específico: "El CV no menciona experiencia en ventas, requisito clave para el puesto".
  "summary": "" // Breve resumen de 1-2 oraciones. Ej: "Candidato con perfil de diseño, sin evidencia de experiencia en ventas o atención al cliente para el puesto de call center."
}

Evalúa considerando:
- Experiencia laboral (50%)
- Habilidades técnicas (25%)
- Formación académica (10%)
- Competencias interpersonales (10%)

Responde solo con el JSON válido.`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'Eres un asistente de recursos humanos especializado en evaluación de candidatos. Responde siempre en formato JSON válido.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: MODEL,
      temperature: 0.2,
      max_tokens: 1000,
      top_p: 0.9,
      stream: false,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      throw new Error('No se recibió respuesta del modelo');
    }

    // Limpiar la respuesta antes de parsear
    let cleanResponse = response.trim();

    // Si la respuesta contiene "safe", significa que fue filtrada por seguridad
    if (cleanResponse.toLowerCase().includes('safe')) {
      console.warn('⚠️ Respuesta filtrada por seguridad de contenido');
      throw new Error('Respuesta filtrada por seguridad');
    }

    // Intentar extraer JSON si está envuelto en texto
    const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanResponse = jsonMatch[0];
    }

    // Intentar parsear la respuesta JSON
    try {
      const evaluation = JSON.parse(cleanResponse);

      // Validar estructura de la respuesta
      if (
        !evaluation.score ||
        !evaluation.strengths ||
        !evaluation.weaknesses
      ) {
        throw new Error('Respuesta del modelo incompleta');
      }

      // Asegurar que el score esté en el rango correcto
      evaluation.score = Math.max(0, Math.min(100, parseInt(evaluation.score)));

      // Asegurar que tengamos exactamente 2 fortalezas y 2 debilidades
      evaluation.strengths = Array.isArray(evaluation.strengths)
        ? evaluation.strengths.slice(0, 2)
        : ['Evaluación pendiente', 'Requiere revisión'];
      evaluation.weaknesses = Array.isArray(evaluation.weaknesses)
        ? evaluation.weaknesses.slice(0, 2)
        : ['Información limitada', 'Análisis incompleto'];

      // Asegurar que summary existe
      evaluation.summary =
        evaluation.summary || 'Evaluación completada automáticamente';

      return evaluation;
    } catch (parseError) {
      console.error('Error parseando respuesta JSON:', parseError);
      console.error('Respuesta recibida:', response);

      // Respuesta de fallback
      return {
        score: 50,
        strengths: [
          'Candidato presenta experiencia en el área',
          'Perfil con potencial de desarrollo',
        ],
        weaknesses: [
          'Requiere evaluación más detallada',
          'Información limitada para análisis completo',
        ],
        summary:
          'Evaluación requiere revisión manual debido a error en el procesamiento automático.',
      };
    }
  } catch (error) {
    console.error('Error en evaluación con Groq:', error);

    // Respuesta de fallback en caso de error
    return {
      score: 0,
      strengths: ['Evaluación pendiente', 'Requiere revisión manual'],
      weaknesses: [
        'Error en procesamiento automático',
        'Información no disponible',
      ],
      summary:
        'Error en la evaluación automática. Se requiere revisión manual del candidato.',
    };
  }
}

module.exports = {
  groq,
  evaluateCV,
  MODEL,
};
