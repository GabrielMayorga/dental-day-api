// src/app.js
// ============================================================
// Punto de entrada del servidor.
// ============================================================
require('dotenv').config();        // Carga el archivo .env — debe ir PRIMERO
require('express-async-errors');   // Permite usar async/await sin try/catch repetido

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { port, corsOrigin, isDev } = require('./config/env');
const db = require('./config/database');
const logger = require('./config/logger');

const app = express();

// ── SEGURIDAD ────────────────────────────
app.use(helmet()); // Agrega cabeceras HTTP de seguridad automáticamente

app.use(cors({
  origin: corsOrigin,           // Solo tu frontend puede llamar a esta API
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
}));

// Límite global: máx. 100 peticiones por IP cada 15 minutos
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas peticiones. Intenta en 15 minutos.' },
});
app.use(globalLimiter);

// ── PARSEO DE PETICIONES ─────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Log de cada petición (solo mientras programas)
if (isDev) {
  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });
}

// ── RUTAS ─────────────────────────────────

// Ruta de salud: para confirmar que el servidor y la BD están vivos
app.get('/health', async (_req, res) => {
  const dbInfo = await db.healthCheck();
  res.json({
    status: 'ok',
    service: 'Dental Day API',
    time: dbInfo.time,
    db: dbInfo.pg_version.split(' ').slice(0, 2).join(' '),
  });
});

// 👉 Aquí montaremos cada módulo en los próximos sprints:
// app.use('/api/v1/auth', require('./modules/auth/auth.routes'));

// ── MANEJO DE ERRORES ────────────────────
app.use((err, req, res, _next) => {
  logger.error(`${err.status || 500} — ${err.message}`);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    ...(isDev && { stack: err.stack }),
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ── ARRANQUE ──────────────────────────────
const start = async () => {
  try {
    const dbInfo = await db.healthCheck();
    logger.info(`✅ Base de datos conectada — ${dbInfo.pg_version.split(',')[0]}`);

    app.listen(port, () => {
      logger.info(`🚀 Servidor corriendo en http://localhost:${port}`);
    });
  } catch (err) {
    logger.error('❌ No se pudo conectar a la base de datos:', err.message);
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  await db.close();
  process.exit(0);
});

start();

module.exports = app;
