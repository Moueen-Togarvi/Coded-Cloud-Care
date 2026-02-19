const express = require('express');
const Subscription = require('../models/Subscription');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

const VALID_PRODUCTS = [
    'hospital-pms',
    'pharmacy-pos',
    'lab-reporting',
    'quick-invoice',
    'private-clinic-lite',
];

const TRIAL_DAYS = 3;

/**
 * GET /api/subscriptions/my
 * Logged-in user ki saari subscriptions return karo
 */
router.get('/my', authenticate, async (req, res) => {
    try {
        const now = new Date();
        const subscriptions = await Subscription.find({ userId: req.user.userId }).sort({ createdAt: -1 });

        // Auto-expire
        const result = await Promise.all(
            subscriptions.map(async (sub) => {
                if (sub.status === 'active' && now > sub.endDate) {
                    sub.status = 'expired';
                    await sub.save();
                }
                return {
                    productSlug: sub.productSlug,
                    planType: sub.planType,
                    status: sub.status,
                    startDate: sub.startDate,
                    endDate: sub.endDate,
                    isAccessible: sub.status === 'active' && now < sub.endDate,
                };
            })
        );

        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch subscriptions', error: error.message });
    }
});

/**
 * POST /api/subscriptions/trial
 * Kisi product ka 3-day trial start karo (ek email pe sirf ek baar)
 * Body: { productSlug: 'hospital-pms' }
 */
router.post('/trial', authenticate, async (req, res) => {
    try {
        const { productSlug } = req.body;

        if (!productSlug || !VALID_PRODUCTS.includes(productSlug)) {
            return res.status(400).json({
                success: false,
                message: `Invalid product. Valid options: ${VALID_PRODUCTS.join(', ')}`,
            });
        }

        // Check: Kya is user ne pehle is product ka trial liya tha?
        const existing = await Subscription.findOne({
            userId: req.user.userId,
            productSlug,
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: `You have already used a trial for ${productSlug}.`,
                code: 'TRIAL_ALREADY_USED',
                currentStatus: existing.status,
                endDate: existing.endDate,
            });
        }

        // Trial create karo
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + TRIAL_DAYS);

        const subscription = await Subscription.create({
            userId: req.user.userId,
            productSlug,
            planType: 'trial',
            startDate,
            endDate,
            status: 'active',
        });

        res.status(201).json({
            success: true,
            message: `3-day free trial for ${productSlug} started!`,
            data: {
                productSlug: subscription.productSlug,
                planType: subscription.planType,
                status: subscription.status,
                endDate: subscription.endDate,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to start trial', error: error.message });
    }
});

module.exports = router;
