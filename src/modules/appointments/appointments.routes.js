// src/modules/appointments/appointments.routes.js
const express = require('express');
const controller = require('./appointments.controller');
const validate = require('../../middlewares/validate.middleware');
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/rbac.middleware');
const { createAppointmentSchema, changeStatusSchema } = require('./appointments.validation');

const router = express.Router();

const ALLOWED_ROLES = ['admin', 'dentist', 'receptionist'];

router.use(authenticate);

router.get('/',    authorize(...ALLOWED_ROLES), controller.findAll);
router.get('/:id', authorize(...ALLOWED_ROLES), controller.findById);
router.post('/',   authorize(...ALLOWED_ROLES), validate(createAppointmentSchema), controller.create);
router.patch('/:id/status', authorize(...ALLOWED_ROLES), validate(changeStatusSchema), controller.changeStatus);

module.exports = router;
