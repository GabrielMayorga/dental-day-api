// src/modules/clinical-records/clinicalRecords.repository.js
// ============================================================
// Repositorio de historia clínica (registros del expediente).
// Cada registro pertenece a un paciente y lo crea un odontólogo.
// ============================================================
const db = require('../../config/database');

// Lista los registros de un paciente, del más reciente al más antiguo.
// JOIN con staff para mostrar quién lo registró.
const findByPatient = async (patientId) => {
  const result = await db.query(
    `SELECT
       cr.id, cr.patient_id, cr.staff_id, cr.appointment_id,
       cr.chief_complaint, cr.diagnosis, cr.treatment_plan, cr.notes,
       cr.created_at, cr.updated_at,
       s.first_name || ' ' || s.last_name AS staff_name
     FROM clinical_records cr
     JOIN staff s ON s.id = cr.staff_id
     WHERE cr.patient_id = $1
     ORDER BY cr.created_at DESC`,
    [patientId]
  );
  return result.rows;
};

// Busca un registro por su id (con nombre del odontólogo y del paciente)
const findById = async (id) => {
  const result = await db.query(
    `SELECT
       cr.id, cr.patient_id, cr.staff_id, cr.appointment_id,
       cr.chief_complaint, cr.diagnosis, cr.treatment_plan, cr.notes,
       cr.created_at, cr.updated_at,
       s.first_name || ' ' || s.last_name AS staff_name,
       p.first_name || ' ' || p.last_name AS patient_name
     FROM clinical_records cr
     JOIN staff s    ON s.id = cr.staff_id
     JOIN patients p ON p.id = cr.patient_id
     WHERE cr.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

// Crea un registro clínico
const create = async ({
  patient_id, staff_id, appointment_id,
  chief_complaint, diagnosis, treatment_plan, notes,
}) => {
  const result = await db.query(
    `INSERT INTO clinical_records
       (patient_id, staff_id, appointment_id,
        chief_complaint, diagnosis, treatment_plan, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [patient_id, staff_id, appointment_id ?? null,
     chief_complaint ?? null, diagnosis ?? null,
     treatment_plan ?? null, notes ?? null]
  );
  return result.rows[0];
};

// Actualiza un registro (lista blanca de columnas, como en pacientes)
const update = async (id, fields) => {
  const allowed = ['chief_complaint', 'diagnosis', 'treatment_plan', 'notes'];
  const columns = Object.keys(fields).filter((c) => allowed.includes(c));
  if (columns.length === 0) return findById(id);

  const values = columns.map((c) => fields[c]);
  const setClause = columns.map((c, i) => `${c} = $${i + 1}`).join(', ');

  const result = await db.query(
    `UPDATE clinical_records SET ${setClause}
     WHERE id = $${columns.length + 1} RETURNING *`,
    [...values, id]
  );
  return result.rows[0] || null;
};

// Lista las historias clínicas más recientes de toda la clínica,
// con datos del paciente y del odontólogo que las registró.
const findRecent = async (limit = 50) => {
  const result = await db.query(
    `SELECT
       cr.id,
       cr.chief_complaint,
       cr.diagnosis,
       cr.created_at,
       p.id   AS patient_id,
       p.first_name || ' ' || p.last_name AS patient_name,
       s.first_name || ' ' || s.last_name AS staff_name
     FROM clinical_records cr
     JOIN patients p ON p.id = cr.patient_id
     JOIN staff    s ON s.id = cr.staff_id
     ORDER BY cr.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
};

module.exports = { findByPatient, findById, create, update, findRecent };
