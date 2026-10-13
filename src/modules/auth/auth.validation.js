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

const refreshSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'string.empty': 'El refresh token es obligatorio',
      'any.required': 'El refresh token es obligatorio',
    }),
});

// Ningún mensaje repite el valor recibido: las contraseñas no deben
// aparecer en respuestas ni en logs.
const changePasswordSchema = Joi.object({
  current_password: Joi.string()
    .required()
    .messages({
      'string.empty': 'La contraseña actual es obligatoria',
      'any.required': 'La contraseña actual es obligatoria',
    }),

  new_password: Joi.string()
    .min(10)
    // bcrypt ignora todo lo que pase de 72 bytes
    .max(72)
    .invalid(Joi.ref('current_password'))
    .custom((value, helpers) => {
      const email = helpers.prefs.context?.user?.email;
      if (email && value.toLowerCase() === email.toLowerCase()) {
        return helpers.error('password.email');
      }
      return value;
    })
    .required()
    .messages({
      'string.min': 'La nueva contraseña debe tener al menos 10 caracteres',
      'string.max': 'La nueva contraseña no puede superar los 72 caracteres',
      'any.invalid': 'La nueva contraseña debe ser distinta de la actual',
      'password.email': 'La nueva contraseña no puede ser tu correo',
      'string.empty': 'La nueva contraseña es obligatoria',
      'any.required': 'La nueva contraseña es obligatoria',
    }),
});

module.exports = { loginSchema, refreshSchema, changePasswordSchema };
