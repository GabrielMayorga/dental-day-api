// src/modules/clinical-records/clinicalRecords.validation.js
const Joi = require('joi');

const createRecordSchema = Joi.object({
  // Opcional aquí: el servicio decide según el rol. Un odontólogo
  // firma siempre con su propia ficha; el admin debe indicarla.
  staff_id: Joi.string().uuid().messages({
    'string.guid': 'staff_id debe ser un UUID válido',
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
