// src/modules/invoices/invoices.controller.js
const service = require('./invoices.service');

const list = async (req, res) => {
  const invoices = await service.listInvoices({
    status: req.query.status || null,
    patientId: req.query.patient_id || null,
  });
  res.json({ data: invoices });
};

const getById = async (req, res) => {
  const invoice = await service.getInvoice(req.params.id);
  res.json({ data: invoice });
};

const create = async (req, res) => {
  const invoice = await service.createInvoice(req.body, req.user.id);
  res.status(201).json({ message: 'Factura creada', data: invoice });
};

const changeStatus = async (req, res) => {
  const invoice = await service.changeStatus(req.params.id, req.body.status);
  res.json({ message: 'Estado actualizado', data: invoice });
};

module.exports = { list, getById, create, changeStatus };
