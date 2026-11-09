// src/modules/appointments/appointments.repository.js
// ============================================================
// Repositorio de citas: todas las consultas SQL de la agenda.
// ============================================================
const db = require('../../config/database');

// Las escrituras reciben un client opcional (el de la transacción en
// curso, para auditar en la misma transacción). Sin él, usan el pool.

// puede_gestionar para quien consulta (docs/politica-acceso-clinico.md):
// recepción y admin gestionan todas las citas (gestionaTodas); un
// odontólogo, solo las suyas. Sin ficha (staffId null) la comparación
// da NULL y COALESCE la deja en FALSE.
const puedeGestionar = (todas, staff) =>
  `COALESCE(${todas}::boolean OR a.staff_id = ${staff}::uuid, FALSE) AS puede_gestionar`;

/**
 * Crea una cita.
 * Nota: duration_minutes ya viene resuelta desde el servicio
 * (copiada del catálogo de tratamientos en el momento de crear).
 */
const create = async ({
  patient_id, staff_id, status_id, scheduled_at,
  duration_minutes, reason, notes, created_by,
}, client = db) => {
  const result = await client.query(
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
const findAll = async ({ from, to, staffId } = {}, { gestionaTodas = false, staffId: viewerStaffId = null } = {}) => {
  const result = await db.query(
    `SELECT
       a.id,
       to_char(a.scheduled_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS scheduled_at,
       a.duration_minutes,
       a.reason,
       a.notes,
       a.patient_id,
       p.first_name || ' ' || p.last_name AS patient_name,
       a.staff_id,
       s.first_name || ' ' || s.last_name AS staff_name,
       a.status_id,
       st.name      AS status_name,
       st.color_hex AS status_color,
       ${puedeGestionar('$4', '$5')}
     FROM appointments a
     JOIN patients p  ON p.id  = a.patient_id
     JOIN staff s     ON s.id  = a.staff_id
     JOIN appointment_statuses st ON st.id = a.status_id
     WHERE ($1::timestamp IS NULL OR a.scheduled_at >= $1)
       AND ($2::timestamp IS NULL OR a.scheduled_at <  $2)
       AND ($3::uuid IS NULL OR a.staff_id = $3)
     ORDER BY a.scheduled_at`,
    [from ?? null, to ?? null, staffId ?? null, gestionaTodas, viewerStaffId]
  );
  return result.rows;
};

/**
 * Busca una cita por su id, con los mismos datos legibles.
 */
const findById = async (id, { gestionaTodas = false, staffId = null } = {}) => {
  const result = await db.query(
    `SELECT
       a.id,
       to_char(a.scheduled_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS scheduled_at,
       a.duration_minutes,
       a.reason,
       a.notes,
       a.cancelled_reason,
       a.patient_id, p.first_name || ' ' || p.last_name AS patient_name,
       a.staff_id,   s.first_name || ' ' || s.last_name AS staff_name,
       a.status_id,  st.name AS status_name, st.color_hex AS status_color,
       ${puedeGestionar('$2', '$3')}
     FROM appointments a
     JOIN patients p  ON p.id  = a.patient_id
     JOIN staff s     ON s.id  = a.staff_id
     JOIN appointment_statuses st ON st.id = a.status_id
     WHERE a.id = $1`,
    [id, gestionaTodas, staffId]
  );
  return result.rows[0] || null;
};

/**
 * Lee la cita con el nombre de su estado y la bloquea hasta el fin de
 * la transacción (el "antes" de la auditoría).
 */
const lockById = async (id, client) => {
  const result = await client.query(
    `SELECT a.id, a.staff_id, a.status_id, a.cancelled_reason, st.name AS status_name
     FROM appointments a
     JOIN appointment_statuses st ON st.id = a.status_id
     WHERE a.id = $1
     FOR UPDATE OF a`,
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Cambia el estado de una cita (ej: a 'confirmed', 'cancelled', etc.).
 * Si se cancela, guarda el motivo.
 */
const updateStatus = async (id, statusId, cancelledReason = null, client = db) => {
  const result = await client.query(
    `UPDATE appointments
        SET status_id = $1,
            cancelled_reason = $2
      WHERE id = $3
      RETURNING *`,
    [statusId, cancelledReason, id]
  );
  return result.rows[0] || null;
};

module.exports = { create, findAll, findById, lockById, updateStatus };