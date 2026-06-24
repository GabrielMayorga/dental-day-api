// src/modules/patients/patients.routes.js
const express = require('express');
const patientsController = require('./patients.controller');
const validate    = require('../../middlewares/validate.middleware');
const authenticate = require('../../middlewares/auth.middleware');
const authorize    = require('../../middlewares/rbac.middleware');
const { createPatientSchema, updatePatientSchema } = require('./patients.validation');

const router = express.Router();

const ALLOWED_ROLES = ['admin', 'dentist', 'receptionist'];

router.use(authenticate);

router.get('/',    authorize(...ALLOWED_ROLES), patientsController.findAll);
router.get('/:id', authorize(...ALLOWED_ROLES), patientsController.findById);
router.post('/',   authorize(...ALLOWED_ROLES), validate(createPatientSchema), patientsController.create);
router.patch('/:id', authorize(...ALLOWED_ROLES), validate(updatePatientSchema), patientsController.update);
router.delete('/:id', authorize(...ALLOWED_ROLES), patientsController.softDelete);

module.exports = router;
