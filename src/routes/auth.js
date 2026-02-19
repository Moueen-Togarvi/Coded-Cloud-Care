const express = require('express');
const { register, login, getProfile, getSession } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

const { bridgeHospitalAuth } = require('../middleware/hospitalAuth');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ success: false, error: 'Logout failed' });
        res.clearCookie('connect.sid');
        return res.json({ success: true, message: 'Logged out successfully' });
    });
});
router.get('/session', bridgeHospitalAuth, getSession); // Legacy bridge for Hospital PMS

// Protected routes
router.get('/profile', authenticate, getProfile);

module.exports = router;
