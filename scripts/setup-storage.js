const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function setupStorage() {
  // Usar service role key para crear bucket y políticas
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('🚀 Configurando Storage...');

    // 1. Crear bucket si no existe
    const { data: bucketData, error: bucketError } = await supabaseAdmin.storage.createBucket('cvs', {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['application/pdf']
    });

    if (bucketError && !bucketError.message.includes('already exists')) {
      throw bucketError;
    }

    console.log('✅ Bucket "cvs" creado/configurado');

    // 2. Crear políticas RLS
    const policies = [
      {
        name: 'Allow CV uploads',
        sql: `CREATE POLICY "Allow CV uploads" ON storage.objects FOR INSERT TO authenticated, anon WITH CHECK (bucket_id = 'cvs');`
      },
      {
        name: 'Allow CV downloads', 
        sql: `CREATE POLICY "Allow CV downloads" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'cvs');`
      },
      {
        name: 'Allow CV updates',
        sql: `CREATE POLICY "Allow CV updates" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'cvs' AND auth.uid()::text = owner) WITH CHECK (bucket_id = 'cvs');`
      },
      {
        name: 'Allow CV deletions',
        sql: `CREATE POLICY "Allow CV deletions" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'cvs' AND auth.uid()::text = owner);`
      }
    ];

    for (const policy of policies) {
      try {
        const { error } = await supabaseAdmin.rpc('exec_sql', { sql: policy.sql });
        if (error && !error.message.includes('already exists')) {
          console.warn(`⚠️  Advertencia al crear política "${policy.name}":`, error.message);
        } else {
          console.log(`✅ Política "${policy.name}" creada`);
        }
      } catch (err) {
        console.warn(`⚠️  No se pudo crear política "${policy.name}":`, err.message);
      }
    }

    console.log('🎉 Configuración de Storage completada');
    console.log('📋 Bucket "cvs" listo para recibir archivos PDF');

  } catch (error) {
    console.error('❌ Error configurando Storage:', error.message);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  setupStorage()
    .then(() => {
      console.log('✅ Proceso completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { setupStorage };
