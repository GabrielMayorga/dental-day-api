// src/modules/audit/audit.service.js
// Consulta del registro de auditoría. Para ESCRIBIR en él se usa
// src/shared/audit/audit.service.js (registrar).
const repo = require('./audit.repository');

const PAGE_SIZE = 50;

const list = async ({ page, ...filters }) => {
  const [rows, total] = await Promise.all([
    repo.findPage(filters, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    repo.count(filters),
  ]);

  return {
    data: rows,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
  };
};

module.exports = { list };
