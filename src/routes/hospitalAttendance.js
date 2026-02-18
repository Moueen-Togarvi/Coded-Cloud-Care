const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const { requireHospitalAuth } = require('../middleware/hospitalAuth');

/**
 * @route   GET /api/hospital/attendance
 * @desc    Get attendance for a month/year
 */
router.get('/', requireHospitalAuth, async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const month = parseInt(req.query.month);

        const records = await Attendance.find({ year, month });

        const result = {};
        records.forEach((rec) => {
            result[rec.employee_id] = Object.fromEntries(rec.days || new Map());
        });

        return res.json(result);
    } catch (error) {
        console.error('Get attendance error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/hospital/attendance
 * @desc    Save/update a single attendance mark
 */
router.post('/', requireHospitalAuth, async (req, res) => {
    try {
        const { empId, day, year, month, mark } = req.body;

        const query = { employee_id: empId, year: parseInt(year), month: parseInt(month) };

        if (mark === '') {
            await Attendance.findOneAndUpdate(query, { $unset: { [`days.${day}`]: '' } }, { upsert: true });
        } else {
            await Attendance.findOneAndUpdate(query, { $set: { [`days.${day}`]: mark } }, { upsert: true });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('Save attendance error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
