// src/shared/audit/acceso-denegado.js
// ============================================================
// Rechazos auditados (ACCESO_DENEGADO) de las reglas de acceso
// clínico: firma de historias, corrección de historias y gestión
// de citas (ver docs/politica-acceso-clinico.md).
//
// El servicio lanza AccesoDenegadoError donde detecta el rechazo,
// aunque sea dentro de una transacción. conAuditoriaDeRechazos lo
// atrapa DESPUÉS de que la transacción se revirtió y liberó su
// conexión, y lo registra con el pool: no hay cambio que revertir,
// así que el registro va fuera de transacción. Si se registrara
// dentro, el ROLLBACK del propio rechazo lo borraría.
// ============================================================
const db = require('../../config/database');
const audit = require('./audit.service');
const ACCIONES = require('./acciones');
const { ForbiddenError } = require('../errors/app-error');

class AccesoDenegadoError extends ForbiddenError {
  /**
   * @param {string} mensaje - Mensaje para el usuario (y motivo en la auditoría)
   * @param {object} recurso
   * @param {string} recurso.tabla        - Tabla del recurso rechazado
   * @param {string} [recurso.registroId] - UUID de la fila, si existe
   */
  constructor(mensaje, { tabla, registroId = null }) {
    super(mensaje);
    this.recurso = { tabla, registroId };
  }
}

/**
 * Ejecuta fn y, si lanza AccesoDenegadoError, lo audita y lo
 * vuelve a lanzar (el cliente recibe el 403 de siempre).
 */
const conAuditoriaDeRechazos = async (req, fn) => {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AccesoDenegadoError) {
      await audit.registrar(db, {
        req,
        accion: ACCIONES.ACCESO_DENEGADO,
        tabla: err.recurso.tabla,
        registroId: err.recurso.registroId,
        despues: { metodo: req.method, ruta: req.originalUrl, motivo: err.message },
      });
    }
    throw err;
  }
};

module.exports = { AccesoDenegadoError, conAuditoriaDeRechazos };
