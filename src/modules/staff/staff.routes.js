// src/modules/staff/staff.routes.js
const express = require('express');
const controller = require('./staff.controller');
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/dentists',
  authorize('admin', 'dentist', 'receptionist'),
  controller.listDentists
);

module.exports = router;
