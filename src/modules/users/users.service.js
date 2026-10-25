// src/modules/users/users.service.js
const repo = require('./users.repository');
const { hashPassword } = require('../../shared/utils/password.util');
const {
  BadRequestError, ConflictError, NotFoundError,
} = require('../../shared/errors/app-error');

const listUsers = async () => repo.findAll();

// Crea un usuario. Si el rol es 'dentist', crea también su ficha de staff.
const createUser = async (data) => {
  const { email, password, role, full_name, first_name, last_name, speciality, phone } = data;

  if (await repo.emailExists(email)) {
    throw new ConflictError('Ya existe un usuario con ese correo');
  }

  const roleId = await repo.getRoleId(role);
  if (!roleId) throw new BadRequestError(`Rol inválido: ${role}`);

  const passwordHash = await hashPassword(password);

  if (role === 'dentist') {
    if (!first_name || !last_name) {
      throw new BadRequestError('Un odontólogo requiere nombre y apellido');
    }
    // El nombre de la cuenta: el full_name dado, o nombre+apellido
    const fullName = full_name || `${first_name} ${last_name}`;
    return repo.createUserWithStaff({
      email, passwordHash, roleId, fullName,
      first_name, last_name, speciality, phone,
    });
  }

  // Otros roles: requieren full_name
  if (!full_name) throw new BadRequestError('El nombre es obligatorio');
  return repo.createUser({ email, passwordHash, roleId, fullName: full_name });
};

// Rechaza el cambio si el usuario es el último admin activo
const ensureNotLastActiveAdmin = async (user) => {
  if (user.role_name !== 'admin' || !user.is_active) return;
  if (await repo.countActiveAdmins() <= 1) {
    throw new BadRequestError('Debe quedar al menos un administrador activo');
  }
};

// Cambia el rol. Un admin no puede cambiar el suyo, y nunca se
// degrada al último administrador activo.
const changeRole = async (id, role, requesterId) => {
  const user = await repo.findById(id);
  if (!user) throw new NotFoundError('El usuario no existe');

  if (id === requesterId) {
    throw new BadRequestError('No puedes cambiar tu propio rol');
  }

  if (role !== 'admin') await ensureNotLastActiveAdmin(user);

  const roleId = await repo.getRoleId(role);
  if (!roleId) throw new BadRequestError(`Rol inválido: ${role}`);

  return repo.updateRole(id, roleId);
};

// Activa/desactiva. Un admin no puede desactivarse a sí mismo,
// y nunca se desactiva al último administrador activo.
const changeStatus = async (id, isActive, requesterId) => {
  const user = await repo.findById(id);
  if (!user) throw new NotFoundError('El usuario no existe');

  if (id === requesterId && isActive === false) {
    throw new BadRequestError('No puedes desactivar tu propia cuenta');
  }

  if (isActive === false) await ensureNotLastActiveAdmin(user);

  return repo.updateStatus(id, isActive);
};

module.exports = { listUsers, createUser, changeRole, changeStatus };
