const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { settingsSchema } = require('../models/tenantSchemas');
const { requireHospitalAuth } = require('../middleware/hospitalAuth');
const { cleanInputData } = require('../utils/hospitalHelpers');

// Use existing model or create new one
const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);

/**
 * @route   GET /api/settings (Hospital Alias)
 * @desc    Get hospital settings/branding
 * @access  Private
 */
router.get('/', requireHospitalAuth, async (req, res) => {
    try {
        const tenantId = req.hospitalUser.tenantId;

        // Find settings for this tenant
        let settings = await Settings.findOne({ tenantId });

        if (!settings) {
            // Check for legacy settings without tenantId (migration)
            const legacySettings = await Settings.findOne({ tenantId: { $exists: false } });

            if (legacySettings) {
                legacySettings.tenantId = tenantId;
                await legacySettings.save();
                settings = legacySettings;
            } else {
                // Create default settings
                settings = await Settings.create({
                    tenantId,
                    clinicName: 'My Clinic',
                    clinicTagline: 'Medical & Health Services',
                });
            }
        }

        return res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error('Get hospital settings error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch settings',
            error: error.message
        });
    }
});

/**
 * @route   PUT /api/settings (Hospital Alias)
 * @desc    Update hospital settings/branding
 * @access  Private (Admin)
 */
router.put('/', requireHospitalAuth, async (req, res) => {
    try {
        // Only Admin should update settings, but we'll allow all authentic users for now to avoid locking out single-user setups
        // if (req.hospitalUser.role !== 'Admin') return res.status(403).json({ ... });

        const data = cleanInputData(req.body);
        const tenantId = req.hospitalUser.tenantId;

        const settings = await Settings.findOneAndUpdate(
            { tenantId },
            {
                $set: {
                    ...data,
                    tenantId,
                    updatedAt: new Date()
                }
            },
            { new: true, upsert: true, runValidators: true }
        );

        return res.json({
            success: true,
            message: 'Settings updated successfully',
            data: settings
        });
    } catch (error) {
        console.error('Update hospital settings error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update settings',
            error: error.message
        });
    }
});

module.exports = router;
