const mongoose = require('mongoose');
const { getHospitalDB } = require('../config/hospitalDatabase');

/**
 * Employee Schema
 * Hospital staff management
 */
const employeeSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        designation: {
            type: String,
            required: true,
            trim: true,
        },
        salary: {
            type: Number,
            required: true,
        },
        joinDate: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for faster queries
employeeSchema.index({ name: 1 });
employeeSchema.index({ status: 1 });
employeeSchema.index({ joinDate: -1 });

const Employee = getHospitalDB().model('Employee', employeeSchema);


module.exports = Employee;
