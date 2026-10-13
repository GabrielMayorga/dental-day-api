// src/modules/users/users.service.js
const repo = require('./users.repository');
const { hashPassword, generateTemporaryPassword } = require('../../shared/utils/password.util');
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

// Restablece la contraseña de otro usuario. El servidor genera la
// temporal (el admin no la elige, así no hay temporales débiles) y
// la devuelve UNA sola vez: no se guarda en texto plano ni se loguea.
const resetPassword = async (id, requesterId) => {
  if (id === requesterId) {
    throw new BadRequestError('Usa Cambiar contraseña en tu perfil');
  }

  const user = await repo.findById(id);
  if (!user) throw new NotFoundError('El usuario no existe');

  if (!user.is_active) {
    throw new BadRequestError('No se puede restablecer la contraseña de un usuario inactivo');
  }

  const temporaryPassword = generateTemporaryPassword(12);
  const passwordHash = await hashPassword(temporaryPassword);
  await repo.resetPassword(id, passwordHash);

  return { temporary_password: temporaryPassword };
};

module.exports = { listUsers, createUser, changeRole, changeStatus, resetPassword };
