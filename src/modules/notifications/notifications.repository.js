// src/modules/notifications/notifications.repository.js
// ============================================================
// Consulta las citas próximas (hoy + próximos días) que siguen
// pendientes (programadas o confirmadas). No usa tabla nueva:
// las notificaciones se derivan de las citas reales.
// Acepta staffId OPCIONAL para que un odontólogo vea solo las suyas.
// ============================================================
const db = require('../../config/database');

const findUpcoming = async ({ days = 7, staffId = null }) => {
  const result = await db.query(
    `SELECT
       a.id,
       a.scheduled_at,
       a.duration_minutes,
       a.reason,
       p.first_name || ' ' || p.last_name AS patient_name,
       p.phone AS patient_phone,
       s.first_name || ' ' || s.last_name AS staff_name,
       st.name  AS status_name,
       st.color_hex AS status_color
     FROM appointments a
     JOIN patients p            ON p.id = a.patient_id
     JOIN staff s               ON s.id = a.staff_id
     JOIN appointment_statuses st ON st.id = a.status_id
     WHERE a.scheduled_at::date >= CURRENT_DATE
       AND a.scheduled_at::date <= CURRENT_DATE + ($1::int - 1)
       AND st.name IN ('scheduled', 'confirmed')
       AND ($2::uuid IS NULL OR a.staff_id = $2)
     ORDER BY a.scheduled_at ASC`,
    [days, staffId]
  );
  return result.rows;
};

module.exports = { findUpcoming };
