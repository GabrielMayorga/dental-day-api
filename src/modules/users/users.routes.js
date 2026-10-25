// src/modules/users/users.routes.js
// Gestión de usuarios: SOLO admin.
const express = require('express');
const controller = require('./users.controller');
const validate = require('../../middlewares/validate.middleware');
const validateParams = require('../../middlewares/validate-params.middleware');
const authenticate = require('../../middlewares/auth.middleware');
const { perUserLimiter } = require('../../middlewares/rate-limit.middleware');
const authorize = require('../../middlewares/rbac.middleware');
const {
  createUserSchema, changeRoleSchema, changeStatusSchema,
} = require('./users.validation');

const router = express.Router();

router.use(authenticate, perUserLimiter);
router.use(authorize('admin'));  // todo el módulo es solo para admin

router.get('/', controller.list);
router.post('/', validate(createUserSchema), controller.create);
router.patch('/:id/role', validateParams('id'), validate(changeRoleSchema), controller.changeRole);
router.patch('/:id/status', validateParams('id'), validate(changeStatusSchema), controller.changeStatus);

module.exports = router;
