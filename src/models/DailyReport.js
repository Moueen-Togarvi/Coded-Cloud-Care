const mongoose = require('mongoose');
const { getHospitalDB } = require('../config/hospitalDatabase');

const dailyReportSchema = new mongoose.Schema(
    {
        date: { type: String, required: true },          // 'YYYY-MM-DD'
        patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalPatient', required: true },
        schedule: { type: Map, of: String, default: {} }, // { morning: 'done', evening: 'not_done', ... }
        updated_at: { type: Date },
        updated_by: { type: String, default: 'System' },
    },
    { timestamps: true }
);

dailyReportSchema.index({ date: 1, patient_id: 1 }, { unique: true });

module.exports = getHospitalDB().model('DailyReport', dailyReportSchema);
