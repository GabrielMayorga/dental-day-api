// src/middlewares/auth.middleware.js
const { verifyAccessToken } = require('../shared/utils/token.util');
const authRepository = require('../modules/auth/auth.repository');
const requirePasswordChange = require('./require-password-change.middleware');
const { UnauthorizedError } = require('../shared/errors/app-error');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('No se proporcionó un token de acceso');
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw new UnauthorizedError('Token inválido o expirado');
  }

  const user = await authRepository.findById(payload.id);

  if (!user || !user.is_active) {
    throw new UnauthorizedError('La cuenta ya no está disponible');
  }

  // Ya consultamos al usuario en cada petición, así que comparar la
  // versión no cuesta nada: un restablecimiento o cambio de contraseña
  // revoca los access tokens al instante, sin esperar a que expiren.
  if (payload.tv !== user.token_version) {
    throw new UnauthorizedError('Tu sesión fue cerrada. Inicia sesión de nuevo.', 'SESSION_REVOKED');
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role_name,
    // De la base, no del token: con tv verificado ambos coinciden,
    // pero la base es la fuente de verdad
    mustChangePassword: user.must_change_password,
  };

  // Va dentro de authenticate para cubrir TODAS las rutas protegidas
  // (actuales y futuras) sin depender de que cada router lo agregue
  requirePasswordChange(req, res, next);
};

module.exports = authenticate;
