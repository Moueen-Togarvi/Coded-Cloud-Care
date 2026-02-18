const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Hospital PMS User Schema
 * Separate from multi-tenant User model
 * Supports Admin, Doctor, and Psychologist roles
 */
const hospitalUserSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            enum: ['Admin', 'Doctor', 'Psychologist'],
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            validate: {
                validator: function (v) {
                    return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
                },
                message: 'Please enter a valid email address',
            },
        },
    },
    {
        timestamps: true,
    }
);

// Index for faster queries
hospitalUserSchema.index({ username: 1 });
hospitalUserSchema.index({ email: 1 });
hospitalUserSchema.index({ role: 1 });

// Hash password before saving
hospitalUserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare passwords
hospitalUserSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const HospitalUser = mongoose.model('HospitalUser', hospitalUserSchema);

module.exports = HospitalUser;
