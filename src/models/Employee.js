const mongoose = require('mongoose');

/**
 * Employee Schema
 * Hospital staff management
 */
const employeeSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
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
        advance: {
            type: Number,
            default: 0,
        },
        duty_timings: {
            type: String,
            trim: true,
            default: '',
        },
        joinDate: {
            type: Date,
            required: true,
        },
        cnic: {
            type: String,
            trim: true,
            default: '',
        },
        phone: {
            type: String,
            trim: true,
            default: '',
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

const Employee = mongoose.model('Employee', employeeSchema);


module.exports = Employee;
