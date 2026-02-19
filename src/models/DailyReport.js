const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        date: { type: String, required: true },          // 'YYYY-MM-DD'
        patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalPatient', required: true },
        schedule: { type: Map, of: String, default: {} }, // { morning: 'done', evening: 'not_done', ... }
        updated_at: { type: Date },
        updated_by: { type: String, default: 'System' },
    },
    { timestamps: true }
);

dailyReportSchema.index({ tenantId: 1, date: 1, patient_id: 1 }, { unique: true });

module.exports = mongoose.model('DailyReport', dailyReportSchema);
