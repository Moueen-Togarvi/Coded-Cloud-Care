/**
 * Staff Controller
 * Handles CRUD operations for staff members in tenant databases
 */

/**
 * Get all staff members for the authenticated tenant
 */
const getAllStaff = async (req, res) => {
    try {
        const Staff = req.tenantModels.Staff;

        const staff = await Staff.find({ tenantId: req.user.userId, isActive: true })
            .sort({ createdAt: -1 })
            .select('-__v');

        res.status(200).json({
            success: true,
            count: staff.length,
            data: staff,
        });
    } catch (error) {
        console.error('Get staff error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch staff',
            error: error.message,
        });
    }
};

/**
 * Get a single staff member by ID
 */
const getStaffById = async (req, res) => {
    try {
        const Staff = req.tenantModels.Staff;
        const { id } = req.params;

        const staff = await Staff.findOne({ _id: id, tenantId: req.user.userId });

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Staff member not found',
            });
        }

        res.status(200).json({
            success: true,
            data: staff,
        });
    } catch (error) {
        console.error('Get staff error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch staff member',
            error: error.message,
        });
    }
};

/**
 * Create a new staff member
 */
const createStaff = async (req, res) => {
    try {
        const Staff = req.tenantModels.Staff;
        const User = require('../models/User');
        const { firstName, lastName, email, role, phone, password } = req.body;
        const normalizedEmail = String(email || '').trim().toLowerCase();

        // Validate required fields
        if (!firstName || !lastName || !normalizedEmail) {
            return res.status(400).json({
                success: false,
                message: 'First name, last name, and email are required',
            });
        }
        if (password && String(password).length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long when provided',
            });
        }

        // Check if email already exists in this tenant (Staff collection)
        const existingStaff = await Staff.findOne({ email: normalizedEmail, tenantId: req.user.userId });
        if (existingStaff) {
            return res.status(400).json({
                success: false,
                message: 'Staff member with this email already exists',
            });
        }

        // Check if email already exists in main User collection
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'A user with this email already exists in the system',
            });
        }

        // 1) Create staff profile inside tenant DB
        const staff = new Staff({
            tenantId: req.user.userId,
            firstName,
            lastName,
            email: normalizedEmail,
            role: role || 'staff',
            phone,
        });
        await staff.save();

        // 2) Best-effort master login account provisioning (optional)
        let loginProvisioned = false;
        const warnings = [];
        if (password) {
            const ownerUser = await User.findById(req.user.userId).select('companyName tenantDbName tenantDbUrl');
            if (!ownerUser) {
                warnings.push('Tenant owner account not found; login account was not provisioned.');
            } else {
                try {
                    const staffUser = new User({
                        email: normalizedEmail,
                        passwordHash: password,
                        companyName: ownerUser.companyName,
                        contactInfo: {
                            phone: phone || '',
                            address: '',
                        },
                        termsAccepted: true,
                        tenantDbName: ownerUser.tenantDbName,
                        tenantDbUrl: ownerUser.tenantDbUrl,
                        role: 'staff',
                        isActive: true,
                        is_verified: true,
                    });
                    await staffUser.save();
                    loginProvisioned = true;
                } catch (provisionError) {
                    if (provisionError.code === 11000 && String(provisionError.message).includes('tenantDbName')) {
                        warnings.push('Staff profile created, but login provisioning is disabled by current User tenantDbName uniqueness constraints.');
                    } else {
                        warnings.push(`Staff profile created, but login provisioning failed: ${provisionError.message}`);
                    }
                }
            }
        }

        res.status(201).json({
            success: true,
            message: 'Staff member created successfully',
            data: {
                id: staff._id,
                firstName: staff.firstName,
                lastName: staff.lastName,
                email: staff.email,
                role: staff.role,
                phone: staff.phone,
                loginProvisioned,
            },
            warnings: warnings.length ? warnings : undefined,
        });
    } catch (error) {
        console.error('Create staff error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create staff member',
            error: error.message,
        });
    }
};

/**
 * Update a staff member
 */
const updateStaff = async (req, res) => {
    try {
        const Staff = req.tenantModels.Staff;
        const { id } = req.params;
        const updateData = req.body;

        // Update the updatedAt timestamp
        updateData.updatedAt = new Date();

        const staff = await Staff.findOneAndUpdate(
            { _id: id, tenantId: req.user.userId },
            updateData,
            { new: true, runValidators: true }
        );

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Staff member not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Staff member updated successfully',
            data: staff,
        });
    } catch (error) {
        console.error('Update staff error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update staff member',
            error: error.message,
        });
    }
};

/**
 * Delete a staff member (soft delete)
 */
const deleteStaff = async (req, res) => {
    try {
        const Staff = req.tenantModels.Staff;
        const User = require('../models/User');
        const { id } = req.params;

        // 1. Deactivate in Staff collection
        const staff = await Staff.findOneAndUpdate(
            { _id: id, tenantId: req.user.userId },
            { isActive: false, updatedAt: new Date() },
            { new: true }
        );

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Staff member not found',
            });
        }

        // 2. Deactivate in main User collection to revoke login access
        await User.findOneAndUpdate(
            { email: staff.email, tenantDbName: req.user.tenantDbName },
            { isActive: false }
        );

        res.status(200).json({
            success: true,
            message: 'Staff member deleted successfully',
        });
    } catch (error) {
        console.error('Delete staff error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete staff member',
            error: error.message,
        });
    }
};

module.exports = {
    getAllStaff,
    getStaffById,
    createStaff,
    updateStaff,
    deleteStaff,
};
