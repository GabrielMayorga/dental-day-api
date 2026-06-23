// src/middlewares/rbac.middleware.js
const { ForbiddenError } = require('../shared/errors/app-error');

const authorize = (...allowedRoles) => {
  return (req, _res, next) => {
    if (!req.user) {
      throw new ForbiddenError('Acceso denegado');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError('No tienes permiso para realizar esta acción');
    }

    next();
  };
};

module.exports = authorize;
