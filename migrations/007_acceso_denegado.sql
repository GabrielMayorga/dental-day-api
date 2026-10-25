-- migrations/007_acceso_denegado.sql
-- ============================================================
-- Reglas de acceso clínico (lote 3, parte B): los rechazos 403
-- de firma, corrección de historias y gestión de citas quedan
-- auditados con la acción ACCESO_DENEGADO.
--
-- Agrega ACCESO_DENEGADO al catálogo de audit_logs.action
-- (src/shared/audit/acciones.js). El resto de la lista es la
-- misma de la migración 006.
-- ============================================================

BEGIN;

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'LOGIN_EXITOSO', 'LOGIN_FALLIDO',
  'HISTORIA_CREADA', 'HISTORIA_EDITADA', 'HISTORIA_CONSULTADA',
  'PACIENTE_CREADO', 'PACIENTE_EDITADO', 'PACIENTE_DESACTIVADO',
  'USUARIO_CREADO', 'USUARIO_ROL_CAMBIADO', 'USUARIO_ESTADO_CAMBIADO',
  'CITA_CREADA', 'CITA_ESTADO_CAMBIADO', 'CITA_REPROGRAMADA',
  'ACCESO_DENEGADO'
));

COMMIT;

SELECT 'Migración 007 aplicada — ACCESO_DENEGADO agregado al catálogo de auditoría' AS resultado;
