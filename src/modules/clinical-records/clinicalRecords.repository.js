// src/modules/clinical-records/clinicalRecords.repository.js
// ============================================================
// Repositorio de historia clínica (registros del expediente).
// Cada registro pertenece a un paciente y lo crea un odontólogo.
// ============================================================
const db = require('../../config/database');

// Las escrituras reciben un client opcional (el de la transacción en
// curso, para auditar en la misma transacción). Sin él, usan el pool.

// Plazo de corrección: solo el autor, dentro de las 24 h desde la
// creación (docs/politica-acceso-clinico.md). Se calcula en SQL con
// el reloj de la base, no con el del servidor de la API.
const PLAZO = `interval '24 hours'`;
const EN_PLAZO = `cr.created_at > now() - ${PLAZO}`;

// puede_editar para quien consulta. autorStaffId es la ficha del
// odontólogo que pregunta, o null (admin: nunca edita contenido
// clínico). Con null la comparación da NULL y COALESCE la deja en FALSE.
// editable_hasta es el fin del plazo, solo si puede_editar (la
// interfaz lo muestra; no recalcula la regla).
const puedeEditar = (param) => {
  const puede = `COALESCE(cr.staff_id = ${param}::uuid AND ${EN_PLAZO}, FALSE)`;
  return `${puede} AS puede_editar,
       CASE WHEN ${puede} THEN cr.created_at + ${PLAZO} END AS editable_hasta`;
};

// Lista los registros de un paciente, del más reciente al más antiguo.
// JOIN con staff para mostrar quién lo registró.
const findByPatient = async (patientId, autorStaffId = null) => {
  const result = await db.query(
    `SELECT
       cr.id, cr.patient_id, cr.staff_id, cr.appointment_id,
       cr.chief_complaint, cr.diagnosis, cr.treatment_plan, cr.notes,
       cr.created_at, cr.updated_at,
       s.first_name || ' ' || s.last_name AS staff_name,
       ${puedeEditar('$2')}
     FROM clinical_records cr
     JOIN staff s ON s.id = cr.staff_id
     WHERE cr.patient_id = $1
     ORDER BY cr.created_at DESC`,
    [patientId, autorStaffId]
  );
  return result.rows;
};

// Busca un registro por su id (con nombre del odontólogo y del paciente)
const findById = async (id, autorStaffId = null, client = db) => {
  const result = await client.query(
    `SELECT
       cr.id, cr.patient_id, cr.staff_id, cr.appointment_id,
       cr.chief_complaint, cr.diagnosis, cr.treatment_plan, cr.notes,
       cr.created_at, cr.updated_at,
       s.first_name || ' ' || s.last_name AS staff_name,
       p.first_name || ' ' || p.last_name AS patient_name,
       ${puedeEditar('$2')}
     FROM clinical_records cr
     JOIN staff s    ON s.id = cr.staff_id
     JOIN patients p ON p.id = cr.patient_id
     WHERE cr.id = $1`,
    [id, autorStaffId]
  );
  return result.rows[0] || null;
};

// Lee la fila completa y la bloquea hasta el fin de la transacción
// (el "antes" de la auditoría). en_plazo indica si sigue dentro de
// las 24 h de corrección; no es una columna de la tabla.
const lockById = async (id, client) => {
  const result = await client.query(
    `SELECT cr.*, ${EN_PLAZO} AS en_plazo
     FROM clinical_records cr WHERE cr.id = $1 FOR UPDATE`,
    [id]
  );
  return result.rows[0] || null;
};

// Crea un registro clínico
const create = async ({
  patient_id, staff_id, appointment_id,
  chief_complaint, diagnosis, treatment_plan, notes,
}, client = db) => {
  const result = await client.query(
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
const update = async (id, fields, client = db) => {
  const allowed = ['chief_complaint', 'diagnosis', 'treatment_plan', 'notes'];
  const columns = Object.keys(fields).filter((c) => allowed.includes(c));
  if (columns.length === 0) {
    const result = await client.query(`SELECT * FROM clinical_records WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  const values = columns.map((c) => fields[c]);
  const setClause = columns.map((c, i) => `${c} = $${i + 1}`).join(', ');

  const result = await client.query(
    `UPDATE clinical_records SET ${setClause}
     WHERE id = $${columns.length + 1} RETURNING *`,
    [...values, id]
  );
  return result.rows[0] || null;
};

// Lista las historias clínicas más recientes de toda la clínica,
// con datos del paciente y del odontólogo que las registró.
const findRecent = async (limit = 50, autorStaffId = null) => {
  const result = await db.query(
    `SELECT
       cr.id,
       cr.chief_complaint,
       cr.diagnosis,
       cr.created_at,
       p.id   AS patient_id,
       p.first_name || ' ' || p.last_name AS patient_name,
       s.first_name || ' ' || s.last_name AS staff_name,
       ${puedeEditar('$2')}
     FROM clinical_records cr
     JOIN patients p ON p.id = cr.patient_id
     JOIN staff    s ON s.id = cr.staff_id
     ORDER BY cr.created_at DESC
     LIMIT $1`,
    [limit, autorStaffId]
  );
  return result.rows;
};

module.exports = { findByPatient, findById, lockById, create, update, findRecent };
