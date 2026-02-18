const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { authenticate } = require('../middleware/authMiddleware');
const { attachTenantModels } = require('../middleware/tenantMiddleware');

router.use(authenticate);
router.use(attachTenantModels);

router.get('/', getSettings);
router.put('/', updateSettings);

module.exports = router;
