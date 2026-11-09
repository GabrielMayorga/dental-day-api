// src/modules/clinical-records/clinicalRecords.service.js
// Reglas de acceso: docs/politica-acceso-clinico.md
const db = require('../../config/database');
const repo = require('./clinicalRecords.repository');
const audit = require('../../shared/audit/audit.service');
const ACCIONES = require('../../shared/audit/acciones');
const {
  AccesoDenegadoError,
  conAuditoriaDeRechazos,
} = require('../../shared/audit/acceso-denegado');
const { NotFoundError, BadRequestError } = require('../../shared/errors/app-error');

// Toda consulta de historias queda registrada (HISTORIA_CONSULTADA),
// una entrada por petición y SIN contenido clínico: solo el paciente.
// Se registra después de leer y antes de responder: si la auditoría
// falla, la petición falla y los datos no salen.

// Ficha con la que quien consulta podría corregir historias. Solo
// los odontólogos corrigen; el admin no edita contenido clínico,
// aunque tenga ficha de personal.
const autorStaffId = (req) => (req.user.role === 'dentist' ? req.user.staffId : null);

// Historias recientes de toda la clínica (admin y odontólogos)
const listRecent = async (req) => {
  const records = await repo.findRecent(50, autorStaffId(req));
  await audit.registrar(db, {
    req, accion: ACCIONES.HISTORIA_CONSULTADA, tabla: 'clinical_records',
  });
  return records;
};

// Lista los registros de un paciente (valida que el paciente exista)
const listByPatient = async (patientId, req) => {
  const patient = await db.query(
    `SELECT id FROM patients WHERE id = $1`, [patientId]
  );
  if (patient.rows.length === 0) {
    throw new NotFoundError('El paciente no existe');
  }
  const records = await repo.findByPatient(patientId, autorStaffId(req));
  await audit.registrar(db, {
    req, accion: ACCIONES.HISTORIA_CONSULTADA, tabla: 'clinical_records',
    despues: { patient_id: patientId },
  });
  return records;
};

// Obtiene un registro por id
const getById = async (id, req) => {
  const record = await repo.findById(id, autorStaffId(req));
  if (!record) throw new NotFoundError('El registro clínico no existe');
  await audit.registrar(db, {
    req, accion: ACCIONES.HISTORIA_CONSULTADA, tabla: 'clinical_records',
    registroId: record.id, despues: { patient_id: record.patient_id },
  });
  return record;
};

// ── Firma (S-02) ─────────────────────────────────────────────
// Un odontólogo firma siempre con su propia ficha: no puede crear
// un registro a nombre de otro. El admin debe indicar a nombre de
// quién lo crea; la auditoría lo deja como autor de la acción
// (user_id de HISTORIA_CREADA) y al odontólogo como firmante.
const resolverFirmante = (staffId, req) => {
  if (req.user.role === 'dentist') {
    if (!req.user.staffId) {
      throw new AccesoDenegadoError(
        'Tu usuario no tiene ficha de odontólogo. Comunícate con la administración',
        { tabla: 'clinical_records' }
      );
    }
    // Los UUID pueden llegar en mayúsculas; la base los da en minúsculas
    if (staffId && staffId.toLowerCase() !== req.user.staffId) {
      throw new BadRequestError('No puedes firmar un registro a nombre de otro odontólogo');
    }
    return req.user.staffId;
  }

  if (!staffId) {
    throw new BadRequestError('El odontólogo es obligatorio');
  }
  return staffId;
};

// Crea un registro clínico para un paciente
const createForPatient = (patientId, data, req) => conAuditoriaDeRechazos(req, async () => {
  const staffId = resolverFirmante(data.staff_id, req);

  // Validar que el paciente exista y esté activo
  const patient = await db.query(
    `SELECT id FROM patients WHERE id = $1 AND is_active = TRUE`, [patientId]
  );
  if (patient.rows.length === 0) {
    throw new NotFoundError('El paciente no existe o está inactivo');
  }

  // Validar que el firmante exista y sea odontólogo: el admin no puede
  // firmar con su propia ficha ni con la de otro rol
  const staff = await db.query(
    `SELECT s.id
     FROM staff s
     JOIN users u ON u.id = s.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE s.id = $1 AND s.is_active = TRUE AND r.name = 'dentist'`,
    [staffId]
  );
  if (staff.rows.length === 0) {
    throw new NotFoundError('El odontólogo no existe o está inactivo');
  }

  // La cita vinculada debe ser del mismo paciente
  if (data.appointment_id) {
    const cita = await db.query(
      `SELECT 1 FROM appointments WHERE id = $1 AND patient_id = $2`,
      [data.appointment_id, patientId]
    );
    if (cita.rows.length === 0) {
      throw new BadRequestError('La cita indicada no corresponde a este paciente');
    }
  }

  return db.withTransaction(async (client) => {
    const record = await repo.create({ ...data, staff_id: staffId, patient_id: patientId }, client);
    await audit.registrar(client, {
      req, accion: ACCIONES.HISTORIA_CREADA, tabla: 'clinical_records',
      registroId: record.id, despues: record,
    });
    // Se relee para devolver puede_editar y editable_hasta calculados
    // en SQL, igual que en las lecturas
    return repo.findById(record.id, autorStaffId(req), client);
  });
});

// ── Corrección (S-03) ────────────────────────────────────────
// Solo el autor y dentro de las 24 h desde la creación (en_plazo se
// calcula en SQL). Pasado el plazo, la corrección es un registro nuevo.
const updateRecord = (id, fields, req) => conAuditoriaDeRechazos(req, () =>
  db.withTransaction(async (client) => {
    const row = await repo.lockById(id, client);
    if (!row) throw new NotFoundError('El registro clínico no existe');
    const { en_plazo: enPlazo, ...record } = row;

    const recurso = { tabla: 'clinical_records', registroId: id };
    if (!autorStaffId(req) || record.staff_id !== autorStaffId(req)) {
      throw new AccesoDenegadoError('Solo el autor puede corregir este registro', recurso);
    }
    if (!enPlazo) {
      throw new AccesoDenegadoError(
        'El plazo de corrección venció. Agrega un registro de corrección', recurso
      );
    }

    const updated = await repo.update(id, fields, client);
    await audit.registrar(client, {
      req, accion: ACCIONES.HISTORIA_EDITADA, tabla: 'clinical_records',
      registroId: id, antes: record, despues: updated,
    });
    return repo.findById(id, autorStaffId(req), client);
  }));

module.exports = { listByPatient, getById, createForPatient, updateRecord, listRecent };
