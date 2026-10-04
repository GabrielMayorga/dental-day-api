// src/modules/reports/reports.controller.js
const service = require('./reports.service');

// Acepta solo fechas ISO locales (YYYY-MM-DD o YYYY-MM-DDTHH:mm[:ss])
// que existan de verdad (rechaza 2026-02-30 o 25:00). Si no son
// válidas devuelve null y el filtro se ignora en vez de fallar.
// Se devuelve el string original (sin pasar por Date/toISOString)
// para no desplazar la hora: scheduled_at es TIMESTAMP sin zona.
const ISO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const parseDateParam = (value) => {
  const m = typeof value === 'string' && value.match(ISO_LOCAL);
  if (!m) return null;
  const [y, mo, d, h = 0, mi = 0, s = 0] = m.slice(1).map((v) => Number(v ?? 0));
  const date = new Date(y, mo - 1, d, h, mi, s);
  const valid = date.getFullYear() === y && date.getMonth() === mo - 1
    && date.getDate() === d && date.getHours() === h
    && date.getMinutes() === mi && date.getSeconds() === s;
  return valid ? value : null;
};

// GET /api/v1/reports/dashboard?from=...&to=...
const getDashboard = async (req, res) => {
  const from = parseDateParam(req.query.from);
  const to   = parseDateParam(req.query.to);
  const data = await service.getDashboard(req.user, { from, to });
  res.json({ data });
};

module.exports = { getDashboard };
