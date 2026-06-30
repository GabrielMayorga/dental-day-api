// src/modules/reports/reports.controller.js
const service = require('./reports.service');

// GET /api/v1/reports/dashboard
const getDashboard = async (req, res) => {
  const data = await service.getDashboard(req.user);
  res.json({ data });
};

module.exports = { getDashboard };
