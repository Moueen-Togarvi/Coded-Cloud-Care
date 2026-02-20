const express = require('express');
const router = express.Router();
const HospitalExpense = require('../models/HospitalExpense');
const { requireHospitalAuth } = require('../middleware/hospitalAuth');
const { cleanInputData } = require('../utils/hospitalHelpers');

/**
 * @route   GET /api/hospital/expenses
 * @desc    Get expenses with filters
 * @access  Private
 */
router.get('/', requireHospitalAuth, async (req, res) => {
    try {
        const { type, category, startDate, endDate } = req.query;
        const tenantId = req.hospitalUser.tenantId;

        const query = { tenantId };
        if (type) query.type = type;
        if (category) query.category = category;
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        const expenses = await HospitalExpense.find(query).sort({ date: -1 });

        const expensesData = expenses.map((expense) => ({
            _id: expense._id.toString(),
            type: expense.type,
            category: expense.category,
            description: expense.description,
            amount: expense.amount,
            date: expense.date.toISOString(),
            auto: expense.auto,
            paymentMethod: expense.paymentMethod,
        }));

        return res.json({
            success: true,
            expenses: expensesData,
        });
    } catch (error) {
        console.error('Get expenses error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @route   POST /api/hospital/expenses
 * @desc    Add expense/income
 * @access  Private
 */
router.post('/', requireHospitalAuth, async (req, res) => {
    try {
        const data = cleanInputData(req.body);
        const tenantId = req.hospitalUser.tenantId;

        const expense = new HospitalExpense({
            tenantId,
            type: data.type,
            category: data.category,
            description: data.description,
            amount: parseInt(data.amount),
            date: data.date ? new Date(data.date) : new Date(),
            auto: data.auto || false,
            paymentMethod: (data.paymentMethod || 'cash').toLowerCase(),
        });

        await expense.save();

        return res.status(201).json({
            success: true,
            message: 'Expense recorded',
            id: expense._id.toString(),
        });
    } catch (error) {
        console.error('Add expense error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @route   DELETE /api/hospital/expenses/:id
 * @desc    Delete expense
 * @access  Private
 */
router.delete('/:id', requireHospitalAuth, async (req, res) => {
    try {
        const tenantId = req.hospitalUser.tenantId;
        const result = await HospitalExpense.findOneAndDelete({ _id: req.params.id, tenantId });

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Expense not found',
            });
        }

        return res.json({
            success: true,
            message: 'Expense deleted',
        });
    } catch (error) {
        console.error('Delete expense error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @route   GET /api/hospital/expenses/summary
 * @desc    Get financial summary
 * @access  Private
 */
router.get('/summary', requireHospitalAuth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const tenantId = req.hospitalUser.tenantId;
        const mongoose = require('mongoose');

        const query = { tenantId: new mongoose.Types.ObjectId(tenantId) };
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        const summary = await HospitalExpense.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ]);

        const summaryData = {
            incoming: 0,
            outgoing: 0,
            net: 0,
        };

        summary.forEach((item) => {
            if (item._id === 'incoming') {
                summaryData.incoming = item.total;
            } else if (item._id === 'outgoing') {
                summaryData.outgoing = item.total;
            }
        });

        summaryData.net = summaryData.incoming - summaryData.outgoing;

        return res.json({
            success: true,
            summary: summaryData,
        });
    } catch (error) {
        console.error('Get expense summary error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

module.exports = router;
