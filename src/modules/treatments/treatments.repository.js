// src/modules/treatments/treatments.repository.js
const db = require('../../config/database');

// Lista los tratamientos activos del catálogo
const findAll = async () => {
  const result = await db.query(
    `SELECT id, name, base_price, duration_minutes
     FROM treatment_catalog
     WHERE is_active = TRUE
     ORDER BY name`
  );
  return result.rows;
};

module.exports = { findAll };
