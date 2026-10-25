// src/shared/audit/audit.service.js
// ============================================================
// Registro de auditoría (tabla audit_logs).
//
// Se llama DENTRO de la transacción del cambio, con el mismo
// cliente: si el INSERT de auditoría falla, el cambio se revierte.
// La tabla es de solo inserción (trigger de la migración 006).
// ============================================================
const ACCIONES = require('./acciones');

const ACCIONES_VALIDAS = new Set(Object.values(ACCIONES));

// Claves que nunca se guardan, vengan donde vengan: password_hash,
// password, contraseña, accessToken, refreshToken, secretos...
const CLAVE_SENSIBLE = /pass|contrase|token|secret/i;

// Cambia en cada UPDATE por el trigger fn_set_updated_at: no aporta
// nada (la fila de auditoría ya tiene su propia fecha).
const CLAVES_IGNORADAS = new Set(['updated_at']);

// Los encabezados pueden pesar hasta 16 KB; para identificar el
// navegador basta con mucho menos.
const MAX_USER_AGENT = 500;

const esObjeto = (v) => v !== null && typeof v === 'object' && !(v instanceof Date);

// Copia el objeto sin las claves sensibles (también en objetos anidados)
const limpiar = (valor) => {
  if (Array.isArray(valor)) return valor.map(limpiar);
  if (!esObjeto(valor)) return valor;
  return Object.fromEntries(
    Object.entries(valor)
      .filter(([clave]) => !CLAVE_SENSIBLE.test(clave) && !CLAVES_IGNORADAS.has(clave))
      .map(([clave, v]) => [clave, limpiar(v)])
  );
};

const iguales = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Con antes y después, deja solo las claves presentes en ambos cuyo
// valor cambió (la fila anterior puede traer columnas de JOIN que el
// RETURNING no trae, y al revés). Con uno solo, lo guarda completo:
// en una creación todos los campos son nuevos.
const soloCambios = (antes, despues) => {
  if (!antes || !despues) return { antes, despues };

  const viejos = {};
  const nuevos = {};
  for (const clave of Object.keys(antes)) {
    if (!(clave in despues) || iguales(antes[clave], despues[clave])) continue;
    viejos[clave] = antes[clave];
    nuevos[clave] = despues[clave];
  }
  return { antes: viejos, despues: nuevos };
};

const aJson = (valor) =>
  valor && Object.keys(valor).length > 0 ? JSON.stringify(valor) : null;

/**
 * Inserta una fila en audit_logs.
 *
 * @param {object} db - Cliente de la transacción en curso (o db para
 *                      lecturas, que no tienen cambio que revertir)
 * @param {object} entrada
 * @param {object} entrada.req        - Petición de Express (usuario, IP, user-agent)
 * @param {string} entrada.accion     - Una de ACCIONES
 * @param {string} entrada.tabla      - Tabla afectada
 * @param {string} [entrada.registroId] - UUID de la fila afectada
 * @param {object} [entrada.antes]    - Fila antes del cambio
 * @param {object} [entrada.despues]  - Fila después del cambio
 * @param {string|null} [entrada.usuarioId] - Solo para el login, donde
 *        aún no hay req.user. Por defecto, req.user?.id.
 */
const registrar = async (db, {
  req, accion, tabla, registroId = null, antes = null, despues = null, usuarioId,
}) => {
  if (!ACCIONES_VALIDAS.has(accion)) {
    throw new Error(`Acción de auditoría desconocida: ${accion}`);
  }

  const cambios = soloCambios(limpiar(antes), limpiar(despues));
  const userAgent = req?.get?.('user-agent')?.slice(0, MAX_USER_AGENT) ?? null;

  await db.query(
    `INSERT INTO audit_logs
       (user_id, action, table_name, record_id,
        old_values, new_values, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      usuarioId !== undefined ? usuarioId : (req?.user?.id ?? null),
      accion,
      tabla,
      registroId,
      aJson(cambios.antes),
      aJson(cambios.despues),
      req?.ip ?? null,
      userAgent,
    ]
  );
};

module.exports = { registrar };
