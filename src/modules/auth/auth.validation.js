// src/modules/auth/auth.validation.js
const Joi = require('joi');

const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'El email no tiene un formato válido',
      'string.empty': 'El email es obligatorio',
      'any.required': 'El email es obligatorio',
    }),

  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'La contraseña es obligatoria',
      'any.required': 'La contraseña es obligatoria',
    }),
});

module.exports = { loginSchema };
