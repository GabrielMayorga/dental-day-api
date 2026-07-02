// src/modules/notifications/notifications.controller.js
const service = require('./notifications.service');

// GET /api/v1/notifications
const getUpcoming = async (req, res) => {
  const data = await service.getUpcoming(req.user);
  res.json({ data });
};

module.exports = { getUpcoming };
