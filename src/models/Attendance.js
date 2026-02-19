const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        employee_id: { type: String, required: true },
        year: { type: Number, required: true },
        month: { type: Number, required: true },
        days: { type: Map, of: String, default: {} }, // { '1': 'P', '2': 'A', ... }
    },
    { timestamps: true }
);

attendanceSchema.index({ tenantId: 1, employee_id: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
