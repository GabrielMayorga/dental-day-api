// src/middlewares/rate-limit.middleware.js
// ============================================================
// Limitadores de peticiones (express-rate-limit).
//
// ALMACÉN: todos usan el almacén EN MEMORIA por defecto. Sirve
// porque la API corre en una sola instancia en Render, pero los
// contadores se reinician si el servicio se reinicia o se duerme.
// Con varias instancias cada una llevaría su propia cuenta y los
// límites reales se multiplicarían: haría falta un almacén
// compartido como Redis (rate-limit-redis).
// ============================================================
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { rateLimit: limits } = require('../config/env');

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// Cabeceras estándar (RateLimit, RateLimit-Policy) y sin las X-RateLimit-*
const baseOptions = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
};

const TOO_MANY_REQUESTS = { error: 'Demasiadas solicitudes. Espera un momento.' };
const TOO_MANY_LOGINS = { error: 'Demasiados intentos. Intenta de nuevo más tarde.' };

// ── Freno por IP (global) ────────────────
// Va antes de las rutas. Es holgado a propósito: en una clínica
// varios equipos pueden salir por la misma IP pública.
// El keyGenerator por defecto ya aplica ipKeyGenerator (IPv6).
const ipLimiter = rateLimit({
  ...baseOptions,
  windowMs: FIFTEEN_MINUTES,
  limit: limits.ipMax,
  message: TOO_MANY_REQUESTS,
});

// ── Límite por usuario autenticado ───────
// Debe ir DESPUÉS de authenticate (necesita req.user).
const perUserLimiter = rateLimit({
  ...baseOptions,
  windowMs: FIFTEEN_MINUTES,
  limit: limits.userMax,
  message: TOO_MANY_REQUESTS,
  keyGenerator: (req) => (req.user ? req.user.id : ipKeyGenerator(req.ip)),
  // Una petición a /patients/:patientId/records pasa primero por el
  // router de pacientes y luego por el de expedientes, y ambos montan
  // este limitador: solo contamos la primera vez.
  skip: (req) => {
    if (req.userRateLimitCounted) return true;
    req.userRateLimitCounted = true;
    return false;
  },
});

// ── Login ────────────────────────────────
// Solo cuentan los fallos (skipSuccessfulRequests). La respuesta 429
// es la misma exista o no el correo.
const loginEmail = (req) => {
  const email = req.body && req.body.email;
  return typeof email === 'string' && email.trim() !== ''
    ? email.trim().toLowerCase()
    : null;
};

// a) Por IP + correo: frena a quien prueba contraseñas desde una IP
const loginIpEmailLimiter = rateLimit({
  ...baseOptions,
  windowMs: FIFTEEN_MINUTES,
  limit: limits.loginMaxPerIpEmail,
  skipSuccessfulRequests: true,
  message: TOO_MANY_LOGINS,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip);
    const email = loginEmail(req);
    return email ? `${ip}:${email}` : ip;
  },
});

// b) Por correo: frena ataques distribuidos contra una misma cuenta
const loginEmailLimiter = rateLimit({
  ...baseOptions,
  windowMs: ONE_HOUR,
  limit: limits.loginMaxPerEmail,
  skipSuccessfulRequests: true,
  message: TOO_MANY_LOGINS,
  keyGenerator: (req) => loginEmail(req) || ipKeyGenerator(req.ip),
});

const loginLimiters = [loginIpEmailLimiter, loginEmailLimiter];

module.exports = { ipLimiter, perUserLimiter, loginLimiters };
