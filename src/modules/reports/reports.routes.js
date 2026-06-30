// src/modules/reports/reports.routes.js
const express = require('express');
const controller = require('./reports.controller');
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

// Admin y odontólogos. El servicio filtra los datos según el rol.
router.get('/dashboard',
  authorize('admin', 'dentist'),
  controller.getDashboard
);

module.exports = router;
