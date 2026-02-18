const HospitalUser = require('../models/HospitalUser');
const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');

/**
 * Hospital PMS Authentication Middleware
 * Session-based authentication (compatible with existing Python frontend)
 */

/**
 * Middleware to check if user is logged in
 */
const requireHospitalAuth = async (req, res, next) => {
    await bridgeHospitalAuth(req, res, () => {
        if (!req.session || !req.session.hospitalUserId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Please login to access this resource',
            });
        }
        next();
    });
};

/**
 * Middleware to bridge Master JWT to Hospital Session without blocking
 */
const bridgeHospitalAuth = async (req, res, next) => {
    // 1. Check for existing Hospital Session
    if (req.session && req.session.hospitalUserId) {
        return next();
    }

    // 2. Check for Master JWT Token
    try {
        const authHeader = req.headers.authorization || req.headers['x-auth-token'];
        if (authHeader) {
            const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
            const decoded = verifyToken(token);
            const user = await User.findById(decoded.userId);

            if (user && user.isActive && user.productId === 'hospital-pms') {
                // Bridge to Hospital Session for Admin bypass
                req.session.hospitalUserId = user._id.toString();
                req.session.hospitalUsername = user.email;
                req.session.hospitalRole = 'Admin';
                req.session.isMasterUser = true;

                req.hospitalUser = {
                    userId: user._id,
                    username: user.email,
                    role: 'Admin',
                    name: user.companyName,
                    isMasterUser: true,
                };
            }
        }
    } catch (error) {
        // Fall through quietly
    }
    next();
};

/**
 * Middleware to check if user has required role(s)
 * @param {Array<string>} roles - Array of allowed roles (e.g., ['Admin', 'Doctor'])
 */
const requireHospitalRole = (roles) => {
    return async (req, res, next) => {
        try {
            // Attempt to bridge first
            await bridgeHospitalAuth(req, res, async () => {
                // 1. Check if user is logged in (after potential bridge)
                if (!req.session || !req.session.hospitalUserId) {
                    return res.status(401).json({
                        success: false,
                        error: 'Unauthorized',
                        message: 'Please login to access this resource',
                    });
                }

                // 2. Check if it's a bridged Master User
                if (req.session.isMasterUser) {
                    if (roles.includes('Admin')) {
                        return next();
                    } else {
                        return res.status(403).json({
                            success: false,
                            error: 'Access Denied',
                            message: `Admin access required for this resource`,
                        });
                    }
                }

                // 3. Get user from database (Hospital staff)
                const user = await HospitalUser.findById(req.session.hospitalUserId);

                if (!user) {
                    return res.status(401).json({
                        success: false,
                        error: 'Unauthorized',
                        message: 'User not found',
                    });
                }

                // 4. Check if user has required role
                if (!roles.includes(user.role)) {
                    return res.status(403).json({
                        success: false,
                        error: 'Access Denied',
                        message: `This action requires one of the following roles: ${roles.join(', ')}`,
                    });
                }

                // Attach user info to request
                req.hospitalUser = {
                    userId: user._id,
                    username: user.username,
                    role: user.role,
                    name: user.name,
                    email: user.email,
                };

                next();
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    };
};

module.exports = {
    requireHospitalAuth,
    requireHospitalRole,
    bridgeHospitalAuth,
};
