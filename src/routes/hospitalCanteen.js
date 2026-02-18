const express = require('express');
const router = express.Router();
const CanteenSale = require('../models/CanteenSale');
const HospitalPatient = require('../models/HospitalPatient');
const { requireHospitalAuth } = require('../middleware/hospitalAuth');
const { cleanInputData } = require('../utils/hospitalHelpers');

/**
 * @route   POST /api/hospital/canteen/sales
 * @desc    Record canteen sale
 * @access  Private
 */
router.post('/sales', requireHospitalAuth, async (req, res) => {
    try {
        const data = cleanInputData(req.body);

        const sale = new CanteenSale({
            patient_id: data.patient_id,
            item: data.item,
            amount: parseInt(data.amount),
            date: data.date ? new Date(data.date) : new Date(),
            type: data.type || 'sale',
        });

        await sale.save();

        return res.status(201).json({
            success: true,
            message: 'Sale recorded',
            id: sale._id.toString(),
        });
    } catch (error) {
        console.error('Record canteen sale error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @route   GET /api/hospital/canteen/sales/breakdown
 * @desc    Get canteen sales breakdown by patient
 * @access  Private
 */
router.get('/sales/breakdown', requireHospitalAuth, async (req, res) => {
    try {
        const breakdown = await CanteenSale.aggregate([
            {
                $group: {
                    _id: '$patient_id',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ]);

        // Get patient names
        const patientIds = breakdown.map((item) => item._id);
        const patients = await HospitalPatient.find({ _id: { $in: patientIds } }, { name: 1 });

        const patientMap = {};
        patients.forEach((patient) => {
            patientMap[patient._id.toString()] = patient.name;
        });

        const breakdownData = breakdown.map((item) => ({
            patient_id: item._id.toString(),
            patient_name: patientMap[item._id.toString()] || 'Unknown',
            total: item.total,
            count: item.count,
        }));

        return res.json({
            success: true,
            breakdown: breakdownData,
        });
    } catch (error) {
        console.error('Get canteen breakdown error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @route   GET /api/hospital/canteen/sales/history
 * @desc    Get canteen sales history
 * @access  Private
 */
router.get('/sales/history', requireHospitalAuth, async (req, res) => {
    try {
        const { patient_id, limit = 50 } = req.query;

        const query = patient_id ? { patient_id } : {};
        const sales = await CanteenSale.find(query).sort({ date: -1 }).limit(parseInt(limit));

        const salesData = sales.map((sale) => ({
            _id: sale._id.toString(),
            patient_id: sale.patient_id.toString(),
            item: sale.item,
            amount: sale.amount,
            date: sale.date.toISOString(),
            type: sale.type,
        }));

        return res.json({
            success: true,
            sales: salesData,
        });
    } catch (error) {
        console.error('Get canteen history error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

module.exports = router;
