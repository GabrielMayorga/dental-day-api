// src/modules/users/users.service.js
const db = require('../../config/database');
const repo = require('./users.repository');
const audit = require('../../shared/audit/audit.service');
const ACCIONES = require('../../shared/audit/acciones');
const { hashPassword } = require('../../shared/utils/password.util');
const {
  BadRequestError, ConflictError, NotFoundError,
} = require('../../shared/errors/app-error');

const listUsers = async () => repo.findAll();

// Crea un usuario. Si el rol es 'dentist', crea también su ficha de staff.
const createUser = async (data, req) => {
  const { email, password, role, full_name, first_name, last_name, speciality, phone } = data;

  if (await repo.emailExists(email)) {
    throw new ConflictError('Ya existe un usuario con ese correo');
  }

  const roleId = await repo.getRoleId(role);
  if (!roleId) throw new BadRequestError(`Rol inválido: ${role}`);

  if (role === 'dentist' && (!first_name || !last_name)) {
    throw new BadRequestError('Un odontólogo requiere nombre y apellido');
  }
  // Otros roles: requieren full_name
  if (role !== 'dentist' && !full_name) {
    throw new BadRequestError('El nombre es obligatorio');
  }

  // bcrypt va fuera de la transacción: es lento y no hace falta
  // tener una conexión tomada mientras calcula
  const passwordHash = await hashPassword(password);

  return db.withTransaction(async (client) => {
    let user;
    if (role === 'dentist') {
      // El nombre de la cuenta: el full_name dado, o nombre+apellido
      const fullName = full_name || `${first_name} ${last_name}`;
      user = await repo.createUserWithStaff({
        email, passwordHash, roleId, fullName,
        first_name, last_name, speciality, phone,
      }, client);
    } else {
      user = await repo.createUser({ email, passwordHash, roleId, fullName: full_name }, client);
    }

    await audit.registrar(client, {
      req, accion: ACCIONES.USUARIO_CREADO, tabla: 'users',
      registroId: user.id, despues: { ...user, role },
    });
    return user;
  });
};

// Rechaza el cambio si el usuario es el último admin activo
const ensureNotLastActiveAdmin = async (user, client) => {
  if (user.role_name !== 'admin' || !user.is_active) return;
  if (await repo.countActiveAdmins(client) <= 1) {
    throw new BadRequestError('Debe quedar al menos un administrador activo');
  }
};

// Cambia el rol. Un admin no puede cambiar el suyo, y nunca se
// degrada al último administrador activo.
const changeRole = async (id, role, req) => {
  return db.withTransaction(async (client) => {
    const user = await repo.lockById(id, client);
    if (!user) throw new NotFoundError('El usuario no existe');

    if (id === req.user.id) {
      throw new BadRequestError('No puedes cambiar tu propio rol');
    }

    if (role !== 'admin') await ensureNotLastActiveAdmin(user, client);

    const roleId = await repo.getRoleId(role);
    if (!roleId) throw new BadRequestError(`Rol inválido: ${role}`);

    const updated = await repo.updateRole(id, roleId, client);
    await audit.registrar(client, {
      req, accion: ACCIONES.USUARIO_ROL_CAMBIADO, tabla: 'users',
      registroId: id, antes: { role: user.role_name }, despues: { role },
    });
    return updated;
  });
};

// Activa/desactiva. Un admin no puede desactivarse a sí mismo,
// y nunca se desactiva al último administrador activo.
const changeStatus = async (id, isActive, req) => {
  return db.withTransaction(async (client) => {
    const user = await repo.lockById(id, client);
    if (!user) throw new NotFoundError('El usuario no existe');

    if (id === req.user.id && isActive === false) {
      throw new BadRequestError('No puedes desactivar tu propia cuenta');
    }

    if (isActive === false) await ensureNotLastActiveAdmin(user, client);

    const updated = await repo.updateStatus(id, isActive, client);
    await audit.registrar(client, {
      req, accion: ACCIONES.USUARIO_ESTADO_CAMBIADO, tabla: 'users',
      registroId: id, antes: user, despues: updated,
    });
    return updated;
  });
};

module.exports = { listUsers, createUser, changeRole, changeStatus };
