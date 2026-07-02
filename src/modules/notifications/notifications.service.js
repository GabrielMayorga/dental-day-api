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

// Determina el grupo (hoy / mañana / esta semana) de una fecha
const groupOf = (scheduledAt) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(scheduledAt);
  fecha.setHours(0, 0, 0, 0);

  const diffDias = Math.round((fecha - hoy) / (1000 * 60 * 60 * 24));
  if (diffDias <= 0) return 'hoy';
  if (diffDias === 1) return 'mañana';
  return 'semana';
};

const getUpcoming = async (user) => {
  // Si es odontólogo, filtra solo sus citas
  let staffId = null;
  if (user.role === 'dentist') {
    staffId = await getStaffIdForUser(user.id);
  }

  const citas = await repo.findUpcoming({ days: 7, staffId });

  // Agrega a cada cita su grupo de cercanía
  const conGrupo = citas.map((c) => ({ ...c, group: groupOf(c.scheduled_at) }));

  return {
    total: conGrupo.length,
    items: conGrupo,
  };
};

module.exports = { getUpcoming };
