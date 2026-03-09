const express = require('express');
const router = express.Router();
const {
  getDashboardSummary,
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  addInvoicePayment,
} = require('../controllers/quickInvoiceController');
const { authenticate } = require('../middleware/authMiddleware');
const { attachTenantModels } = require('../middleware/tenantMiddleware');
const { validateObjectIdParam } = require('../middleware/validationMiddleware');

router.use(authenticate);
router.use(attachTenantModels);

// Dashboard
router.get('/dashboard/summary', getDashboardSummary);

// Customers
router.get('/customers', getCustomers);
router.post('/customers', createCustomer);
router.put('/customers/:id', validateObjectIdParam, updateCustomer);
router.delete('/customers/:id', validateObjectIdParam, deleteCustomer);

// Products
router.get('/products', getProducts);
router.post('/products', createProduct);
router.put('/products/:id', validateObjectIdParam, updateProduct);
router.delete('/products/:id', validateObjectIdParam, deleteProduct);

// Invoices
router.get('/invoices', getInvoices);
router.get('/invoices/:id', validateObjectIdParam, getInvoiceById);
router.post('/invoices', createInvoice);
router.put('/invoices/:id', validateObjectIdParam, updateInvoice);
router.delete('/invoices/:id', validateObjectIdParam, deleteInvoice);
router.post('/invoices/:id/payment', validateObjectIdParam, addInvoicePayment);

module.exports = router;
