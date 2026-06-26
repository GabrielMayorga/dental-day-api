// src/modules/treatments/treatments.controller.js
const treatmentsService = require('./treatments.service');

const listTreatments = async (_req, res) => {
  const treatments = await treatmentsService.listTreatments();
  res.json({ data: treatments });
};

module.exports = { listTreatments };
