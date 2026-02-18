const express = require('express');
const router = express.Router();
const UtilityBill = require('../models/UtilityBill');
const { requireHospitalAuth, requireHospitalRole } = require('../middleware/hospitalAuth');

/**
 * @route   GET /api/hospital/utility_bills
 * @desc    Get all utility bills
 */
router.get('/', requireHospitalAuth, async (req, res) => {
    try {
        const bills = await UtilityBill.find().sort({ date: -1 });
        const data = bills.map((b) => ({ ...b.toObject(), _id: b._id.toString() }));
        return res.json({ success: true, bills: data });
    } catch (error) {
        console.error('Get utility bills error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/hospital/utility_bills
 * @desc    Add a utility bill
 */
router.post('/', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const data = req.body;
        const bill = new UtilityBill({
            ...data,
            date: data.date ? new Date(data.date) : new Date(),
        });
        await bill.save();
        return res.status(201).json({ success: true, message: 'Bill added', id: bill._id.toString() });
    } catch (error) {
        console.error('Add utility bill error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   DELETE /api/hospital/utility_bills/:id
 * @desc    Delete a utility bill
 */
router.delete('/:id', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        await UtilityBill.findByIdAndDelete(req.params.id);
        return res.json({ success: true, message: 'Bill deleted' });
    } catch (error) {
        console.error('Delete utility bill error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
