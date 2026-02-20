const User = require('../models/User');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const { provisionTenant } = require('../services/tenantService');
const { generateToken } = require('../utils/jwt');

const TRIAL_DAYS = 3;

/**
 * Register a new user
 * - Creates user account
 * - Provisions tenant database
 * - Agar productId diya ho to us product ka 3-day trial start karta hai
 */
const register = async (req, res) => {
  try {
    const { email, password, companyName, phone, address, planType, productId, termsAccepted } = req.body;

    if (!email || !password || !companyName || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, company name, and phone number',
      });
    }

    if (!termsAccepted) {
      return res.status(400).json({
        success: false,
        message: 'You must accept the Terms and Privacy Policy to register.',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Find plan (optional — default to basic if not found)
    let plan = null;
    if (planType) {
      plan = await Plan.findOne({ planType, isActive: true });
    }
    if (!plan) {
      plan = await Plan.findOne({ isActive: true });
    }

    // Provision tenant database
    const { tenantDbName, tenantDbUrl } = await provisionTenant(companyName);

    // Create new user
    const user = new User({
      email,
      passwordHash: password, // Will be hashed by pre-save hook
      companyName,
      contactInfo: {
        phone: phone || '',
        address: address || '',
      },
      planId: plan ? plan._id : undefined,
      tenantDbName,
      tenantDbUrl,
      isActive: true,
      termsAccepted: true,
    });

    await user.save();

    // Agar productId diya hai to us product ka trial subscription create karo
    let initialSubscription = null;
    if (productId) {
      const validSlugs = ['hospital-pms', 'pharmacy-pos', 'lab-reporting', 'quick-invoice', 'private-clinic-lite'];
      if (validSlugs.includes(productId)) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + TRIAL_DAYS);

        initialSubscription = await Subscription.create({
          userId: user._id,
          productSlug: productId,
          planType: 'trial',
          startDate,
          endDate,
          status: 'active',
        });
      }
    }

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Your 3-day free trial has started.',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          companyName: user.companyName,
        },
        activeSubscription: initialSubscription
          ? {
            productSlug: initialSubscription.productSlug,
            planType: initialSubscription.planType,
            endDate: initialSubscription.endDate,
            status: initialSubscription.status,
          }
          : null,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message,
    });
  }
};

/**
 * Login user
 * - Kisi bhi product se login ho sakta hai (PRODUCT_MISMATCH check removed)
 * - User ki saari subscriptions return karta hai
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    // User ki saari subscriptions fetch karo (expired wali bhi dikhao, frontend decide kare)
    const subscriptions = await Subscription.find({ userId: user._id }).sort({ createdAt: -1 });

    // Auto-expire jo subscriptions endDate guzar chuki hain
    const now = new Date();
    const updatedSubs = await Promise.all(
      subscriptions.map(async (sub) => {
        if (sub.status === 'active' && now > sub.endDate) {
          sub.status = 'expired';
          await sub.save();
        }
        return sub;
      })
    );

    // Generate JWT token
    const token = generateToken(user._id);

    // Hospital PMS session bridge (if user has hospital-pms subscription)
    const hospitalSub = updatedSubs.find(s => s.productSlug === 'hospital-pms' && s.status === 'active' && now < s.endDate);

    if (hospitalSub && req.session) {
      req.session.hospitalUserId = user._id.toString();
      req.session.hospitalTenantId = user._id.toString();
      req.session.hospitalUsername = user.email;
      req.session.hospitalName = user.companyName;
      req.session.hospitalRole = 'Admin';
      req.session.isMasterUser = true;
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          companyName: user.companyName,
          role: user.role,
        },
        // Saari active subscriptions
        subscriptions: updatedSubs.map((s) => ({
          productSlug: s.productSlug,
          planType: s.planType,
          status: s.status,
          endDate: s.endDate,
          isAccessible: s.status === 'active' && now < s.endDate,
        })),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message,
    });
  }
};

/**
 * Get current user profile + subscriptions
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const now = new Date();
    const subscriptions = await Subscription.find({ userId: user._id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          companyName: user.companyName,
          contactInfo: user.contactInfo,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
        subscriptions: subscriptions.map((s) => ({
          productSlug: s.productSlug,
          planType: s.planType,
          status: s.status,
          endDate: s.endDate,
          isAccessible: s.status === 'active' && now < s.endDate,
        })),
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message,
    });
  }
};

/**
 * Get session status (Legacy bridge for Hospital PMS)
 */
const getSession = async (req, res) => {
  try {
    if (req.session && req.session.hospitalUserId) {
      return res.json({
        success: true,
        is_logged_in: true,
        username: req.session.hospitalUsername,
        role: req.session.hospitalRole,
        user_id: req.session.hospitalUserId,
        is_master_user: req.session.isMasterUser || false,
      });
    }
    return res.json({
      success: true,
      is_logged_in: false,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  getSession,
};
