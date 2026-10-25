// src/modules/patients/patients.routes.js
const express = require('express');
const patientsController = require('./patients.controller');
const validate    = require('../../middlewares/validate.middleware');
const validateParams = require('../../middlewares/validate-params.middleware');
const authenticate = require('../../middlewares/auth.middleware');
const { perUserLimiter } = require('../../middlewares/rate-limit.middleware');
const authorize    = require('../../middlewares/rbac.middleware');
const {
  createPatientSchema,
  updatePatientSchema,
  createPatientContactSchema,
  updatePatientContactSchema,
} = require('./patients.validation');

const router = express.Router();

const ALLOWED_ROLES = ['admin', 'dentist', 'receptionist'];

// Recepción valida contra el esquema sin campos médicos
const validateByRole = (schema, contactSchema) => {
  const full = validate(schema);
  const contact = validate(contactSchema);
  return (req, res, next) =>
    (req.user.role === 'receptionist' ? contact : full)(req, res, next);
};

router.use(authenticate, perUserLimiter);

router.get('/',    authorize(...ALLOWED_ROLES), patientsController.findAll);
router.get('/:id', authorize(...ALLOWED_ROLES), validateParams('id'), patientsController.findById);
router.post('/',   authorize(...ALLOWED_ROLES), validateByRole(createPatientSchema, createPatientContactSchema), patientsController.create);
router.patch('/:id', authorize(...ALLOWED_ROLES), validateParams('id'), validateByRole(updatePatientSchema, updatePatientContactSchema), patientsController.update);
// Desactivar un paciente: solo admin
router.delete('/:id', authorize('admin'), validateParams('id'), patientsController.softDelete);

module.exports = router;
