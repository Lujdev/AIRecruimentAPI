const { Pool } = require('pg');
require('dotenv').config();

async function fixStoragePolicies() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔧 Corrigiendo políticas RLS para Storage...');

    // Primero eliminar políticas problemáticas si existen
    const dropPolicies = [
      'DROP POLICY IF EXISTS "Allow CV updates" ON storage.objects;',
      'DROP POLICY IF EXISTS "Allow CV deletions" ON storage.objects;'
    ];

    for (const dropSQL of dropPolicies) {
      try {
        await pool.query(dropSQL);
        console.log('🗑️ Política problemática eliminada');
      } catch (error) {
        console.log('ℹ️ No se pudo eliminar política (puede que no exista)');
      }
    }

    // Crear políticas corregidas
    const fixedPolicies = [
      {
        name: 'Allow CV updates (fixed)',
        sql: `CREATE POLICY "Allow CV updates" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'cvs' AND auth.uid()::text = owner::text) WITH CHECK (bucket_id = 'cvs');`
      },
      {
        name: 'Allow CV deletions (fixed)',
        sql: `CREATE POLICY "Allow CV deletions" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'cvs' AND auth.uid()::text = owner::text);`
      }
    ];

    for (const policy of fixedPolicies) {
      try {
        await pool.query(policy.sql);
        console.log(`✅ Política "${policy.name}" creada exitosamente`);
      } catch (error) {
        console.warn(`⚠️ Error creando política "${policy.name}":`, error.message);
      }
    }

    console.log('🎉 Políticas corregidas');
    console.log('📋 Storage completamente configurado');

  } catch (error) {
    console.error('❌ Error corrigiendo políticas:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  fixStoragePolicies()
    .then(() => {
      console.log('✅ Proceso completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { fixStoragePolicies };
