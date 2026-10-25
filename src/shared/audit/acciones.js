// src/shared/audit/acciones.js
// ============================================================
// Catálogo de acciones de auditoría (columna audit_logs.action).
// El CHECK de la migración 006 admite exactamente esta lista:
// si agregas una acción aquí, agrégala también allí.
// ============================================================
const ACCIONES = Object.freeze({
  LOGIN_EXITOSO:           'LOGIN_EXITOSO',
  LOGIN_FALLIDO:           'LOGIN_FALLIDO',

  HISTORIA_CREADA:         'HISTORIA_CREADA',
  HISTORIA_EDITADA:        'HISTORIA_EDITADA',
  HISTORIA_CONSULTADA:     'HISTORIA_CONSULTADA',

  PACIENTE_CREADO:         'PACIENTE_CREADO',
  PACIENTE_EDITADO:        'PACIENTE_EDITADO',
  PACIENTE_DESACTIVADO:    'PACIENTE_DESACTIVADO',

  USUARIO_CREADO:          'USUARIO_CREADO',
  USUARIO_ROL_CAMBIADO:    'USUARIO_ROL_CAMBIADO',
  USUARIO_ESTADO_CAMBIADO: 'USUARIO_ESTADO_CAMBIADO',

  CITA_CREADA:             'CITA_CREADA',
  CITA_ESTADO_CAMBIADO:    'CITA_ESTADO_CAMBIADO',
  CITA_REPROGRAMADA:       'CITA_REPROGRAMADA',
});

module.exports = ACCIONES;
