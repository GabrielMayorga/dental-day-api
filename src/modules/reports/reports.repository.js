// src/modules/reports/reports.repository.js
// ============================================================
// Consultas de agregación para el panel de indicadores.
// Cada función acepta un staffId OPCIONAL: si viene, filtra
// por ese odontólogo (para que cada dentista vea solo lo suyo).
// ============================================================
const db = require('../../config/database');

// Citas agrupadas por estado (con su color para el gráfico)
const countByStatus = async (staffId = null) => {
  const result = await db.query(
    `SELECT s.name, s.color_hex, COUNT(a.id)::int AS total
     FROM appointment_statuses s
     LEFT JOIN appointments a
       ON a.status_id = s.id
       AND ($1::uuid IS NULL OR a.staff_id = $1)
     GROUP BY s.name, s.color_hex
     ORDER BY s.name`,
    [staffId]
  );
  return result.rows;
};

// Total de citas (opcionalmente por odontólogo)
const totalAppointments = async (staffId = null) => {
  const result = await db.query(
    `SELECT COUNT(*)::int AS total FROM appointments
     WHERE ($1::uuid IS NULL OR staff_id = $1)`,
    [staffId]
  );
  return result.rows[0].total;
};

// Citas de hoy
const todayAppointments = async (staffId = null) => {
  const result = await db.query(
    `SELECT COUNT(*)::int AS total FROM appointments
     WHERE scheduled_at::date = CURRENT_DATE
       AND ($1::uuid IS NULL OR staff_id = $1)`,
    [staffId]
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
const countByDentist = async () => {
  const result = await db.query(
    `SELECT s.first_name || ' ' || s.last_name AS dentist,
            COUNT(a.id)::int AS total
     FROM staff s
     LEFT JOIN appointments a ON a.staff_id = s.id
     JOIN users u ON u.id = s.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE r.name = 'dentist'
     GROUP BY dentist
     ORDER BY total DESC`
  );
  return result.rows;
};

module.exports = {
  countByStatus, totalAppointments, todayAppointments,
  activePatients, countByDentist,
};
