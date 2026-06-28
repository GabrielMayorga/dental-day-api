// scripts/create-receptionist.js
// ============================================================
// Crea un usuario recepcionista de prueba.
// Uso: node scripts/create-receptionist.js
// ============================================================
require('dotenv').config();

const db = require('../src/config/database');
const { hashPassword } = require('../src/shared/utils/password.util');

const EMAIL = 'recepcion@clinicadentalday.com';
const PASSWORD = 'Recepcion2024!';

async function createReceptionist() {
  console.log('\n🦷 Creando recepcionista de prueba...\n');
  try {
    const roleResult = await db.query(
      `SELECT id FROM roles WHERE name = 'receptionist'`
    );
    if (roleResult.rows.length === 0) {
      console.error('❌ No existe el rol "receptionist". ¿Corriste los seeds?');
      process.exit(1);
    }
    const roleId = roleResult.rows[0].id;
    const passwordHash = await hashPassword(PASSWORD);

    const result = await db.query(
      `INSERT INTO users (email, password_hash, role_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id, email`,
      [EMAIL, passwordHash, roleId]
    );

    console.log('✅ Recepcionista listo:');
    console.log('   Email:      ', result.rows[0].email);
    console.log('   Contraseña: ', PASSWORD);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

createReceptionist();
