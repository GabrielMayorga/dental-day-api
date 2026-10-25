// src/modules/audit/audit.controller.js
const service = require('./audit.service');

// GET /api/v1/audit?usuario=&accion=&tabla=&registroId=&from=&to=&page=
const list = async (req, res) => {
  const { data, pagination } = await service.list(req.query);
  res.json({ data, pagination });
};

module.exports = { list };
