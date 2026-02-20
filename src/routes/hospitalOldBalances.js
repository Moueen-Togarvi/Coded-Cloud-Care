const express = require('express');
const router = express.Router();
const HospitalOldBalance = require('../models/HospitalOldBalance');
const { requireHospitalAuth } = require('../middleware/hospitalAuth');
const { cleanInputData } = require('../utils/hospitalHelpers');

/**
 * @route   GET /api/old-balances
 * @desc    Get all recovery records
 * @access  Private
 */
router.get('/', requireHospitalAuth, async (req, res) => {
    try {
        const tenantId = req.hospitalUser.tenantId;
        const records = await HospitalOldBalance.find({ tenantId }).sort({ createdAt: -1 });

        const data = records.map((rec) => ({
            id: rec._id.toString(),
            name: rec.name,
            amount: rec.amount,
            commitment_date: rec.commitment_date ? rec.commitment_date.toISOString() : null,
            last_call_date: rec.last_call_date ? rec.last_call_date.toISOString() : null,
            status: rec.status,
            created_at: rec.createdAt,
        }));

        return res.json(data);
    } catch (error) {
        console.error('Get old balances error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   POST /api/old-balances
 * @desc    Create new recovery record
 * @access  Private
 */
router.post('/', requireHospitalAuth, async (req, res) => {
    try {
        const data = cleanInputData(req.body);
        const tenantId = req.hospitalUser.tenantId;

        if (!data.name || !data.amount) {
            return res.status(400).json({ error: 'Name and amount are required' });
        }

        const newRecord = new HospitalOldBalance({
            tenantId,
            name: data.name,
            amount: parseFloat(data.amount),
            commitment_date: data.commitment_date ? new Date(data.commitment_date) : null,
            last_call_date: data.last_call_date ? new Date(data.last_call_date) : null,
            notes: data.notes || '',
        });

        await newRecord.save();

        return res.status(201).json({
            success: true,
            id: newRecord._id.toString(),
            message: 'Record created',
        });
    } catch (error) {
        console.error('Create old balance error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   DELETE /api/old-balances/:id
 * @desc    Delete a record
 * @access  Private
 */
router.delete('/:id', requireHospitalAuth, async (req, res) => {
    try {
        const tenantId = req.hospitalUser.tenantId;
        const result = await HospitalOldBalance.findOneAndDelete({
            _id: req.params.id,
            tenantId,
        });

        if (!result) {
            return res.status(404).json({ error: 'Record not found' });
        }

        return res.json({ success: true, message: 'Record deleted' });
    } catch (error) {
        console.error('Delete old balance error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
