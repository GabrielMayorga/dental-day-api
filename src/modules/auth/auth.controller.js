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

const refresh = async (req, res) => {
  const tokens = await authService.refresh(req.body.refreshToken);

  res.status(200).json({
    message: 'Sesión renovada',
    data: tokens,
  });
};

const me = (req, res) => {
  const { id, email, role, mustChangePassword } = req.user;

  res.json({
    message: 'Estás autenticado',
    user: { id, email, role, must_change_password: mustChangePassword },
  });
};

const changeOwnPassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  const tokens = await authService.changeOwnPassword(req.user, current_password, new_password);

  res.status(200).json({
    message: 'Contraseña actualizada. Se cerraron tus demás sesiones.',
    data: tokens,
  });
};

module.exports = { login, refresh, me, changeOwnPassword };
