// src/config/logger.js
// ============================================================
// Logger centralizado con Winston.
// ¿Por qué no usar console.log? Porque Winston nos da niveles
// (info, warn, error, debug), formato consistente, y en
// producción genera JSON que Railway puede leer estructurado.
// ============================================================
const winston = require('winston');
const { isDev } = require('./env');

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Formato legible y colorido para cuando programas en tu máquina
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack }) =>
    stack
      ? `[${timestamp}] ${level}: ${message}\n${stack}`
      : `[${timestamp}] ${level}: ${message}`
  )
);

// Formato JSON para producción (más fácil de buscar/filtrar en Railway)
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: isDev ? devFormat : prodFormat,
  transports: [new winston.transports.Console()],
});

module.exports = logger;
