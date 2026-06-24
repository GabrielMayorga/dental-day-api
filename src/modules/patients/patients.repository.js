// src/modules/patients/patients.repository.js
const db = require('../../config/database');

const create = async ({ first_name, last_name, birth_date, gender, phone, address, city, emergency_contact_name, emergency_contact_phone, blood_type, allergies, notes, user_id, created_by }) => {
  const result = await db.query(
    `INSERT INTO patients
       (first_name, last_name, birth_date, gender, phone, address, city,
        emergency_contact_name, emergency_contact_phone, blood_type,
        allergies, notes, user_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [first_name, last_name, birth_date ?? null, gender ?? null, phone ?? null,
     address ?? null, city ?? null, emergency_contact_name ?? null,
     emergency_contact_phone ?? null, blood_type ?? null, allergies ?? null,
     notes ?? null, user_id ?? null, created_by ?? null]
  );
  return result.rows[0];
};

const findAll = async (search = '') => {
  const result = await db.query(
    `SELECT id, first_name, last_name, birth_date, gender, phone, address,
            city, emergency_contact_name, emergency_contact_phone, blood_type,
            allergies, notes, user_id, created_by, created_at, updated_at
     FROM patients
     WHERE is_active = TRUE
       AND ($1 = '' OR lower(first_name || ' ' || last_name) LIKE '%' || lower($1) || '%')
     ORDER BY last_name, first_name`,
    [search]
  );
  return result.rows;
};

const findById = async (id) => {
  const result = await db.query(
    `SELECT id, first_name, last_name, birth_date, gender, phone, address,
            city, emergency_contact_name, emergency_contact_phone, blood_type,
            allergies, notes, user_id, created_by, created_at, updated_at
     FROM patients
     WHERE id = $1 AND is_active = TRUE`,
    [id]
  );
  return result.rows[0] || null;
};

const update = async (id, fields) => {
  // Lista blanca: solo estas columnas se pueden actualizar.
  // Cualquier otra clave se ignora — defensa contra inyección por nombre de columna.
  const allowed = [
    'first_name', 'last_name', 'birth_date', 'gender', 'phone',
    'address', 'city', 'emergency_contact_name', 'emergency_contact_phone',
    'blood_type', 'allergies', 'notes',
  ];

  // Filtramos solo las columnas permitidas que vengan en fields
  const columns = Object.keys(fields).filter((col) => allowed.includes(col));

  // Si no hay nada válido que actualizar, no hacemos la query
  if (columns.length === 0) {
    return findById(id);
  }

  const values = columns.map((col) => fields[col]);

  const setClause = columns
    .map((col, i) => `${col} = $${i + 1}`)
    .join(', ');

  const result = await db.query(
    `UPDATE patients
     SET ${setClause}
     WHERE id = $${columns.length + 1} AND is_active = TRUE
     RETURNING *`,
    [...values, id]
  );
  return result.rows[0] || null;
};

const softDelete = async (id) => {
  const result = await db.query(
    `UPDATE patients SET is_active = FALSE WHERE id = $1 AND is_active = TRUE RETURNING id`,
    [id]
  );
  return result.rows[0] || null;
};

module.exports = { create, findAll, findById, update, softDelete };
