const { evaluateCV } = require('../config/groq');

async function testGroqEvaluation() {
  try {
    console.log('🧪 Probando evaluación de CV con Groq...');
    
    const testCV = `
    Juan Pérez
    Desarrollador Full Stack
    
    EXPERIENCIA:
    - 3 años desarrollando aplicaciones web con React y Node.js
    - Experiencia con bases de datos PostgreSQL y MongoDB
    - Conocimientos en Docker y AWS
    
    EDUCACIÓN:
    - Ingeniería en Sistemas, Universidad Nacional
    - Certificación en React Development
    
    HABILIDADES:
    - JavaScript, TypeScript, React, Node.js
    - PostgreSQL, MongoDB
    - Git, Docker, AWS
    `;
    
    const testJobDescription = `
    Buscamos un Desarrollador Full Stack con experiencia en:
    - React y Node.js (mínimo 2 años)
    - Bases de datos relacionales
    - Conocimientos en cloud computing
    - Trabajo en equipo y comunicación efectiva
    `;
    
    const evaluation = await evaluateCV(testCV, testJobDescription);
    
    console.log('✅ Evaluación completada:');
    console.log('📊 Score:', evaluation.score);
    console.log('💪 Fortalezas:', evaluation.strengths);
    console.log('⚠️ Debilidades:', evaluation.weaknesses);
    console.log('📝 Resumen:', evaluation.summary);
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testGroqEvaluation()
    .then(() => {
      console.log('🎉 Prueba completada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { testGroqEvaluation };
