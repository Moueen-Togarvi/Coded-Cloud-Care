const Subscription = require('../models/Subscription');

/**
 * checkSubscription(productSlug)
 *
 * Yeh middleware factory function hai.
 * Isko call karo kisi bhi productSlug ke saath:
 *   router.get('/dashboard', authenticate, checkSubscription('hospital-pms'), handler)
 *
 * Yeh check karta hai:
 *   1. User ka us product ka subscription exist karta hai?
 *   2. Status active hai?
 *   3. endDate future mein hai?
 *
 * Agar koi bhi condition fail → 403 return karta hai
 */
const checkSubscription = (productSlug) => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
            }

            const now = new Date();

            const subscription = await Subscription.findOne({
                userId: req.user.userId,
                productSlug: productSlug,
                status: 'active',
            });

            // Subscription nahi mili
            if (!subscription) {
                return res.status(403).json({
                    success: false,
                    message: `Access denied. No active subscription for ${productSlug}.`,
                    code: 'NO_SUBSCRIPTION',
                    productSlug,
                    action: 'start_trial', // frontend is button dikhaye
                });
            }

            // Subscription expire ho gayi
            if (now > subscription.endDate) {
                // Auto-expire karo
                subscription.status = 'expired';
                await subscription.save();

                return res.status(403).json({
                    success: false,
                    message: `Your ${productSlug} trial/subscription has expired.`,
                    code: 'SUBSCRIPTION_EXPIRED',
                    productSlug,
                    expiredAt: subscription.endDate,
                    action: 'upgrade', // frontend is button dikhaye
                });
            }

            // Access granted — subscription info request mein attach karo
            req.subscription = {
                productSlug: subscription.productSlug,
                planType: subscription.planType,
                status: subscription.status,
                endDate: subscription.endDate,
            };

            next();
        } catch (error) {
            console.error('checkSubscription error:', error);
            return res.status(500).json({
                success: false,
                message: 'Error checking subscription',
                error: error.message,
            });
        }
    };
};

module.exports = { checkSubscription };
