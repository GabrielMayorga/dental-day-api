// src/middlewares/validate.middleware.js
const { BadRequestError } = require('../shared/errors/app-error');

const validate = (schema) => {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
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
