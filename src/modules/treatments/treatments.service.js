// src/modules/treatments/treatments.service.js
const treatmentsRepository = require('./treatments.repository');

const listTreatments = async () => {
  return treatmentsRepository.findAll();
};

module.exports = { listTreatments };
