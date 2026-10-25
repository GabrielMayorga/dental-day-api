// src/middlewares/validate-params.middleware.js
// ============================================================
// Valida que los parámetros de ruta (:id, :patientId...) sean UUID.
// Sin esto, un id mal formado llega a PostgreSQL y termina en 500.
// ============================================================
const Joi = require('joi');
const { BadRequestError } = require('../shared/errors/app-error');

/**
 * Uso: router.get('/:id', validateParams('id'), ...)
 *
 * @param {...string} names - Los parámetros de la ruta que deben ser UUID
 * @returns {function} Un middleware de Express
 */
const validateParams = (...names) => {
  const schema = Joi.object(
    Object.fromEntries(names.map((name) => [name, Joi.string().uuid().required()]))
  ).unknown(true);

  return (req, _res, next) => {
    const { error } = schema.validate(req.params, { abortEarly: false });

    if (error) {
      const invalid = error.details.map((d) => d.path.join('.')).join(', ');
      throw new BadRequestError(`Identificador inválido: ${invalid} debe ser un UUID`);
    }

    next();
  };
};

module.exports = validateParams;
