// scripts/create-receptionist.js
// ============================================================
// Crea un usuario recepcionista de prueba. Si ya existe, no lo toca.
// Uso: RECEPTION_PASSWORD=... node scripts/create-receptionist.js
// ============================================================
require('dotenv').config();

const EMAIL = 'recepcion@clinicadentalday.com';
const PASSWORD = process.env.RECEPTION_PASSWORD;

if (!PASSWORD) {
  console.error('❌ Falta RECEPTION_PASSWORD. Uso: RECEPTION_PASSWORD=... node scripts/create-receptionist.js');
  process.exit(1);
}

const db = require('../src/config/database');
const { hashPassword } = require('../src/shared/utils/password.util');

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

    // DO NOTHING: nunca sobrescribe la contraseña de un usuario existente
    const result = await db.query(
      `INSERT INTO users (email, password_hash, role_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email`,
      [EMAIL, passwordHash, roleId]
    );

    if (result.rows.length === 0) {
      console.log(`ℹ️  Ya existe un usuario con el correo ${EMAIL}; no se modificó.`);
      return;
    }

    console.log('✅ Recepcionista creado:');
    console.log('   Email:', result.rows[0].email);
    console.log('   ID:   ', result.rows[0].id);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

createReceptionist();
