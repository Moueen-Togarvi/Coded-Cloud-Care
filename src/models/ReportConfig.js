const mongoose = require('mongoose');

const reportConfigSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
            unique: true,
        },
        day_columns: { type: mongoose.Schema.Types.Mixed, default: [] },
        night_columns: { type: mongoose.Schema.Types.Mixed, default: [] },
    },
    { timestamps: true }
);

module.exports = mongoose.model('ReportConfig', reportConfigSchema);
