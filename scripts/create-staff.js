// scripts/create-staff.js
// ============================================================
// Crea usuarios odontólogos de prueba (user + perfil en staff).
// Los que ya existen se omiten sin modificarlos.
// Uso: STAFF_PASSWORD=... node scripts/create-staff.js
// ============================================================
require('dotenv').config();

const STAFF_PASSWORD = process.env.STAFF_PASSWORD;

if (!STAFF_PASSWORD) {
  console.error('❌ Falta STAFF_PASSWORD. Uso: STAFF_PASSWORD=... node scripts/create-staff.js');
  process.exit(1);
}

const db = require('../src/config/database');
const { hashPassword } = require('../src/shared/utils/password.util');

const DENTISTS = [
  { email: 'ronald@clinicadentalday.com',  first_name: 'Ronald', last_name: 'Mayorga', speciality: 'Odontología general' },
  { email: 'sayda@clinicadentalday.com',   first_name: 'Sayda',  last_name: 'Mejía',   speciality: 'Ortodoncia' },
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

      const passwordHash = await hashPassword(STAFF_PASSWORD);

      // DO NOTHING: nunca sobrescribe la contraseña de un usuario existente
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, role_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [d.email, passwordHash, dentistRoleId]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        console.log(`ℹ️  ${d.email} ya existe; no se modificó.`);
        continue;
      }
      const userId = userResult.rows[0].id;

      const staffResult = await client.query(
        `INSERT INTO staff (user_id, first_name, last_name, speciality)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [userId, d.first_name, d.last_name, d.speciality]
      );

      await client.query('COMMIT');
      console.log(`✅ ${d.email} (user_id: ${userId}, staff_id: ${staffResult.rows[0].id})`);
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
