const { testConnection, runMigrations } = require('../utils/database');
const { supabase } = require('../config/supabase');

/**
 * Script de inicialización de la base de datos
 * Este script:
 * 1. Verifica la conexión a PostgreSQL
 * 2. Ejecuta las migraciones
 * 3. Configura el bucket de Supabase Storage para CVs
 */
async function initializeDatabase() {
  console.log('🚀 Iniciando configuración de la base de datos...');
  
  try {
    // 1. Verificar conexión a PostgreSQL
    console.log('📡 Verificando conexión a PostgreSQL...');
    await testConnection();
    console.log('✅ Conexión a PostgreSQL exitosa');
    
    // 2. Ejecutar migraciones
    console.log('📋 Ejecutando migraciones...');
    await runMigrations();
    console.log('✅ Migraciones ejecutadas exitosamente');
    
    // 3. Configurar Supabase Storage
    console.log('📁 Configurando Supabase Storage...');
    await setupSupabaseStorage();
    console.log('✅ Supabase Storage configurado');
    
    console.log('🎉 Inicialización completada exitosamente');
    console.log('');
    console.log('📝 Próximos pasos:');
    console.log('   1. Ejecutar: npm start');
    console.log('   2. El servidor estará disponible en: http://localhost:3000');
    console.log('   3. Documentación de la API: http://localhost:3000/api/health');
    
  } catch (error) {
    console.error('❌ Error durante la inicialización:', error.message);
    console.error('');
    console.error('🔧 Posibles soluciones:');
    console.error('   1. Verificar las credenciales de la base de datos en .env');
    console.error('   2. Asegurar que Supabase esté accesible');
    console.error('   3. Verificar la configuración de red/firewall');
    process.exit(1);
  }
}

/**
 * Configurar el bucket de Supabase Storage para CVs
 */
async function setupSupabaseStorage() {
  try {
    // Verificar si el bucket 'cvs' ya existe
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.warn('⚠️  No se pudo verificar buckets existentes:', listError.message);
      return;
    }
    
    const cvsBucket = buckets.find(bucket => bucket.name === 'cvs');
    
    if (cvsBucket) {
      console.log('📁 Bucket "cvs" ya existe');
      return;
    }
    
    // Crear el bucket 'cvs'
    const { data, error } = await supabase.storage.createBucket('cvs', {
      public: false, // Los CVs deben ser privados
      allowedMimeTypes: ['application/pdf'],
      fileSizeLimit: 10485760 // 10MB
    });
    
    if (error) {
      if (error.message.includes('already exists')) {
        console.log('📁 Bucket "cvs" ya existe');
        return;
      }
      throw new Error(`Error creando bucket: ${error.message}`);
    }
    
    console.log('📁 Bucket "cvs" creado exitosamente');
    
  } catch (error) {
    console.warn('⚠️  Error configurando Supabase Storage:', error.message);
    console.warn('   El bucket se puede crear manualmente desde el dashboard de Supabase');
    // No fallar la inicialización por esto
  }
}

/**
 * Verificar configuración del entorno
 */
function checkEnvironment() {
  const requiredVars = [
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GROQ_API_KEY'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Variables de entorno faltantes:');
    missing.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('');
    console.error('💡 Asegúrate de tener un archivo .env con todas las variables necesarias');
    process.exit(1);
  }
  
  console.log('✅ Variables de entorno verificadas');
}

// Ejecutar inicialización si este archivo se ejecuta directamente
if (require.main === module) {
  // Cargar variables de entorno
  require('dotenv').config();
  
  console.log('🔧 RecruitmentApp - Inicialización de Base de Datos');
  console.log('================================================');
  console.log('');
  
  // Verificar entorno
  checkEnvironment();
  
  // Ejecutar inicialización
  initializeDatabase();
}

module.exports = {
  initializeDatabase,
  setupSupabaseStorage,
  checkEnvironment
};