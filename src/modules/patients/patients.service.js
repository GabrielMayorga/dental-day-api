// src/modules/patients/patients.service.js
const patientsRepository = require('./patients.repository');
const { NotFoundError } = require('../../shared/errors/app-error');

const create = async (data, createdBy) => {
  return patientsRepository.create({ ...data, created_by: createdBy });
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

const update = async (id, fields) => {
  const existing = await patientsRepository.findById(id);
  if (!existing) {
    throw new NotFoundError('Paciente no encontrado');
  }
  return patientsRepository.update(id, fields);
};

const softDelete = async (id) => {
  const deleted = await patientsRepository.softDelete(id);
  if (!deleted) {
    throw new NotFoundError('Paciente no encontrado');
  }
};

module.exports = { create, findAll, findById, update, softDelete };
