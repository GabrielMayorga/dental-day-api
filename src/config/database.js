// src/config/database.js
// ============================================================
// "Pool" de conexiones a PostgreSQL. Un pool mantiene varias
// conexiones abiertas y las reutiliza, en vez de abrir/cerrar
// una conexión nueva en cada consulta (eso sería muy lento).
// ============================================================
const { Pool } = require('pg');
const { databaseUrl, isProd } = require('./env');

const pool = new Pool({
  connectionString: databaseUrl,

  // Railway requiere SSL en producción; en local (Docker) no
  ssl: isProd ? { rejectUnauthorized: false } : false,

  max: 10,                       // Máximo de conexiones simultáneas
  idleTimeoutMillis: 30_000,     // Cierra una conexión si está inactiva 30s
  connectionTimeoutMillis: 5_000, // Si no logra conectar en 5s, lanza error
});

// Si una conexión falla en segundo plano, lo registramos
// en vez de dejar que tumbe el servidor silenciosamente
pool.on('error', (err) => {
  console.error('❌ Error inesperado en cliente de BD:', err.message);
});

/**
 * Ejecuta una consulta SQL.
 * Uso: const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
 *
 * Los símbolos $1, $2... son "parámetros preparados": PostgreSQL
 * los trata como datos, nunca como código SQL. Esto es lo que
 * previene ataques de SQL Injection — NUNCA concatenes strings
 * directamente en una query.
 */
const query = (text, params) => pool.query(text, params);

/**
 * Para transacciones (varias queries que deben tener éxito todas
 * juntas, o ninguna). Lo usaremos en módulos como Citas y Facturación.
 */
const getClient = () => pool.connect();

/**
 * Verifica que la BD esté viva. Se usa al arrancar el servidor
 * y en la ruta /health.
 */
const healthCheck = async () => {
  const result = await query('SELECT NOW() AS time, version() AS pg_version');
  return result.rows[0];
};

const close = () => pool.end();

module.exports = { query, getClient, healthCheck, close };
