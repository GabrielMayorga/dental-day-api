// src/modules/clinical-records/clinicalRecords.routes.js
// Dos routers: uno anidado bajo pacientes, otro para registros sueltos.
const express = require('express');
const controller = require('./clinicalRecords.controller');
const validate = require('../../middlewares/validate.middleware');
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/rbac.middleware');
const { createRecordSchema, updateRecordSchema } = require('./clinicalRecords.validation');

// Solo personal clínico accede a las historias
const CLINICAL_ROLES = ['admin', 'dentist'];

// Router anidado: /api/v1/patients/:patientId/records
const patientRecordsRouter = express.Router({ mergeParams: true });
patientRecordsRouter.use(authenticate);
patientRecordsRouter.get('/',  authorize(...CLINICAL_ROLES), controller.listByPatient);
patientRecordsRouter.post('/', authorize(...CLINICAL_ROLES), validate(createRecordSchema), controller.create);

// Router suelto: /api/v1/records
const recordsRouter = express.Router();
recordsRouter.use(authenticate);

// IMPORTANTE: /recent debe ir ANTES de /:id, o Express tomaria
// "recent" como si fuera un identificador.
recordsRouter.get('/recent', authorize(...CLINICAL_ROLES), controller.listRecent);

recordsRouter.get('/:id',   authorize(...CLINICAL_ROLES), controller.getById);
recordsRouter.patch('/:id', authorize(...CLINICAL_ROLES), validate(updateRecordSchema), controller.update);

module.exports = { patientRecordsRouter, recordsRouter };
