// scripts/create-staff.js
// ============================================================
// Crea usuarios odontólogos de prueba (user + perfil en staff).
// Uso: node scripts/create-staff.js
// ============================================================
require('dotenv').config();

const db = require('../src/config/database');
const { hashPassword } = require('../src/shared/utils/password.util');

const DENTISTS = [
  { email: 'ronald@clinicadentalday.com',  password: 'Dentist2024!', first_name: 'Ronald', last_name: 'Mayorga', speciality: 'Odontología general' },
  { email: 'sayda@clinicadentalday.com',   password: 'Dentist2024!', first_name: 'Sayda',  last_name: 'Mejía',   speciality: 'Ortodoncia' },
];

async function createStaff() {
  console.log('\n🦷 Creando odontólogos de prueba...\n');
  const client = await db.getClient();

  try {
    const roleResult = await client.query(`SELECT id FROM roles WHERE name = 'dentist'`);
    if (roleResult.rows.length === 0) {
      console.error('❌ No existe el rol "dentist". ¿Corriste los seeds?');
      process.exit(1);
    }
    const dentistRoleId = roleResult.rows[0].id;

    for (const d of DENTISTS) {
      // Transacción: crear user + staff juntos (o ninguno si algo falla)
      await client.query('BEGIN');

      const passwordHash = await hashPassword(d.password);

      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, role_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
         RETURNING id`,
        [d.email, passwordHash, dentistRoleId]
      );
      const userId = userResult.rows[0].id;

      const staffResult = await client.query(
        `INSERT INTO staff (user_id, first_name, last_name, speciality)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET speciality = EXCLUDED.speciality
         RETURNING id`,
        [userId, d.first_name, d.last_name, d.speciality]
      );

      await client.query('COMMIT');
      console.log(`✅ ${d.first_name} ${d.last_name} (staff_id: ${staffResult.rows[0].id})`);
    }

    console.log('\n🎉 Odontólogos listos.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await db.close();
  }
}

createStaff();
