// src/modules/appointments/appointments.repository.js
// ============================================================
// Repositorio de citas: todas las consultas SQL de la agenda.
// ============================================================
const db = require('../../config/database');

/**
 * Crea una cita.
 * Nota: duration_minutes ya viene resuelta desde el servicio
 * (copiada del catálogo de tratamientos en el momento de crear).
 */
const create = async ({
  patient_id, staff_id, status_id, scheduled_at,
  duration_minutes, reason, notes, created_by,
}) => {
  const result = await db.query(
    `INSERT INTO appointments
       (patient_id, staff_id, status_id, scheduled_at,
        duration_minutes, reason, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [patient_id, staff_id, status_id, scheduled_at,
     duration_minutes, reason ?? null, notes ?? null, created_by ?? null]
  );
  return result.rows[0];
};

/**
 * Lista citas con filtros opcionales por rango de fechas y por odontólogo.
 * Hace JOIN para traer nombres legibles (paciente, dentista, estado y color),
 * no solo los UUIDs. Útil para pintar el calendario directamente.
 */
const findAll = async ({ from, to, staffId } = {}) => {
  const result = await db.query(
    `SELECT
       a.id,
       a.scheduled_at,
       a.duration_minutes,
       a.reason,
       a.notes,
       a.patient_id,
       p.first_name || ' ' || p.last_name AS patient_name,
       a.staff_id,
       s.first_name || ' ' || s.last_name AS staff_name,
       a.status_id,
       st.name      AS status_name,
       st.color_hex AS status_color
     FROM appointments a
     JOIN patients p  ON p.id  = a.patient_id
     JOIN staff s     ON s.id  = a.staff_id
     JOIN appointment_statuses st ON st.id = a.status_id
     WHERE ($1::timestamp IS NULL OR a.scheduled_at >= $1)
       AND ($2::timestamp IS NULL OR a.scheduled_at <  $2)
       AND ($3::uuid IS NULL OR a.staff_id = $3)
     ORDER BY a.scheduled_at`,
    [from ?? null, to ?? null, staffId ?? null]
  );
  return result.rows;
};

/**
 * Busca una cita por su id, con los mismos datos legibles.
 */
const findById = async (id) => {
  const result = await db.query(
    `SELECT
       a.id, a.scheduled_at, a.duration_minutes, a.reason, a.notes,
       a.cancelled_reason,
       a.patient_id, p.first_name || ' ' || p.last_name AS patient_name,
       a.staff_id,   s.first_name || ' ' || s.last_name AS staff_name,
       a.status_id,  st.name AS status_name, st.color_hex AS status_color
     FROM appointments a
     JOIN patients p  ON p.id  = a.patient_id
     JOIN staff s     ON s.id  = a.staff_id
     JOIN appointment_statuses st ON st.id = a.status_id
     WHERE a.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Cambia el estado de una cita (ej: a 'confirmed', 'cancelled', etc.).
 * Si se cancela, guarda el motivo.
 */
const updateStatus = async (id, statusId, cancelledReason = null) => {
  const result = await db.query(
    `UPDATE appointments
        SET status_id = $1,
            cancelled_reason = $2
      WHERE id = $3
      RETURNING *`,
    [statusId, cancelledReason, id]
  );
  return result.rows[0] || null;
};

module.exports = { create, findAll, findById, updateStatus };