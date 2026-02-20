const mongoose = require('mongoose');

const hospitalOldBalanceSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HospitalUser',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        amount: {
            type: Number,
            required: true,
            default: 0,
        },
        commitment_date: {
            type: Date,
        },
        last_call_date: {
            type: Date,
        },
        status: {
            type: String,
            enum: ['pending', 'recovered', 'partial'],
            default: 'pending',
        },
        notes: {
            type: String,
        },
    },
    { timestamps: true }
);

// Index for efficient querying by tenant
hospitalOldBalanceSchema.index({ tenantId: 1, name: 1 });

module.exports = mongoose.model('HospitalOldBalance', hospitalOldBalanceSchema);
