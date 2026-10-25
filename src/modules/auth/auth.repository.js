// src/modules/auth/auth.repository.js
// ============================================================
// Repositorio de autenticación: TODAS las consultas SQL
// relacionadas a usuarios para el login viven aquí.
// Ninguna lógica de negocio — solo acceso a datos.
// ============================================================
const db = require('../../config/database');

/**
 * Busca un usuario por su email, incluyendo el NOMBRE de su rol.
 */
const findByEmail = async (email) => {
  const result = await db.query(
    `SELECT
       u.id,
       u.email,
       u.password_hash,
       u.is_active,
       u.role_id,
       r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = $1`,
    [email]
  );

  return result.rows[0] || null;
};

/**
 * Busca un usuario por su ID, incluyendo el nombre de su rol y su
 * ficha de personal (staff_id), si tiene. Las reglas de acceso
 * clínico comparan staff_id: quién firma una historia, de quién
 * es una cita.
 */
const findById = async (id) => {
  const result = await db.query(
    `SELECT
       u.id,
       u.email,
       u.is_active,
       u.role_id,
       r.name AS role_name,
       s.id   AS staff_id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN staff s ON s.user_id = u.id
     WHERE u.id = $1`,
    [id]
  );

  return result.rows[0] || null;
};

/**
 * Actualiza la fecha del último login del usuario.
 */
const updateLastLogin = async (id, client = db) => {
  await client.query(
    `UPDATE users SET last_login = NOW() WHERE id = $1`,
    [id]
  );
};

module.exports = {
  findByEmail,
  findById,
  updateLastLogin,
};
