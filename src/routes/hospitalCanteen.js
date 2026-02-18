const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const CanteenSale = require('../models/CanteenSale');
const HospitalPatient = require('../models/HospitalPatient');
const { requireHospitalAuth, requireHospitalRole } = require('../middleware/hospitalAuth');
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
        return res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
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
            { $group: { _id: '$patient_id', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]);

        const patientIds = breakdown.map((item) => item._id);
        const patients = await HospitalPatient.find({ _id: { $in: patientIds } }, { name: 1 });

        const patientMap = {};
        patients.forEach((patient) => { patientMap[patient._id.toString()] = patient.name; });

        const breakdownData = breakdown.map((item) => ({
            patient_id: item._id.toString(),
            patient_name: patientMap[item._id.toString()] || 'Unknown',
            total: item.total,
            count: item.count,
        }));

        return res.json({ success: true, breakdown: breakdownData });
    } catch (error) {
        console.error('Get canteen breakdown error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
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

        return res.json({ success: true, sales: salesData });
    } catch (error) {
        console.error('Get canteen history error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
    }
});

/**
 * @route   GET /api/hospital/canteen/daily-sheet
 * @desc    Get daily canteen sheet (all active patients + today's sales)
 * @access  Private
 */
router.get('/daily-sheet', requireHospitalAuth, async (req, res) => {
    try {
        const dateStr = req.query.date;
        const targetDate = dateStr ? new Date(dateStr) : new Date();

        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const patients = await HospitalPatient.find({ isDischarged: { $ne: true } }, { name: 1 }).sort({ name: 1 });

        const dailySalesAgg = await CanteenSale.aggregate([
            { $match: { date: { $gte: startOfDay, $lte: endOfDay } } },
            {
                $group: {
                    _id: '$patient_id',
                    items: { $push: { item: '$item', amount: '$amount' } },
                    total: { $sum: '$amount' },
                },
            },
        ]);

        const dailySalesMap = {};
        dailySalesAgg.forEach((s) => { dailySalesMap[s._id.toString()] = s; });

        const sheet = patients.map((p) => {
            const pid = p._id.toString();
            const salesData = dailySalesMap[pid] || { items: [], total: 0 };
            return { id: pid, name: p.name, todayItems: salesData.items, todayTotal: salesData.total };
        });

        return res.json({
            date: targetDate.toISOString().split('T')[0],
            patients: sheet,
        });
    } catch (error) {
        console.error('Daily sheet error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   GET /api/hospital/canteen/monthly-table
 * @desc    Get monthly canteen table with daily entries per patient
 * @access  Private
 */
router.get('/monthly-table', requireHospitalRole(['Admin', 'Canteen']), async (req, res) => {
    try {
        const today = new Date();
        const month = parseInt(req.query.month || today.getMonth() + 1);
        const year = parseInt(req.query.year || today.getFullYear());

        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 1);
        const daysInMonth = Math.round((endOfMonth - startOfMonth) / (1000 * 60 * 60 * 24));

        const patients = await HospitalPatient.find({}, { name: 1, isDischarged: 1, admissionDate: 1 }).sort({ name: 1 });

        // Get manual old balance overrides
        const db = mongoose.connection.db;
        const balanceOverrides = {};
        if (db) {
            const overrides = await db.collection('canteen_balance_overrides').find({ month, year }).toArray();
            overrides.forEach((o) => { balanceOverrides[o.patient_id.toString()] = o.old_balance; });
        }

        if (!patients.length) {
            return res.json({ month, year, daysInMonth, patients: [] });
        }

        const patientIds = patients.map((p) => p._id);

        // Previous months sales (non-other)
        const prevSalesAgg = await CanteenSale.aggregate([
            {
                $match: {
                    patient_id: { $in: patientIds },
                    date: { $lt: startOfMonth },
                    $or: [{ entry_type: { $exists: false } }, { entry_type: { $ne: 'other' } }],
                },
            },
            { $group: { _id: '$patient_id', total: { $sum: '$amount' } } },
        ]);
        const prevSalesMap = {};
        prevSalesAgg.forEach((item) => { prevSalesMap[item._id.toString()] = item.total; });

        // Previous months adjustments (other)
        const prevAdjAgg = await CanteenSale.aggregate([
            { $match: { patient_id: { $in: patientIds }, date: { $lt: startOfMonth }, entry_type: 'other' } },
            { $group: { _id: '$patient_id', total: { $sum: '$amount' } } },
        ]);
        const prevAdjMap = {};
        prevAdjAgg.forEach((item) => { prevAdjMap[item._id.toString()] = item.total; });

        // Current month daily sales
        const currentSales = await CanteenSale.find({
            patient_id: { $in: patientIds },
            date: { $gte: startOfMonth, $lt: endOfMonth },
            $or: [{ entry_type: { $exists: false } }, { entry_type: { $ne: 'other' } }],
        });

        // Current month other entries
        const otherEntries = await CanteenSale.find({
            patient_id: { $in: patientIds },
            date: { $gte: startOfMonth, $lt: endOfMonth },
            entry_type: 'other',
        });
        const otherMap = {};
        otherEntries.forEach((item) => { otherMap[item.patient_id.toString()] = item.amount; });

        const patientsData = patients.map((patient) => {
            const pid = patient._id.toString();
            const prevSales = prevSalesMap[pid] || 0;
            const prevAdj = prevAdjMap[pid] || 0;
            const calculatedBalance = prevSales + prevAdj;
            const oldBalance = balanceOverrides.hasOwnProperty(pid) ? balanceOverrides[pid] : calculatedBalance;
            const hasManualOverride = balanceOverrides.hasOwnProperty(pid);

            const dailyEntries = {};
            currentSales.forEach((sale) => {
                if (sale.patient_id.toString() === pid) {
                    const day = new Date(sale.date).getDate();
                    dailyEntries[day] = (dailyEntries[day] || 0) + sale.amount;
                }
            });

            const otherAmount = otherMap[pid] || 0;
            const monthTotal = Object.values(dailyEntries).reduce((a, b) => a + b, 0) + otherAmount;
            const totalSpent = oldBalance + monthTotal;

            return {
                id: pid,
                name: patient.name,
                oldBalance,
                calculatedBalance,
                hasManualOverride,
                dailyEntries,
                other: otherAmount,
                monthTotal,
                total: totalSpent,
                isDischarged: patient.isDischarged || false,
            };
        });

        return res.json({ month, year, daysInMonth, patients: patientsData });
    } catch (error) {
        console.error('Monthly table error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/hospital/canteen/old-balance
 * @desc    Save manual override for canteen old balance
 * @access  Admin
 */
router.post('/old-balance', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const { patient_id, month, year, old_balance } = req.body;
        const db = mongoose.connection.db;
        if (!db) return res.status(500).json({ success: false, error: 'Database error' });

        await db.collection('canteen_balance_overrides').updateOne(
            { patient_id: new mongoose.Types.ObjectId(patient_id), month: parseInt(month), year: parseInt(year) },
            {
                $set: {
                    old_balance: parseInt(old_balance || 0),
                    updated_at: new Date(),
                    updated_by: req.session?.hospitalUsername,
                },
            },
            { upsert: true }
        );

        return res.json({ success: true, message: 'Old balance updated' });
    } catch (error) {
        console.error('Save old balance error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/hospital/canteen/daily-entry
 * @desc    Save or update a daily canteen entry
 * @access  Admin, Canteen
 */
router.post('/daily-entry', requireHospitalRole(['Admin', 'Canteen']), async (req, res) => {
    try {
        const data = cleanInputData(req.body);
        if (!data.patient_id || !data.date || data.amount === undefined || !data.entry_type) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const patientId = new mongoose.Types.ObjectId(data.patient_id);
        const entryDate = new Date(data.date);
        const amount = parseInt(data.amount);
        const entryType = data.entry_type; // 'daily' or 'other'
        const userRole = req.session?.hospitalRole;
        const username = req.session?.hospitalUsername || 'Unknown';

        const startOfDay = new Date(entryDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);

        const existingEntry = await CanteenSale.findOne({
            patient_id: patientId,
            date: { $gte: startOfDay, $lt: endOfDay },
            entry_type: entryType,
        });

        if (existingEntry) {
            if (amount === 0) {
                if (userRole === 'Canteen') {
                    return res.status(403).json({ success: false, error: 'Canteen staff cannot delete existing entries' });
                }
                await CanteenSale.findByIdAndDelete(existingEntry._id);
                return res.json({ success: true, message: 'Entry deleted', id: existingEntry._id.toString() });
            } else {
                if (userRole === 'Canteen') {
                    return res.status(403).json({ success: false, error: 'Canteen staff cannot edit existing entries' });
                }
                await CanteenSale.findByIdAndUpdate(existingEntry._id, {
                    $set: { amount, date: entryDate, edited_by: username, edited_at: new Date() },
                });
                return res.json({ success: true, message: 'Entry updated', id: existingEntry._id.toString() });
            }
        } else {
            if (amount === 0) {
                return res.json({ success: true, message: 'No entry created for zero amount' });
            }
            const newEntry = new CanteenSale({
                patient_id: patientId,
                date: entryDate,
                amount,
                entry_type: entryType,
                item: data.item || '',
                recorded_by: username,
            });
            await newEntry.save();
            return res.status(201).json({ success: true, message: 'Entry recorded', id: newEntry._id.toString() });
        }
    } catch (error) {
        console.error('Daily entry error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   GET /api/hospital/debug/canteen/:patient_id
 * @desc    Debug: view all canteen entries for a patient
 */
router.get('/debug/:patient_id', requireHospitalAuth, async (req, res) => {
    try {
        const { patient_id } = req.params;
        const entries = await CanteenSale.find({
            patient_id: new mongoose.Types.ObjectId(patient_id),
        }).sort({ date: 1 });

        const result = entries.map((e) => ({
            date: e.date ? e.date.toISOString() : '',
            amount: e.amount,
            entry_type: e.entry_type || '',
            item: e.item || '',
            recorded_by: e.recorded_by || '',
        }));

        return res.json({ entries: result, total: result.reduce((a, e) => a + e.amount, 0), count: result.length });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   DELETE /api/hospital/debug/canteen/:patient_id
 * @desc    Debug: delete all canteen entries for a patient
 */
router.delete('/debug/:patient_id', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const { patient_id } = req.params;
        const result = await CanteenSale.deleteMany({ patient_id: new mongoose.Types.ObjectId(patient_id) });
        return res.json({ success: true, message: `Deleted ${result.deletedCount} entries`, deleted_count: result.deletedCount });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
