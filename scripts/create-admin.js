// scripts/create-admin.js
// ============================================================
// Crea el usuario administrador inicial. Si ya existe, no lo toca.
// Uso: ADMIN_PASSWORD=... node scripts/create-admin.js
// ============================================================
require('dotenv').config();

const ADMIN_EMAIL = 'admin@clinicadentalday.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.error('❌ Falta ADMIN_PASSWORD. Uso: ADMIN_PASSWORD=... node scripts/create-admin.js');
  process.exit(1);
}

const db = require('../src/config/database');
const { hashPassword } = require('../src/shared/utils/password.util');

async function createAdmin() {
  console.log('\n🦷 Creando usuario administrador...\n');

  try {
    const roleResult = await db.query(
      `SELECT id FROM roles WHERE name = 'admin'`
    );

    if (roleResult.rows.length === 0) {
      console.error('❌ No existe el rol "admin". ¿Corriste los seeds?');
      process.exit(1);
    }

    const adminRoleId = roleResult.rows[0].id;
    const passwordHash = await hashPassword(ADMIN_PASSWORD);

    // DO NOTHING: un script de creación nunca sobrescribe la
    // contraseña de un usuario existente.
    const result = await db.query(
      `INSERT INTO users (email, password_hash, role_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email`,
      [ADMIN_EMAIL, passwordHash, adminRoleId]
    );

    if (result.rows.length === 0) {
      console.log(`ℹ️  Ya existe un usuario con el correo ${ADMIN_EMAIL}; no se modificó.\n`);
      return;
    }

    const admin = result.rows[0];
    console.log('✅ Usuario administrador creado:');
    console.log('   Email:', admin.email);
    console.log('   ID:   ', admin.id, '\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

createAdmin();
