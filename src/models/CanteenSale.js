const mongoose = require('mongoose');
const { getHospitalDB } = require('../config/hospitalDatabase');

/**
 * Canteen Sale Schema
 * Tracks canteen purchases and adjustments for patients
 */
const canteenSaleSchema = new mongoose.Schema(
    {
        patient_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HospitalPatient',
            required: true,
        },
        item: {
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
        type: {
            type: String,
            enum: ['sale', 'adjustment', 'other'],
            default: 'sale',
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

const CanteenSale = getHospitalDB().model('CanteenSale', canteenSaleSchema);

module.exports = CanteenSale;
