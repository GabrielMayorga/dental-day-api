// src/shared/utils/password.util.js
// ============================================================
// Utilidades para hashear y verificar contraseñas con bcrypt.
// Responsabilidad única: todo lo relacionado a contraseñas
// vive aquí, aislado del resto de la lógica.
// ============================================================
const bcrypt = require('bcryptjs');
const { bcryptRounds } = require('../../config/env');

/**
 * Convierte una contraseña en texto plano a un hash seguro.
 * Se usa al CREAR un usuario o al cambiar su contraseña.
 *
 * @param {string} plainPassword - La contraseña tal como la escribió el usuario
 * @returns {Promise<string>} El hash listo para guardar en la columna password_hash
 */
const hashPassword = async (plainPassword) => {
  // bcrypt.hash genera el salt automáticamente y lo incluye en el resultado
  return bcrypt.hash(plainPassword, bcryptRounds);
};

/**
 * Compara una contraseña en texto plano contra un hash guardado.
 * Se usa al hacer LOGIN.
 *
 * @param {string} plainPassword - Lo que el usuario escribió al intentar entrar
 * @param {string} hashedPassword - El hash que tenemos guardado en la BD
 * @returns {Promise<boolean>} true si coinciden, false si no
 */
const comparePassword = async (plainPassword, hashedPassword) => {
  // bcrypt extrae el salt del hash guardado y rehashea la clave
  // para compararlas — todo de forma segura
  return bcrypt.compare(plainPassword, hashedPassword);
};

module.exports = { hashPassword, comparePassword };