const mongoose = require('mongoose');
const { getHospitalDB } = require('../config/hospitalDatabase');

/**
 * Call/Meeting Tracker Schema
 * Tracks scheduled calls and meetings with patients
 */
const callMeetingTrackerSchema = new mongoose.Schema(
    {
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

const CallMeetingTracker = getHospitalDB().model('CallMeetingTracker', callMeetingTrackerSchema);


module.exports = CallMeetingTracker;
