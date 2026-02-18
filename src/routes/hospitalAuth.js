const express = require('express');
const router = express.Router();
const HospitalUser = require('../models/HospitalUser');
const { requireHospitalAuth } = require('../middleware/hospitalAuth');
const { cleanInputData, normalizeEmail } = require('../utils/hospitalHelpers');

/**
 * @route   POST /api/hospital/auth/login
 * @desc    Login user and create session
 * @access  Public
 */
router.post('/login', async (req, res) => {
    try {
        const data = cleanInputData(req.body || {});
        const { username, password } = data;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required',
            });
        }

        // Find user by username
        const user = await HospitalUser.findOne({ username: username.toLowerCase() });

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
            });
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
            });
        }

        // Create session
        req.session.hospitalUserId = user._id.toString();
        req.session.hospitalUsername = user.username;
        req.session.hospitalRole = user.role;

        return res.json({
            success: true,
            message: 'Login successful',
            username: user.username,
            role: user.role,
            name: user.name,
            user_id: user._id.toString(),
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @route   POST /api/hospital/auth/logout
 * @desc    Logout user and destroy session
 * @access  Private
 */
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                error: 'Failed to logout',
            });
        }
        res.clearCookie('connect.sid');
        return res.json({
            success: true,
            message: 'Logged out',
        });
    });
});

/**
 * @route   GET /api/hospital/auth/session
 * @desc    Check if user is logged in
 * @access  Public
 */
router.get('/session', (req, res) => {
    if (req.session && req.session.hospitalUserId) {
        return res.json({
            success: true,
            is_logged_in: true,
            username: req.session.hospitalUsername,
            role: req.session.hospitalRole,
            user_id: req.session.hospitalUserId,
        });
    }
    return res.json({
        success: true,
        is_logged_in: false,
    });
});

/**
 * @route   POST /api/hospital/auth/change_password
 * @desc    Change user's own password
 * @access  Private
 */
router.post('/change_password', requireHospitalAuth, async (req, res) => {
    try {
        const data = cleanInputData(req.body);
        const { old_password, new_password } = data;

        if (!old_password || !new_password) {
            return res.status(400).json({
                success: false,
                error: 'Old password and new password are required',
            });
        }

        // Get user
        const user = await HospitalUser.findById(req.session.hospitalUserId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }

        // Verify old password
        const isPasswordValid = await user.comparePassword(old_password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid old password',
            });
        }

        // Update password
        user.password = new_password;
        await user.save();

        return res.json({
            success: true,
            message: 'Password updated successfully',
        });
    } catch (error) {
        console.error('Change password error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

module.exports = router;
