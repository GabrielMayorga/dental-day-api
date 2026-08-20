// src/modules/appointments/appointments.service.js
// ============================================================
// Servicio de citas: la lógica de negocio de la agenda.
// Maneja la duración desde el catálogo y el solapamiento.
// ============================================================
const db = require('../../config/database');
const appointmentsRepository = require('./appointments.repository');
const {
  NotFoundError,
  ConflictError,
  BadRequestError,
} = require('../../shared/errors/app-error');

/**
 * Crea una cita aplicando las reglas de negocio.
 *
 * @param {object} data - patient_id, staff_id, scheduled_at,
 *                        treatment_id (opcional), duration_minutes (opcional),
 *                        reason, notes, created_by
 */
const createAppointment = async (data) => {
  const {
    patient_id, staff_id, scheduled_at, treatment_id,
    reason, notes, created_by,
  } = data;
  let { duration_minutes } = data;

  // ── Regla 1: el paciente debe existir ──
  const patient = await db.query(
    `SELECT id FROM patients WHERE id = $1 AND is_active = TRUE`,
    [patient_id]
  );
  if (patient.rows.length === 0) {
    throw new NotFoundError('El paciente no existe o está inactivo');
  }

  // ── Regla 2: el odontólogo debe existir ──
  const staff = await db.query(
    `SELECT id FROM staff WHERE id = $1 AND is_active = TRUE`,
    [staff_id]
  );
  if (staff.rows.length === 0) {
    throw new NotFoundError('El odontólogo no existe o está inactivo');
  }

  // ── Regla 3: resolver la duración ──
  // Si mandaron un tratamiento, copiamos su duración del catálogo (snapshot).
  // Si no, usamos la duración enviada o 30 min por defecto.
  if (treatment_id) {
    const treatment = await db.query(
      `SELECT duration_minutes FROM treatment_catalog
       WHERE id = $1 AND is_active = TRUE`,
      [treatment_id]
    );
    if (treatment.rows.length === 0) {
      throw new NotFoundError('El tratamiento no existe en el catálogo');
    }
    duration_minutes = treatment.rows[0].duration_minutes;
  }
  duration_minutes = duration_minutes || 30;

  // ── Regla 4: el estado inicial es 'scheduled' (programada) ──
  const status = await db.query(
    `SELECT id FROM appointment_statuses WHERE name = 'scheduled'`
  );
  const status_id = status.rows[0].id;

  // ── Crear la cita, capturando el error de solapamiento ──
  try {
    return await appointmentsRepository.create({
      patient_id, staff_id, status_id, scheduled_at,
      duration_minutes, reason, notes, created_by,
    });
  } catch (err) {
    // 23P01 = exclusion_violation: la restricción anti-solapamiento se activó.
    // Convertimos el error técnico de PostgreSQL en un mensaje amigable.
    if (err.code === '23P01') {
      throw new ConflictError(
        'El odontólogo ya tiene una cita en ese horario. Elige otro horario.'
      );
    }
    throw err; // cualquier otro error sube sin tocar
  }
};

/**
 * Lista citas con filtros opcionales (fecha desde/hasta, odontólogo).
 */
const listAppointments = async (filters) => {
  return appointmentsRepository.findAll(filters);
};

/**
 * Obtiene una cita por id.
 */
const getAppointment = async (id) => {
  const appointment = await appointmentsRepository.findById(id);
  if (!appointment) {
    throw new NotFoundError('La cita no existe');
  }
  return appointment;
};

/**
 * Máquina de estados de una cita.
 * Define, para cada estado, a qué estados puede transicionar.
 * Los estados finales (completed, cancelled, no_show) tienen lista
 * vacía: una vez ahí, la cita no cambia más.
 *
 * Esta tabla es la representación en código del diagrama de estados
 * del diseño del sistema.
 */
const TRANSICIONES_VALIDAS = {
  scheduled:   ['confirmed', 'cancelled', 'no_show'],
  confirmed:   ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed'],
  completed:   [],
  cancelled:   [],
  no_show:     [],
};

// Nombres en español para los mensajes de error al usuario
const NOMBRE_ESTADO = {
  scheduled:   'Programada',
  confirmed:   'Confirmada',
  in_progress: 'En consulta',
  completed:   'Completada',
  cancelled:   'Cancelada',
  no_show:     'No asistió',
};

/**
 * Cambia el estado de una cita (confirmar, completar, cancelar, etc.).
 */
const changeStatus = async (id, statusName, cancelledReason) => {
  // La cita debe existir
  const appointment = await appointmentsRepository.findById(id);
  if (!appointment) {
    throw new NotFoundError('La cita no existe');
  }

  // El estado solicitado debe ser válido
  const status = await db.query(
    `SELECT id FROM appointment_statuses WHERE name = $1`,
    [statusName]
  );
  if (status.rows.length === 0) {
    throw new BadRequestError(`Estado inválido: ${statusName}`);
  }

    if (status.rows.length === 0) {
    throw new BadRequestError(`Estado inválido: ${statusName}`);
  }

  // ── Regla: la transición debe ser válida según la máquina de estados ──
  // findById ya trae status_name gracias al JOIN con appointment_statuses.
  const estadoActual = appointment.status_name;
  const permitidos = TRANSICIONES_VALIDAS[estadoActual] ?? [];

  if (estadoActual === statusName) {
    throw new BadRequestError(
      `La cita ya está en estado "${NOMBRE_ESTADO[statusName]}"`
    );
  }

  if (!permitidos.includes(statusName)) {
    const opciones = permitidos.length
      ? permitidos.map((e) => NOMBRE_ESTADO[e]).join(', ')
      : 'ninguno, es un estado final';
    throw new BadRequestError(
      `No se puede pasar de "${NOMBRE_ESTADO[estadoActual]}" a ` +
      `"${NOMBRE_ESTADO[statusName]}". Transiciones permitidas: ${opciones}`
    );
  }

  return appointmentsRepository.updateStatus(
    id, status.rows[0].id, cancelledReason ?? null
  );

  return appointmentsRepository.updateStatus(
    id, status.rows[0].id, cancelledReason ?? null
  );
};

module.exports = {
  createAppointment,
  listAppointments,
  getAppointment,
  changeStatus,
};