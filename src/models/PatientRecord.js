const mongoose = require('mongoose');

/**
 * Patient Record Schema
 * Stores medical records and session notes for patients
 */
const patientRecordSchema = new mongoose.Schema(
    {
        patient_id: {
            type: String, // Stored as string to match Python implementation
            required: true,
        },
        record_type: {
            type: String,
            enum: ['session_note', 'medical_record'],
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        created_by: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for faster queries
patientRecordSchema.index({ patient_id: 1 });
patientRecordSchema.index({ record_type: 1 });
patientRecordSchema.index({ createdAt: -1 });

const PatientRecord = mongoose.model('PatientRecord', patientRecordSchema);

module.exports = PatientRecord;
