// src/modules/appointments/appointments.controller.js
const appointmentsService = require('./appointments.service');

const create = async (req, res) => {
  const appointment = await appointmentsService.createAppointment({
    ...req.body,
    created_by: req.user.id,
  });
  res.status(201).json({
    message: 'Cita creada exitosamente',
    data: appointment,
  });
};

const findAll = async (req, res) => {
  const { from, to, staffId } = req.query;
  const appointments = await appointmentsService.listAppointments({ from, to, staffId });
  res.json({ data: appointments });
};

const findById = async (req, res) => {
  const appointment = await appointmentsService.getAppointment(req.params.id);
  res.json({ data: appointment });
};

const changeStatus = async (req, res) => {
  const { status, cancelled_reason } = req.body;
  const appointment = await appointmentsService.changeStatus(
    req.params.id, status, cancelled_reason
  );
  res.json({
    message: 'Estado de la cita actualizado',
    data: appointment,
  });
};

module.exports = { create, findAll, findById, changeStatus };
