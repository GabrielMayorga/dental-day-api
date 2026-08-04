// scripts/apply-migration.js
// ============================================================
// Aplica un archivo SQL a la base de datos.
// Uso: DATABASE_URL="..." NODE_ENV=production node scripts/apply-migration.js migrations/002_xxx.sql
// ============================================================
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function run() {
  const file = process.argv[2];
  if (!file) {
    console.error('❌ Indica el archivo: node scripts/apply-migration.js <archivo.sql>');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('❌ Falta DATABASE_URL');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  console.log('✅ Conectado a PostgreSQL');
  try {
    const sql = fs.readFileSync(path.resolve(file), 'utf8');
    console.log(`▶  Aplicando: ${file}`);
    await client.query(sql);
    console.log('   ✅ Migración aplicada correctamente');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
