// src/modules/reports/reports.service.js
// ============================================================
// Lógica de reportes. Decide el ALCANCE según el rol:
// - admin: estadísticas globales de la clínica
// - dentist: solo sus propias estadísticas (filtra por su staff_id)
// ============================================================
const db = require('../../config/database');
const repo = require('./reports.repository');

// Dado el user.id del token, obtiene su staff_id (si es odontólogo)
const getStaffIdForUser = async (userId) => {
  const result = await db.query(
    `SELECT id FROM staff WHERE user_id = $1`, [userId]
  );
  return result.rows[0]?.id || null;
};

// Construye el dashboard según quién consulta
const getDashboard = async (user) => {
  // Si es odontólogo, resolvemos su staff_id para filtrar
  let staffId = null;
  let scope = 'global';

  if (user.role === 'dentist') {
    staffId = await getStaffIdForUser(user.id);
    scope = 'personal';
    // Si por alguna razón no tiene staff, no verá datos de citas
  }

  const [byStatus, total, today, patients] = await Promise.all([
    repo.countByStatus(staffId),
    repo.totalAppointments(staffId),
    repo.todayAppointments(staffId),
    repo.activePatients(),
  ]);

  // Tasa de inasistencia: (no_show + cancelled) / total
  const noShow = byStatus.find((s) => s.name === 'no_show')?.total || 0;
  const cancelled = byStatus.find((s) => s.name === 'cancelled')?.total || 0;
  const absenceRate = total > 0
    ? Math.round(((noShow + cancelled) / total) * 100)
    : 0;

  // Citas por odontólogo: solo para admin (vista global)
  const byDentist = user.role === 'admin' ? await repo.countByDentist() : [];

  return {
    scope,
    byStatus,
    totals: {
      appointments: total,
      today,
      activePatients: patients,
      absenceRate,
    },
    byDentist,
  };
};

module.exports = { getDashboard };
