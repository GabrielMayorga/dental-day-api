// src/modules/auth/auth.service.js
// ============================================================
// Servicio de autenticación: la LÓGICA DE NEGOCIO del login.
// Coordina el repositorio, bcrypt y JWT. No toca HTTP ni SQL
// directamente — solo orquesta las reglas del negocio.
// ============================================================
const crypto = require('crypto');
const authRepository = require('./auth.repository');
const { hashPassword, comparePassword } = require('../../shared/utils/password.util');
const {
  generateAccessToken,
  generateRefreshToken,
} = require('../../shared/utils/token.util');
const {
  UnauthorizedError,
  ForbiddenError,
} = require('../../shared/errors/app-error');

// Hash ficticio, generado al arrancar con las mismas rondas que los
// reales. Si el correo no existe comparamos contra él, para que la
// respuesta tarde lo mismo que con un correo real y el tiempo no
// delate qué correos están registrados.
const dummyHashPromise = hashPassword(crypto.randomBytes(32).toString('hex'));

/**
 * Procesa el inicio de sesión de un usuario.
 *
 * @param {string} email
 * @param {string} password - La contraseña en texto plano
 * @returns {Promise<object>} Datos del usuario + tokens
 * @throws {UnauthorizedError} Si las credenciales son inválidas
 * @throws {ForbiddenError} Si la cuenta está desactivada
 */
const login = async (email, password) => {
  // ── Paso 1: Buscar el usuario por su email ──
  const user = await authRepository.findByEmail(email);

  // ── Paso 2: Comparar la contraseña ──
  // Siempre ejecutamos bcrypt, exista o no el usuario: si no existe,
  // contra el hash ficticio (el resultado se descarta).
  let passwordMatches = false;
  if (user) {
    passwordMatches = await comparePassword(password, user.password_hash);
  } else {
    await comparePassword(password, await dummyHashPromise);
  }

  // El MISMO error para correo inexistente y contraseña mala: no
  // revelamos cuál de los dos falló (previene la enumeración).
  if (!passwordMatches) {
    throw new UnauthorizedError('Credenciales inválidas');
  }

  // ── Paso 3: Verificar que la cuenta esté activa ──
  // Solo se revela con la contraseña correcta: quien no la conoce
  // no puede saber si una cuenta existe y está desactivada.
  if (!user.is_active) {
    throw new ForbiddenError('Tu cuenta está desactivada. Comunícate con la administración');
  }

  // ── Paso 4: Generar los tokens ──
  // El payload lleva solo lo necesario: id y rol (nada sensible).
  const payload = { id: user.id, role: user.role_name };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({ id: user.id });

  // Actualizamos la fecha del último login (dato de auditoría)
  await authRepository.updateLastLogin(user.id);

  // ── Devolvemos los datos del usuario (SIN el hash) + los tokens ──
  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role_name,
    },
    accessToken,
    refreshToken,
  };
};

module.exports = { login };