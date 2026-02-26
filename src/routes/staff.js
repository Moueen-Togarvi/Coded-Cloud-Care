const express = require('express');
const router = express.Router();
const {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
} = require('../controllers/staffController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { attachTenantModels } = require('../middleware/tenantMiddleware');
const { validateStaffInput, validateObjectIdParam } = require('../middleware/validationMiddleware');

// All routes require authentication and tenant context
router.use(authenticate);
router.use(attachTenantModels);

// Staff routes with validation
// Staff routes with validation (Admin only for security)
router.get('/', authorize(['admin']), getAllStaff);
router.get('/:id', authorize(['admin']), validateObjectIdParam, getStaffById);
router.post('/', authorize(['admin']), validateStaffInput, createStaff);
router.put('/:id', authorize(['admin']), validateObjectIdParam, validateStaffInput, updateStaff);
router.delete('/:id', authorize(['admin']), validateObjectIdParam, deleteStaff);

module.exports = router;
