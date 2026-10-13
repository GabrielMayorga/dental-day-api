// src/middlewares/require-password-change.middleware.js
// ============================================================
// Cambio de contraseña obligatorio. Si el usuario tiene
// must_change_password (tras un restablecimiento del admin),
// solo puede ver su perfil y cambiar su contraseña.
// La regla vive en el servidor: aunque el frontend se saltee la
// pantalla de cambio, la API no lo deja operar.
// Se usa DESPUÉS de authenticate (necesita req.user).
// ============================================================
const { ForbiddenError } = require('../shared/errors/app-error');

// Únicas rutas permitidas mientras el cambio esté pendiente
const ALLOWED = new Set([
  'GET /api/v1/auth/me',
  'PATCH /api/v1/auth/me/password',
]);

const requirePasswordChange = (req, _res, next) => {
  if (!req.user?.mustChangePassword) return next();

  // baseUrl + path = ruta completa sin query string, se use el
  // middleware con router.use() o en una ruta puntual
  const fullPath = `${req.baseUrl}${req.path}`.replace(/\/+$/, '');
  if (ALLOWED.has(`${req.method} ${fullPath}`)) return next();

  throw new ForbiddenError(
    'Debes cambiar tu contraseña antes de continuar',
    'PASSWORD_CHANGE_REQUIRED'
  );
};

module.exports = requirePasswordChange;
