const express = require('express');
const router = express.Router();
const DailyReport = require('../models/DailyReport');
const ReportConfig = require('../models/ReportConfig');
const { requireHospitalAuth, requireHospitalRole } = require('../middleware/hospitalAuth');

/**
 * @route   GET /api/hospital/reports
 * @desc    Get daily report entries for a date
 */
router.get('/', requireHospitalRole(['Admin', 'General Staff', 'Doctor']), async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ success: false, error: 'Date required' });
        const tenantId = req.hospitalUser.tenantId;

        const reports = await DailyReport.find({ tenantId, date });
        const data = reports.map((r) => ({
            _id: r._id.toString(),
            date: r.date,
            patient_id: r.patient_id.toString(),
            schedule: Object.fromEntries(r.schedule || new Map()),
            updated_at: r.updated_at,
            updated_by: r.updated_by,
        }));

        return res.json(data);
    } catch (error) {
        console.error('Get daily report error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/hospital/reports/update
 * @desc    Update a daily report entry (upsert)
 */
router.post('/update', requireHospitalRole(['Admin', 'General Staff', 'Doctor']), async (req, res) => {
    try {
        const { date, patient_id, time_slot, status } = req.body;
        const tenantId = req.hospitalUser.tenantId;

        await DailyReport.findOneAndUpdate(
            { tenantId, date, patient_id },
            {
                $set: {
                    [`schedule.${time_slot}`]: status,
                    updated_at: new Date(),
                    updated_by: req.hospitalUser.username || 'System',
                },
            },
            { upsert: true, new: true }
        );

        return res.json({ success: true, message: 'Status updated' });
    } catch (error) {
        console.error('Update daily report error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   GET /api/hospital/reports/config
 * @desc    Get report layout config
 */
router.get('/config', requireHospitalAuth, async (req, res) => {
    try {
        const tenantId = req.hospitalUser.tenantId;
        const config = await ReportConfig.findOne({ tenantId });
        return res.json(config || {});
    } catch (error) {
        console.error('Get report config error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/hospital/reports/config
 * @desc    Save report layout config
 */
router.post('/config', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const { day_columns, night_columns } = req.body;
        const tenantId = req.hospitalUser.tenantId;
        await ReportConfig.findOneAndUpdate(
            { tenantId },
            { $set: { day_columns, night_columns } },
            { upsert: true, new: true }
        );
        return res.json({ success: true, message: 'Layout saved' });
    } catch (error) {
        console.error('Save report config error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
