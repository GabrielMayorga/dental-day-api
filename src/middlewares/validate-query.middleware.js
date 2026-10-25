// src/middlewares/validate-query.middleware.js
// ============================================================
// Valida la query string (?a=1&b=2) con un esquema Joi.
// A diferencia de validate (body), rechaza los parámetros
// desconocidos: un filtro mal escrito no debe ignorarse en
// silencio y devolver resultados sin filtrar.
// ============================================================
const { BadRequestError } = require('../shared/errors/app-error');

const validateQuery = (schema) => {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });

    if (error) {
      const message = error.details.map((d) => d.message).join('. ');
      throw new BadRequestError(message);
    }

    req.query = value;
    next();
  };
};

module.exports = validateQuery;
