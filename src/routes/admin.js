const express = require('express');
const router = express.Router();
const User = require('../models/User');
const AdminProfile = require('../models/AdminProfile');
const Subscription = require('../models/Subscription');
const { verifyToken } = require('../utils/jwt');

/**
 * @route POST /api/admin/login
 * @desc Explicit Super Admin Login preventing cross-tenant pollution
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        const user = await AdminProfile.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials or missing Super Admin privileges.' });
        }

        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials or missing Super Admin privileges.' });
        }

        if (!user.isActive) {
            return res.status(403).json({ success: false, message: 'Your admin account has been deactivated.' });
        }

        const { generateToken } = require('../utils/jwt');
        const token = generateToken(user._id);

        res.status(200).json({
            success: true,
            message: 'Admin login successful',
            data: {
                token,
                user: { id: user._id, email: user.email, name: user.name, role: user.role }
            }
        });
    } catch (error) {
        console.error('Admin Login error:', error);
        res.status(500).json({ success: false, message: 'Admin login failed', error: error.message });
    }
});

// Custom Admin Authentication Middleware
const adminAuthenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const token = authHeader.substring(7);
        const decoded = verifyToken(token);

        const user = await AdminProfile.findById(decoded.userId);
        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Session Expired or Unauthorized. Please log in as an administrator.'
            });
        }

        req.user = { userId: user._id, email: user.email, role: user.role };
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};

// Protect all admin routes using the custom admin auth
router.use(adminAuthenticate);

/**
 * @route GET /api/admin/users
 * @desc Get all registered users with their details and subscriptions
 */
router.get('/users', async (req, res) => {
    try {
        const { status, plan, search } = req.query;

        let query = {};

        if (status === 'active') query.isActive = true;
        if (status === 'inactive') query.isActive = false;

        if (search) {
            query.$or = [
                { companyName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { 'contactInfo.phone': { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query).sort({ createdAt: -1 }).select('-passwordHash');

        // Fetch subscriptions for all users
        const usersWithSubs = await Promise.all(users.map(async (user) => {
            const subscriptions = await Subscription.find({ userId: user._id });

            // Filter by plan if requested
            if (plan && plan !== 'all') {
                const hasPlan = subscriptions.some(s => s.planType === plan);
                if (!hasPlan) return null;
            }

            return {
                ...user.toObject(),
                subscriptions
            };
        }));

        const filteredResults = usersWithSubs.filter(u => u !== null);

        res.json({
            success: true,
            count: filteredResults.length,
            data: filteredResults
        });
    } catch (error) {
        console.error('Admin Fetch Users Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
    }
});

/**
 * @route GET /api/admin/users/:id
 * @desc Get a single user with their details and subscriptions
 */
router.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-passwordHash');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const subscriptions = await Subscription.find({ userId: user._id });

        res.json({
            success: true,
            data: {
                ...user.toObject(),
                subscriptions
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch user', error: error.message });
    }
});

/**
 * @route PUT /api/admin/users/:id/status
 * @desc Toggle user active state (suspend/activate)
 */
router.put('/users/:id/status', async (req, res) => {
    try {
        const { isActive } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isActive },
            { new: true }
        ).select('-passwordHash');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            message: `User ${isActive ? 'activated' : 'suspended'} successfully`,
            data: user
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update user status', error: error.message });
    }
});

/**
 * @route PUT /api/admin/users/:id/plan
 * @desc Change a user's subscription plan directly
 */
router.put('/users/:id/plan', async (req, res) => {
    try {
        const { productSlug, planType, endDate } = req.body;

        if (!productSlug || !planType || !endDate) {
            return res.status(400).json({ success: false, message: 'Missing required subscription fields' });
        }

        // Find or create the subscription for this product
        let sub = await Subscription.findOne({ userId: req.params.id, productSlug });

        if (sub) {
            sub.planType = planType;
            sub.endDate = new Date(endDate);
            sub.status = 'active';
            await sub.save();
        } else {
            sub = await Subscription.create({
                userId: req.params.id,
                productSlug,
                planType,
                endDate: new Date(endDate),
                status: 'active'
            });
        }

        res.json({
            success: true,
            message: 'User plan updated successfully',
            data: sub
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update user plan', error: error.message });
    }
});

/**
 * @route PUT /api/admin/users/:id
 * @desc Update user basic information (Email, Company Name, etc.)
 */
router.put('/users/:id', async (req, res) => {
    try {
        const { email, companyName, phone } = req.body;
        const updateData = {};
        if (email) updateData.email = email;
        if (companyName) updateData.companyName = companyName;
        if (phone) updateData['contactInfo.phone'] = phone;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true }
        ).select('-passwordHash');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            message: 'User information updated successfully',
            data: user
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update user', error: error.message });
    }
});

/**
 * @route GET /api/admin/system-users
 * @desc Get all platform administrators and staff
 */
router.get('/system-users', async (req, res) => {
    try {
        const users = await AdminProfile.find().select('-passwordHash');
        res.json({ success: true, count: users.length, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch system users' });
    }
});

/**
 * @route POST /api/admin/system-users
 * @desc Create a new platform administrator or staff
 */
router.post('/system-users', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password || !role) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const exists = await AdminProfile.findOne({ email });
        if (exists) {
            return res.status(400).json({ success: false, message: 'Email already registered as system user' });
        }

        const newUser = await AdminProfile.create({
            name,
            email,
            passwordHash: password, // Will be hashed by model
            role
        });

        res.status(201).json({
            success: true,
            message: 'System user created successfully',
            data: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create system user' });
    }
});

/**
 * @route DELETE /api/admin/system-users/:id
 * @desc Delete a system administrator or staff
 */
router.delete('/system-users/:id', async (req, res) => {
    try {
        // Prevent self-deletion
        if (req.user.userId === req.params.id) {
            return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
        }

        const user = await AdminProfile.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'System user not found' });
        }

        res.json({ success: true, message: 'System user deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete system user' });
    }
});

module.exports = router;
