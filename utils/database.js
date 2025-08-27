const { Pool } = require('pg');
require('dotenv').config();

// Configuración del pool de conexiones PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20, // máximo número de conexiones en el pool
  min: 2, // mínimo número de conexiones a mantener
  idleTimeoutMillis: 30000, // tiempo antes de cerrar conexiones inactivas
  connectionTimeoutMillis: 10000, // tiempo máximo para establecer conexión (aumentado)
  maxLifetimeSeconds: 3600, // rotar conexiones cada hora para evitar conexiones stale
  allowExitOnIdle: false, // mantener el proceso vivo mientras hay conexiones
});

// Manejar eventos del pool
pool.on('connect', (client) => {
  console.log('✅ Nueva conexión establecida con PostgreSQL');
  // Configurar el cliente recién conectado
  client.query('SET timezone = "UTC"').catch(err => {
    console.warn('⚠️ No se pudo configurar timezone:', err.message);
  });
});

pool.on('error', (err, client) => {
  console.error('❌ Error inesperado en el pool de PostgreSQL:', err);
  // No hacer exit inmediato, solo loggear el error
  // El pool manejará automáticamente la reconexión
});

pool.on('acquire', (client) => {
  console.log('🔗 Cliente adquirido del pool');
});

pool.on('release', (err, client) => {
  if (err) {
    console.error('❌ Error al liberar cliente:', err);
  } else {
    console.log('🔓 Cliente liberado al pool');
  }
});

pool.on('remove', (client) => {
  console.log('🗑️ Cliente removido del pool');
});

/**
 * Ejecuta una consulta SQL
 * @param {string} text - Consulta SQL
 * @param {Array} params - Parámetros de la consulta
 * @returns {Promise<Object>} - Resultado de la consulta
 */
async function query(text, params) {
  const start = Date.now();
  try {
    // Validate pool is available
    if (!pool) {
      throw new Error('Database pool is not initialized');
    }
    
    // Validate pool.query returns a promise
    const queryPromise = pool.query(text, params);
    if (!queryPromise || typeof queryPromise.then !== 'function') {
      throw new Error('pool.query did not return a promise');
    }
    
    const res = await queryPromise;
    const duration = Date.now() - start;
    console.log('📊 Consulta ejecutada:', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('❌ Error en consulta SQL:', { text, error: error.message });
    throw error;
  }
}

/**
 * Obtiene un cliente del pool para transacciones
 * @returns {Promise<Object>} - Cliente de PostgreSQL
 */
async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query;
  const originalRelease = client.release;
  
  // Track if client has been released to prevent double release
  let isReleased = false;
  
  // Configurar timeout para el cliente
  const timeout = setTimeout(() => {
    if (!isReleased) {
      console.error('❌ Cliente de base de datos no liberado después de 5 segundos');
      console.error(new Error().stack);
    }
  }, 5000);
  
  // Wrapper para liberar el cliente automáticamente
  client.release = (destroy = false) => {
    if (isReleased) {
      console.warn('⚠️ Intento de liberar cliente ya liberado');
      return;
    }
    
    isReleased = true;
    clearTimeout(timeout);
    
    // Restore original methods
    client.query = originalQuery;
    client.release = originalRelease;
    
    return originalRelease.call(client, destroy);
  };
  
  // Wrapper para consultas con logging
  client.query = (...args) => {
    if (isReleased) {
      throw new Error('Cannot query on released client');
    }
    
    const start = Date.now();
    return originalQuery.apply(client, args).then(res => {
      const duration = Date.now() - start;
      console.log('📊 Consulta de transacción ejecutada:', { 
        text: args[0], 
        duration, 
        rows: res.rowCount 
      });
      return res;
    }).catch(error => {
      console.error('❌ Error en consulta de transacción:', { 
        text: args[0], 
        error: error.message 
      });
      throw error;
    });
  };
  
  return client;
}

/**
 * Ejecuta múltiples consultas en una transacción
 * @param {Function} callback - Función que recibe el cliente y ejecuta las consultas
 * @returns {Promise<any>} - Resultado de la transacción
 */
async function transaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('❌ Error durante ROLLBACK:', rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Verifica la conexión a la base de datos
 * @returns {Promise<boolean>} - true si la conexión es exitosa
 */
async function testConnection() {
  try {
    const result = await query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Conexión a PostgreSQL exitosa:', {
      time: result.rows[0].current_time,
      version: result.rows[0].pg_version.split(' ')[0]
    });
    return true;
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error.message);
    return false;
  }
}

/**
 * Valida que el pool esté funcionando correctamente
 * @returns {Promise<boolean>} - true si el pool está funcionando
 */
async function validatePool() {
  try {
    if (!pool) {
      console.error('❌ Pool no inicializado');
      return false;
    }
    
    // Verificar estadísticas del pool
    console.log('📊 Estado del pool:', {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    });
    
    // Probar una consulta simple
    const result = await query('SELECT 1 as test');
    if (result.rows[0].test === 1) {
      console.log('✅ Pool validado correctamente');
      return true;
    } else {
      console.error('❌ Pool no responde correctamente');
      return false;
    }
  } catch (error) {
    console.error('❌ Error validando pool:', error.message);
    return false;
  }
}

/**
 * Ejecuta las migraciones de la base de datos
 * @returns {Promise<boolean>} - true si las migraciones son exitosas
 */
async function runMigrations() {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    // Crear tabla de migraciones si no existe
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(file => file.endsWith('.sql')).sort();
    
    for (const file of sqlFiles) {
      // Verificar si la migración ya fue ejecutada
      const existingMigration = await query(
        'SELECT id FROM migrations WHERE filename = $1',
        [file]
      );
      
      if (existingMigration.rows.length === 0) {
        console.log(`🔄 Ejecutando migración: ${file}`);
        
        const filePath = path.join(migrationsDir, file);
        const migrationSQL = await fs.readFile(filePath, 'utf8');
        
        await transaction(async (client) => {
          await client.query(migrationSQL);
          await client.query(
            'INSERT INTO migrations (filename) VALUES ($1)',
            [file]
          );
        });
        
        console.log(`✅ Migración completada: ${file}`);
      } else {
        console.log(`⏭️  Migración ya ejecutada: ${file}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error ejecutando migraciones:', error.message);
    return false;
  }
}

/**
 * Cierra todas las conexiones del pool
 */
async function closePool() {
  await pool.end();
  console.log('🔌 Pool de conexiones PostgreSQL cerrado');
}

module.exports = {
  query,
  getClient,
  transaction,
  testConnection,
  validatePool,
  runMigrations,
  closePool,
  pool
};