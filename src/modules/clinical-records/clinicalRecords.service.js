// src/modules/clinical-records/clinicalRecords.service.js
const db = require('../../config/database');
const repo = require('./clinicalRecords.repository');
const { NotFoundError } = require('../../shared/errors/app-error');

// Lista los registros de un paciente (valida que el paciente exista)
const listByPatient = async (patientId) => {
  const patient = await db.query(
    `SELECT id FROM patients WHERE id = $1`, [patientId]
  );
  if (patient.rows.length === 0) {
    throw new NotFoundError('El paciente no existe');
  }
  return repo.findByPatient(patientId);
};

// Obtiene un registro por id
const getById = async (id) => {
  const record = await repo.findById(id);
  if (!record) throw new NotFoundError('El registro clínico no existe');
  return record;
};

// Crea un registro clínico para un paciente
const createForPatient = async (patientId, data) => {
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

  return repo.create({ ...data, patient_id: patientId });
};

// Actualiza un registro
const updateRecord = async (id, fields) => {
  const record = await repo.findById(id);
  if (!record) throw new NotFoundError('El registro clínico no existe');
  return repo.update(id, fields);
};

module.exports = { listByPatient, getById, createForPatient, updateRecord };
