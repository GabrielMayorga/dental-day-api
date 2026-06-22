-- ============================================================
-- MIGRACIÓN 001 — Esquema inicial completo
-- Sistema: Clínica Dental Day
-- Motor:   PostgreSQL 16
-- ============================================================
-- Se ejecuta dentro de una transacción (BEGIN...COMMIT):
-- si algo falla a mitad, NO se aplica nada — la BD queda intacta.
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────
-- EXTENSIONES
-- ─────────────────────────────────────────
-- btree_gist habilita la restricción EXCLUDE que evita
-- citas solapadas para un mismo odontólogo (más abajo).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ─────────────────────────────────────────
-- FUNCIÓN AUXILIAR: actualiza updated_at automáticamente
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────
-- DOMINIO 1: ACCESO Y AUTENTICACIÓN
-- ─────────────────────────────────────────

CREATE TABLE roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id       UUID         NOT NULL REFERENCES roles(id),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email   ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE staff (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  first_name     VARCHAR(100) NOT NULL,
  last_name      VARCHAR(100) NOT NULL,
  speciality     VARCHAR(150),
  license_number VARCHAR(50),
  phone          VARCHAR(25),
  hire_date      DATE,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_staff_user_id   ON staff(user_id);
CREATE INDEX idx_staff_last_name ON staff(last_name);

-- ─────────────────────────────────────────
-- DOMINIO 2: PACIENTES
-- ─────────────────────────────────────────

CREATE TABLE patients (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID         REFERENCES users(id) ON DELETE SET NULL,
  first_name              VARCHAR(100) NOT NULL,
  last_name               VARCHAR(100) NOT NULL,
  birth_date              DATE,
  gender                  VARCHAR(30)  CHECK (gender IN ('male','female','other','prefer_not_to_say')),
  phone                   VARCHAR(25),
  address                 TEXT,
  city                    VARCHAR(100),
  emergency_contact_name  VARCHAR(200),
  emergency_contact_phone VARCHAR(25),
  blood_type              VARCHAR(5)   CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown')),
  allergies               TEXT,
  notes                   TEXT,
  created_by              UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_patients_last_name  ON patients(last_name);
CREATE INDEX idx_patients_user_id    ON patients(user_id);
CREATE INDEX idx_patients_created_by ON patients(created_by);
CREATE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─────────────────────────────────────────
-- DOMINIO 3: CITAS Y AGENDA
-- ─────────────────────────────────────────

CREATE TABLE appointment_statuses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(50) NOT NULL UNIQUE,
  color_hex   VARCHAR(7)  NOT NULL DEFAULT '#888888',
  description TEXT
);

CREATE TABLE appointments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID        NOT NULL REFERENCES patients(id),
  staff_id         UUID        NOT NULL REFERENCES staff(id),
  status_id        UUID        NOT NULL REFERENCES appointment_statuses(id),
  scheduled_at     TIMESTAMP NOT NULL,
  duration_minutes INT         NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 15 AND 480),
  reason           TEXT,
  notes            TEXT,
  cancelled_reason TEXT,
  created_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ⚠️ REGLA DE NEGOCIO CRÍTICA (a nivel de base de datos):
  -- Un odontólogo NO puede tener dos citas solapadas.
  -- tstzrange crea un rango de tiempo [inicio, fin).
  -- El operador && detecta si dos rangos se traslapan.
  -- Si intentas insertar una cita que choca, PostgreSQL la rechaza.
  CONSTRAINT no_overlapping_appointments EXCLUDE USING gist (
    staff_id WITH =,
    tsrange(
      scheduled_at,
      scheduled_at + make_interval(mins => duration_minutes),
      '[)'
    ) WITH &&
  )
);
CREATE INDEX idx_appointments_patient_id   ON appointments(patient_id);
CREATE INDEX idx_appointments_staff_id     ON appointments(staff_id);
CREATE INDEX idx_appointments_scheduled_at ON appointments(scheduled_at);
CREATE INDEX idx_appointments_status_id    ON appointments(status_id);
CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─────────────────────────────────────────
-- DOMINIO 4: HISTORIA CLÍNICA
-- ─────────────────────────────────────────

