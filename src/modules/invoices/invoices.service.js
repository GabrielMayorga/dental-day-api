// src/modules/invoices/invoices.service.js
const repo = require('./invoices.repository');
const {
  BadRequestError, NotFoundError,
} = require('../../shared/errors/app-error');

const listInvoices = async (filters) => repo.findAll(filters);

const getInvoice = async (id) => {
  const invoice = await repo.findById(id);
  if (!invoice) throw new NotFoundError('La factura no existe');
  return invoice;
};

// Crea una factura. Cada renglón puede venir con treatment_id
// (se toma el precio del catálogo) o con descripción y precio manual.
const createInvoice = async (data, userId) => {
  const { patient_id, appointment_id, discount = 0, notes, items } = data;

  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestError('La factura debe tener al menos un tratamiento');
  }

  // Resolver cada renglón: si trae treatment_id, tomamos nombre y precio
  // del catálogo (snapshot: se copian a la factura).
  const resolvedItems = [];
  for (const it of items) {
    const quantity = it.quantity ?? 1;

    if (it.treatment_id) {
      const treatment = await repo.getTreatment(it.treatment_id);
      if (!treatment) {
        throw new BadRequestError(`Tratamiento inválido: ${it.treatment_id}`);
      }
      resolvedItems.push({
        treatment_id: treatment.id,
        description: it.description || treatment.name,
        quantity,
        // Permite sobrescribir el precio si se envía explícitamente
        unit_price: it.unit_price ?? Number(treatment.base_price),
      });
    } else {
      // Renglón libre (sin tratamiento del catálogo)
      if (!it.description || it.unit_price == null) {
        throw new BadRequestError('Cada renglón requiere descripción y precio');
      }
      resolvedItems.push({
        treatment_id: null,
        description: it.description,
        quantity,
        unit_price: it.unit_price,
      });
    }
  }

  // El total es la suma de los subtotales de los renglones
  const total_amount = resolvedItems.reduce(
    (sum, it) => sum + it.quantity * Number(it.unit_price), 0
  );

  if (Number(discount) > total_amount) {
    throw new BadRequestError('El descuento no puede superar el total');
  }

  const invoice = await repo.create({
    patient_id, appointment_id, total_amount, discount,
    notes, created_by: userId, items: resolvedItems,
  });

  return repo.findById(invoice.id);
};

const changeStatus = async (id, status) => {
  const invoice = await repo.findById(id);
  if (!invoice) throw new NotFoundError('La factura no existe');
  return repo.updateStatus(id, status);
};

module.exports = { listInvoices, getInvoice, createInvoice, changeStatus };
