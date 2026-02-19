const express = require('express');
const router = express.Router();
const CallMeetingTracker = require('../models/CallMeetingTracker');
const { requireHospitalAuth, requireHospitalRole } = require('../middleware/hospitalAuth');

/**
 * @route   GET /api/hospital/call_meeting_tracker
 * @desc    Get all call/meeting tracker entries
 */
router.get('/', requireHospitalAuth, async (req, res) => {
    try {
        const tenantId = req.hospitalUser.tenantId;
        const entries = await CallMeetingTracker.find({ tenantId }).sort({ date: -1 });
        const data = entries.map((e) => ({
            _id: e._id.toString(),
            ...e.toObject(),
            _id: e._id.toString(),
        }));
        return res.json({ success: true, entries: data });
    } catch (error) {
        console.error('Get call/meeting tracker error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/hospital/call_meeting_tracker
 * @desc    Add a call/meeting tracker entry
 */
router.post('/', requireHospitalAuth, async (req, res) => {
    try {
        const data = req.body;
        const tenantId = req.hospitalUser.tenantId;
        const entry = new CallMeetingTracker({
            ...data,
            tenantId,
            date: data.date ? new Date(data.date) : new Date(),
            recorded_by: req.hospitalUser.username || 'Staff',
        });
        await entry.save();
        return res.status(201).json({ success: true, message: 'Entry added', id: entry._id.toString() });
    } catch (error) {
        console.error('Add call/meeting tracker error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   DELETE /api/hospital/call_meeting_tracker/:id
 * @desc    Delete a call/meeting tracker entry
 */
router.delete('/:id', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const tenantId = req.hospitalUser.tenantId;
        const result = await CallMeetingTracker.findOneAndDelete({ _id: req.params.id, tenantId });
        if (!result) return res.status(404).json({ success: false, error: 'Entry not found' });
        return res.json({ success: true, message: 'Entry deleted' });
    } catch (error) {
        console.error('Delete call/meeting tracker error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   GET /api/hospital/call_meeting_tracker/summary/:month/:year
 * @desc    Get summary for a specific month/year
 */
router.get('/summary/:month/:year', requireHospitalAuth, async (req, res) => {
    try {
        const month = parseInt(req.params.month);
        const year = parseInt(req.params.year);
        const tenantId = req.hospitalUser.tenantId;
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 1);

        const entries = await CallMeetingTracker.find({
            tenantId,
            date: { $gte: startDate, $lt: endDate },
        }).sort({ date: 1 });

        const data = entries.map((e) => ({ ...e.toObject(), _id: e._id.toString() }));
        return res.json({ success: true, entries: data });
    } catch (error) {
        console.error('Call/meeting summary error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
