require('dotenv').config();
// scripts/seed-demo.js
// ============================================================
// Genera datos FICTICIOS de demostración en la base LOCAL:
// 60 pacientes, citas desde 12 semanas atrás hasta 4 adelante e
// historias clínicas de las citas completadas.
//
// Uso:
//   npm run seed:demo              → genera (falla si ya hay datos demo)
//   npm run seed:demo -- --limpiar → borra los datos demo y regenera
//
// Requisitos: al menos un admin, un odontólogo activo y el catálogo
// de tratamientos (seed 001). No agrega columnas a la base.
//
// Los datos demo se identifican por el prefijo de su UUID
// (de000000-): el script genera e inserta de forma explícita los id
// de pacientes, citas e historias. --limpiar borra solo filas con ese
// prefijo y se niega si algún registro real apunta a ellas.
//
// Reproducible: generador con semilla fija. Con la misma semilla,
// la misma fecha de hoy y los mismos odontólogos y tratamientos,
// los datos son idénticos. Todo el plan se genera ANTES de tocar la
// base, así que una cita omitida por solapamiento no altera el resto.
// ============================================================

// ── SEGURIDAD: solo contra la base local ─────────────────────
// Sin opción para saltarse esta regla.
const HOSTS_LOCALES = ['localhost', '127.0.0.1', 'db']; // db = servicio de docker-compose.yml

const soloLocal = () => {
  console.error('❌ seed-demo solo se ejecuta contra la base local');
  process.exit(1);
};

if (process.env.NODE_ENV === 'production') soloLocal();
let hostBase;
try {
  hostBase = new URL(process.env.DATABASE_URL).hostname;
} catch {
  soloLocal();
}
if (!HOSTS_LOCALES.includes(hostBase)) soloLocal();

const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

// ── Configuración ────────────────────────────────────────────
const SEMILLA = 2026;
const PREFIJO_DEMO = 'de000000-';
const TOTAL_PACIENTES = 60;
const SEMANAS_ATRAS = 12;
const SEMANAS_ADELANTE = 4;
const CITAS_POR_DIA = { min: 4, max: 7 }; // por odontólogo
const ZONA = process.env.CLINIC_TIMEZONE || 'America/Managua';
const LIMPIAR = process.argv.includes('--limpiar');

// Horario de la clínica: src/config/clinica.js si existe; si no,
// los mismos valores que usa la interfaz (dental-day-web).
const HORARIO_POR_DEFECTO = {
  dias: [1, 2, 3, 4, 5, 6], // lunes a sábado (0 = domingo)
  apertura: '08:00',
  cierre: '17:00',
  intervaloMinutos: 30,
};
const rutaClinica = path.join(__dirname, '../src/config/clinica.js');
const HORARIO = fs.existsSync(rutaClinica)
  ? { ...HORARIO_POR_DEFECTO, ...require(rutaClinica).CLINICA?.horario }
  : HORARIO_POR_DEFECTO;

// ── Generador pseudoaleatorio (mulberry32) ───────────────────
const mulberry32 = (semilla) => () => {
  semilla |= 0;
  semilla = (semilla + 0x6D2B79F5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rng = mulberry32(SEMILLA);

const entero = (min, max) => min + Math.floor(rng() * (max - min + 1)); // [min, max]
const elegir = (lista) => lista[Math.floor(rng() * lista.length)];
const ponderado = (pares) => { // [[valor, peso], ...]
  let r = rng() * pares.reduce((s, [, p]) => s + p, 0);
  for (const [valor, peso] of pares) {
    if ((r -= peso) < 0) return valor;
  }
  return pares[pares.length - 1][0];
};
// UUID con el prefijo demo y el resto pseudoaleatorio. Lleva los bits
// de versión 4 y de variante, para que cualquier validador lo acepte:
// de000000-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx
const hex = (n) => Array.from({ length: n }, () => Math.floor(rng() * 16).toString(16)).join('');
const uuidDemo = () =>
  `${PREFIJO_DEMO}${hex(4)}-4${hex(3)}-${elegir(['8', '9', 'a', 'b'])}${hex(3)}-${hex(12)}`;

const barajar = (lista) => {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};

// ── Fechas (calendario puro, sin zona: la hora de pared la da la base) ──
const aMinutos = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const aHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const parseDia = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d)); };
const formatDia = (fecha) => fecha.toISOString().slice(0, 10);
const sumarDias = (fecha, dias) => new Date(fecha.getTime() + dias * 86_400_000);

