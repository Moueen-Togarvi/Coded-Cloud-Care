const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Overhead = require('../models/Overhead');
const CanteenSale = require('../models/CanteenSale');
const { requireHospitalAuth, requireHospitalRole } = require('../middleware/hospitalAuth');

/**
 * @route   GET /api/hospital/overheads/:month/:year
 * @desc    Get overhead entries for a month
 */
router.get('/:month/:year', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const month = parseInt(req.params.month);
        const year = parseInt(req.params.year);
        const tenantId = req.hospitalUser.tenantId;

        const entries = await Overhead.find({ tenantId, month, year }).sort({ date: 1 });

        // Build daily canteen map from canteen_sales
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 1);

        const canteenAgg = await CanteenSale.aggregate([
            {
                $match: {
                    tenantId: new mongoose.Types.ObjectId(tenantId),
                    date: { $gte: startDate, $lt: endDate }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                    total: { $sum: '$amount' },
                },
            },
        ]);

        const canteenDaily = {};
        canteenAgg.forEach((item) => {
            canteenDaily[item._id] = item.total;
        });

        return res.json({ success: true, entries, canteenDaily });
    } catch (error) {
        console.error('Get overheads error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   GET /api/hospital/overheads/annual/:year
 * @desc    Get annual overhead summary
 */
router.get('/annual/:year', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const year = parseInt(req.params.year);
        const tenantId = req.hospitalUser.tenantId;
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year + 1, 0, 1);

        // Monthly aggregation from overheads
        const overheadAgg = await Overhead.aggregate([
            { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), year } },
            {
                $group: {
                    _id: '$month',
                    kitchen: { $sum: '$kitchen' },
                    canteen_auto: { $sum: '$canteen_auto' },
                    others: { $sum: '$others' },
                    pay_advance: { $sum: '$pay_advance' },
                    income: { $sum: '$income' },
                    total_expense: { $sum: '$total_expense' },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // Monthly canteen from canteen_sales
        const canteenAgg = await CanteenSale.aggregate([
            {
                $match: {
                    tenantId: new mongoose.Types.ObjectId(tenantId),
                    date: { $gte: startDate, $lt: endDate }
                }
            },
            {
                $group: {
                    _id: { $month: '$date' },
                    total: { $sum: '$amount' },
                },
            },
        ]);

        const canteenByMonth = {};
        canteenAgg.forEach((item) => {
            canteenByMonth[item._id] = item.total;
        });

        return res.json({ success: true, overheadAgg, canteenByMonth });
    } catch (error) {
        console.error('Get annual overheads error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/hospital/overheads/entry
 * @desc    Save or update a single overhead entry for a date
 */
router.post('/entry', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const data = req.body;
        const { date, month, year } = data;
        const tenantId = req.hospitalUser.tenantId;

        const kitchen = parseFloat(data.kitchen || 0);
        const others = parseFloat(data.others || 0);
        const pay_advance = parseFloat(data.pay_advance || 0);
        const income = parseFloat(data.income || 0);
        const employee_names = data.employee_names || '';
        const canteen_auto = parseFloat(data.canteen_auto || 0);
        const total_expense = kitchen + canteen_auto + others + pay_advance;

        const entry = {
            tenantId,
            date,
            month: parseInt(month),
            year: parseInt(year),
            kitchen,
            canteen_auto,
            others,
            pay_advance,
            employee_names,
            income,
            total_expense,
            last_updated: new Date(),
        };

        await Overhead.findOneAndUpdate(
            { tenantId, date, month: parseInt(month), year: parseInt(year) },
            { $set: entry },
            { upsert: true, new: true }
        );

        return res.json({ success: true, message: 'Entry saved', entry });
    } catch (error) {
        console.error('Save overhead entry error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   GET /api/hospital/overheads/canteen-sync/:month/:year
 * @desc    Get updated daily canteen totals for a month
 */
router.get('/canteen-sync/:month/:year', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const month = parseInt(req.params.month);
        const year = parseInt(req.params.year);
        const tenantId = req.hospitalUser.tenantId;

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 1);

        const canteenAgg = await CanteenSale.aggregate([
            {
                $match: {
                    tenantId: new mongoose.Types.ObjectId(tenantId),
                    date: { $gte: startDate, $lt: endDate }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                    total: { $sum: '$amount' },
                },
            },
        ]);

        const canteenDaily = {};
        canteenAgg.forEach((item) => {
            canteenDaily[item._id] = item.total;
        });

        return res.json({ success: true, canteen_daily: canteenDaily });
    } catch (error) {
        console.error('Canteen sync error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
