// scripts/create-dayra.js
// ============================================================
// Crea la odontóloga Dayra González (user + perfil en staff).
// Si el usuario ya existe, no lo toca.
// Uso: DAYRA_PASSWORD=... node scripts/create-dayra.js
// ============================================================
require('dotenv').config();

const DAYRA_PASSWORD = process.env.DAYRA_PASSWORD;

if (!DAYRA_PASSWORD) {
  console.error('❌ Falta DAYRA_PASSWORD. Uso: DAYRA_PASSWORD=... node scripts/create-dayra.js');
  process.exit(1);
}

const db = require('../src/config/database');
const { hashPassword } = require('../src/shared/utils/password.util');

const DENTIST = {
  email: 'dayra@clinicadentalday.com',
  first_name: 'Dayra',
  last_name: 'González',
  speciality: 'Odontología general',
  full_name: 'Dayra González',
};

async function createDayra() {
  console.log('\n🦷 Creando odontóloga Dayra González...\n');
  const client = await db.getClient();
  try {
    const roleResult = await client.query(`SELECT id FROM roles WHERE name = 'dentist'`);
    if (roleResult.rows.length === 0) {
      console.error('❌ No existe el rol "dentist". ¿Corriste los seeds?');
      process.exit(1);
    }
    const dentistRoleId = roleResult.rows[0].id;

    await client.query('BEGIN');
    const passwordHash = await hashPassword(DAYRA_PASSWORD);

    // DO NOTHING: nunca sobrescribe la contraseña de un usuario existente
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role_id, full_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [DENTIST.email, passwordHash, dentistRoleId, DENTIST.full_name]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      console.log(`ℹ️  ${DENTIST.email} ya existe; no se modificó.\n`);
      return;
    }
    const userId = userResult.rows[0].id;

    const staffResult = await client.query(
      `INSERT INTO staff (user_id, first_name, last_name, speciality)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, DENTIST.first_name, DENTIST.last_name, DENTIST.speciality]
    );

    await client.query('COMMIT');
    console.log(`✅ ${DENTIST.full_name} creada`);
    console.log(`   Email: ${DENTIST.email}`);
    console.log(`   ID:    ${userId} (staff_id: ${staffResult.rows[0].id})\n`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await db.close();
  }
}
createDayra();
