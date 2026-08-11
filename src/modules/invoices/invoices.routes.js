// src/modules/invoices/invoices.routes.js
const express = require('express');
const controller = require('./invoices.controller');
const validate = require('../../middlewares/validate.middleware');
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/rbac.middleware');
const { createInvoiceSchema, changeStatusSchema } = require('./invoices.validation');

const router = express.Router();
const ALLOWED_ROLES = ['admin', 'dentist', 'receptionist'];

router.use(authenticate);

router.get('/',    authorize(...ALLOWED_ROLES), controller.list);
router.get('/:id', authorize(...ALLOWED_ROLES), controller.getById);
router.post('/',   authorize(...ALLOWED_ROLES), validate(createInvoiceSchema), controller.create);
router.patch('/:id/status', authorize(...ALLOWED_ROLES), validate(changeStatusSchema), controller.changeStatus);

module.exports = router;
