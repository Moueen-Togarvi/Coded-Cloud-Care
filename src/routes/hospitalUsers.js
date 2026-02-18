const express = require('express');
const router = express.Router();
const HospitalUser = require('../models/HospitalUser');
const { requireHospitalRole } = require('../middleware/hospitalAuth');
const { cleanInputData, normalizeEmail } = require('../utils/hospitalHelpers');

/**
 * @route   GET /api/hospital/users
 * @desc    Get all users (Admin only)
 * @access  Private (Admin)
 */
router.get('/', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const users = await HospitalUser.find({}, { password: 0 }).sort({ createdAt: -1 });

        const usersData = users.map((user) => ({
            _id: user._id.toString(),
            username: user.username,
            role: user.role,
            name: user.name,
            email: user.email,
            created_at: user.createdAt,
        }));

        return res.json({
            success: true,
            users: usersData,
        });
    } catch (error) {
        console.error('Get users error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @route   POST /api/hospital/users
 * @desc    Create new user (Admin only)
 * @access  Private (Admin)
 */
router.post('/', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const data = cleanInputData(req.body);
        const { username, password, role, name, email } = data;

        // Validate required fields
        if (!username || !password || !role || !name || !email) {
            return res.status(400).json({
                success: false,
                error: 'Missing fields',
                message: 'Username, password, role, name, and email are required',
            });
        }

        // Normalize email
        const normalizedEmail = normalizeEmail(email);

        if (!normalizedEmail) {
            return res.status(400).json({
                success: false,
                error: 'Valid email required',
            });
        }

        // Check if username already exists
        const existingUser = await HospitalUser.findOne({ username: username.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'Username already exists',
            });
        }

        // Check if email already exists
        const existingEmail = await HospitalUser.findOne({ email: normalizedEmail });
        if (existingEmail) {
            return res.status(409).json({
                success: false,
                error: 'Email already exists',
            });
        }

        // Create new user
        const newUser = new HospitalUser({
            username: username.toLowerCase(),
            password,
            role,
            name,
            email: normalizedEmail,
        });

        await newUser.save();

        return res.status(201).json({
            success: true,
            message: 'User created',
            id: newUser._id.toString(),
        });
    } catch (error) {
        console.error('Create user error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

module.exports = router;
