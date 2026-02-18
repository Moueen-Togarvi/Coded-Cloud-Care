const express = require('express');
const router = express.Router();
const {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
} = require('../controllers/patientsController');
const { authenticate } = require('../middleware/authMiddleware');
const { attachTenantModels } = require('../middleware/tenantMiddleware');
const {
  validatePatientInput,
  validateObjectIdParam,
} = require('../middleware/validationMiddleware');

// All routes require authentication and tenant context
router.use(authenticate);
router.use(attachTenantModels);

// Patient routes with validation
router.get('/', getAllPatients);
router.get('/:id', validateObjectIdParam, getPatientById);
router.post('/', validatePatientInput, createPatient);
router.put('/:id', validateObjectIdParam, validatePatientInput, updatePatient);
router.delete('/:id', validateObjectIdParam, deletePatient);

module.exports = router;
