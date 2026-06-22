// src/shared/errors/app-error.js
// ============================================================
// Clases de error personalizadas para la aplicación.
// Cada una empaqueta un mensaje + su código HTTP correspondiente.
// El manejador de errores global (en app.js) las traduce a respuestas.
// ============================================================

/**
 * Error base del que heredan todos los demás.
 * Extiende la clase Error nativa de JavaScript y le agrega
 * un statusCode (el código HTTP) y una marca isOperational.
 */
class AppError extends Error {
  /**
   * @param {string} message    - Mensaje legible para el usuario
   * @param {number} statusCode - Código HTTP (400, 401, 404...)
   */
  constructor(message, statusCode) {
    super(message);              // Llama al constructor de Error con el mensaje
    this.statusCode = statusCode;
    this.isOperational = true;   // Marca: es un error "esperado", no un bug
    this.name = this.constructor.name;

    // Mantiene limpio el stack trace (oculta este constructor del rastreo)
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── Errores específicos (cada uno con su código HTTP fijo) ──

/** 400 — El cliente envió datos inválidos o mal formados */
class BadRequestError extends AppError {
  constructor(message = 'Solicitud inválida') {
    super(message, 400);
  }
}

/** 401 — No autenticado: falta el token o es inválido */
class UnauthorizedError extends AppError {
  constructor(message = 'No autenticado') {
    super(message, 401);
  }
}

/** 403 — Autenticado, pero sin permiso para esta acción */
class ForbiddenError extends AppError {
  constructor(message = 'No tienes permiso para realizar esta acción') {
    super(message, 403);
  }
}

/** 404 — El recurso solicitado no existe */
class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404);
  }
}

/** 409 — Conflicto con el estado actual (ej: email duplicado, cita solapada) */
class ConflictError extends AppError {
  constructor(message = 'Conflicto con el estado actual del recurso') {
    super(message, 409);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
};