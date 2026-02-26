const express = require('express');
const { register, login, getProfile, getSession } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

const { bridgeHospitalAuth } = require('../middleware/hospitalAuth');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/logout', (req, res) => {
    res.clearCookie('authToken');
    if (req.session) {
        req.session.destroy((err) => {
            if (err) return res.status(500).json({ success: false, error: 'Logout failed' });
            res.clearCookie('connect.sid');
            res.clearCookie('__Host-pms-sid'); // Clear new secure session cookie
            return res.json({ success: true, message: 'Logged out successfully' });
        });
    } else {
        return res.json({ success: true, message: 'Logged out successfully' });
    }
});
router.get('/session', bridgeHospitalAuth, getSession); // Legacy bridge for Hospital PMS

// Protected routes
router.get('/profile', authenticate, getProfile);

module.exports = router;
