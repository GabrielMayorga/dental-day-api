// src/modules/auth/auth.service.js
// ============================================================
// Servicio de autenticación: la LÓGICA DE NEGOCIO del login.
// Coordina el repositorio, bcrypt y JWT. No toca HTTP ni SQL
// directamente — solo orquesta las reglas del negocio.
// ============================================================
const authRepository = require('./auth.repository');
const { comparePassword } = require('../../shared/utils/password.util');
const {
  generateAccessToken,
  generateRefreshToken,
} = require('../../shared/utils/token.util');
const {
  UnauthorizedError,
  ForbiddenError,
} = require('../../shared/errors/app-error');

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

  // Si no existe, lanzamos el MISMO error que para contraseña mala.
  // No revelamos si el problema fue el email o la contraseña
  // (previene la enumeración de usuarios).
  if (!user) {
    throw new UnauthorizedError('Credenciales inválidas');
  }

  // ── Paso 2: Verificar que la cuenta esté activa ──
  // Aquí sí distinguimos: una cuenta desactivada es un caso legítimo
  // (el admin la suspendió), por eso usamos 403, no 401.
  if (!user.is_active) {
    throw new ForbiddenError('Tu cuenta está desactivada. Contacta al administrador.');
  }

  // ── Paso 3: Comparar la contraseña con el hash guardado ──
  const passwordMatches = await comparePassword(password, user.password_hash);

  if (!passwordMatches) {
    throw new UnauthorizedError('Credenciales inválidas');
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