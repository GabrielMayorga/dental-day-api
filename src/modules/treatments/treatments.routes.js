// src/modules/treatments/treatments.routes.js
const express = require('express');
const controller = require('./treatments.controller');
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/',
  authorize('admin', 'dentist', 'receptionist'),
  controller.listTreatments
);

module.exports = router;
