const mongoose = require('mongoose');
const { getHospitalDB } = require('../config/hospitalDatabase');

/**
 * Hospital Expense Schema
 * Tracks both incoming and outgoing financial transactions
 */
const hospitalExpenseSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ['incoming', 'outgoing'],
            required: true,
        },
        category: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        date: {
            type: Date,
            default: Date.now,
        },
        auto: {
            type: Boolean,
            default: false, // True for auto-generated patient payment entries
        },
        paymentMethod: {
            type: String,
            enum: ['cash', 'bank', 'cheque', 'online', 'other'],
            default: 'cash',
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for faster queries
hospitalExpenseSchema.index({ type: 1 });
hospitalExpenseSchema.index({ date: -1 });
hospitalExpenseSchema.index({ category: 1 });
hospitalExpenseSchema.index({ auto: 1 });

const HospitalExpense = getHospitalDB().model('HospitalExpense', hospitalExpenseSchema);

module.exports = HospitalExpense;
