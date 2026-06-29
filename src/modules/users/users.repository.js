// src/modules/users/users.repository.js
// ============================================================
// Repositorio de usuarios (gestión administrativa).
// Incluye creación con transacción para odontólogos (user+staff).
// ============================================================
const db = require('../../config/database');

// Lista usuarios con su rol y, si es odontólogo, su nombre de staff.
// NUNCA devuelve password_hash.
const findAll = async () => {
  const result = await db.query(
    `SELECT
       u.id, u.email, u.is_active, u.last_login, u.created_at,
       r.name AS role_name,
       s.first_name, s.last_name, s.speciality
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN staff s ON s.user_id = u.id
     ORDER BY u.created_at DESC`
  );
  return result.rows;
};

// Busca un usuario por id (sin password_hash)
const findById = async (id) => {
  const result = await db.query(
    `SELECT u.id, u.email, u.is_active, u.last_login, u.created_at,
            r.name AS role_name
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

// Verifica si un email ya existe
const emailExists = async (email) => {
  const result = await db.query(`SELECT id FROM users WHERE email = $1`, [email]);
  return result.rows.length > 0;
};

// Obtiene el id de un rol por su nombre
const getRoleId = async (roleName) => {
  const result = await db.query(`SELECT id FROM roles WHERE name = $1`, [roleName]);
  return result.rows[0]?.id || null;
};

// Crea SOLO un usuario (para roles que no son odontólogo)
const createUser = async ({ email, passwordHash, roleId }) => {
  const result = await db.query(
    `INSERT INTO users (email, password_hash, role_id)
     VALUES ($1, $2, $3)
     RETURNING id, email, is_active, created_at`,
    [email, passwordHash, roleId]
  );
  return result.rows[0];
};

// Crea usuario + staff en una TRANSACCIÓN (para odontólogos).
// Si algo falla, no queda ningún registro a medias.
const createUserWithStaff = async ({
  email, passwordHash, roleId, first_name, last_name, speciality, phone,
}) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role_id)
       VALUES ($1, $2, $3)
       RETURNING id, email, is_active, created_at`,
      [email, passwordHash, roleId]
    );
    const user = userResult.rows[0];

    const staffResult = await client.query(
      `INSERT INTO staff (user_id, first_name, last_name, speciality, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [user.id, first_name, last_name, speciality ?? null, phone ?? null]
    );

    await client.query('COMMIT');
    return { ...user, staff_id: staffResult.rows[0].id, first_name, last_name, speciality };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Cambia el rol de un usuario
const updateRole = async (id, roleId) => {
  const result = await db.query(
    `UPDATE users SET role_id = $1 WHERE id = $2
     RETURNING id, email, role_id`,
    [roleId, id]
  );
  return result.rows[0] || null;
};

// Activa o desactiva un usuario
const updateStatus = async (id, isActive) => {
  const result = await db.query(
    `UPDATE users SET is_active = $1 WHERE id = $2
     RETURNING id, email, is_active`,
    [isActive, id]
  );
  return result.rows[0] || null;
};

module.exports = {
  findAll, findById, emailExists, getRoleId,
  createUser, createUserWithStaff, updateRole, updateStatus,
};
