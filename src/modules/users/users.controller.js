// src/modules/users/users.controller.js
const service = require('./users.service');

const list = async (_req, res) => {
  const users = await service.listUsers();
  res.json({ data: users });
};

const create = async (req, res) => {
  const user = await service.createUser(req.body);
  res.status(201).json({ message: 'Usuario creado', data: user });
};

const changeRole = async (req, res) => {
  const user = await service.changeRole(req.params.id, req.body.role);
  res.json({ message: 'Rol actualizado', data: user });
};

const changeStatus = async (req, res) => {
  // req.user.id es quien hace la petición (para la auto-protección)
  const user = await service.changeStatus(req.params.id, req.body.is_active, req.user.id);
  res.json({ message: 'Estado actualizado', data: user });
};

const resetPassword = async (req, res) => {
  const result = await service.resetPassword(req.params.id, req.user.id);
  // La respuesta lleva una contraseña: que ningún proxy ni navegador la guarde
  res.set('Cache-Control', 'no-store');
  res.json({
    message: 'Contraseña restablecida. Entrégala al usuario: no se volverá a mostrar.',
    data: result,
  });
};

module.exports = { list, create, changeRole, changeStatus, resetPassword };
