const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');

/**
 * Middleware to authenticate JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    let token = null;
    let user = null;

    // 1. Check for token in Cookies (Preferred for Browser security)
    if (req.cookies && req.cookies.authToken) {
      token = req.cookies.authToken;
    }
    // 2. Check for token in Authorization Header (Legacy / Mobile)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (token) {
      const decoded = verifyToken(token);
      user = await User.findById(decoded.userId);
    }
    // 3. Fallback: Check for existing Hospital Session (Staff Bridge)
    else if (req.session && req.session.hospitalUserId) {
      // If it's a staff member, the tenantId is the Master User's ID
      const ownerId = req.session.hospitalTenantId;
      user = await User.findById(ownerId);

      // Populate additional info for staff
      req.isStaff = true;
      req.staffId = req.session.hospitalUserId;
      req.staffRole = req.session.hospitalRole;
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.',
      });
    }

    req.user = {
      userId: user._id,
      email: user.email,
      companyName: user.companyName,
      tenantDbName: user.tenantDbName,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
      error: error.message,
    });
  }
};

/**
 * Middleware to restrict access based on roles
 * @param {Array<string>} roles - Allowed roles
 */
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Master users (SaaS owners) are Super Admins for their tenant
    if (!req.isStaff) {
      return next();
    }

    // Staff members check
    if (roles.length && !roles.includes(req.staffRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access requires ${roles.join(' or ')} role.`,
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize,
};
