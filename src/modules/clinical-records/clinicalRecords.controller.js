// src/modules/clinical-records/clinicalRecords.controller.js
const service = require('./clinicalRecords.service');

// GET /api/v1/patients/:patientId/records
const listByPatient = async (req, res) => {
  const records = await service.listByPatient(req.params.patientId);
  res.json({ data: records });
};

// POST /api/v1/patients/:patientId/records
const create = async (req, res) => {
  const record = await service.createForPatient(req.params.patientId, req.body);
  res.status(201).json({ message: 'Registro clínico creado', data: record });
};

// GET /api/v1/records/recent
// Historias clínicas más recientes de toda la clínica.
const listRecent = async (_req, res) => {
  const records = await service.listRecent();
  res.json({ data: records });
};

// GET /api/v1/records/:id
const getById = async (req, res) => {
  const record = await service.getById(req.params.id);
  res.json({ data: record });
};

// PATCH /api/v1/records/:id
const update = async (req, res) => {
  const record = await service.updateRecord(req.params.id, req.body);
  res.json({ message: 'Registro clínico actualizado', data: record });
};

module.exports = { listByPatient, create, listRecent, getById, update };
