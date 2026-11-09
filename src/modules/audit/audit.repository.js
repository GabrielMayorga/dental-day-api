// src/modules/audit/audit.repository.js
// ============================================================
// Consulta del registro de auditoría (solo lectura: la tabla no
// admite UPDATE ni DELETE, ver migración 006).
// ============================================================
const db = require('../../config/database');
const { clinicTimezone } = require('../../config/env');

// Todos los filtros son opcionales: NULL desactiva el filtro.
// from/to llegan como hora local de la clínica y se convierten a
// instante con AT TIME ZONE (created_at es TIMESTAMPTZ).
const WHERE = `
  WHERE ($1::uuid    IS NULL OR a.user_id    = $1)
    AND ($2::varchar IS NULL OR a.action     = $2)
    AND ($3::varchar IS NULL OR a.table_name = $3)
    AND ($4::uuid    IS NULL OR a.record_id  = $4)
    AND ($5::timestamp IS NULL OR a.created_at >= ($5::timestamp AT TIME ZONE $7))
    AND ($6::timestamp IS NULL OR a.created_at <  ($6::timestamp AT TIME ZONE $7))`;

const filterParams = ({ usuario, accion, tabla, registroId, from, to }) => [
  usuario ?? null, accion ?? null, tabla ?? null, registroId ?? null,
  from ?? null, to ?? null, clinicTimezone,
];

// Una página de registros, del más reciente al más antiguo, con el
// nombre del usuario (NULL en logins fallidos)
const findPage = async (filters, { limit, offset }) => {
  const result = await db.query(
    `SELECT
       a.id, a.created_at,
       a.user_id, u.full_name AS user_name,
       a.action, a.table_name, a.record_id,
       a.old_values, a.new_values,
       a.ip_address, a.user_agent
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ${WHERE}
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT $8 OFFSET $9`,
    [...filterParams(filters), limit, offset]
  );
  return result.rows;
};

const count = async (filters) => {
  const result = await db.query(
    `SELECT COUNT(*)::int AS total FROM audit_logs a ${WHERE}`,
    filterParams(filters)
  );
  return result.rows[0].total;
};

module.exports = { findPage, count };
