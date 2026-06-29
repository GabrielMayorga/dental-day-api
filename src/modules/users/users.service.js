// src/modules/users/users.service.js
const repo = require('./users.repository');
const { hashPassword } = require('../../shared/utils/password.util');
const {
  BadRequestError, ConflictError, NotFoundError,
} = require('../../shared/errors/app-error');

const listUsers = async () => repo.findAll();

// Crea un usuario. Si el rol es 'dentist', crea también su ficha de staff.
const createUser = async (data) => {
  const { email, password, role, first_name, last_name, speciality, phone } = data;

  // Email único
  if (await repo.emailExists(email)) {
    throw new ConflictError('Ya existe un usuario con ese correo');
  }

  // Resolver el rol
  const roleId = await repo.getRoleId(role);
  if (!roleId) throw new BadRequestError(`Rol inválido: ${role}`);

  const passwordHash = await hashPassword(password);

  // Si es odontólogo, necesita nombre y se crea user + staff
  if (role === 'dentist') {
    if (!first_name || !last_name) {
      throw new BadRequestError('Un odontólogo requiere nombre y apellido');
    }
    return repo.createUserWithStaff({
      email, passwordHash, roleId, first_name, last_name, speciality, phone,
    });
  }

  // Otros roles: solo usuario
  return repo.createUser({ email, passwordHash, roleId });
};

const changeRole = async (id, role) => {
  const user = await repo.findById(id);
  if (!user) throw new NotFoundError('El usuario no existe');

  const roleId = await repo.getRoleId(role);
  if (!roleId) throw new BadRequestError(`Rol inválido: ${role}`);

  return repo.updateRole(id, roleId);
};

// Activa/desactiva. Un admin no puede desactivarse a sí mismo.
const changeStatus = async (id, isActive, requesterId) => {
  const user = await repo.findById(id);
  if (!user) throw new NotFoundError('El usuario no existe');

  if (id === requesterId && isActive === false) {
    throw new BadRequestError('No puedes desactivar tu propia cuenta');
  }

  return repo.updateStatus(id, isActive);
};

module.exports = { listUsers, createUser, changeRole, changeStatus };
