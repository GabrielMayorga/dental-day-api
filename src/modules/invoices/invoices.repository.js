// src/modules/invoices/invoices.repository.js
// ============================================================
// Repositorio de facturación. La creación usa TRANSACCIÓN:
// factura + renglones se guardan juntos, o no se guarda nada.
// ============================================================
const db = require('../../config/database');

// Lista facturas con el nombre del paciente. Filtros opcionales.
const findAll = async ({ status = null, patientId = null } = {}) => {
  const result = await db.query(
    `SELECT
       i.id, i.total_amount, i.discount, i.final_amount, i.status,
       i.issued_at, i.paid_at, i.notes,
       i.patient_id, i.appointment_id,
       p.first_name || ' ' || p.last_name AS patient_name
     FROM invoices i
     JOIN patients p ON p.id = i.patient_id
     WHERE ($1::varchar IS NULL OR i.status = $1)
       AND ($2::uuid IS NULL OR i.patient_id = $2)
     ORDER BY i.issued_at DESC`,
    [status, patientId]
  );
  return result.rows;
};

// Una factura con sus renglones
const findById = async (id) => {
  const invoiceResult = await db.query(
    `SELECT
       i.id, i.total_amount, i.discount, i.final_amount, i.status,
       i.issued_at, i.paid_at, i.notes,
       i.patient_id, i.appointment_id,
       p.first_name || ' ' || p.last_name AS patient_name,
       p.phone AS patient_phone
     FROM invoices i
     JOIN patients p ON p.id = i.patient_id
     WHERE i.id = $1`,
    [id]
  );
  if (invoiceResult.rows.length === 0) return null;

  const itemsResult = await db.query(
    `SELECT id, treatment_id, description, quantity, unit_price, subtotal
     FROM invoice_items
     WHERE invoice_id = $1
     ORDER BY description`,
    [id]
  );

  return { ...invoiceResult.rows[0], items: itemsResult.rows };
};

// Crea factura + renglones en una TRANSACCIÓN
const create = async ({
  patient_id, appointment_id, total_amount, discount,
  notes, created_by, items,
}) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const invoiceResult = await client.query(
      `INSERT INTO invoices
         (patient_id, appointment_id, total_amount, discount, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, total_amount, discount, final_amount, status, issued_at`,
      [patient_id, appointment_id ?? null, total_amount, discount ?? 0,
       notes ?? null, created_by ?? null]
    );
    const invoice = invoiceResult.rows[0];

    // Insertar cada renglón
    for (const it of items) {
      await client.query(
        `INSERT INTO invoice_items
           (invoice_id, treatment_id, description, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [invoice.id, it.treatment_id ?? null, it.description,
         it.quantity ?? 1, it.unit_price]
      );
    }

    await client.query('COMMIT');
    return invoice;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Cambia el estado (marcar pagada, anulada, etc.)
const updateStatus = async (id, status) => {
  const result = await db.query(
    `UPDATE invoices
     SET status = $1,
         paid_at = CASE WHEN $1 = 'paid' THEN now() ELSE paid_at END
     WHERE id = $2
     RETURNING id, status, paid_at, final_amount`,
    [status, id]
  );
  return result.rows[0] || null;
};

// Precio de un tratamiento del catálogo (para armar los renglones)
const getTreatment = async (id) => {
  const result = await db.query(
    `SELECT id, name, base_price FROM treatment_catalog WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

module.exports = { findAll, findById, create, updateStatus, getTreatment };
