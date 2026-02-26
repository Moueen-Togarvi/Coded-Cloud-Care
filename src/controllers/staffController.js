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
        const User = require('../models/User'); // Import User model
        const { firstName, lastName, email, role, phone, password } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'First name, last name, email, and password are required',
            });
        }

        // Check if email already exists in this tenant (Staff collection)
        const existingStaff = await Staff.findOne({ email, tenantId: req.user.userId });
        if (existingStaff) {
            return res.status(400).json({
                success: false,
                message: 'Staff member with this email already exists',
            });
        }

        // Check if email already exists in main User collection
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'A user with this email already exists in the system',
            });
        }

        // 1. Create Staff record in tenant context
        const staff = new Staff({
            tenantId: req.user.userId,
            firstName,
            lastName,
            email,
            role: role || 'staff',
            phone,
        });

        await staff.save();

        // 2. Create User record in main collection for login access
        const staffUser = new User({
            email,
            passwordHash: password, // Will be hashed by pre-save hook
            companyName: req.user.companyName, // Inherit from creator
            contactInfo: {
                phone: phone || '',
                address: '',
            },
            tenantDbName: req.user.tenantDbName, // Link to same tenant
            tenantDbUrl: req.user.tenantDbUrl || '',
            role: 'staff',
            isActive: true,
            is_verified: true, // Auto-verify staff created by admin
        });

        await staffUser.save();

        res.status(201).json({
            success: true,
            message: 'Staff member created successfully',
            data: {
                id: staff._id,
                firstName: staff.firstName,
                lastName: staff.lastName,
                email: staff.email,
                role: staff.role,
                phone: staff.phone
            },
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
        const User = require('../models/User'); // Import User model
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
            { email: staff.email },
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
