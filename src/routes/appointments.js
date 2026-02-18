const express = require('express');
const router = express.Router();
const {
  getAllAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  cancelAppointment,
} = require('../controllers/appointmentsController');
const { authenticate } = require('../middleware/authMiddleware');
const { attachTenantModels } = require('../middleware/tenantMiddleware');
const {
  validateAppointmentInput,
  validateObjectIdParam,
} = require('../middleware/validationMiddleware');

// All routes require authentication and tenant context
router.use(authenticate);
router.use(attachTenantModels);

// Appointment routes with validation
router.get('/', getAllAppointments);
router.get('/:id', validateObjectIdParam, getAppointmentById);
router.post('/', validateAppointmentInput, createAppointment);
router.put('/:id', validateObjectIdParam, updateAppointment);
router.delete('/:id', validateObjectIdParam, cancelAppointment);

module.exports = router;
