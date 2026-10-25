// src/modules/patients/patients.service.js
const db = require('../../config/database');
const patientsRepository = require('./patients.repository');
const audit = require('../../shared/audit/audit.service');
const ACCIONES = require('../../shared/audit/acciones');
const { NotFoundError } = require('../../shared/errors/app-error');

// Cada escritura va en una transacción junto con su registro de
// auditoría: si la auditoría falla, el cambio se revierte.

const create = async (data, createdBy, req) => {
  return db.withTransaction(async (client) => {
    const patient = await patientsRepository.create({ ...data, created_by: createdBy }, client);
    await audit.registrar(client, {
      req, accion: ACCIONES.PACIENTE_CREADO, tabla: 'patients',
      registroId: patient.id, despues: patient,
    });
    return patient;
  });
};

const findAll = async (search) => {
  return patientsRepository.findAll(search);
};

const findById = async (id) => {
  const patient = await patientsRepository.findById(id);
  if (!patient) {
    throw new NotFoundError('Paciente no encontrado');
  }
  return patient;
};

const update = async (id, fields, req) => {
  return db.withTransaction(async (client) => {
    const existing = await patientsRepository.lockById(id, client);
    if (!existing) {
      throw new NotFoundError('Paciente no encontrado');
    }
    const updated = await patientsRepository.update(id, fields, client);
    await audit.registrar(client, {
      req, accion: ACCIONES.PACIENTE_EDITADO, tabla: 'patients',
      registroId: id, antes: existing, despues: updated,
    });
    return updated;
  });
};

const softDelete = async (id, req) => {
  await db.withTransaction(async (client) => {
    const existing = await patientsRepository.lockById(id, client);
    if (!existing) {
      throw new NotFoundError('Paciente no encontrado');
    }
    const deleted = await patientsRepository.softDelete(id, client);
    await audit.registrar(client, {
      req, accion: ACCIONES.PACIENTE_DESACTIVADO, tabla: 'patients',
      registroId: id, antes: existing, despues: deleted,
    });
  });
};

module.exports = { create, findAll, findById, update, softDelete };