// ── Datos fijos: nombres y direcciones ───────────────────────
const NOMBRES_HOMBRE = [
  'José', 'Juan', 'Carlos', 'Luis', 'Francisco', 'Miguel', 'Jorge', 'Pedro', 'Manuel', 'Antonio',
  'Róger', 'Ervin', 'Denis', 'Marvin', 'Álvaro', 'Byron', 'Kevin', 'Danilo', 'Julio', 'Ronald',
];
const NOMBRES_MUJER = [
  'María', 'Ana', 'Rosa', 'Martha', 'Carmen', 'Yolanda', 'Fátima', 'Karla', 'Jessica', 'Scarleth',
  'Heysell', 'Ruth', 'Johana', 'Indira', 'Maryuri', 'Xiomara', 'Darling', 'Gabriela', 'Lesbia', 'Reyna',
];
const APELLIDOS = [
  'González', 'López', 'Martínez', 'Hernández', 'García', 'Pérez', 'Rodríguez', 'Sánchez',
  'Ramírez', 'Flores', 'Castillo', 'Mendoza', 'Gutiérrez', 'Rivera', 'Obando', 'Espinoza',
  'Jarquín', 'Somarriba', 'Bermúdez', 'Membreño', 'Téllez', 'Úbeda', 'Zeledón', 'Aráuz', 'Duarte',
];
const BARRIOS = [
  'Barrio Central', 'Barrio El Panamá', 'Barrio Santa Rosa', 'Barrio Nueva Jerusalén',
  'Barrio Los Ángeles', 'Barrio San Francisco', 'Barrio El Recreo', 'Barrio La Bomba',
];
const REFERENCIAS = [
  'de la iglesia católica', 'del parque central', 'de la Alcaldía', 'del mercado municipal',
  'del muelle', 'del hospital', 'de la gasolinera', 'del Instituto Nacional', 'de la terminal de buses',
];
const INDICACIONES = [
  '2 c. al sur', '1 c. al norte', '3 c. al este', '1/2 c. al oeste', '1 c. al lago, 1/2 c. al sur',
  '2 c. abajo, 25 vrs. al norte', '75 vrs. al este', '1 c. arriba, 1 c. al sur',
];
const TIPOS_SANGRE = [
  ['O+', 45], ['A+', 25], ['B+', 10], ['AB+', 4], ['O-', 6], ['A-', 5], ['B-', 3], ['AB-', 2],
];
const ALERGIAS = ['Penicilina', 'Látex', 'Ibuprofeno'];

const MOTIVOS_CANCELACION = [
  'El paciente tuvo un viaje imprevisto',
  'Paciente enfermo, llamará para reprogramar',
  'Problemas de transporte por la lluvia',
  'No consiguió permiso en el trabajo',
  'Canceló por WhatsApp sin indicar motivo',
  'Emergencia familiar',
  'El odontólogo tuvo una emergencia',
  'El paciente prefirió otra fecha',
];

