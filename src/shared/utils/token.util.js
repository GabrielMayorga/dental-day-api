// src/shared/utils/token.util.js
// ============================================================
// Utilidades para generar y verificar tokens JWT.
// Responsabilidad única: todo lo relacionado a tokens vive aquí.
// ============================================================
const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../../config/env');

/**
 * Genera un ACCESS TOKEN (de vida corta, ~15 min).
 * Es el que el usuario envía en cada petición protegida.
 *
 * @param {object} payload - Datos a incluir, ej: { id, role }
 * @returns {string} El token JWT firmado
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,   // ej: '15m'
  });
};

/**
 * Genera un REFRESH TOKEN (de vida larga, ~7 días).
 * Sirve para pedir un nuevo access token sin volver a hacer login.
 * Se firma con un SECRETO DIFERENTE al del access token, por seguridad.
 *
 * @param {object} payload - Datos a incluir, ej: { id }
 * @returns {string} El refresh token firmado
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpiresIn,   // ej: '7d'
  });
};

/**
 * Verifica un ACCESS TOKEN.
 * Si el token es válido, devuelve su payload decodificado.
 * Si está alterado, expirado o es falso, lanza un error (lo capturamos arriba).
 *
 * @param {string} token - El token a verificar
 * @returns {object} El payload decodificado, ej: { id, role, iat, exp }
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, jwtConfig.secret);
};

/**
 * Verifica un REFRESH TOKEN (con su secreto correspondiente).
 *
 * @param {string} token - El refresh token a verificar
 * @returns {object} El payload decodificado
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, jwtConfig.refreshSecret);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};