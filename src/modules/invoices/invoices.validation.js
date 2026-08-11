// src/modules/invoices/invoices.validation.js
const Joi = require('joi');

const STATUSES = ['pending', 'paid', 'cancelled', 'partial'];

const itemSchema = Joi.object({
  treatment_id: Joi.string().uuid(),
  description: Joi.string().max(300),
  quantity: Joi.number().integer().min(1).default(1),
  unit_price: Joi.number().min(0),
});

const createInvoiceSchema = Joi.object({
  patient_id: Joi.string().uuid().required().messages({
    'any.required': 'El paciente es obligatorio',
  }),
  appointment_id: Joi.string().uuid().allow(null),
  discount: Joi.number().min(0).default(0),
  notes: Joi.string().max(1000).allow('', null),
  items: Joi.array().items(itemSchema).min(1).required().messages({
    'array.min': 'La factura debe tener al menos un tratamiento',
    'any.required': 'Los tratamientos son obligatorios',
  }),
});

const changeStatusSchema = Joi.object({
  status: Joi.string().valid(...STATUSES).required().messages({
    'any.only': `El estado debe ser uno de: ${STATUSES.join(', ')}`,
  }),
});

module.exports = { createInvoiceSchema, changeStatusSchema };
