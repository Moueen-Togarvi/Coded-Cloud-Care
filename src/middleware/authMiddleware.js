const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');

/**
 * Middleware to authenticate JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please login to access this resource.',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyToken(token);

    // Find user
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    // Attach user info to request
    req.user = {
      userId: user._id,
      email: user.email,
      companyName: user.companyName,
      tenantDbName: user.tenantDbName,
      subscriptionStatus: user.subscriptionStatus,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      error: error.message,
    });
  }
};

/**
 * Middleware to check if user has valid access (trial not expired or active subscription)
 */
const checkAccess = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }


    // Check if user has access
    if (!user.hasAccess()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Your trial has expired or subscription is not active.',
        subscriptionStatus: user.subscriptionStatus,
        trialEndDate: user.trialEndDate,
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking access',
      error: error.message,
    });
  }
};

module.exports = {
  authenticate,
  checkAccess,
};
