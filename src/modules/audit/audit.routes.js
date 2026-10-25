// src/modules/audit/audit.routes.js
// Registro de auditoría: SOLO admin.
const express = require('express');
const controller = require('./audit.controller');
const validateQuery = require('../../middlewares/validate-query.middleware');
const authenticate = require('../../middlewares/auth.middleware');
const { perUserLimiter } = require('../../middlewares/rate-limit.middleware');
const authorize = require('../../middlewares/rbac.middleware');
const { listAuditSchema } = require('./audit.validation');

const router = express.Router();

router.use(authenticate, perUserLimiter);
router.use(authorize('admin'));

router.get('/', validateQuery(listAuditSchema), controller.list);

module.exports = router;
