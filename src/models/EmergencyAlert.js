const mongoose = require('mongoose');

const emergencyAlertSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        patient_name: { type: String, default: 'Unknown' },
        note: { type: String, default: '' },
        severity: { type: String, default: 'critical' },
        added_by: { type: String, default: 'Staff' },
    },
    { timestamps: true }
);

module.exports = mongoose.model('EmergencyAlert', emergencyAlertSchema);
