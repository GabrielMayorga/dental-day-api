// src/config/env.js
// ============================================================
// Valida las variables de entorno ANTES de que el resto del
// código las use. Si falta algo importante, el servidor no
// arranca — mejor fallar aquí que tener un bug raro después.
// ============================================================
const Joi = require('joi');

const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number()
    .integer()
    .min(1024)
    .max(65535)
    .default(4000),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),

  JWT_SECRET: Joi.string()
    .min(32)
    .required(),

  JWT_EXPIRES_IN: Joi.string().default('15m'),

  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .required(),

  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  BCRYPT_ROUNDS: Joi.number().integer().min(10).max(15).default(12),

  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
})
  .unknown(true) // Ignora otras variables del sistema operativo que no nos interesan
  .required();

// Validamos process.env apenas se importa este archivo
const { error, value: env } = envSchema.validate(process.env);

if (error) {
  throw new Error(
    `\n❌ Error de configuración de entorno:\n${error.message}\n` +
    `👉 Revisa tu archivo .env (¿copiaste .env.example?)\n`
  );
}

// Exportamos un objeto limpio y organizado, en vez de usar
// process.env.JWT_SECRET por todo el código
module.exports = {
  env: env.NODE_ENV,
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  bcryptRounds: env.BCRYPT_ROUNDS,
  corsOrigin: env.CORS_ORIGIN,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
};