// ── Historias por tratamiento: [motivo, diagnóstico, plan] ──
// El motivo es también el reason de la cita, para que cita e
// historia cuenten lo mismo. La clave es el nombre exacto del
// catálogo (seeds/001_seed_data.sql).
const HISTORIAS = {
  'Consulta General': [
    ['Dolor al masticar en zona posterior', 'Caries en pieza 36, sin compromiso pulpar', 'Empaste de resina en pieza 36; control en 2 semanas'],
    ['Revisión general, no acude desde hace dos años', 'Caries incipientes en premolares y acúmulo de placa', 'Limpieza dental y empastes simples programados'],
    ['Sensibilidad al frío', 'Recesión gingival leve con dentina expuesta en caninos', 'Pasta desensibilizante y cepillado suave; control en 1 mes'],
    ['Sangrado de encías al cepillarse', 'Gingivitis generalizada por placa bacteriana', 'Profilaxis, instrucción de higiene oral y control en 3 meses'],
  ],
  'Limpieza Dental': [
    ['Control semestral', 'Gingivitis leve', 'Profilaxis y control en 6 meses'],
    ['Limpieza de rutina', 'Sarro supragingival en incisivos inferiores', 'Detartraje y pulido; control en 6 meses'],
    ['Manchas en los dientes por café', 'Pigmentación extrínseca, encías sanas', 'Profilaxis con pulido; control en 6 meses'],
    ['Mal aliento persistente', 'Placa y sarro abundantes, gingivitis moderada', 'Detartraje completo y enjuague con clorhexidina 2 semanas; control en 3 meses'],
  ],
  'Radiografía Periapical': [
    ['Dolor espontáneo en molar superior', 'Radiolucidez periapical en pieza 16', 'Valorar endodoncia de pieza 16'],
    ['Control de empaste profundo', 'Restauración adaptada, sin lesión periapical', 'Sin tratamiento adicional; control clínico en 6 meses'],
    ['Inflamación en encía de pieza 46', 'Lesión periapical compatible con absceso crónico', 'Endodoncia multirradicular de pieza 46'],
    ['Fractura de diente anterior por golpe', 'Fractura coronaria de pieza 11 sin compromiso radicular', 'Restauración con resina en pieza 11'],
  ],
  'Radiografía Panorámica': [
    ['Valoración de muelas del juicio', 'Terceros molares inferiores retenidos en posición mesioangular', 'Extracción quirúrgica de piezas 38 y 48'],
    ['Evaluación previa a ortodoncia', 'Apiñamiento dental moderado, sin piezas retenidas', 'Referir a valoración de ortodoncia'],
    ['Dolor difuso en la mandíbula', 'Sin lesiones óseas; caries profunda en pieza 37', 'Radiografía periapical y valorar endodoncia de pieza 37'],
    ['Control general de adulto mayor', 'Pérdida ósea horizontal leve, varias piezas ausentes', 'Limpieza profunda y valorar prótesis parcial'],
  ],
  'Empaste Simple': [
    ['Caries detectada en consulta anterior', 'Caries oclusal en pieza 46', 'Empaste de resina en pieza 46; control en 6 meses'],
    ['Se le quebró un empaste', 'Restauración antigua fracturada en pieza 25', 'Reemplazo con resina; evitar alimentos duros 24 h'],
    ['Mancha oscura en un diente', 'Caries de esmalte en pieza 14', 'Empaste simple con resina en pieza 14'],
    ['Se le queda comida entre los dientes', 'Caries interproximal en pieza 35', 'Empaste de resina en pieza 35; hilo dental diario'],
  ],
  'Empaste Complejo': [
    ['Dolor al morder alimentos duros', 'Caries extensa en pieza 36 que afecta tres superficies', 'Restauración compleja en pieza 36; control en 2 semanas'],
    ['Diente partido', 'Fractura de cúspide en pieza 26', 'Reconstrucción con resina de pieza 26; valorar corona a futuro'],
    ['Empaste grande desgastado', 'Restauración MOD filtrada en pieza 47', 'Reemplazo de restauración MOD en pieza 47'],
    ['Sensibilidad intensa al dulce', 'Caries profunda MOD en pieza 15, pulpa vital', 'Protección pulpar y restauración compleja en pieza 15; control en 1 mes'],
  ],
  'Extracción Simple': [
    ['Diente flojo', 'Movilidad grado III en pieza 31 por enfermedad periodontal', 'Extracción de pieza 31; indicaciones postoperatorias'],
    ['Resto de raíz que molesta', 'Resto radicular de pieza 24', 'Extracción del resto radicular; control en 1 semana'],
    ['Diente de leche que no se cae', 'Pieza temporal 75 retenida con permanente en erupción', 'Extracción de pieza 75'],
    ['Muela muy destruida', 'Caries extensa no restaurable en pieza 17', 'Extracción de pieza 17; valorar reposición'],
  ],
  'Extracción Quirúrgica': [
    ['Dolor en muela del juicio', 'Pieza 38 semi-incluida con pericoronaritis', 'Extracción quirúrgica de pieza 38; antibiótico y analgésico; retiro de puntos en 7 días'],
    ['Muela del juicio torcida', 'Pieza 48 incluida en posición horizontal', 'Extracción quirúrgica de pieza 48; control en 7 días'],
    ['Inflamación recurrente detrás de las muelas', 'Pericoronaritis recurrente en pieza 28', 'Extracción quirúrgica de pieza 28; dieta blanda 48 h'],
    ['Raíz fracturada', 'Fractura radicular de pieza 45', 'Extracción quirúrgica de pieza 45 con odontosección; retiro de puntos en 7 días'],
  ],
  'Endodoncia Unirradicular': [
    ['Dolor intenso en diente de adelante', 'Pulpitis irreversible en pieza 12', 'Endodoncia de pieza 12; restauración definitiva en 2 semanas'],
    ['Diente oscurecido tras un golpe', 'Necrosis pulpar en pieza 21', 'Endodoncia de pieza 21; valorar blanqueamiento interno'],
    ['Dolor al calor que dura minutos', 'Pulpitis irreversible en pieza 44', 'Endodoncia de pieza 44 y empaste definitivo'],
    ['Absceso en la encía del canino', 'Periodontitis apical crónica en pieza 13', 'Endodoncia de pieza 13; control radiográfico en 6 meses'],
  ],
  'Endodoncia Multirradicular': [
    ['Dolor que no lo deja dormir', 'Pulpitis irreversible en pieza 36', 'Endodoncia de pieza 36; valorar corona en 1 mes'],
    ['Hinchazón en la cara', 'Absceso periapical agudo en pieza 46', 'Drenaje, endodoncia de pieza 46 y antibiótico; control en 1 semana'],
    ['Molestia al masticar en muela con empaste', 'Necrosis pulpar en pieza 26', 'Endodoncia de pieza 26; restauración con corona'],
    ['Dolor al frío y al calor', 'Pulpitis irreversible en pieza 47', 'Endodoncia de pieza 47; empaste definitivo en la siguiente cita'],
  ],
  'Corona Porcelana': [
    ['Diente tratado con endodoncia', 'Pieza 36 endodonciada con estructura debilitada', 'Corona de porcelana en pieza 36; cementación definitiva'],
    ['Diente de adelante fracturado', 'Fractura amplia de pieza 11', 'Corona de porcelana en pieza 11'],
    ['Corona vieja desajustada', 'Corona metálica filtrada en pieza 16', 'Reemplazo por corona de porcelana en pieza 16'],
    ['Diente manchado que afecta la estética', 'Pigmentación intrínseca en pieza 21', 'Corona de porcelana en pieza 21; control en 1 mes'],
  ],
  'Blanqueamiento': [
    ['Quiere dientes más blancos', 'Coloración amarillenta generalizada, encías sanas', 'Blanqueamiento en consultorio; evitar café y vino tinto 48 h'],
    ['Blanqueamiento antes de su boda', 'Pigmentación extrínseca moderada', 'Blanqueamiento en consultorio y refuerzo en casa por 1 semana'],
    ['Manchas por tabaco', 'Pigmentación extrínseca por tabaco', 'Profilaxis previa y blanqueamiento; se recomienda dejar de fumar'],
    ['Retoque de blanqueamiento', 'Recidiva leve de color tras blanqueamiento anterior', 'Sesión de refuerzo de blanqueamiento'],
  ],
  'Ortodoncia - Consulta': [
    ['Dientes torcidos', 'Apiñamiento anterior moderado', 'Estudio de modelos y radiografía panorámica; plan de brackets'],
    ['Mordida abierta', 'Mordida abierta anterior', 'Referir a ortodoncista; registros iniciales'],
    ['Espacios entre los dientes', 'Diastemas en sector anterior superior', 'Valoración de ortodoncia fija; presupuesto entregado'],
    ['Valoración para su hijo', 'Clase II esquelética leve en dentición mixta', 'Control de crecimiento y valorar aparatología en 6 meses'],
  ],
  'Fluorización': [
    ['Control preventivo infantil', 'Dentición mixta sana, placa leve', 'Aplicación de flúor barniz; control en 6 meses'],
    ['Prevención de caries', 'Riesgo alto de caries por dieta azucarada', 'Flúor barniz y orientación de dieta; control en 3 meses'],
    ['Manchas blancas en los dientes', 'Lesiones de mancha blanca en incisivos', 'Aplicación de flúor; control en 3 meses'],
    ['Sensibilidad dental', 'Hipersensibilidad dentinaria leve', 'Aplicación de flúor tópico; pasta desensibilizante'],
  ],
};
// Para un tratamiento que no esté en la lista (catálogo modificado)
const historiaGenerica = (nombre) => [[nombre, 'Evolución favorable', 'Control en 6 meses']];

