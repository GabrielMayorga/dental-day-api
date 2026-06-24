-- ============================================================
-- MIGRACIÓN 002 — Borrado lógico para pacientes
-- Agrega la columna is_active para no eliminar físicamente
-- registros con valor médico/legal.
-- ============================================================

BEGIN;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Índice para filtrar rápido los pacientes activos
CREATE INDEX IF NOT EXISTS idx_patients_is_active
  ON patients(is_active) WHERE is_active = TRUE;

COMMIT;

SELECT 'Migración 002 aplicada — columna is_active agregada' AS resultado;
