require('dotenv').config();
// scripts/reset-password.js
// Restablece la contraseña de un usuario sin que la clave pase por
// el código ni por los logs.
// Uso: NEW_PASSWORD=... node scripts/reset-password.js correo@dominio
const { Pool } = require('pg');

let bcrypt;
try { bcrypt = require('bcrypt'); } catch { bcrypt = require('bcryptjs'); }

const email = process.argv[2];
const password = process.env.NEW_PASSWORD;
const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

if (!email) {
  console.error('Uso: NEW_PASSWORD=... node scripts/reset-password.js correo@dominio');
  process.exit(1);
}
if (!password || password.length < 10) {
  console.error('❌ NEW_PASSWORD debe tener al menos 10 caracteres');
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

(async () => {
  try {
    const hash = await bcrypt.hash(password, rounds);
    const r = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE lower(email) = lower($2) RETURNING email',
      [hash, email]
    );
    if (r.rowCount === 0) {
      console.error(`❌ No existe un usuario con el correo ${email}`);
      process.exitCode = 1;
    } else {
      console.log(`✅ Contraseña actualizada para ${r.rows[0].email}`);
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
