// src/modules/staff/staff.service.js
const staffRepository = require('./staff.repository');

const listDentists = async () => {
  return staffRepository.findDentists();
};

module.exports = { listDentists };
