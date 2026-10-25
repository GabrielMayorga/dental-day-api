// src/modules/notifications/notifications.routes.js
const express = require('express');
const controller = require('./notifications.controller');
const authenticate = require('../../middlewares/auth.middleware');
const { perUserLimiter } = require('../../middlewares/rate-limit.middleware');
const authorize = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate, perUserLimiter);

// Los tres roles operativos pueden ver recordatorios de citas.
router.get('/',
  authorize('admin', 'dentist', 'receptionist'),
  controller.getUpcoming
);

module.exports = router;
