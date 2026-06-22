-- ============================================================
-- SEED 001 — Datos iniciales del sistema
-- Ejecutar DESPUÉS de la migración 001_initial_schema.sql
-- ============================================================
-- ON CONFLICT DO NOTHING: si corres el seed dos veces, no
-- duplica datos ni da error — es "idempotente" (seguro de repetir).
-- ============================================================

BEGIN;

-- ── ROLES DEL SISTEMA ──────────────────────
INSERT INTO roles (name, description) VALUES
  ('admin',        'Acceso total: usuarios, reportes y configuración'),
  ('dentist',      'Odontólogo: su agenda y el historial de sus pacientes'),
  ('receptionist', 'Recepcionista: gestión de citas y registro de pacientes'),
  ('patient',      'Paciente: consulta de sus propias citas e historial')
ON CONFLICT (name) DO NOTHING;

-- ── ESTADOS DE CITA (con colores para el calendario) ──
INSERT INTO appointment_statuses (name, color_hex, description) VALUES
  ('scheduled',   '#3B82F6', 'Programada — pendiente de confirmar'),
  ('confirmed',   '#10B981', 'Paciente confirmó asistencia'),
  ('in_progress', '#F59E0B', 'Paciente en consulta'),
  ('completed',   '#6B7280', 'Consulta finalizada'),
  ('cancelled',   '#EF4444', 'Cita cancelada'),
  ('no_show',     '#DC2626', 'Paciente no se presentó')
ON CONFLICT (name) DO NOTHING;

-- ── CATÁLOGO DE TRATAMIENTOS (precios en córdobas) ──
INSERT INTO treatment_catalog (name, description, base_price, duration_minutes) VALUES
  ('Consulta General',          'Revisión dental con diagnóstico',                  300.00, 30),
  ('Limpieza Dental',           'Remoción de placa y sarro, pulido',                500.00, 45),
  ('Radiografía Periapical',    'Radiografía individual de un diente',              150.00, 15),
  ('Radiografía Panorámica',    'Radiografía completa de toda la boca',             400.00, 20),
  ('Empaste Simple',            'Restauración de caries con resina',                600.00, 45),
  ('Empaste Complejo',          'Restauración de 3+ superficies',                   900.00, 60),
  ('Extracción Simple',         'Extracción sin complicaciones',                    500.00, 30),
  ('Extracción Quirúrgica',     'Extracción con cirugía (ej: muela del juicio)',   1500.00, 60),
  ('Endodoncia Unirradicular',  'Tratamiento de conducto, raíz única',             2500.00, 90),
  ('Endodoncia Multirradicular','Tratamiento de conducto, múltiples raíces',       3500.00, 120),
  ('Corona Porcelana',          'Corona estética de porcelana',                    4500.00, 60),
  ('Blanqueamiento',            'Blanqueamiento profesional en consultorio',       1500.00, 60),
  ('Ortodoncia - Consulta',     'Valoración para tratamiento de brackets',          300.00, 45),
  ('Fluorización',              'Aplicación de flúor (especialmente niños)',        200.00, 20)
ON CONFLICT DO NOTHING;

COMMIT;

-- Verificación
SELECT
  (SELECT COUNT(*) FROM roles)                AS roles,
  (SELECT COUNT(*) FROM appointment_statuses) AS estados_cita,
  (SELECT COUNT(*) FROM treatment_catalog)    AS tratamientos;