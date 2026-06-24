// src/middlewares/rbac.middleware.js
// ============================================================
// Middleware de AUTORIZACIÓN (RBAC - Role-Based Access Control).
// Verifica que el rol del usuario esté permitido para la ruta.
// Responde la pregunta: "¿puedes hacer esto?"
// ============================================================
const { ForbiddenError } = require('../shared/errors/app-error');

/**
 * Crea un middleware que solo permite el paso a ciertos roles.
 * Se usa DESPUÉS de authenticate (necesita que req.user ya exista).
 *
 * Uso en una ruta:
 *   router.post('/users', authenticate, authorize('admin'), controller.create)
 *   router.get('/agenda', authenticate, authorize('admin', 'dentist'), ...)
 *
 * @param {...string} allowedRoles - Los roles que tienen permiso
 * @returns {function} Un middleware de Express
 */
const authorize = (...allowedRoles) => {
  return (req, _res, next) => {
    // req.user fue puesto por el middleware authenticate.
    // Si no existe, es un error de programación (olvidamos authenticate antes).
    if (!req.user) {
      throw new ForbiddenError('Acceso denegado');
    }

    // ¿El rol del usuario está en la lista de permitidos?
    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        'No tienes permiso para realizar esta acción'
      );
    }

    next(); // El rol está permitido, continúa
  };
};

module.exports = authorize;