// ── Generación de pacientes ──────────────────────────────────
// "8XXX XXXX": empieza en 5, 7 u 8
const telefono = () => {
  const digitos = String(elegir([5, 7, 8])) + Array.from({ length: 7 }, () => entero(0, 9)).join('');
  return `${digitos.slice(0, 4)} ${digitos.slice(4)}`;
};

const generarPacientes = (fechaInicio) => {
  const nacimientoMin = Date.UTC(1950, 0, 1);
  const nacimientoMax = Date.UTC(2020, 11, 31);

  return Array.from({ length: TOTAL_PACIENTES }, () => {
    const gender = rng() < 0.5 ? 'male' : 'female';
    const firstName = elegir(gender === 'male' ? NOMBRES_HOMBRE : NOMBRES_MUJER);
    const apellido1 = elegir(APELLIDOS);
    const apellido2 = elegir(APELLIDOS);
    const nacimiento = new Date(nacimientoMin + Math.floor(rng() * (nacimientoMax - nacimientoMin)));

    return {
      id: uuidDemo(),
      first_name: firstName,
      last_name: `${apellido1} ${apellido2}`,
      birth_date: formatDia(nacimiento),
      gender,
      phone: telefono(),
      address: `${elegir(BARRIOS)}, ${elegir(REFERENCIAS)} ${elegir(INDICACIONES)}`,
      city: 'El Rama',
      emergency_contact_name: `${elegir(rng() < 0.5 ? NOMBRES_HOMBRE : NOMBRES_MUJER)} ${elegir([apellido1, apellido2])}`,
      emergency_contact_phone: telefono(),
      blood_type: ponderado(TIPOS_SANGRE),
      allergies: rng() < 0.15 ? elegir(ALERGIAS) : null,
      // Registrado antes de su primera cita posible
      created_at: `${formatDia(sumarDias(fechaInicio, -entero(1, 180)))} 09:00`,
    };
  });
};

// ── Generación de citas ──────────────────────────────────────
// Por cada día hábil y odontólogo: elige tratamientos que quepan en
// la jornada y reparte los huecos libres al azar. Así no hay solapamientos y todo termina antes del
// cierre, sin depender de la base.
const estadoCita = (dia, inicio, fin, hoy, ahoraMin) => {
  const r = rng(); // se consume siempre, para no desplazar el resto del plan
  if (dia < hoy) {
    if (r < 0.85) return 'completed';
    if (r < 0.93) return 'no_show';
    return 'cancelled';
  }
  if (dia > hoy) return r < 0.6 ? 'scheduled' : 'confirmed';
  if (fin <= ahoraMin) return 'completed';
  if (inicio <= ahoraMin) return 'in_progress';
  return 'confirmed';
};

const generarCitas = ({ dentistas, tratamientos, totalPacientes, hoy, ahoraMin }) => {
  const paso = HORARIO.intervaloMinutos;
  const apertura = aMinutos(HORARIO.apertura);
  const cierre = aMinutos(HORARIO.cierre);
  const bloquesJornada = Math.floor((cierre - apertura) / paso);
  const bloques = (t) => Math.ceil(t.duration_minutes / paso);
  const utiles = tratamientos.filter((t) => bloques(t) <= bloquesJornada);
  const minBloques = Math.min(...utiles.map(bloques));

  const citas = [];
  const fechaHoy = parseDia(hoy);
  for (let d = -SEMANAS_ATRAS * 7; d <= SEMANAS_ADELANTE * 7; d++) {
    const fecha = sumarDias(fechaHoy, d);
    if (!HORARIO.dias.includes(fecha.getUTCDay())) continue;
    const dia = formatDia(fecha);
    const pacientesDelDia = new Set(); // un paciente, una cita por día

    for (const dentista of dentistas) {
      // Cada tratamiento se elige entre los que dejan sitio para los
      // que faltan (al menos el más corto cada uno): siempre caben todos
      const cuantas = entero(CITAS_POR_DIA.min, CITAS_POR_DIA.max);
      const elegidos = [];
      let restantes = bloquesJornada;
      for (let i = 0; i < cuantas; i++) {
        const reservar = (cuantas - i - 1) * minBloques;
        const caben = utiles.filter((t) => bloques(t) <= restantes - reservar);
        if (caben.length === 0) break;
        const tratamiento = elegir(caben);
        elegidos.push(tratamiento);
        restantes -= bloques(tratamiento);
      }

      // Bloques libres repartidos entre los huecos (antes, entre y después)
      const huecos = new Array(elegidos.length + 1).fill(0);
      const libres = bloquesJornada - elegidos.reduce((s, t) => s + bloques(t), 0);
      for (let i = 0; i < libres; i++) huecos[Math.floor(rng() * huecos.length)]++;

      let cursor = apertura;
      barajar(elegidos).forEach((tratamiento, i) => {
        const inicio = cursor + huecos[i] * paso;
        const fin = inicio + tratamiento.duration_minutes;
        cursor = inicio + bloques(tratamiento) * paso;

        let paciente;
        for (let intento = 0; intento < 20; intento++) {
          paciente = Math.floor(rng() * totalPacientes);
          if (!pacientesDelDia.has(paciente)) break;
        }
        pacientesDelDia.add(paciente);

        const status = estadoCita(dia, inicio, fin, hoy, ahoraMin);
        const variantes = HISTORIAS[tratamiento.name] ?? historiaGenerica(tratamiento.name);
        const [motivo, diagnostico, plan] = elegir(variantes);
        citas.push({
          id: uuidDemo(),
          paciente,
          staff_id: dentista.id,
          scheduled_at: `${dia} ${aHHMM(inicio)}`,
          duration_minutes: tratamiento.duration_minutes,
          reason: motivo,
          status,
          cancelled_reason: status === 'cancelled' ? elegir(MOTIVOS_CANCELACION) : null,
          // Días de anticipación con que se agendó
          anticipacion: entero(1, 14),
          historia: { id: uuidDemo(), chief_complaint: motivo, diagnosis: diagnostico, treatment_plan: plan },
        });
      });
    }
  }
  return citas;
};

