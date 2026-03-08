const mongoose = require('mongoose');

/**
 * Canteen Sale Schema
 * Tracks canteen purchases and adjustments for patients
 */
const canteenSaleSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        patient_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HospitalPatient',
            required: true,
        },
        item: {
            type: String,
            default: '',
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
        type: {
            type: String,
            enum: ['sale', 'adjustment', 'other'],
            default: 'sale',
        },
        entry_type: {
            type: String,
            enum: ['daily', 'other'],
        },
        recorded_by: {
            type: String,
            trim: true,
        },
        edited_by: {
            type: String,
            trim: true,
        },
        edited_at: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for faster queries
canteenSaleSchema.index({ patient_id: 1 });
canteenSaleSchema.index({ date: -1 });
canteenSaleSchema.index({ type: 1 });
canteenSaleSchema.index({ entry_type: 1 });

const CanteenSale = mongoose.model('CanteenSale', canteenSaleSchema);

module.exports = CanteenSale;
