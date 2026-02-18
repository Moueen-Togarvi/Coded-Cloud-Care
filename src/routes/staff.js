const express = require('express');
const router = express.Router();
const {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
} = require('../controllers/staffController');
const { authenticate } = require('../middleware/authMiddleware');
const { attachTenantModels } = require('../middleware/tenantMiddleware');
const { validateStaffInput, validateObjectIdParam } = require('../middleware/validationMiddleware');

// All routes require authentication and tenant context
router.use(authenticate);
router.use(attachTenantModels);

// Staff routes with validation
router.get('/', getAllStaff);
router.get('/:id', validateObjectIdParam, getStaffById);
router.post('/', validateStaffInput, createStaff);
router.put('/:id', validateObjectIdParam, validateStaffInput, updateStaff);
router.delete('/:id', validateObjectIdParam, deleteStaff);

module.exports = router;
