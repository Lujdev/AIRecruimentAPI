const { Pool } = require('pg');
require('dotenv').config();

// Configuración del pool de conexiones PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20, // máximo número de conexiones en el pool
  idleTimeoutMillis: 30000, // tiempo antes de cerrar conexiones inactivas
  connectionTimeoutMillis: 2000, // tiempo máximo para establecer conexión
});

// Manejar eventos del pool
pool.on('connect', () => {
  console.log('✅ Nueva conexión establecida con PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool de PostgreSQL:', err);
  process.exit(-1);
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
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Consulta ejecutada:', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('❌ Error en consulta SQL:', { text, error: error.message });
    throw error;
  }
}

/**
 * Wrapper para ejecutar una consulta en un cliente con logging.
 * @param {Object} client - El cliente de la base de datos.
 * @param {string} text - La consulta SQL.
 * @param {Array} params - Los parámetros de la consulta.
 * @returns {Promise<Object>} - El resultado de la consulta.
 */
async function logQuery(client, text, params) {
  const start = Date.now();
  try {
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Consulta de transacción ejecutada:', { 
      text, 
      duration, 
      rows: res.rowCount 
    });
    return res;
  } catch (error) {
    console.error('❌ Error en consulta de transacción:', { text, error: error.message });
    throw error;
  }
}
/**
 * Obtiene un cliente del pool para transacciones
 * @returns {Promise<Object>} - Cliente de PostgreSQL
 */
async function getClient() {
  const client = await pool.connect();
  const query = client.query;
  // Configurar timeout para el cliente
  const timeout = setTimeout(() => {
    console.error('❌ Cliente de base de datos no liberado después de 5 segundos');
    console.error(new Error().stack);
  }, 5000);
  
  // Wrapper para liberar el cliente automáticamente
  const release = client.release;
  let released = false;
  client.release = () => {
    if (released) return;
    released = true;
    clearTimeout(timeout);
    return release.apply(client);
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
    await logQuery(client, 'BEGIN');
    const result = await callback(client);
    await logQuery(client, 'COMMIT');
    return result;
  } catch (error) {
    await logQuery(client, 'ROLLBACK');
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
  runMigrations,
  closePool,
  pool
};