CREATE TABLE clinical_records (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID        NOT NULL REFERENCES patients(id),
  staff_id        UUID        NOT NULL REFERENCES staff(id),
  appointment_id  UUID        REFERENCES appointments(id) ON DELETE SET NULL,
  chief_complaint TEXT        NOT NULL,
  diagnosis       TEXT,
  treatment_plan  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_clinical_records_patient_id     ON clinical_records(patient_id);
CREATE INDEX idx_clinical_records_staff_id       ON clinical_records(staff_id);
CREATE INDEX idx_clinical_records_appointment_id ON clinical_records(appointment_id);
CREATE TRIGGER trg_clinical_records_updated_at
  BEFORE UPDATE ON clinical_records FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE dental_chart_entries (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id         UUID        NOT NULL REFERENCES patients(id),
  clinical_record_id UUID        REFERENCES clinical_records(id) ON DELETE SET NULL,
  tooth_number       SMALLINT    NOT NULL CHECK (tooth_number BETWEEN 1 AND 32),
  surface            VARCHAR(20) CHECK (surface IN ('mesial','distal','occlusal','buccal','lingual','full','root')),
  condition          VARCHAR(100),
  treatment_done     VARCHAR(100),
  notes              TEXT,
  recorded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by        UUID        REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_dental_chart_patient_id ON dental_chart_entries(patient_id);

-- ─────────────────────────────────────────
-- DOMINIO 5: FACTURACIÓN
-- ─────────────────────────────────────────

CREATE TABLE treatment_catalog (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(200)  NOT NULL,
  description      TEXT,
  base_price       DECIMAL(10,2) NOT NULL CHECK (base_price >= 0),
  duration_minutes INT           DEFAULT 30 CHECK (duration_minutes > 0),
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE invoices (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID          NOT NULL REFERENCES patients(id),
  appointment_id UUID          REFERENCES appointments(id) ON DELETE SET NULL,
  total_amount   DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  discount       DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (discount >= 0 AND discount <= total_amount),
  -- Columna calculada: PostgreSQL la mantiene siempre consistente
  final_amount   DECIMAL(10,2) GENERATED ALWAYS AS (total_amount - discount) STORED,
  status         VARCHAR(20)   NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','paid','cancelled','partial')),
  issued_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  paid_at        TIMESTAMPTZ,
  notes          TEXT,
  created_by     UUID          REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX idx_invoices_status     ON invoices(status);
CREATE INDEX idx_invoices_issued_at  ON invoices(issued_at);

CREATE TABLE invoice_items (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  treatment_id UUID          REFERENCES treatment_catalog(id) ON DELETE SET NULL,
  description  TEXT          NOT NULL,
  quantity     SMALLINT      NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price   DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  subtotal     DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- ─────────────────────────────────────────
-- DOMINIO 6: NOTIFICACIONES
-- ─────────────────────────────────────────

CREATE TABLE notifications (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID        NOT NULL REFERENCES patients(id),
  appointment_id UUID        REFERENCES appointments(id) ON DELETE CASCADE,
  type           VARCHAR(50) NOT NULL CHECK (type IN ('reminder','confirmation','no_show_followup','general')),
  channel        VARCHAR(20) NOT NULL CHECK (channel IN ('email','sms','whatsapp')),
  message        TEXT        NOT NULL,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  sent_at        TIMESTAMPTZ,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Índice parcial: solo indexa las notificaciones pendientes (más eficiente)
CREATE INDEX idx_notifications_pending ON notifications(scheduled_at) WHERE status = 'pending';

-- ─────────────────────────────────────────
-- DOMINIO 7: AUDITORÍA (requisito de seguridad)
-- ─────────────────────────────────────────

CREATE TABLE audit_logs (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(20)  NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE','SELECT','LOGIN','LOGOUT','FAILED_LOGIN')),
  table_name  VARCHAR(100) NOT NULL,
  record_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_new_values ON audit_logs USING gin(new_values);

COMMIT;

-- Confirmación visual
SELECT 'Migración 001 aplicada' AS resultado,
       (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') AS tablas_creadas;