// scripts/setup-db.js
// ============================================================
// Ejecuta la migración y los seeds contra la base de datos.
// Uso: npm run db:setup
// ============================================================
require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Archivos a ejecutar, EN ORDEN
const steps = [
  { label: 'Migración 001 — Esquema',     file: '../migrations/001_initial_schema.sql' },
  { label: 'Seed 001 — Datos iniciales',  file: '../seeds/001_seed_data.sql' },
  // Las migraciones posteriores van DESPUÉS del seed: la 003 rellena
  // full_name de los usuarios que ya existan. Toda migración nueva
  // debe agregarse aquí, o se olvidará al desplegar.
  { label: 'Migración 002 — Borrado lógico de pacientes', file: '../migrations/002_patients_soft_delete.sql' },
  { label: 'Migración 003 — Nombre completo de usuarios', file: '../migrations/003_users_full_name.sql' },
  { label: 'Migración 005 — Gestión de contraseñas',      file: '../migrations/005_password_management.sql' },
];

async function setupDatabase() {
  console.log('\n🦷 Dental Day — Configuración de base de datos\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ Falta DATABASE_URL en tu archivo .env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  console.log('✅ Conectado a PostgreSQL\n');

  try {
    for (const step of steps) {
      const fullPath = path.join(__dirname, step.file);

      if (!fs.existsSync(fullPath)) {
        console.error(`❌ No se encontró el archivo: ${fullPath}`);
        process.exit(1);
      }

      console.log(`▶  ${step.label}`);
      const sql = fs.readFileSync(fullPath, 'utf8');
      const result = await client.query(sql);

      // Si el script terminó con un SELECT de verificación, lo mostramos
      const last = Array.isArray(result) ? result[result.length - 1] : result;
      if (last?.rows?.length > 0) {
        console.table(last.rows);
      }
      console.log(`   ✅ Listo\n`);
    }

    console.log('🎉 Base de datos configurada correctamente.');
    console.log('   Siguiente paso: npm run dev\n');

  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    if (err.detail) console.error(`   Detalle: ${err.detail}`);
    if (err.hint)   console.error(`   Sugerencia: ${err.hint}`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase();