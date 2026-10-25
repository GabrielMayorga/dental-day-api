# Política de acceso a la información clínica

Reglas decididas por la clínica para la información clínica de los
pacientes. La API las aplica en el servidor. La interfaz solo oculta
lo que no se puede hacer, y para eso usa los campos calculados
`puede_editar` y `puede_gestionar`.

Roles: **admin**, **dentist** (odontólogo) y **receptionist** (recepción).

## 1. Lectura de historias clínicas

Los odontólogos y el admin pueden leer todas las historias clínicas.
Recepción no puede leer ninguna.

Cada lectura queda en la auditoría con la acción `HISTORIA_CONSULTADA`.
El registro guarda quién leyó, cuándo y de qué paciente, pero no el
contenido clínico. La auditoría se escribe antes de responder: si falla,
la petición falla y los datos no se entregan.

## 2. Firma y corrección de historias

**Firma.** El registro clínico queda firmado por el odontólogo que lo
crea, es decir, su ficha de personal (`staff_id`):

- Un odontólogo firma siempre con su propia ficha. Si el cuerpo de la
  petición trae el `staff_id` de otro odontólogo, la API responde 400:
  "No puedes firmar un registro a nombre de otro odontólogo".
- El admin tiene que indicar el `staff_id` del odontólogo a cuyo nombre
  crea el registro. Esa ficha debe ser de un usuario con rol de
  odontólogo: el admin no puede firmar con su propia ficha. En la
  auditoría (`HISTORIA_CREADA`), el admin queda como autor de la acción
  y el odontólogo como firmante.
- Si el registro se vincula a una cita, esa cita debe ser del mismo
  paciente. Si no lo es, la API responde 400.

**Corrección.** Solo el autor puede corregir una historia, y solo
durante las primeras **24 horas** desde su creación. El plazo se calcula
con el reloj de la base de datos. Pasado ese plazo, la corrección se
hace agregando un registro nuevo. La historia original no se modifica.

- Si quien corrige no es el autor, la API responde 403: "Solo el autor
  puede corregir este registro".
- Si el plazo venció, la API responde 403: "El plazo de corrección
  venció. Agrega un registro de corrección".
- El admin no edita contenido clínico.

Cada historia que devuelve la API trae el campo `puede_editar`, que dice
si quien consulta puede corregirla en ese momento, y `editable_hasta`,
el fin del plazo (solo cuando `puede_editar` es verdadero; si no, null).
La interfaz muestra esa hora sin recalcular el plazo.

## 3. Datos de pacientes para recepción

Recepción solo ve los datos de contacto del paciente: id, nombres,
apellidos, fecha de nacimiento, teléfono, dirección (con la ciudad),
contacto de emergencia (nombre y teléfono) e `is_active`. La consulta a
la base pide solo esas columnas, así que los datos médicos nunca salen
de la base para este rol.

Al crear o editar un paciente, recepción solo puede enviar esos mismos
campos de contacto. Si envía otros, como tipo de sangre, alergias, notas
o género, la API los descarta. La respuesta de la API también trae solo
las columnas de contacto.

Solo el admin puede desactivar pacientes.

> La tabla `patients` no tiene columna de correo. Si se agrega, debe
> sumarse a la lista de columnas de contacto en
> `src/modules/patients/patients.repository.js`.

## 4. Gestión de citas

Recepción y admin gestionan todas las citas. Cada odontólogo gestiona
solo las suyas, es decir, las citas cuyo `staff_id` es su ficha de
personal:

- Cambiar el estado de una cita, lo que incluye cancelarla.
- Agendar una cita. Reprogramar es crear una cita nueva para el mismo
  paciente; la cita original no se modifica. Por eso un odontólogo solo
  puede agendar o reprogramar en su propia agenda.

Si un odontólogo intenta gestionar una cita de otro, la API responde
403: "Solo puedes gestionar tus propias citas".

Todos pueden ver la agenda completa. Cada cita que devuelve la API trae
el campo `puede_gestionar`.

## Auditoría de rechazos

Los 403 de firma, corrección y gestión de citas quedan en la auditoría
con la acción `ACCESO_DENEGADO`. El registro guarda:

- quién intentó la acción,
- el recurso (tabla y, si existe, el id de la fila),
- el método y la ruta de la petición,
- el motivo del rechazo.

Como un rechazo no cambia ningún dato, este registro se escribe fuera
de la transacción del cambio. Si se escribiera dentro, el ROLLBACK que
provoca el propio rechazo lo borraría.

## Dónde está en el código

| Regla | Archivo |
|---|---|
| Firma y corrección | `src/modules/clinical-records/clinicalRecords.service.js` |
| Plazo de 24 h y `puede_editar` (SQL) | `src/modules/clinical-records/clinicalRecords.repository.js` |
| Citas propias y `puede_gestionar` | `src/modules/appointments/appointments.service.js`, `appointments.repository.js` |
| Columnas por rol | `src/modules/patients/patients.repository.js` |
| Esquemas de recepción | `src/modules/patients/patients.validation.js` |
| Rechazos auditados | `src/shared/audit/acceso-denegado.js` |
| Catálogo `ACCESO_DENEGADO` | `src/shared/audit/acciones.js`, `migrations/007_acceso_denegado.sql` |
