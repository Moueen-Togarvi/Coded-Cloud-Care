const mongoose = require('mongoose');
const { getHospitalDB } = require('../config/hospitalDatabase');

const attendanceSchema = new mongoose.Schema(
    {
        employee_id: { type: String, required: true },
        year: { type: Number, required: true },
        month: { type: Number, required: true },
        days: { type: Map, of: String, default: {} }, // { '1': 'P', '2': 'A', ... }
    },
    { timestamps: true }
);

attendanceSchema.index({ employee_id: 1, year: 1, month: 1 }, { unique: true });

module.exports = getHospitalDB().model('Attendance', attendanceSchema);
