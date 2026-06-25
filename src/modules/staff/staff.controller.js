// src/modules/staff/staff.controller.js
const staffService = require('./staff.service');

// GET /api/v1/staff/dentists
const listDentists = async (_req, res) => {
  const dentists = await staffService.listDentists();
  res.json({ data: dentists });
};

module.exports = { listDentists };
