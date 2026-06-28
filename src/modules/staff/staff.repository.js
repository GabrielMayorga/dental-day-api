// src/modules/staff/staff.repository.js
const db = require('../../config/database');

// Lista los odontólogos (rol dentist) activos, con su email de cuenta.
const findDentists = async () => {
  const result = await db.query(
    `SELECT s.id, s.first_name, s.last_name, s.speciality, s.phone, u.email
     FROM staff s
     JOIN users u ON u.id = s.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE s.is_active = TRUE AND r.name = 'dentist'
     ORDER BY s.last_name, s.first_name`
  );
  return result.rows;
};

module.exports = { findDentists };
