// src/modules/audit/audit.validation.js
const Joi = require('joi');
const ACCIONES = require('../../shared/audit/acciones');

const LISTA_ACCIONES = Object.values(ACCIONES);

// Fechas ISO locales (YYYY-MM-DD o YYYY-MM-DDTHH:mm[:ss]) en hora de
// la clínica, como en reportes. Se rechazan fechas que no existen
// (2026-02-30, 25:00). Se devuelve el texto tal cual: la conversión a
// instante se hace en SQL con la zona de la clínica.
const ISO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/;

const fechaExiste = (value, helpers) => {
  const [y, mo, d, h = 0, mi = 0, s = 0] = value.match(ISO_LOCAL).slice(1).map((v) => Number(v ?? 0));
  const date = new Date(y, mo - 1, d, h, mi, s);
  const valid = date.getFullYear() === y && date.getMonth() === mo - 1
    && date.getDate() === d && date.getHours() === h
    && date.getMinutes() === mi && date.getSeconds() === s;
  return valid ? value : helpers.error('any.invalid');
};

const fechaLocal = (nombre) =>
  Joi.string().pattern(ISO_LOCAL).custom(fechaExiste).messages({
    'string.pattern.base': `${nombre} debe tener el formato YYYY-MM-DD o YYYY-MM-DDTHH:mm`,
    'any.invalid': `${nombre} no es una fecha válida`,
  });

// Completa la hora para poder comparar dos fechas como texto
const normalizar = (fecha) => (fecha.length === 10 ? `${fecha}T00:00:00` : fecha.padEnd(19, ':00'));

const listAuditSchema = Joi.object({
  usuario: Joi.string().uuid().messages({
    'string.guid': 'usuario debe ser un UUID válido',
  }),
  accion: Joi.string().valid(...LISTA_ACCIONES).messages({
    'any.only': `accion debe ser una de: ${LISTA_ACCIONES.join(', ')}`,
  }),
  tabla: Joi.string().max(100),
  registroId: Joi.string().uuid().messages({
    'string.guid': 'registroId debe ser un UUID válido',
  }),
  // from incluido, to excluido (created_at >= from AND < to)
  from: fechaLocal('from'),
  to: fechaLocal('to'),
  page: Joi.number().integer().min(1).max(100000).default(1).messages({
    'number.base': 'page debe ser un número',
    'number.integer': 'page debe ser un número entero',
    'number.min': 'page debe ser 1 o mayor',
    'number.max': 'page no puede superar 100000',
  }),
}).custom((value, helpers) => {
  if (value.from && value.to && normalizar(value.from) >= normalizar(value.to)) {
    return helpers.message('from debe ser anterior a to');
  }
  return value;
});

module.exports = { listAuditSchema };
