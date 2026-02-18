const express = require('express');
const router = express.Router();
const {
  // Medicine/Inventory
  getAllItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  // Sales
  recordSale,
  recordBulkSale,
  getAllSales,
  getSaleById,
  getDailySales,
  getSalesByDateRange,
  voidSaleBatch,
  updateSaleItem,
  // Stock Management
  addStock,
  adjustStock,
  getStockMovements,
  getLowStockItems,
  getExpiringItems,
  // Suppliers
  createSupplier,
  getAllSuppliers,
  updateSupplier,
  deleteSupplier,
  // Purchase Orders
  createPurchaseOrder,
  receivePurchaseOrder,
  getAllPurchaseOrders,
  // Reports & Analytics
  getDailyReport,
  getWeeklyReport,
  getMonthlyReport,
  getProfitAnalysis,
  getTopSellingMedicines,
  getInventoryValue,
} = require('../controllers/pharmacyController');
const { authenticate } = require('../middleware/authMiddleware');
const { attachTenantModels } = require('../middleware/tenantMiddleware');
const {
  validateInventoryInput,
  validateObjectIdParam,
} = require('../middleware/validationMiddleware');

// All routes require authentication and tenant context
router.use(authenticate);
router.use(attachTenantModels);

// ==================== MEDICINE/INVENTORY ROUTES ====================
router.get('/inventory', getAllItems);
router.get('/inventory/:id', validateObjectIdParam, getItemById);
router.post('/inventory', validateInventoryInput, createItem);
router.put('/inventory/:id', validateObjectIdParam, validateInventoryInput, updateItem);
router.delete('/inventory/:id', validateObjectIdParam, deleteItem);

// ==================== SALES ROUTES ====================
router.post('/sales', recordSale);
router.post('/sales/bulk', recordBulkSale);
router.get('/sales', getAllSales);
router.get('/sales/daily/:date', getDailySales);
router.get('/sales/range', getSalesByDateRange);
router.get('/sales/:id', getSaleById);
router.delete('/sales/invoice/:invoiceNumber', voidSaleBatch);
router.put('/sales/:id', updateSaleItem);

// ==================== STOCK MANAGEMENT ROUTES ====================
router.post('/stock/add', addStock);
router.post('/stock/adjust', adjustStock);
router.get('/stock/movements', getStockMovements);
router.get('/stock/low', getLowStockItems);
router.get('/stock/expiring', getExpiringItems);

// ==================== SUPPLIER ROUTES ====================
router.post('/suppliers', createSupplier);
router.get('/suppliers', getAllSuppliers);
router.put('/suppliers/:id', updateSupplier);
router.delete('/suppliers/:id', deleteSupplier);

// ==================== PURCHASE ORDER ROUTES ====================
router.post('/purchase-orders', createPurchaseOrder);
router.put('/purchase-orders/:id/receive', receivePurchaseOrder);
router.get('/purchase-orders', getAllPurchaseOrders);

// ==================== REPORTS & ANALYTICS ROUTES ====================
router.get('/reports/daily/:date', getDailyReport);
router.get('/reports/weekly/:startDate', getWeeklyReport);
router.get('/reports/monthly/:year/:month', getMonthlyReport);
router.get('/analytics/profit', getProfitAnalysis);
router.get('/analytics/top-selling', getTopSellingMedicines);
router.get('/analytics/inventory-value', getInventoryValue);

module.exports = router;
