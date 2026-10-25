-- migrations/006_audit_inmutable.sql
-- ============================================================
-- Auditoría (hallazgo S-04):
--   1. La columna action pasa a admitir el catálogo de
--      src/shared/audit/acciones.js (el CHECK original solo
--      aceptaba INSERT/UPDATE/... y VARCHAR(20) no alcanzaba
--      para USUARIO_ESTADO_CAMBIADO).
--   2. audit_logs pasa a ser de solo inserción: un trigger lanza
--      una excepción ante cualquier UPDATE, DELETE o TRUNCATE.
--
-- ALCANCE DE LA PROTECCIÓN: el trigger protege contra
-- modificaciones desde la aplicación (un bug, una consulta
-- inyectada) y contra errores humanos (un UPDATE sin WHERE).
-- NO protege contra el dueño de la base de datos ni un
-- superusuario: pueden hacer DROP TRIGGER, ALTER TABLE ...
-- DISABLE TRIGGER o SET session_replication_role = replica.
-- Para eso haría falta que la API se conecte con un rol sin
-- privilegios sobre la tabla, o enviar los registros fuera.
--
-- EFECTO SECUNDARIO: user_id tiene ON DELETE SET NULL, que es un
-- UPDATE sobre audit_logs. Borrar físicamente un usuario con
-- registros de auditoría fallará. La aplicación nunca borra
-- usuarios (solo los desactiva), así que es el comportamiento
-- deseado: el rastro de quién hizo qué no se pierde.
-- ============================================================

BEGIN;

-- ── 1. Catálogo de acciones ──────────────────────────────────
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ALTER COLUMN action TYPE VARCHAR(50);
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'LOGIN_EXITOSO', 'LOGIN_FALLIDO',
  'HISTORIA_CREADA', 'HISTORIA_EDITADA', 'HISTORIA_CONSULTADA',
  'PACIENTE_CREADO', 'PACIENTE_EDITADO', 'PACIENTE_DESACTIVADO',
  'USUARIO_CREADO', 'USUARIO_ROL_CAMBIADO', 'USUARIO_ESTADO_CAMBIADO',
  'CITA_CREADA', 'CITA_ESTADO_CAMBIADO', 'CITA_REPROGRAMADA'
));

-- ── 2. Inmutabilidad ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_audit_logs_inmutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs es de solo inserción: % no permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_inmutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_inmutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_logs_inmutable();

-- TRUNCATE no dispara triggers por fila: necesita uno por sentencia
DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION fn_audit_logs_inmutable();

COMMIT;

SELECT 'Migración 006 aplicada — audit_logs con catálogo de acciones y de solo inserción' AS resultado;
