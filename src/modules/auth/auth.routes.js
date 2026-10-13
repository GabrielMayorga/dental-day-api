// src/modules/auth/auth.routes.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('./auth.controller');
const validate = require('../../middlewares/validate.middleware');
const authenticate = require('../../middlewares/auth.middleware');
const { loginSchema, refreshSchema, changePasswordSchema } = require('./auth.validation');

const router = express.Router();

// 5 intentos de cambio de contraseña cada 15 minutos POR USUARIO
// (no por IP): frena a quien tenga una sesión robada y quiera
// adivinar la contraseña actual. Va después de authenticate.
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => req.user.id,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Demasiados intentos de cambio de contraseña. Intenta en 15 minutos.',
    code: 'TOO_MANY_ATTEMPTS',
  },
});

router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);

// GET /api/v1/auth/me — datos del usuario autenticado actual
router.get('/me', authenticate, authController.me);

// PATCH /api/v1/auth/me/password — el propio usuario cambia su contraseña
router.patch(
  '/me/password',
  authenticate,
  changePasswordLimiter,
  validate(changePasswordSchema),
  authController.changeOwnPassword
);

module.exports = router;
