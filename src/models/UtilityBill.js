const mongoose = require('mongoose');

/**
 * Utility Bill Schema
 * Tracks electricity, gas, water, and internet bills
 */
const utilityBillSchema = new mongoose.Schema(
    {
        billType: {
            type: String,
            enum: ['electricity', 'gas', 'water', 'internet', 'other'],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        month: {
            type: Number,
            required: true,
            min: 1,
            max: 12,
        },
        year: {
            type: Number,
            required: true,
        },
        dueDate: {
            type: Date,
        },
        isPaid: {
            type: Boolean,
            default: false,
        },
        paidDate: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for faster queries
utilityBillSchema.index({ billType: 1 });
utilityBillSchema.index({ year: -1, month: -1 });
utilityBillSchema.index({ isPaid: 1 });

const UtilityBill = mongoose.model('UtilityBill', utilityBillSchema);

module.exports = UtilityBill;
