const mongoose = require('mongoose');

const overheadSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        date: { type: String, required: true },   // 'YYYY-MM-DD'
        month: { type: Number, required: true },
        year: { type: Number, required: true },
        kitchen: { type: Number, default: 0 },
        canteen_auto: { type: Number, default: 0 },
        others: { type: Number, default: 0 },
        pay_advance: { type: Number, default: 0 },
        employee_names: { type: String, default: '' },
        income: { type: Number, default: 0 },
        total_expense: { type: Number, default: 0 },
        last_updated: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

// Unique per tenant+date+month+year
overheadSchema.index({ tenantId: 1, date: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Overhead', overheadSchema);
