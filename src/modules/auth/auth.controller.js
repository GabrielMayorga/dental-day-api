// src/modules/auth/auth.controller.js
const authService = require('./auth.service');

const login = async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);

  res.status(200).json({
    message: 'Inicio de sesión exitoso',
    data: result,
  });
};

module.exports = { login };
