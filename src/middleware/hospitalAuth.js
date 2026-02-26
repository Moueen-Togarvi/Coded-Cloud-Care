const HospitalUser = require('../models/HospitalUser');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { verifyToken } = require('../utils/jwt');

/**
 * Hospital PMS Authentication Middleware
 * Session-based authentication (compatible with existing Python frontend)
 */

/**
 * Middleware to check if user is logged in
 */
const requireHospitalAuth = async (req, res, next) => {
    await bridgeHospitalAuth(req, res, async () => {
        if (!req.session || !req.session.hospitalUserId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Please login to access this resource',
            });
        }

        // Fast path: use session data if available
        if (!req.hospitalUser) {
            if (req.session.hospitalTenantId && req.session.hospitalUsername) {
                req.hospitalUser = {
                    userId: req.session.hospitalUserId,
                    tenantId: req.session.hospitalTenantId,
                    username: req.session.hospitalUsername,
                    role: req.session.hospitalRole,
                    name: req.session.hospitalName || req.session.hospitalUsername,
                    isMasterUser: req.session.isMasterUser || false,
                };
            } else {
                // Slow path: fetch from DB
                if (req.session.isMasterUser) {
                    const user = await User.findById(req.session.hospitalUserId);
                    if (user) {
                        req.hospitalUser = {
                            userId: user._id,
                            tenantId: user._id,
                            username: user.email,
                            role: 'Admin',
                            name: user.companyName,
                            isMasterUser: true,
                        };
                    }
                } else {
                    const user = await HospitalUser.findById(req.session.hospitalUserId);
                    if (user) {
                        req.hospitalUser = {
                            userId: user._id,
                            tenantId: user.tenantId,
                            username: user.username,
                            role: user.role,
                            name: user.name,
                            email: user.email,
                            isMasterUser: false,
                        };
                    }
                }
            }
        }

        if (!req.hospitalUser) {
            return res.status(401).json({ success: false, error: 'User context lost' });
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

    // 2. Check for Master JWT Token (Cookies or Header)
    try {
        let token = null;
        if (req.cookies && req.cookies.authToken) {
            token = req.cookies.authToken;
        } else {
            const authHeader = req.headers.authorization || req.headers['x-auth-token'];
            if (authHeader) {
                token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
            }
        }

        if (token) {
            const decoded = verifyToken(token);
            const user = await User.findById(decoded.userId);

            if (user && user.isActive) {
                // IMPORTANT: Check if user has an active subscription for Hospital PMS
                const subscription = await Subscription.findOne({
                    userId: user._id,
                    productSlug: 'hospital-pms',
                    status: 'active',
                    endDate: { $gt: new Date() }
                });

                if (subscription) {
                    // Bridge to Hospital Session for Admin bypass
                    req.session.hospitalUserId = user._id.toString();
                    req.session.hospitalTenantId = user._id.toString(); // For Admin, tenantId is their own ID
                    req.session.hospitalUsername = user.email;
                    req.session.hospitalName = user.companyName;
                    req.session.hospitalRole = 'Admin';
                    req.session.isMasterUser = true;

                    req.hospitalUser = {
                        userId: user._id,
                        tenantId: user._id,
                        username: user.email,
                        role: 'Admin',
                        name: user.companyName,
                        isMasterUser: true,
                    };
                }
            }
        }
    } catch (error) {
        // Fall through quietly
        console.error('Bridge Auth Error:', error.message);
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
                        req.hospitalUser = {
                            userId: req.session.hospitalUserId,
                            tenantId: req.session.hospitalTenantId,
                            username: req.session.hospitalUsername,
                            role: 'Admin',
                            isMasterUser: true
                        };
                        return next();
                    } else {
                        return res.status(403).json({
                            success: false,
                            error: 'Access Denied',
                            message: `Admin access required for this resource`,
                        });
                    }
                }

                // 3. Fast path: check session for Hospital staff
                if (req.session.hospitalTenantId && req.session.hospitalUsername) {
                    req.hospitalUser = {
                        userId: req.session.hospitalUserId,
                        tenantId: req.session.hospitalTenantId,
                        username: req.session.hospitalUsername,
                        role: req.session.hospitalRole,
                        name: req.session.hospitalName || req.session.hospitalUsername,
                        isMasterUser: false
                    };
                } else {
                    // 3. Slow path: fetch from DB
                    const user = await HospitalUser.findById(req.session.hospitalUserId);
                    if (!user) {
                        return res.status(401).json({ success: false, error: 'Unauthorized', message: 'User not found' });
                    }
                    req.hospitalUser = {
                        userId: user._id,
                        tenantId: user.tenantId,
                        username: user.username,
                        role: user.role,
                        name: user.name,
                        email: user.email,
                        isMasterUser: false
                    };
                }

                // 4. Check if user has required role
                if (!roles.includes(req.hospitalUser.role)) {
                    return res.status(403).json({
                        success: false,
                        error: 'Access Denied',
                        message: `This action requires one of the following roles: ${roles.join(', ')}`,
                    });
                }

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
