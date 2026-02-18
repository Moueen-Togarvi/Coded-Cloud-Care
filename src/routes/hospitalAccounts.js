const express = require('express');
const router = express.Router();
const HospitalPatient = require('../models/HospitalPatient');
const HospitalExpense = require('../models/HospitalExpense');
const CanteenSale = require('../models/CanteenSale');
const { requireHospitalAuth, requireHospitalRole } = require('../middleware/hospitalAuth');
const { calculateProratedFee, parseAmount } = require('../utils/hospitalHelpers');

/**
 * @route   GET /api/hospital/accounts/summary
 * @desc    Get accounts summary (income, expenses, balance)
 */
router.get('/summary', requireHospitalAuth, async (req, res) => {
    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

        // Total incoming this month (manual + patient fees)
        const incomingAgg = await HospitalExpense.aggregate([
            { $match: { type: 'incoming', date: { $gte: startOfMonth, $lt: endOfMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const totalIncoming = incomingAgg[0]?.total || 0;

        // Total outgoing this month
        const outgoingAgg = await HospitalExpense.aggregate([
            { $match: { type: 'outgoing', date: { $gte: startOfMonth, $lt: endOfMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const totalOutgoing = outgoingAgg[0]?.total || 0;

        // Canteen sales this month
        const canteenAgg = await CanteenSale.aggregate([
            { $match: { date: { $gte: startOfMonth, $lt: endOfMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const totalCanteen = canteenAgg[0]?.total || 0;

        // Total expected balance from active patients
        const activePatients = await HospitalPatient.find({ isDischarged: { $ne: true } });
        const canteenTotals = await CanteenSale.aggregate([
            { $group: { _id: '$patient_id', total: { $sum: '$amount' } } },
        ]);
        const canteenMap = {};
        canteenTotals.forEach((item) => {
            canteenMap[item._id.toString()] = item.total;
        });

        let totalExpectedBalance = 0;
        for (const patient of activePatients) {
            const pid = patient._id.toString();
            const admissionDate = patient.admissionDate;
            let daysElapsed = 0;
            if (admissionDate) {
                daysElapsed = Math.max(0, Math.floor((today - new Date(admissionDate)) / (1000 * 60 * 60 * 24)));
            }
            const fee = calculateProratedFee(patient.monthlyFee, daysElapsed);
            const canteen = canteenMap[pid] || 0;
            const laundry = patient.laundryStatus ? patient.laundryAmount : 0;
            const received = parseAmount(patient.receivedAmount);
            const balance = fee + canteen + laundry - received;
            totalExpectedBalance += Math.max(0, balance);
        }

        return res.json({
            success: true,
            totalIncoming,
            totalOutgoing,
            totalCanteen,
            totalExpectedBalance,
            netBalance: totalIncoming - totalOutgoing,
        });
    } catch (error) {
        console.error('Accounts summary error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
