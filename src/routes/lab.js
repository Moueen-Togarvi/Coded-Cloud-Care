const express = require('express');
const router = express.Router();
const {
  getDashboardSummary,
  getLabPatients,
  getLabPatientById,
  createLabPatient,
  updateLabPatient,
  deleteLabPatient,
  getLabTests,
  getLabTestById,
  createLabTest,
  updateLabTest,
  deleteLabTest,
  createLabOrder,
  getLabOrders,
  getLabOrderById,
  updateLabOrderStatus,
  createOrUpdateLabReport,
  getLabReports,
  getLabReportById,
  getLabReportByOrder,
  getLabInvoices,
  addLabInvoicePayment,
  getOutstandingLabInvoices,
} = require('../controllers/labController');
const { authenticate } = require('../middleware/authMiddleware');
const { attachTenantModels } = require('../middleware/tenantMiddleware');
const { validateObjectIdParam, validatePatientInput } = require('../middleware/validationMiddleware');

// All routes require authentication and tenant context
router.use(authenticate);
router.use(attachTenantModels);

// Dashboard
router.get('/dashboard/summary', getDashboardSummary);

// Patients
router.get('/patients', getLabPatients);
router.get('/patients/:id', validateObjectIdParam, getLabPatientById);
router.post('/patients', validatePatientInput, createLabPatient);
router.put('/patients/:id', validateObjectIdParam, validatePatientInput, updateLabPatient);
router.delete('/patients/:id', validateObjectIdParam, deleteLabPatient);

// Tests Catalog
router.get('/tests', getLabTests);
router.get('/tests/:id', validateObjectIdParam, getLabTestById);
router.post('/tests', createLabTest);
router.put('/tests/:id', validateObjectIdParam, updateLabTest);
router.delete('/tests/:id', validateObjectIdParam, deleteLabTest);

// Orders
router.get('/orders', getLabOrders);
router.get('/orders/:id', validateObjectIdParam, getLabOrderById);
router.post('/orders', createLabOrder);
router.patch('/orders/:id/status', validateObjectIdParam, updateLabOrderStatus);

// Reports
router.get('/reports', getLabReports);
router.get('/reports/order/:id', validateObjectIdParam, getLabReportByOrder);
router.get('/reports/:id', validateObjectIdParam, getLabReportById);
router.post('/reports', createOrUpdateLabReport); // upsert by orderId

// Billing
router.get('/billing/invoices', getLabInvoices);
router.get('/billing/outstanding', getOutstandingLabInvoices);
router.post('/billing/invoices/:id/payment', validateObjectIdParam, addLabInvoicePayment);

module.exports = router;
