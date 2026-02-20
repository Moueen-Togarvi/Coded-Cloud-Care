const mongoose = require('mongoose');

const getSettings = async (req, res) => {
    try {
        const { Settings } = req.tenantModels;
        const tenantId = new mongoose.Types.ObjectId(req.user.userId);

        // Try to find settings specific to this tenant
        let settings = await Settings.findOne({ tenantId });

        if (!settings) {
            // Create default settings if none exist because we use a single DB now.
            settings = await Settings.create({
                tenantId: tenantId,
                clinicName: req.user.companyName || 'My Clinic',
                clinicAddress: '',
                clinicPhone: '',
                clinicEmail: req.user.email || '',
                pharmacyName: req.user.companyName ? `${req.user.companyName} Pharmacy` : 'My Pharmacy',
                pharmacyEmail: req.user.email || ''
            });
        }

        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch settings',
            error: error.message
        });
    }
};

const updateSettings = async (req, res) => {
    try {
        const { Settings } = req.tenantModels;
        const tenantId = new mongoose.Types.ObjectId(req.user.userId);

        const settings = await Settings.findOneAndUpdate(
            { tenantId: tenantId },
            { $set: { ...req.body, tenantId: tenantId, updatedAt: new Date() } },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Settings updated successfully',
            data: settings
        });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update settings',
            error: error.message
        });
    }
};

module.exports = {
    getSettings,
    updateSettings
};
