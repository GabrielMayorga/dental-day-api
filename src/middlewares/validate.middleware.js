// src/middlewares/validate.middleware.js
const { BadRequestError } = require('../shared/errors/app-error');

const validate = (schema) => {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      // Los esquemas pueden referirse al usuario autenticado como $user
      // (ej: la nueva contraseña no puede ser su correo)
      context: { user: req.user },
    });

    if (error) {
      const message = error.details.map((d) => d.message).join('. ');
      throw new BadRequestError(message);
    }

    req.body = value;
    next();
  };
};

module.exports = validate;
