const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { attachTenantModels } = require('../middleware/tenantMiddleware');

router.use(authenticate);
router.use(attachTenantModels);

router.get('/', authorize(['admin']), getSettings);
router.put('/', authorize(['admin']), updateSettings);

module.exports = router;
