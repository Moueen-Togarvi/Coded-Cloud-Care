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

        const staff = await Staff.find({ isActive: true })
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

        const staff = await Staff.findById(id);

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
        const { firstName, lastName, email, role, phone } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email) {
            return res.status(400).json({
                success: false,
                message: 'First name, last name, and email are required',
            });
        }

        // Check if email already exists in this tenant
        const existingStaff = await Staff.findOne({ email });
        if (existingStaff) {
            return res.status(400).json({
                success: false,
                message: 'Staff member with this email already exists',
            });
        }

        const staff = new Staff({
            firstName,
            lastName,
            email,
            role: role || 'staff',
            phone,
        });

        await staff.save();

        res.status(201).json({
            success: true,
            message: 'Staff member created successfully',
            data: staff,
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

        const staff = await Staff.findByIdAndUpdate(
            id,
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
        const { id } = req.params;

        const staff = await Staff.findByIdAndUpdate(
            id,
            { isActive: false, updatedAt: new Date() },
            { new: true }
        );

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Staff member not found',
            });
        }

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
