// src/modules/notifications/notifications.service.js
// ============================================================
// Arma las notificaciones de citas próximas, agrupadas por
// cercanía (hoy, mañana, esta semana). Si es odontólogo,
// filtra solo sus citas.
// ============================================================
const db = require('../../config/database');
const repo = require('./notifications.repository');

const getStaffIdForUser = async (userId) => {
  const result = await db.query(
    `SELECT id FROM staff WHERE user_id = $1`, [userId]
  );
  return result.rows[0]?.id || null;
};

const getUpcoming = async (user) => {
  // Si es odontólogo, filtra solo sus citas
  let staffId = null;
  if (user.role === 'dentist') {
    staffId = await getStaffIdForUser(user.id);
  }

  // Cada cita ya trae su grupo de cercanía, calculado en SQL
  // con la fecha de la clínica (ver notifications.repository.js)
  const citas = await repo.findUpcoming({ days: 7, staffId });

  return {
    total: citas.length,
    items: citas,
  };
};

module.exports = { getUpcoming };
