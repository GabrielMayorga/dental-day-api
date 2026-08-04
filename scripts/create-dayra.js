// scripts/create-dayra.js
// ============================================================
// Crea la odontóloga Dayra González (user + perfil en staff).
// Uso: node scripts/create-dayra.js  (con DATABASE_URL exportada)
// ============================================================
const db = require('../src/config/database');
const { hashPassword } = require('../src/shared/utils/password.util');

const DENTIST = {
  email: 'dayra@clinicadentalday.com',
  password: 'Dentist2024!',
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
    const passwordHash = await hashPassword(DENTIST.password);

    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role_id, full_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             full_name = EXCLUDED.full_name
       RETURNING id`,
      [DENTIST.email, passwordHash, dentistRoleId, DENTIST.full_name]
    );
    const userId = userResult.rows[0].id;

    const staffResult = await client.query(
      `INSERT INTO staff (user_id, first_name, last_name, speciality)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET speciality = EXCLUDED.speciality
       RETURNING id`,
      [userId, DENTIST.first_name, DENTIST.last_name, DENTIST.speciality]
    );

    await client.query('COMMIT');
    console.log(`✅ ${DENTIST.full_name} creada (staff_id: ${staffResult.rows[0].id})`);
    console.log(`   Email: ${DENTIST.email}`);
    console.log(`   Especialidad: ${DENTIST.speciality}\n`);
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
