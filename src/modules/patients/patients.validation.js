// src/modules/patients/patients.validation.js
const Joi = require('joi');

const GENDERS     = ['male', 'female', 'other', 'prefer_not_to_say'];
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'];

const baseFields = {
  first_name: Joi.string().max(100),
  last_name:  Joi.string().max(100),
  birth_date: Joi.date().iso().max('now').messages({
    'date.max': 'La fecha de nacimiento no puede ser futura',
  }),
  gender:     Joi.string().valid(...GENDERS).messages({
    'any.only': `El género debe ser uno de: ${GENDERS.join(', ')}`,
  }),
  phone:                   Joi.string().max(25),
  address:                 Joi.string().max(500),
  city:                    Joi.string().max(100),
  emergency_contact_name:  Joi.string().max(200),
  emergency_contact_phone: Joi.string().max(25),
  blood_type: Joi.string().valid(...BLOOD_TYPES).messages({
    'any.only': `El tipo de sangre debe ser uno de: ${BLOOD_TYPES.join(', ')}`,
  }),
  allergies: Joi.string(),
  notes:     Joi.string(),
};

const createPatientSchema = Joi.object({
  ...baseFields,
  first_name: baseFields.first_name.required().messages({
    'string.empty': 'El nombre es obligatorio',
    'any.required': 'El nombre es obligatorio',
  }),
  last_name: baseFields.last_name.required().messages({
    'string.empty': 'El apellido es obligatorio',
    'any.required': 'El apellido es obligatorio',
  }),
});

const updatePatientSchema = Joi.object(baseFields).min(1).messages({
  'object.min': 'Debes enviar al menos un campo para actualizar',
});

module.exports = { createPatientSchema, updatePatientSchema };
