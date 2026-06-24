// src/modules/appointments/appointments.validation.js
const Joi = require('joi');

const STATUSES = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];

// Crear una cita
const createAppointmentSchema = Joi.object({
  patient_id: Joi.string().uuid().required().messages({
    'string.guid': 'patient_id debe ser un UUID válido',
    'any.required': 'El paciente es obligatorio',
  }),
  staff_id: Joi.string().uuid().required().messages({
    'string.guid': 'staff_id debe ser un UUID válido',
    'any.required': 'El odontólogo es obligatorio',
  }),
  scheduled_at: Joi.date().iso().required().messages({
    'date.base': 'La fecha y hora de la cita es inválida',
    'any.required': 'La fecha y hora es obligatoria',
  }),
  // Opcional: si viene, la duración se toma del catálogo
  treatment_id: Joi.string().uuid().messages({
    'string.guid': 'treatment_id debe ser un UUID válido',
  }),
  // Opcional: duración manual (si no se usa treatment_id)
  duration_minutes: Joi.number().integer().min(15).max(480),
  reason: Joi.string().max(500),
  notes: Joi.string().max(1000),
});

// Cambiar el estado de una cita
const changeStatusSchema = Joi.object({
  status: Joi.string().valid(...STATUSES).required().messages({
    'any.only': `El estado debe ser uno de: ${STATUSES.join(', ')}`,
    'any.required': 'El estado es obligatorio',
  }),
  cancelled_reason: Joi.string().max(500),
});

module.exports = { createAppointmentSchema, changeStatusSchema };