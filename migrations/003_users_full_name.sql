-- migrations/003_users_full_name.sql
-- ============================================================
-- Agrega la columna full_name a users, para que todos los
-- usuarios (no solo odontólogos) tengan un nombre.
-- ============================================================

-- 1. Agregar la columna (nullable primero, para no romper filas existentes)
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);

-- 2. Rellenar los usuarios existentes con un nombre razonable:
--    - Odontólogos: tomar su nombre de la tabla staff
UPDATE users u
SET full_name = s.first_name || ' ' || s.last_name
FROM staff s
WHERE s.user_id = u.id AND u.full_name IS NULL;

--    - Los que aún queden sin nombre (admin, recepcionistas): usar la parte del email antes de la @
UPDATE users
SET full_name = INITCAP(SPLIT_PART(email, '@', 1))
WHERE full_name IS NULL;
