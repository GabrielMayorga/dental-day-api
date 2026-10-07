// src/config/database.js
// ============================================================
// "Pool" de conexiones a PostgreSQL. Un pool mantiene varias
// conexiones abiertas y las reutiliza, en vez de abrir/cerrar
// una conexión nueva en cada consulta (eso sería muy lento).
// ============================================================
const { Pool, types } = require('pg');
const { databaseUrl, isProd, clinicTimezone } = require('./env');

// ── TIPOS DE FECHA ───────────────────────────────────────────
// Por defecto pg convierte TIMESTAMP y DATE en objetos Date usando
// la zona del SERVIDOR (UTC en Render). Al serializarlos a JSON
// salen con sufijo Z y el navegador los desplaza (-6h en Managua).
// Cortamos esa conversión aquí, en la frontera del driver:
//
// TIMESTAMP sin zona (OID 1114): hora de pared de la clínica.
// Se devuelve como texto ISO sin zona, nunca como Date.
types.setTypeParser(1114, (v) => v.replace(' ', 'T'));
// DATE (OID 1082): fecha de calendario, sin hora ni zona.
types.setTypeParser(1082, (v) => v);
// TIMESTAMPTZ (OID 1184) NO se toca: created_at, last_login, paid_at
// son instantes reales y deben seguir viajando como Date / ISO con Z.

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
 * clinic_now es la hora de pared de la clínica según la base: sirve
 * para comprobar en producción qué hora cree el servidor que es.
 */
const healthCheck = async () => {
  const result = await query(
    `SELECT NOW() AS time,
            version() AS pg_version,
            to_char(now() AT TIME ZONE $1, 'YYYY-MM-DD"T"HH24:MI:SS') AS clinic_now`,
    [clinicTimezone]
  );
  return result.rows[0];
};

const close = () => pool.end();

module.exports = { query, getClient, healthCheck, close };
