// src/modules/auth/auth.service.js
// ============================================================
// Servicio de autenticación: la LÓGICA DE NEGOCIO del login.
// Coordina el repositorio, bcrypt y JWT. No toca HTTP ni SQL
// directamente — solo orquesta las reglas del negocio.
// ============================================================
const authRepository = require('./auth.repository');
const { comparePassword, hashPassword } = require('../../shared/utils/password.util');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../../shared/utils/token.util');
const {
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
} = require('../../shared/errors/app-error');

/**
 * Firma el par de tokens de un usuario.
 * Ambos llevan:
 *   - tv  (token_version): si no coincide con la base, la sesión fue revocada
 *   - mcp (must_change_password): el frontend sabe si mostrar la pantalla
 *         de cambio; el servidor igual lo hace cumplir por su cuenta
 */
const issueTokens = ({ id, role, tokenVersion, mustChangePassword }) => {
  const claims = { tv: tokenVersion, mcp: mustChangePassword };

  return {
    accessToken: generateAccessToken({ id, role, ...claims }),
    refreshToken: generateRefreshToken({ id, ...claims }),
  };
};

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
  // El payload lleva solo lo necesario: id, rol y versión (nada sensible).
  const { accessToken, refreshToken } = issueTokens({
    id: user.id,
    role: user.role_name,
    tokenVersion: user.token_version,
    mustChangePassword: user.must_change_password,
  });

  // Actualizamos la fecha del último login (dato de auditoría)
  await authRepository.updateLastLogin(user.id);

  // ── Devolvemos los datos del usuario (SIN el hash) + los tokens ──
  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role_name,
      must_change_password: user.must_change_password,
    },
    accessToken,
    refreshToken,
  };
};

/**
 * Canjea un refresh token por un par de tokens nuevo.
 *
 * @throws {UnauthorizedError} Token inválido, cuenta no disponible, o
 *         sesión revocada (code SESSION_REVOKED) si token_version cambió
 */
const refresh = async (refreshToken) => {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw new UnauthorizedError('Refresh token inválido o expirado');
  }

  const user = await authRepository.findById(payload.id);

  if (!user || !user.is_active) {
    throw new UnauthorizedError('La cuenta ya no está disponible');
  }

  // Tras un restablecimiento o cambio de contraseña, token_version
  // aumentó: los refresh tokens viejos ya no sirven
  if (payload.tv !== user.token_version) {
    throw new UnauthorizedError('Tu sesión fue cerrada. Inicia sesión de nuevo.', 'SESSION_REVOKED');
  }

  return issueTokens({
    id: user.id,
    role: user.role_name,
    tokenVersion: user.token_version,
    mustChangePassword: user.must_change_password,
  });
};

/**
 * Cambia la contraseña del propio usuario.
 * Revoca todas sus demás sesiones y devuelve tokens nuevos para
 * que la sesión actual continúe.
 *
 * @param {object} user - req.user ({ id, role })
 * @throws {BadRequestError} Si la contraseña actual no es correcta
 */
const changeOwnPassword = async (user, currentPassword, newPassword) => {
  const passwordHash = await authRepository.findPasswordHash(user.id);
  if (!passwordHash) {
    throw new UnauthorizedError('La cuenta ya no está disponible');
  }

  const matches = await comparePassword(currentPassword, passwordHash);
  if (!matches) {
    throw new BadRequestError('La contraseña actual no es correcta');
  }

  const newHash = await hashPassword(newPassword);
  const updated = await authRepository.updateOwnPassword(user.id, newHash);

  return issueTokens({
    id: user.id,
    role: user.role,
    tokenVersion: updated.token_version,
    mustChangePassword: updated.must_change_password,
  });
};

module.exports = { login, refresh, changeOwnPassword };
