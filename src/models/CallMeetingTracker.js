const mongoose = require('mongoose');

/**
 * Call/Meeting Tracker Schema
 * Tracks scheduled calls and meetings with patients
 */
const callMeetingTrackerSchema = new mongoose.Schema(
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
        patientName: {
            type: String,
            trim: true,
        },
        type: {
            type: String,
            enum: ['call', 'meeting'],
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        notes: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for faster queries
callMeetingTrackerSchema.index({ patient_id: 1 });
callMeetingTrackerSchema.index({ date: -1 });
callMeetingTrackerSchema.index({ type: 1 });

const CallMeetingTracker = mongoose.model('CallMeetingTracker', callMeetingTrackerSchema);


module.exports = CallMeetingTracker;
