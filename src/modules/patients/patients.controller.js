// src/modules/patients/patients.controller.js
const patientsService = require('./patients.service');

const create = async (req, res) => {
  const patient = await patientsService.create(req.body, req.user.id, req);
  res.status(201).json({ message: 'Paciente creado exitosamente', data: patient });
};

const findAll = async (req, res) => {
  const { search = '' } = req.query;
  const patients = await patientsService.findAll(search, req.user.role);
  res.status(200).json({ data: patients });
};

const findById = async (req, res) => {
  const patient = await patientsService.findById(req.params.id, req.user.role);
  res.status(200).json({ data: patient });
};

const update = async (req, res) => {
  const patient = await patientsService.update(req.params.id, req.body, req);
  res.status(200).json({ message: 'Paciente actualizado exitosamente', data: patient });
};

const softDelete = async (req, res) => {
  await patientsService.softDelete(req.params.id, req);
  res.status(200).json({ message: 'Paciente eliminado exitosamente' });
};

module.exports = { create, findAll, findById, update, softDelete };
