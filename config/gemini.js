
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY no está configurada en las variables de entorno');
}

// Inicializar cliente de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Modelo a utilizar
const MODEL_VISION = 'gemini-1.5-flash'; // Modelo multimodal para analizar el PDF
const MODEL_TEXT = 'gemini-1.5-flash';   // Modelo de texto para re-evaluaciones

const generationConfig = {
  temperature: 0.2,
  topP: 0.9,
  maxOutputTokens: 1000,
  responseMimeType: 'application/json',
};

const safetySettings = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

/**
 * Genera el prompt para la evaluación del CV.
 * @param {string} jobDescription - Descripción del puesto.
 * @returns {string} - El prompt completo.
 */
const getEvaluationPrompt = (jobDescription) => `
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

**INSTRUCCIÓN FINAL:** Analiza el CV proporcionado y genera ÚNICAMENTE un objeto JSON válido, sin ningún texto adicional antes o después. Sé crítico y basado en hechos. Asegúrate de que los arrays 'strengths' y 'weaknesses' tengan EXACTAMENTE 3 elementos cada uno.

{
  "score": 0, // Calculado de forma justa.
  "strengths": ["", "", ""], // Sé específico y cita la evidencia del CV. Ej: "2 años de experiencia en call center en Empresa X".
  "weaknesses": ["", "", ""], // Sé específico: "El CV no menciona experiencia en ventas, requisito clave para el puesto".
  "summary": "" // Breve resumen de 1-2 oraciones. Ej: "Candidato con perfil de diseño, sin evidencia de experiencia en ventas o atención al cliente para el puesto de call center."
}

Evalúa considerando:
- Experiencia laboral (50%)
- Habilidades técnicas (25%)
- Formación académica (10%)
- Competencias interpersonales (10%)

Responde solo con el JSON válido.
`;

/**
 * Normaliza y valida la respuesta JSON de la IA.
 * @param {object} evaluation - El objeto de evaluación de la IA.
 * @returns {object} - La evaluación normalizada.
 */
const normalizeEvaluation = (evaluation) => {
  if (!evaluation || typeof evaluation !== 'object') {
    throw new Error('Respuesta del modelo no es un objeto válido');
  }

  // Validar estructura de la respuesta
  if (!('score' in evaluation) || !('strengths' in evaluation) || !('weaknesses' in evaluation)) {
    throw new Error('Respuesta del modelo incompleta. Faltan score, strengths o weaknesses.');
  }

  // Asegurar que el score esté en el rango correcto
  evaluation.score = Math.max(0, Math.min(100, parseInt(evaluation.score) || 0));

  // Asegurar que tengamos exactamente 3 fortalezas y 3 debilidades
  evaluation.strengths = (Array.isArray(evaluation.strengths) ? evaluation.strengths : []).slice(0, 3);
  while (evaluation.strengths.length < 3) {
    evaluation.strengths.push('Análisis pendiente');
  }

  evaluation.weaknesses = (Array.isArray(evaluation.weaknesses) ? evaluation.weaknesses : []).slice(0, 3);
  while (evaluation.weaknesses.length < 3) {
    evaluation.weaknesses.push('Información limitada');
  }

  // Asegurar que summary existe
  evaluation.summary = evaluation.summary || 'Evaluación completada automáticamente.';

  return evaluation;
};

/**
 * Evalúa un CV (archivo PDF) contra una descripción de puesto usando Gemini.
 * @param {Buffer} cvFileBuffer - Buffer del archivo PDF del CV.
 * @param {string} jobDescription - Descripción del puesto.
 * @returns {Promise<Object>} - Evaluación con puntuación, fortalezas y debilidades.
 */
async function evaluateCVWithFile(cvFileBuffer, jobDescription) {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_VISION,
      safetySettings,
      generationConfig,
    });

    const prompt = getEvaluationPrompt(jobDescription);
    const imagePart = {
      inlineData: {
        data: cvFileBuffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;
    const evaluation = response.text();

    return normalizeEvaluation(JSON.parse(evaluation));
  } catch (error) {
    console.error('Error en evaluación con Gemini (File):', error);
    // Respuesta de fallback en caso de error
    return {
      score: 0,
      strengths: ['Evaluación pendiente', 'Requiere revisión manual', 'Error de IA'],
      weaknesses: ['Error en procesamiento automático', 'Información no disponible', 'Fallo en la API'],
      summary: 'Error en la evaluación automática con Gemini. Se requiere revisión manual del candidato.',
    };
  }
}

/**
 * Evalúa un CV (texto) contra una descripción de puesto usando Gemini.
 * @param {string} cvText - Texto extraído del CV.
 * @param {string} jobDescription - Descripción del puesto.
 * @returns {Promise<Object>} - Evaluación con puntuación, fortalezas y debilidades.
 */
async function evaluateCVWithText(cvText, jobDescription) {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_TEXT,
      safetySettings,
      generationConfig,
    });

    const prompt = getEvaluationPrompt(jobDescription) + '\n\nCURRICULUM VITAE:\n' + cvText;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const evaluation = response.text();

    return normalizeEvaluation(JSON.parse(evaluation));
  } catch (error) {
    console.error('Error en evaluación con Gemini (Text):', error);
    // Respuesta de fallback en caso de error
    return {
      score: 0,
      strengths: ['Evaluación pendiente', 'Requiere revisión manual', 'Error de IA'],
      weaknesses: ['Error en procesamiento automático', 'Información no disponible', 'Fallo en la API'],
      summary: 'Error en la evaluación automática con Gemini. Se requiere revisión manual del candidato.',
    };
  }
}

module.exports = {
  evaluateCVWithFile,
  evaluateCVWithText,
  MODEL_VISION,
  MODEL_TEXT,
};
