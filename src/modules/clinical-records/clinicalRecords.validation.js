// src/modules/clinical-records/clinicalRecords.validation.js
const Joi = require('joi');

const createRecordSchema = Joi.object({
  staff_id: Joi.string().uuid().required().messages({
    'string.guid': 'staff_id debe ser un UUID válido',
    'any.required': 'El odontólogo es obligatorio',
  }),
  appointment_id: Joi.string().uuid().allow(null).messages({
    'string.guid': 'appointment_id debe ser un UUID válido',
  }),
  chief_complaint: Joi.string().max(1000).allow('', null),
  diagnosis: Joi.string().max(2000).allow('', null),
  treatment_plan: Joi.string().max(2000).allow('', null),
  notes: Joi.string().max(2000).allow('', null),
}).min(1);

const updateRecordSchema = Joi.object({
  chief_complaint: Joi.string().max(1000).allow('', null),
  diagnosis: Joi.string().max(2000).allow('', null),
  treatment_plan: Joi.string().max(2000).allow('', null),
  notes: Joi.string().max(2000).allow('', null),
}).min(1).messages({
  'object.min': 'Debes enviar al menos un campo para actualizar',
});

module.exports = { createRecordSchema, updateRecordSchema };
