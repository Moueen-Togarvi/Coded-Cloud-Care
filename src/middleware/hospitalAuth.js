const HospitalUser = require('../models/HospitalUser');

/**
 * Hospital PMS Authentication Middleware
 * Session-based authentication (compatible with existing Python frontend)
 */

/**
 * Middleware to check if user is logged in
 */
const requireHospitalAuth = (req, res, next) => {
    if (!req.session || !req.session.hospitalUserId) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Please login to access this resource',
        });
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
            // First check if user is logged in
            if (!req.session || !req.session.hospitalUserId) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                    message: 'Please login to access this resource',
                });
            }

            // Get user from database
            const user = await HospitalUser.findById(req.session.hospitalUserId);

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                    message: 'User not found',
                });
            }

            // Check if user has required role
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
};
