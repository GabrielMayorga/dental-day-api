// src/modules/auth/auth.routes.js
const express = require('express');
const authController = require('./auth.controller');
const validate = require('../../middlewares/validate.middleware');
const { loginSchema } = require('./auth.validation');

// Agrega estos dos require al inicio, junto a los otros imports:
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/rbac.middleware');


const router = express.Router();

router.post('/login', validate(loginSchema), authController.login);

// Y agrega esta ruta de prueba antes de module.exports:
// GET /api/v1/auth/me — datos del usuario autenticado actual
router.get('/me', authenticate, (req, res) => {
  res.json({ message: 'Estás autenticado', user: req.user });
});

module.exports = router;
