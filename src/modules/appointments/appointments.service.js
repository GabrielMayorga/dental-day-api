// src/modules/appointments/appointments.service.js
// ============================================================
// Servicio de citas: la lógica de negocio de la agenda.
// Maneja la duración desde el catálogo y el solapamiento.
// ============================================================
const db = require('../../config/database');
const appointmentsRepository = require('./appointments.repository');
const audit = require('../../shared/audit/audit.service');
const ACCIONES = require('../../shared/audit/acciones');
const {
  AccesoDenegadoError,
  conAuditoriaDeRechazos,
} = require('../../shared/audit/acceso-denegado');
const {
  NotFoundError,
  ConflictError,
  BadRequestError,
} = require('../../shared/errors/app-error');

// ── Gestión de citas por rol (S-14) ─────────────────────────
// Recepción y admin gestionan todas las citas; cada odontólogo, solo
// las suyas (docs/politica-acceso-clinico.md).
const NO_ES_TUYA = 'Solo puedes gestionar tus propias citas';

const alcance = (req) => ({
  gestionaTodas: req.user.role !== 'dentist',
  staffId: req.user.staffId,
});

// Los UUID pueden llegar en mayúsculas; la base los da en minúsculas
const puedeGestionar = (staffId, req) =>
  alcance(req).gestionaTodas ||
  (Boolean(req.user.staffId) && String(staffId).toLowerCase() === req.user.staffId);

/**
 * Crea una cita aplicando las reglas de negocio.
 *
 * @param {object} data - patient_id, staff_id, scheduled_at,
 *                        treatment_id (opcional), duration_minutes (opcional),
 *                        reason, notes, created_by
 */
const createAppointment = (data, req) => conAuditoriaDeRechazos(req, async () => {
  const {
    patient_id, staff_id, scheduled_at, treatment_id,
    reason, notes, created_by,
  } = data;
  let { duration_minutes } = data;

  // ── Regla 0: un odontólogo solo agenda en su propia agenda ──
  // Reprogramar es crear una cita nueva con el mismo paciente (la
  // original no se toca), así que esta regla también la cubre.
  if (!puedeGestionar(staff_id, req)) {
    throw new AccesoDenegadoError(NO_ES_TUYA, { tabla: 'appointments' });
  }

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

  // ── Crear la cita y auditarla, capturando el error de solapamiento ──
  try {
    return await db.withTransaction(async (client) => {
      const appointment = await appointmentsRepository.create({
        patient_id, staff_id, status_id, scheduled_at,
        duration_minutes, reason, notes, created_by,
      }, client);
      await audit.registrar(client, {
        req, accion: ACCIONES.CITA_CREADA, tabla: 'appointments',
        registroId: appointment.id, despues: appointment,
      });
      // La regla 0 garantiza que quien la creó puede gestionarla
      return { ...appointment, puede_gestionar: true };
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
});

/**
 * Lista citas con filtros opcionales (fecha desde/hasta, odontólogo).
 */
const listAppointments = async (filters, req) => {
  return appointmentsRepository.findAll(filters, alcance(req));
};

/**
 * Obtiene una cita por id.
 */
const getAppointment = async (id, req) => {
  const appointment = await appointmentsRepository.findById(id, alcance(req));
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
const changeStatus = (id, statusName, cancelledReason, req) => conAuditoriaDeRechazos(req, async () => {
  // El estado solicitado debe ser válido
  const status = await db.query(
    `SELECT id FROM appointment_statuses WHERE name = $1`,
    [statusName]
  );
  if (status.rows.length === 0) {
    throw new BadRequestError(`Estado inválido: ${statusName}`);
  }

  return db.withTransaction(async (client) => {
    // La cita debe existir (queda bloqueada hasta el COMMIT)
    const appointment = await appointmentsRepository.lockById(id, client);
    if (!appointment) {
      throw new NotFoundError('La cita no existe');
    }

    // ── Regla: un odontólogo solo gestiona sus propias citas ──
    if (!puedeGestionar(appointment.staff_id, req)) {
      throw new AccesoDenegadoError(NO_ES_TUYA, { tabla: 'appointments', registroId: id });
    }

    // ── Regla: la transición debe ser válida según la máquina de estados ──
    // lockById trae status_name gracias al JOIN con appointment_statuses.
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

    const updated = await appointmentsRepository.updateStatus(
      id, status.rows[0].id, cancelledReason ?? null, client
    );
    await audit.registrar(client, {
      req, accion: ACCIONES.CITA_ESTADO_CAMBIADO, tabla: 'appointments',
      registroId: id,
      antes:   { status: estadoActual, cancelled_reason: appointment.cancelled_reason },
      despues: { status: statusName,   cancelled_reason: updated.cancelled_reason },
    });
    // Llegar aquí exige poder gestionarla
    return { ...updated, puede_gestionar: true };
  });
});

module.exports = {
  createAppointment,
  listAppointments,
  getAppointment,
  changeStatus,
};