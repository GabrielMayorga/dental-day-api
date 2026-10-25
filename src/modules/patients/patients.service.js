// src/modules/patients/patients.service.js
const db = require('../../config/database');
const patientsRepository = require('./patients.repository');
const audit = require('../../shared/audit/audit.service');
const ACCIONES = require('../../shared/audit/acciones');
const { NotFoundError } = require('../../shared/errors/app-error');

// Cada escritura va en una transacción junto con su registro de
// auditoría: si la auditoría falla, el cambio se revierte.
//
// La auditoría guarda la fila completa; la respuesta se vuelve a leer
// con las columnas del rol (recepción: solo contacto), para que una
// edición no devuelva datos médicos que ese rol no puede ver.

const create = async (data, createdBy, req) => {
  return db.withTransaction(async (client) => {
    const patient = await patientsRepository.create({ ...data, created_by: createdBy }, client);
    await audit.registrar(client, {
      req, accion: ACCIONES.PACIENTE_CREADO, tabla: 'patients',
      registroId: patient.id, despues: patient,
    });
    return patientsRepository.findById(patient.id, req.user.role, client);
  });
};

const findAll = async (search, rol) => {
  return patientsRepository.findAll(search, rol);
};

const findById = async (id, rol) => {
  const patient = await patientsRepository.findById(id, rol);
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
    return patientsRepository.findById(id, req.user.role, client);
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
