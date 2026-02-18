const User = require('../models/User');
const Plan = require('../models/Plan');
const { provisionTenant } = require('../services/tenantService');
const { generateToken } = require('../utils/jwt');

/**
 * Register a new user (clinic)
 * - Creates user account
 * - Provisions tenant database
 * - Starts 3-day free trial
 */
const register = async (req, res) => {
  try {
    const { email, password, companyName, phone, address, planType, productId } = req.body;

    // Validate required fields
    if (!email || !password || !companyName || !planType || !productId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, company name, plan type, and product ID',
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

    // Find the selected plan
    const plan = await Plan.findOne({ planType, isActive: true });
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan type or plan not available',
      });
    }

    // Provision tenant database
    const { tenantDbName, tenantDbUrl } = await provisionTenant(companyName);

    // Calculate trial end date
    const trialStartDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + (plan.trialDays || 3));

    // Create new user
    const user = new User({
      email,
      passwordHash: password, // Will be hashed by pre-save hook
      companyName,
      contactInfo: {
        phone: phone || '',
        address: address || '',
      },
      planId: plan._id,
      tenantDbName,
      tenantDbUrl,
      subscriptionStatus: 'trial',
      trialStartDate,
      trialEndDate,
      productId,
      isActive: true,
    });

    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Your 3-day free trial has started!',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          companyName: user.companyName,
          planType: plan.planType,
          subscriptionStatus: user.subscriptionStatus,
          trialEndDate: user.trialEndDate,
          tenantDbName: user.tenantDbName,
          productId: user.productId,
        },
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
 * - Validates credentials
 * - Returns JWT token
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Find user by email
    const user = await User.findOne({ email }).populate('planId');
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

    // Check if user has access (trial not expired or active subscription)
    if (!user.hasAccess()) {
      return res.status(403).json({
        success: false,
        message: 'Your trial has expired. Please subscribe to continue using the service.',
        subscriptionStatus: user.subscriptionStatus,
        trialEndDate: user.trialEndDate,
      });
    }

    // Generate JWT token
    const token = generateToken(user._id);

    // Bridge session for Hospital PMS users
    if (user.productId === 'hospital-pms') {
      req.session.hospitalUserId = user._id.toString();
      req.session.hospitalUsername = user.email;
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
          planType: user.planId.planType,
          subscriptionStatus: user.subscriptionStatus,
          trialEndDate: user.trialEndDate,
          tenantDbName: user.tenantDbName,
          productId: user.productId,
        },
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
 * Get current user profile
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate('planId').select('-passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          companyName: user.companyName,
          contactInfo: user.contactInfo,
          plan: {
            type: user.planId.planType,
            name: user.planId.planName,
            price: user.planId.price,
            billingCycle: user.planId.billingCycle,
          },
          subscriptionStatus: user.subscriptionStatus,
          trialStartDate: user.trialStartDate,
          trialEndDate: user.trialEndDate,
          tenantDbName: user.tenantDbName,
          productId: user.productId,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
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

module.exports = {
  register,
  login,
  getProfile,
};
