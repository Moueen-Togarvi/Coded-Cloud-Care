const mongoose = require('mongoose');
const { getHospitalDB } = require('../config/hospitalDatabase');

const emergencyAlertSchema = new mongoose.Schema(
    {
        patient_name: { type: String, default: 'Unknown' },
        note: { type: String, default: '' },
        severity: { type: String, default: 'critical' },
        added_by: { type: String, default: 'Staff' },
    },
    { timestamps: true }
);

module.exports = getHospitalDB().model('EmergencyAlert', emergencyAlertSchema);