// ── Base de datos ────────────────────────────────────────────
// PREFIJO_DEMO es una constante del script, no entrada de usuario
const esDemo = (columna) => `${columna}::text LIKE '${PREFIJO_DEMO}%'`;

// Registros que NO son demo pero apuntan a filas demo. Borrarlas
// dispararía sus ON DELETE (SET NULL o CASCADE) y cambiaría datos
// reales, así que --limpiar se niega si encuentra alguno.
const REFERENCIAS_EXTERNAS = [
  ['historias',      `SELECT count(*) FROM clinical_records WHERE NOT ${esDemo('id')} AND (${esDemo('patient_id')} OR ${esDemo('appointment_id')})`],
  ['citas',          `SELECT count(*) FROM appointments WHERE NOT ${esDemo('id')} AND ${esDemo('patient_id')}`],
  ['facturas',       `SELECT count(*) FROM invoices WHERE ${esDemo('patient_id')} OR ${esDemo('appointment_id')}`],
  ['notificaciones', `SELECT count(*) FROM notifications WHERE ${esDemo('patient_id')} OR ${esDemo('appointment_id')}`],
  ['odontograma',    `SELECT count(*) FROM dental_chart_entries WHERE ${esDemo('patient_id')} OR ${esDemo('clinical_record_id')}`],
];

