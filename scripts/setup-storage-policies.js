const { Pool } = require('pg');
require('dotenv').config();

async function setupStoragePolicies() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🚀 Configurando políticas RLS para Storage...');

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
        await pool.query(policy.sql);
        console.log(`✅ Política "${policy.name}" creada exitosamente`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⏭️  Política "${policy.name}" ya existe`);
        } else {
          console.warn(`⚠️  Error creando política "${policy.name}":`, error.message);
        }
      }
    }

    console.log('🎉 Configuración de políticas completada');
    console.log('📋 Storage listo para recibir archivos CV');

  } catch (error) {
    console.error('❌ Error configurando políticas:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  setupStoragePolicies()
    .then(() => {
      console.log('✅ Proceso completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { setupStoragePolicies };
