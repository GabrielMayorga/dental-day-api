// src/modules/clinical-records/clinicalRecords.service.js
const db = require('../../config/database');
const repo = require('./clinicalRecords.repository');
const audit = require('../../shared/audit/audit.service');
const ACCIONES = require('../../shared/audit/acciones');
const { NotFoundError } = require('../../shared/errors/app-error');

// Toda consulta de historias queda registrada (HISTORIA_CONSULTADA),
// una entrada por petición y SIN contenido clínico: solo el paciente.
// Se registra después de leer y antes de responder: si la auditoría
// falla, la petición falla y los datos no salen.

// Historias recientes de toda la clínica (admin y odontólogos)
const listRecent = async (req) => {
  const records = await repo.findRecent(50);
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
  const records = await repo.findByPatient(patientId);
  await audit.registrar(db, {
    req, accion: ACCIONES.HISTORIA_CONSULTADA, tabla: 'clinical_records',
    despues: { patient_id: patientId },
  });
  return records;
};

// Obtiene un registro por id
const getById = async (id, req) => {
  const record = await repo.findById(id);
  if (!record) throw new NotFoundError('El registro clínico no existe');
  await audit.registrar(db, {
    req, accion: ACCIONES.HISTORIA_CONSULTADA, tabla: 'clinical_records',
    registroId: record.id, despues: { patient_id: record.patient_id },
  });
  return record;
};

// Crea un registro clínico para un paciente
const createForPatient = async (patientId, data, req) => {
  // Validar que el paciente exista y esté activo
  const patient = await db.query(
    `SELECT id FROM patients WHERE id = $1 AND is_active = TRUE`, [patientId]
  );
  if (patient.rows.length === 0) {
    throw new NotFoundError('El paciente no existe o está inactivo');
  }

  // Validar que el odontólogo exista
  const staff = await db.query(
    `SELECT id FROM staff WHERE id = $1 AND is_active = TRUE`, [data.staff_id]
  );
  if (staff.rows.length === 0) {
    throw new NotFoundError('El odontólogo no existe o está inactivo');
  }

  return db.withTransaction(async (client) => {
    const record = await repo.create({ ...data, patient_id: patientId }, client);
    await audit.registrar(client, {
      req, accion: ACCIONES.HISTORIA_CREADA, tabla: 'clinical_records',
      registroId: record.id, despues: record,
    });
    return record;
  });
};

// Actualiza un registro
const updateRecord = async (id, fields, req) => {
  return db.withTransaction(async (client) => {
    const record = await repo.lockById(id, client);
    if (!record) throw new NotFoundError('El registro clínico no existe');
    const updated = await repo.update(id, fields, client);
    await audit.registrar(client, {
      req, accion: ACCIONES.HISTORIA_EDITADA, tabla: 'clinical_records',
      registroId: id, antes: record, despues: updated,
    });
    return updated;
  });
};

module.exports = { listByPatient, getById, createForPatient, updateRecord, listRecent };
