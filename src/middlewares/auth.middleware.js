// src/middlewares/auth.middleware.js
const { verifyAccessToken } = require('../shared/utils/token.util');
const authRepository = require('../modules/auth/auth.repository');
const { UnauthorizedError } = require('../shared/errors/app-error');

const authenticate = async (req, _res, next) => {
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

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role_name,
  };

  next();
};

module.exports = authenticate;
