// src/modules/auth/auth.controller.js
const authService = require('./auth.service');
const logger = require('../../config/logger');

const login = async (req, res) => {
  const { email, password } = req.body;

  let result;
  try {
    result = await authService.login(email, password);
  } catch (err) {
    // Cada login fallido queda en el log (en el lote 3 pasa a audit_logs)
    if (err.statusCode === 401 || err.statusCode === 403) {
      logger.warn(`Login fallido — email=${email} ip=${req.ip} status=${err.statusCode}`);
    }
    throw err;
  }

  res.status(200).json({
    message: 'Inicio de sesión exitoso',
    data: result,
  });
};

module.exports = { login };
