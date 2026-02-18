const mongoose = require('mongoose');

/**
 * Hospital Patient Schema
 * Comprehensive patient management with financial tracking
 */
const hospitalPatientSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        cnic: {
            type: String,
            trim: true,
        },
        contactNo: {
            type: String,
            trim: true,
        },
        guardianName: {
            type: String,
            trim: true,
        },
        relation: {
            type: String,
            trim: true,
        },
        address: {
            type: String,
            trim: true,
        },
        admissionDate: {
            type: Date,
            required: true,
        },
        monthlyFee: {
            type: String, // Stored as string with commas (e.g., "50,000")
            default: '0',
        },
        receivedAmount: {
            type: String, // Cumulative payments received
            default: '0',
        },
        drug: {
            type: String,
            trim: true,
        },
        photo1: {
            type: String, // Base64 or URL
            default: '',
        },
        photo2: {
            type: String,
            default: '',
        },
        photo3: {
            type: String,
            default: '',
        },
        isDischarged: {
            type: Boolean,
            default: false,
        },
        dischargeDate: {
            type: Date,
        },
        laundryStatus: {
            type: Boolean,
            default: false,
        },
        laundryAmount: {
            type: Number,
            default: 0, // One-time charge added at discharge
        },
        notes: {
            type: [String],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for faster queries
hospitalPatientSchema.index({ name: 1 });
hospitalPatientSchema.index({ isDischarged: 1 });
hospitalPatientSchema.index({ admissionDate: -1 });
hospitalPatientSchema.index({ createdAt: -1 });

const HospitalPatient = mongoose.model('HospitalPatient', hospitalPatientSchema);

module.exports = HospitalPatient;
