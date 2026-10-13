-- migrations/005_password_management.sql
-- ============================================================
-- Gestión de contraseñas:
--   - must_change_password: obliga a cambiar la contraseña en el
--     próximo inicio de sesión (tras un restablecimiento del admin).
--   - token_version: viaja en los JWT (claim tv). Incrementarla
--     revoca todas las sesiones abiertas del usuario.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

SELECT 'Migración 005 aplicada — must_change_password y token_version agregadas' AS resultado;