// Borra, en orden, historias, citas y pacientes demo. Nada más.
const limpiar = async (client) => {
  const externas = [];
  for (const [etiqueta, sql] of REFERENCIAS_EXTERNAS) {
    const n = Number((await client.query(sql)).rows[0].count);
    if (n > 0) externas.push(`${n} ${etiqueta}`);
  }
  if (externas.length > 0) {
    throw new Error(
      `Hay registros que no son demo ligados a datos demo (${externas.join(', ')}). ` +
      'No se borra nada: revísalos a mano.'
    );
  }

  const borrados = {};
  for (const [tabla, etiqueta] of [
    ['clinical_records', 'historias'],
    ['appointments', 'citas'],
    ['patients', 'pacientes'],
  ]) {
    const r = await client.query(`DELETE FROM ${tabla} WHERE ${esDemo('id')}`);
    borrados[etiqueta] = r.rowCount;
  }
  return borrados;
};

const verificarRequisitos = async (client) => {
  const admin = await client.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
     WHERE r.name = 'admin' AND u.is_active ORDER BY u.created_at, u.id LIMIT 1`
  );
  if (admin.rows.length === 0) throw new Error('No hay un usuario admin activo (scripts/create-admin.js)');

  // Orden fijo: el plan depende de él
  const dentistas = await client.query(
    `SELECT s.id FROM staff s
     JOIN users u ON u.id = s.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE r.name = 'dentist' AND s.is_active AND u.is_active
     ORDER BY s.created_at, s.id`
  );
  if (dentistas.rows.length === 0) throw new Error('No hay odontólogos activos (scripts/create-staff.js)');

  const tratamientos = await client.query(
    `SELECT id, name, COALESCE(duration_minutes, $1) AS duration_minutes
     FROM treatment_catalog WHERE is_active ORDER BY name, id`,
    [HORARIO.intervaloMinutos]
  );
  if (tratamientos.rows.length === 0) throw new Error('El catálogo de tratamientos está vacío (seed 001)');

  const estados = await client.query(`SELECT id, name FROM appointment_statuses`);

  return {
    adminId: admin.rows[0].id,
    dentistas: dentistas.rows,
    tratamientos: tratamientos.rows,
    estadoId: Object.fromEntries(estados.rows.map((e) => [e.name, e.id])),
  };
};

const main = async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { adminId, dentistas, tratamientos, estadoId } = await verificarRequisitos(client);

    if (LIMPIAR) {
      const borrados = await limpiar(client);
      console.log('🧹 Datos demo borrados:', borrados);
    } else {
      const existentes = await client.query(`SELECT count(*)::int AS n FROM patients WHERE ${esDemo('id')}`);
      if (existentes.rows[0].n > 0) {
        throw new Error(`Ya hay ${existentes.rows[0].n} pacientes demo. Usa: npm run seed:demo -- --limpiar`);
      }
    }

    // "Hoy" y "ahora" en la hora de pared de la clínica, según la base
    const reloj = await client.query(
      `SELECT to_char(now() AT TIME ZONE $1, 'YYYY-MM-DD') AS hoy,
              to_char(now() AT TIME ZONE $1, 'HH24:MI')    AS hora`,
      [ZONA]
    );
    const { hoy, hora } = reloj.rows[0];

    // Todo el plan antes de escribir
    const pacientes = generarPacientes(sumarDias(parseDia(hoy), -SEMANAS_ATRAS * 7));
    const citas = generarCitas({
      dentistas, tratamientos, totalPacientes: pacientes.length, hoy, ahoraMin: aMinutos(hora),
    });

    const pacienteIds = [];
    for (const p of pacientes) {
      const r = await client.query(
        `INSERT INTO patients
           (id, first_name, last_name, birth_date, gender, phone, address, city,
            emergency_contact_name, emergency_contact_phone, blood_type, allergies,
            created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 $14::timestamp AT TIME ZONE $15, $14::timestamp AT TIME ZONE $15)
         RETURNING id`,
        [p.id, p.first_name, p.last_name, p.birth_date, p.gender, p.phone, p.address, p.city,
         p.emergency_contact_name, p.emergency_contact_phone, p.blood_type, p.allergies,
         adminId, p.created_at, ZONA]
      );
      pacienteIds.push(r.rows[0].id);
    }

    const porEstado = {};
    let omitidas = 0;
    let historias = 0;
    for (const c of citas) {
      // Un 23P01 aborta la transacción entera: el savepoint permite
      // omitir solo esa cita (choque con una cita real) y seguir
      await client.query('SAVEPOINT cita');
      let citaId;
      try {
        const r = await client.query(
          `INSERT INTO appointments
             (id, patient_id, staff_id, status_id, scheduled_at, duration_minutes,
              reason, cancelled_reason, created_by, created_at)
           VALUES ($11, $1, $2, $3, $4, $5, $6, $7, $8,
                   LEAST(now(), ($4::timestamp - make_interval(days => $9)) AT TIME ZONE $10))
           RETURNING id`,
          [pacienteIds[c.paciente], c.staff_id, estadoId[c.status], c.scheduled_at,
           c.duration_minutes, c.reason, c.cancelled_reason, adminId, c.anticipacion, ZONA, c.id]
        );
        citaId = r.rows[0].id;
        await client.query('RELEASE SAVEPOINT cita');
      } catch (err) {
        if (err.code !== '23P01') throw err;
        await client.query('ROLLBACK TO SAVEPOINT cita');
        omitidas++;
        continue;
      }
      porEstado[c.status] = (porEstado[c.status] ?? 0) + 1;

      if (c.status === 'completed') {
        await client.query(
          `INSERT INTO clinical_records
             (id, patient_id, staff_id, appointment_id, chief_complaint, diagnosis, treatment_plan,
              created_at, updated_at)
           VALUES ($9, $1, $2, $3, $4, $5, $6,
                   $7::timestamp AT TIME ZONE $8, $7::timestamp AT TIME ZONE $8)`,
          [pacienteIds[c.paciente], c.staff_id, citaId, c.historia.chief_complaint,
           c.historia.diagnosis, c.historia.treatment_plan, c.scheduled_at, ZONA, c.historia.id]
        );
        historias++;
      }
    }

    await client.query('COMMIT');

    const totalCitas = Object.values(porEstado).reduce((s, n) => s + n, 0);
    console.log(`\n🦷 Datos demo generados (semilla ${SEMILLA}, hoy ${hoy} ${hora}, ${dentistas.length} odontólogo(s))\n`);
    console.log(`   Pacientes: ${pacienteIds.length}`);
    console.log(`   Citas:     ${totalCitas}${omitidas ? ` (${omitidas} omitidas por solapamiento)` : ''}`);
    for (const estado of ['completed', 'in_progress', 'confirmed', 'scheduled', 'cancelled', 'no_show']) {
      if (porEstado[estado]) console.log(`     ${estado.padEnd(12)} ${porEstado[estado]}`);
    }
    console.log(`   Historias: ${historias}\n`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`\n❌ ${err.message}`);
    if (err.detail) console.error(`   Detalle: ${err.detail}`);
    console.error('   No se guardó nada.\n');
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

main().catch((err) => {
  // Falla al conectar (p. ej. la base local no está levantada)
  console.error(`\n❌ No se pudo conectar a la base local: ${err.message}\n`);
  process.exitCode = 1;
});
