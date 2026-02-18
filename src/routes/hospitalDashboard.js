const express = require('express');
const router = express.Router();
const HospitalPatient = require('../models/HospitalPatient');
const CanteenSale = require('../models/CanteenSale');
const { requireHospitalAuth } = require('../middleware/hospitalAuth');
const { calculateProratedFee, parseAmount } = require('../utils/hospitalHelpers');

/**
 * @route   GET /api/hospital/dashboard
 * @desc    Get dashboard metrics
 * @access  Private
 */
router.get('/', requireHospitalAuth, async (req, res) => {
    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

        // 1. Basic counts
        const totalPatients = await HospitalPatient.countDocuments({});
        const admissionsThisMonth = await HospitalPatient.countDocuments({
            admissionDate: { $gte: startOfMonth, $lt: endOfMonth },
        });
        const dischargesThisMonth = await HospitalPatient.countDocuments({
            isDischarged: true,
            dischargeDate: { $gte: startOfMonth, $lt: endOfMonth },
        });

        // 2. Aggregate canteen sales
        const canteenTotals = await CanteenSale.aggregate([
            { $group: { _id: '$patient_id', total: { $sum: '$amount' } } },
        ]);

        const canteenMap = {};
        canteenTotals.forEach((item) => {
            canteenMap[item._id.toString()] = item.total;
        });

        // 3. Calculate total expected balance from active patients
        const activePatients = await HospitalPatient.find({ isDischarged: { $ne: true } });
        let totalExpectedBalance = 0;

        for (const patient of activePatients) {
            try {
                const pid = patient._id.toString();

                // Calculate days elapsed
                const admissionDate = patient.admissionDate;
                let daysElapsed = 0;
                if (admissionDate) {
                    const admissionDt = new Date(admissionDate);
                    daysElapsed = Math.max(0, Math.floor((today - admissionDt) / (1000 * 60 * 60 * 24)));
                }

                // Get prorated fee
                const fee = calculateProratedFee(patient.monthlyFee, daysElapsed);

                // Get canteen total
                const canteen = canteenMap[pid] || 0;

                // Get laundry
                const laundry = patient.laundryStatus ? patient.laundryAmount : 0;

                // Get received amount
                const received = parseAmount(patient.receivedAmount);

                // Calculate balance
                const balance = fee + canteen + laundry - received;
                totalExpectedBalance += Math.max(0, balance);
            } catch (error) {
                console.error(`Dashboard calculation error for patient ${patient.name}:`, error);
            }
        }

        // 4. Canteen sales this month
        const canteenMonthResult = await CanteenSale.aggregate([
            { $match: { date: { $gte: startOfMonth, $lt: endOfMonth } } },
            { $group: { _id: null, total_sales: { $sum: '$amount' } } },
        ]);
        const totalCanteenSalesThisMonth = canteenMonthResult[0]?.total_sales || 0;

        return res.json({
            success: true,
            totalPatients,
            admissionsThisMonth,
            dischargesThisMonth,
            totalExpectedBalance,
            totalCanteenSalesThisMonth,
        });
    } catch (error) {
        console.error('Dashboard metrics error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @route   GET /api/hospital/dashboard/admissions
 * @desc    Get detailed admissions for current month
 * @access  Private
 */
router.get('/admissions', requireHospitalAuth, async (req, res) => {
    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const admissions = await HospitalPatient.find({
            createdAt: { $gte: startOfMonth },
        }).sort({ createdAt: -1 });

        const admissionsData = admissions.map((patient) => ({
            id: patient._id.toString(),
            name: patient.name,
            admissionDate: patient.admissionDate,
            created_at: patient.createdAt.toISOString(),
        }));

        return res.json({
            success: true,
            admissions: admissionsData,
        });
    } catch (error) {
        console.error('Get admissions error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @route   GET /api/hospital/dashboard/debug
 * @desc    Debug dashboard data
 * @access  Private
 */
router.get('/debug', requireHospitalAuth, async (req, res) => {
    try {
        const patients = await HospitalPatient.find({}, { name: 1, isDischarged: 1 });
        const canteen = await CanteenSale.find().limit(10);

        return res.json({
            success: true,
            patientsCount: patients.length,
            canteenSample: canteen,
            session: req.session,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
