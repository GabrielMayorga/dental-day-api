// src/modules/reports/reports.repository.js
// ============================================================
// Consultas de agregación para el panel de indicadores.
// Cada función acepta { staffId, from, to }, todos OPCIONALES:
// - staffId: filtra por ese odontólogo (cada dentista ve lo suyo)
// - from / to: rango sobre scheduled_at (>= from, < to), en hora
//   local de la clínica (TIMESTAMP sin zona). Cualquiera puede faltar.
// "Hoy" se calcula en la zona de la clínica, no con CURRENT_DATE:
// la base corre en UTC y desde las 18:00 de Managua ya sería mañana.
// ============================================================
const db = require('../../config/database');
const { clinicTimezone } = require('../../config/env');

// Citas agrupadas por estado (con su color para el gráfico)
const countByStatus = async ({ staffId = null, from = null, to = null } = {}) => {
  const result = await db.query(
    `SELECT s.name, s.color_hex, COUNT(a.id)::int AS total
     FROM appointment_statuses s
     LEFT JOIN appointments a
       ON a.status_id = s.id
       AND ($1::uuid IS NULL OR a.staff_id = $1)
       AND ($2::timestamp IS NULL OR a.scheduled_at >= $2)
       AND ($3::timestamp IS NULL OR a.scheduled_at < $3)
     GROUP BY s.name, s.color_hex
     ORDER BY s.name`,
    [staffId, from, to]
  );
  return result.rows;
};

// Total de citas (opcionalmente por odontólogo)
const totalAppointments = async ({ staffId = null, from = null, to = null } = {}) => {
  const result = await db.query(
    `SELECT COUNT(*)::int AS total FROM appointments
     WHERE ($1::uuid IS NULL OR staff_id = $1)
       AND ($2::timestamp IS NULL OR scheduled_at >= $2)
       AND ($3::timestamp IS NULL OR scheduled_at < $3)`,
    [staffId, from, to]
  );
  return result.rows[0].total;
};

// Citas de hoy: indicador del estado actual, NO depende del rango
const todayAppointments = async ({ staffId = null } = {}) => {
  const result = await db.query(
    `SELECT COUNT(*)::int AS total FROM appointments
     WHERE scheduled_at::date = (now() AT TIME ZONE $2)::date
       AND ($1::uuid IS NULL OR staff_id = $1)`,
    [staffId, clinicTimezone]
  );
  return result.rows[0].total;
};

// Total de pacientes activos (no depende del odontólogo: es global)
const activePatients = async () => {
  const result = await db.query(
    `SELECT COUNT(*)::int AS total FROM patients WHERE is_active = TRUE`
  );
  return result.rows[0].total;
};

// Citas por odontólogo (solo tiene sentido en vista global/admin)
const countByDentist = async ({ staffId = null, from = null, to = null } = {}) => {
  const result = await db.query(
    `SELECT s.first_name || ' ' || s.last_name AS dentist,
            COUNT(a.id)::int AS total
     FROM staff s
     LEFT JOIN appointments a
       ON a.staff_id = s.id
       AND ($2::timestamp IS NULL OR a.scheduled_at >= $2)
       AND ($3::timestamp IS NULL OR a.scheduled_at < $3)
     JOIN users u ON u.id = s.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE r.name = 'dentist'
       AND ($1::uuid IS NULL OR s.id = $1)
     GROUP BY dentist
     ORDER BY total DESC`,
    [staffId, from, to]
  );
  return result.rows;
};

module.exports = {
  countByStatus, totalAppointments, todayAppointments,
  activePatients, countByDentist,
};
