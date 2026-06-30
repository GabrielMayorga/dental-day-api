// src/modules/users/users.validation.js
const Joi = require('joi');

const ROLES = ['admin', 'dentist', 'receptionist'];

const createUserSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'El correo no es válido',
    'any.required': 'El correo es obligatorio',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'La contraseña debe tener al menos 8 caracteres',
    'any.required': 'La contraseña es obligatoria',
  }),
  role: Joi.string().valid(...ROLES).required().messages({
    'any.only': `El rol debe ser uno de: ${ROLES.join(', ')}`,
    'any.required': 'El rol es obligatorio',
  }),
  full_name: Joi.string().max(150),
  // Datos de staff (obligatorios solo si role === 'dentist', validado en el servicio)
  first_name: Joi.string().max(100),
  last_name: Joi.string().max(100),
  speciality: Joi.string().max(150).allow('', null),
  phone: Joi.string().max(25).allow('', null),
});

const changeRoleSchema = Joi.object({
  role: Joi.string().valid(...ROLES).required().messages({
    'any.only': `El rol debe ser uno de: ${ROLES.join(', ')}`,
    'any.required': 'El rol es obligatorio',
  }),
});

const changeStatusSchema = Joi.object({
  is_active: Joi.boolean().required().messages({
    'any.required': 'is_active es obligatorio',
    'boolean.base': 'is_active debe ser verdadero o falso',
  }),
});

module.exports = { createUserSchema, changeRoleSchema, changeStatusSchema };
