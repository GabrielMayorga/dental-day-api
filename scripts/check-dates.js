// scripts/check-dates.js
// ============================================================
// Control de fechas contra una API desplegada (o local).
// Inicia sesión, consulta citas, notificaciones y el dashboard,
// y falla (código 1) si:
//   - algún campo de fecha llega con Z o desplazamiento (+/-HH:MM):
//     las fechas de la clínica son hora de pared, no instantes UTC.
//   - alguna notificación del grupo 'hoy' no cae en la fecha de
//     clinicNow (la hora de la clínica según /health).
//
// Uso:
//   CHECK_API_URL=https://dental-day-api.onrender.com \
//   CHECK_EMAIL=... CHECK_PASSWORD=... npm run check:dates
//
// Las credenciales se leen SOLO de variables de entorno. El usuario
// debe ser admin o dentist (el dashboard no admite otros roles).
// ============================================================
require('dotenv').config();

const { CHECK_API_URL, CHECK_EMAIL, CHECK_PASSWORD } = process.env;

if (!CHECK_API_URL || !CHECK_EMAIL || !CHECK_PASSWORD) {
  console.error('❌ Faltan variables: CHECK_API_URL, CHECK_EMAIL y CHECK_PASSWORD son obligatorias');
  process.exit(1);
}

const baseUrl = CHECK_API_URL.replace(/\/+$/, '');

// Fecha u hora ISO que trae zona: termina en Z o en +HH:MM / -HHMM
const FECHA_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

const request = async (path, { token, ...options } = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} → HTTP ${res.status}: ${body?.error || body?.message || ''}`);
  }
  return body;
};

// Recorre la respuesta y devuelve la ruta de cada string con zona
const camposConZona = (value, path = '') => {
  if (typeof value === 'string') {
    return FECHA_CON_ZONA.test(value) ? [`${path} = ${value}`] : [];
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) =>
      camposConZona(v, Array.isArray(value) ? `${path}[${k}]` : `${path}.${k}`));
  }
  return [];
};

const run = async () => {
  const errores = [];

  const health = await request('/health');
  const hoyClinica = health.clinicNow?.slice(0, 10);
  console.log(`🕒 clinicNow=${health.clinicNow} clinicTz=${health.clinicTz}`);
  if (!hoyClinica) {
    throw new Error('/health no devuelve clinicNow: ¿la API desplegada tiene este cambio?');
  }

  const login = await request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: CHECK_EMAIL, password: CHECK_PASSWORD }),
  });
  const token = login.data.accessToken;

  const endpoints = {
    '/appointments': '/api/v1/appointments',
    '/notifications': '/api/v1/notifications',
    '/reports/dashboard': '/api/v1/reports/dashboard',
  };
  const respuestas = {};
  for (const [nombre, path] of Object.entries(endpoints)) {
    respuestas[nombre] = await request(path, { token });
    const sospechosos = camposConZona(respuestas[nombre].data, 'data');
    sospechosos.forEach((c) => errores.push(`${nombre}: fecha con zona → ${c}`));
    console.log(`${sospechosos.length ? '❌' : '✅'} ${nombre}: ${sospechosos.length} campo(s) con zona`);
  }

  const items = respuestas['/notifications'].data.items || [];
  const hoyMal = items.filter((n) => n.group === 'hoy' && n.scheduled_at.slice(0, 10) !== hoyClinica);
  hoyMal.forEach((n) =>
    errores.push(`/notifications: cita ${n.id} en grupo 'hoy' con fecha ${n.scheduled_at} (hoy clínica: ${hoyClinica})`));
  const totalHoy = items.filter((n) => n.group === 'hoy').length;
  console.log(`${hoyMal.length ? '❌' : '✅'} /notifications: ${totalHoy} en 'hoy', ${hoyMal.length} fuera de ${hoyClinica}`);

  if (errores.length) {
    console.error(`\n❌ ${errores.length} problema(s) de fechas:`);
    errores.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }
  console.log('\n✅ Fechas correctas: sin zonas y "hoy" coincide con la clínica');
};

run().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
