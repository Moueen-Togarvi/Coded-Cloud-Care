const mongoose = require('mongoose');
const { getHospitalDB } = require('../config/hospitalDatabase');

const reportConfigSchema = new mongoose.Schema(
    {
        _id: { type: String, default: 'main_config' },
        day_columns: { type: mongoose.Schema.Types.Mixed, default: [] },
        night_columns: { type: mongoose.Schema.Types.Mixed, default: [] },
    },
    { timestamps: true }
);

module.exports = getHospitalDB().model('ReportConfig', reportConfigSchema);
