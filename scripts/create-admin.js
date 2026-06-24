// scripts/create-admin.js
// ============================================================
// Crea (o actualiza) el usuario administrador inicial.
// Uso: node scripts/create-admin.js
// ============================================================
require('dotenv').config();

const db = require('../src/config/database');
const { hashPassword } = require('../src/shared/utils/password.util');

const ADMIN_EMAIL = 'admin@clinicadentalday.com';
const ADMIN_PASSWORD = 'Admin2024!';

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

    const result = await db.query(
      `INSERT INTO users (email, password_hash, role_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (email)
       DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id, email`,
      [ADMIN_EMAIL, passwordHash, adminRoleId]
    );

    const admin = result.rows[0];

    console.log('✅ Usuario administrador listo:');
    console.log('   Email:      ', admin.email);
    console.log('   Contraseña: ', ADMIN_PASSWORD);
    console.log('   ID:         ', admin.id);
    console.log('\n⚠️  Cambia esta contraseña después del primer login.\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

createAdmin();
