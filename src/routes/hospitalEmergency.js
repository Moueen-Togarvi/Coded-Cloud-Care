const express = require('express');
const router = express.Router();
const EmergencyAlert = require('../models/EmergencyAlert');
const { requireHospitalAuth } = require('../middleware/hospitalAuth');

/**
 * @route   GET /api/hospital/emergency
 * @desc    Get all emergency alerts
 */
router.get('/', requireHospitalAuth, async (req, res) => {
    try {
        const alerts = await EmergencyAlert.find().sort({ createdAt: -1 });
        const data = alerts.map((a) => ({
            _id: a._id.toString(),
            patient_name: a.patient_name,
            note: a.note,
            severity: a.severity,
            added_by: a.added_by,
            date: a.createdAt
                ? a.createdAt.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : 'Just now',
        }));
        return res.json(data);
    } catch (error) {
        console.error('Get emergency alerts error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/hospital/emergency
 * @desc    Add an emergency alert
 */
router.post('/', requireHospitalAuth, async (req, res) => {
    try {
        const { patient_name, note, severity } = req.body;
        const alert = new EmergencyAlert({
            patient_name: patient_name || 'Unknown',
            note: note || '',
            severity: severity || 'critical',
            added_by: req.session?.hospitalUsername || 'Staff',
        });
        await alert.save();
        return res.status(201).json({ success: true, message: 'Alert added' });
    } catch (error) {
        console.error('Add emergency alert error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   DELETE /api/hospital/emergency/:id
 * @desc    Delete (resolve) an emergency alert
 */
router.delete('/:id', requireHospitalAuth, async (req, res) => {
    try {
        await EmergencyAlert.findByIdAndDelete(req.params.id);
        return res.json({ success: true, message: 'Alert resolved' });
    } catch (error) {
        console.error('Delete emergency alert error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
