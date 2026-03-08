const express = require('express');
const { register, login, getProfile, getSession, resetPasswordWithToken } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

const { bridgeHospitalAuth } = require('../middleware/hospitalAuth');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/reset', resetPasswordWithToken);
router.post('/logout', (req, res) => {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || (process.env.NODE_ENV === 'production' ? '__Host-pms-sid' : 'pms-sid');
    res.clearCookie('authToken');
    if (req.session) {
        req.session.destroy((err) => {
            if (err) return res.status(500).json({ success: false, error: 'Logout failed' });
            res.clearCookie('connect.sid');
            res.clearCookie('pms-sid');
            res.clearCookie('__Host-pms-sid');
            res.clearCookie(sessionCookieName);
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
