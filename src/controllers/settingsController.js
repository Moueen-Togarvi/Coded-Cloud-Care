const getSettings = async (req, res) => {
    try {
        const { Settings } = req.tenantModels;
        let settings = await Settings.findOne();

        if (!settings) {
            // Create default settings if none exist
            settings = await Settings.create({
                clinicName: 'My Pharmacy',
                clinicAddress: '',
                clinicPhone: '',
                clinicEmail: '',
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
        const updateData = req.body;
        console.log(`[Settings] Updating settings for tenant. Payload keys: ${Object.keys(updateData)}`);
        updateData.updatedAt = new Date();

        let settings = await Settings.findOneAndUpdate({}, updateData, {
            new: true,
            upsert: true,
            runValidators: true
        });

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
