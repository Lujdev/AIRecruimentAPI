const Groq = require('groq-sdk');
require('dotenv').config();

if (!process.env.GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY no está configurada en las variables de entorno');
}

// Inicializar cliente de Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
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
Actúa como un experto reclutador de recursos humanos. Evalúa el siguiente CV contra la descripción del puesto proporcionada.

DESCRIPCIÓN DEL PUESTO:
${jobDescription}

CV DEL CANDIDATO:
${cvText}

Por favor, proporciona una evaluación en el siguiente formato JSON exacto:
{
  "score": [número del 0 al 100],
  "strengths": [
    "Primera fortaleza específica del candidato",
    "Segunda fortaleza específica del candidato"
  ],
  "weaknesses": [
    "Primera debilidad o área de mejora",
    "Segunda debilidad o área de mejora"
  ],
  "summary": "Resumen breve de la evaluación en 2-3 líneas"
}

Criterios de evaluación:
- Experiencia relevante (30%)
- Habilidades técnicas requeridas (25%)
- Educación y certificaciones (20%)
- Habilidades blandas (15%)
- Ajuste cultural potencial (10%)

Responde ÚNICAMENTE con el JSON, sin texto adicional.`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      model: MODEL,
      temperature: 0.3,
      max_tokens: 1000,
      top_p: 1,
      stream: false
    });

    const response = completion.choices[0]?.message?.content;
    
    if (!response) {
      throw new Error('No se recibió respuesta del modelo');
    }

    // Intentar parsear la respuesta JSON
    try {
      const evaluation = JSON.parse(response);
      
      // Validar estructura de la respuesta
      if (!evaluation.score || !evaluation.strengths || !evaluation.weaknesses) {
        throw new Error('Respuesta del modelo incompleta');
      }

      // Asegurar que el score esté en el rango correcto
      evaluation.score = Math.max(0, Math.min(100, evaluation.score));
      
      // Asegurar que tengamos exactamente 2 fortalezas y 2 debilidades
      evaluation.strengths = evaluation.strengths.slice(0, 2);
      evaluation.weaknesses = evaluation.weaknesses.slice(0, 2);
      
      return evaluation;
    } catch (parseError) {
      console.error('Error parseando respuesta JSON:', parseError);
      console.error('Respuesta recibida:', response);
      
      // Respuesta de fallback
      return {
        score: 50,
        strengths: [
          'Candidato presenta experiencia en el área',
          'Perfil con potencial de desarrollo'
        ],
        weaknesses: [
          'Requiere evaluación más detallada',
          'Información limitada para análisis completo'
        ],
        summary: 'Evaluación requiere revisión manual debido a error en el procesamiento automático.'
      };
    }
  } catch (error) {
    console.error('Error en evaluación con Groq:', error);
    
    // Respuesta de fallback en caso de error
    return {
      score: 0,
      strengths: [
        'Evaluación pendiente',
        'Requiere revisión manual'
      ],
      weaknesses: [
        'Error en procesamiento automático',
        'Información no disponible'
      ],
      summary: 'Error en la evaluación automática. Se requiere revisión manual del candidato.'
    };
  }
}

module.exports = {
  groq,
  evaluateCV,
  MODEL
};