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
       u.must_change_password,
       u.token_version,
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
 * Busca un usuario por su ID, incluyendo el nombre de su rol.
 */
const findById = async (id) => {
  const result = await db.query(
    `SELECT
       u.id,
       u.email,
       u.is_active,
       u.must_change_password,
       u.token_version,
       u.role_id,
       r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [id]
  );

  return result.rows[0] || null;
};

/**
 * Actualiza la fecha del último login del usuario.
 */
const updateLastLogin = async (id) => {
  await db.query(
    `UPDATE users SET last_login = NOW() WHERE id = $1`,
    [id]
  );
};

/**
 * Devuelve SOLO el hash de la contraseña de un usuario.
 * Separado de findById para que el hash no viaje en cada petición.
 */
const findPasswordHash = async (id) => {
  const result = await db.query(
    `SELECT password_hash FROM users WHERE id = $1`,
    [id]
  );

  return result.rows[0]?.password_hash ?? null;
};

/**
 * Guarda la nueva contraseña del propio usuario: quita la marca de
 * cambio obligatorio e incrementa token_version (revoca las demás
 * sesiones). Devuelve la versión nueva para firmar los tokens.
 */
const updateOwnPassword = async (id, passwordHash) => {
  const result = await db.query(
    `UPDATE users
     SET password_hash = $1,
         must_change_password = FALSE,
         token_version = token_version + 1
     WHERE id = $2
     RETURNING token_version, must_change_password`,
    [passwordHash, id]
  );

  return result.rows[0] || null;
};

module.exports = {
  findByEmail,
  findById,
  updateLastLogin,
  findPasswordHash,
  updateOwnPassword,
};
