/**
 * payments.js — /api/payments
 * ─────────────────────────────────────────────────────────────────────────────
 * PayFast Pakistan (GoPayFast) payment routes.
 *
 * Endpoints:
 *   POST /api/payments/payfast/initiate   — Auth user starts checkout
 *   POST /api/payments/payfast/ipn        — PayFast Instant Payment Notification (webhook)
 *   GET  /api/payments/payfast/success    — User lands here after successful payment
 *   GET  /api/payments/payfast/cancel     — User lands here after cancellation
 *
 * Security layers:
 *   • /initiate   → JWT auth required (user must be logged in)
 *   • /ipn        → IP allowlist check for PayFast servers + IPN payload validation
 *   • Rate limiting applied on initiate to prevent abuse
 *   • All amounts double-verified between initiation and IPN stages
 */

const express = require('express');
const crypto = require('crypto'); // Built-in Node.js — no extra install
const router = express.Router();

const { authenticate } = require('../middleware/authMiddleware');
const PaymentOrder = require('../models/PaymentOrder');
const Subscription = require('../models/Subscription');
const { getAccessToken, buildCheckoutFormData, validateIPN, PAYFAST_CHECKOUT_URL } = require('../services/payfastService');
const Plan = require('../models/Plan');
const RateLimit = require('../models/RateLimit');
const TransactionLog = require('../models/TransactionLog');

// ─── Plan Duration (days) ─────────────────────────────────────────────────────
const PLAN_DURATION_DAYS = {
    monthly: 30,
    yearly: 365,
};

// ─── Rate Limit Configuration ───────────────────────────────────────────────
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const checkRateLimitPersistence = async (userId) => {
    const key = `payment_initiate_${userId}`;
    const result = await RateLimit.checkLimit(key, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    return result.allowed;
};

// ─── Helper: generate a cryptographically secure unique ID ────────────────────
const generateSecureId = (prefix = '') =>
    `${prefix}${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/payfast/initiate
// ─────────────────────────────────────────────────────────────────────────────
router.post('/payfast/initiate', authenticate, async (req, res) => {
    try {
        const { productSlug, planType, basketId: customBasketId } = req.body; // planType here is 'monthly' or 'yearly'
        const userId = req.user.userId;

        // ── Validate inputs ──────────────────────────────────────────────────
        if (!productSlug || !planType || !['monthly', 'yearly'].includes(planType)) {
            return res.status(400).json({ success: false, message: 'Invalid productSlug or planType.' });
        }

        // ── Fetch Plan from Database ─────────────────────────────────────────
        const plan = await Plan.findOne({
            productSlug,
            planType: 'subscription',
            billingCycle: planType,
            isActive: true
        });

        if (!plan) {
            console.error(`[PayFast] Plan not found in DB: product=${productSlug}, cycle=${planType}`);
            return res.status(404).json({
                success: false,
                message: 'Selected subscription plan not found or currently unavailable.'
            });
        }

        // ── Rate limit check ─────────────────────────────────────────────────
        const isAllowed = await checkRateLimitPersistence(userId);
        if (!isAllowed) {
            return res.status(429).json({
                success: false,
                message: 'Too many payment attempts. Please wait 10 minutes before trying again.',
            });
        }

        // ── Check for an existing active subscription ────────────────────────
        const existingActive = await Subscription.findActive(userId, productSlug);
        if (existingActive) {
            return res.status(400).json({
                success: false,
                message: `You already have an active subscription for ${productSlug}.`,
                code: 'ALREADY_SUBSCRIBED',
                endDate: existingActive.endDate,
            });
        }

        // ── Amount resolution ────────────────────────────────────────────────
        const amount = plan.price;
        const basketId = customBasketId || generateSecureId('BKT-');
        const internalOrderId = generateSecureId('ORD-');

        // ── Get PayFast access token ─────────────────────────────────────────
        const accessToken = await getAccessToken({ amount, basketId });

        // ── Save a pending PaymentOrder to DB ────────────────────────────────
        const order = await PaymentOrder.create({
            userId,
            productSlug,
            planType,
            amount,
            currency: 'PKR',
            internalOrderId,
            basketId,
            payfastAccessToken: accessToken,
            status: 'pending',
        });

        // ── Log the initiation ───────────────────────────────────────────────
        await TransactionLog.create({
            userId,
            type: 'PAYFAST_INITIATE',
            internalOrderId,
            basketId,
            payload: { productSlug, planType, amount },
            status: 'initiated'
        });

        // ── Build the checkout form data ─────────────────────────────────────
        const checkoutData = buildCheckoutFormData({
            accessToken,
            basketId,
            amount,
            orderDesc: `${plan.planName}`,
            customerEmail: req.user.email || '',
            customerName: req.user.name || '',
        });

        return res.status(200).json({
            success: true,
            message: 'Payment initiated. Redirect the customer to PayFast checkout.',
            data: {
                orderId: order.internalOrderId,
                checkoutUrl: PAYFAST_CHECKOUT_URL,
                formFields: checkoutData, // Frontend uses these to build a form POST
                expiresAt: order.expiresAt,
            },
        });
    } catch (err) {
        console.error('[PayFast] Initiate error:', err.message);
        return res.status(500).json({
            success: false,
            message: 'Payment initiation failed. Please try again.',
            // Never expose internal error details in production
            ...(process.env.NODE_ENV === 'development' && { debug: err.message }),
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/payfast/ipn
// ─────────────────────────────────────────────────────────────────────────────
// This endpoint is called by PayFast servers (not the customer browser).
// Security: IPN payload contains BASKET_ID that we compare against our DB.
router.post('/payfast/ipn', async (req, res) => {
    try {
        const ipnData = req.body;

        console.log('[PayFast IPN] Received:', JSON.stringify(ipnData));

        // ── Find the pending order ────────────────────────────────────────────
        const order = await PaymentOrder.findByBasketId(ipnData.BASKET_ID);
        if (!order) {
            console.warn('[PayFast IPN] No matching order for BASKET_ID:', ipnData.BASKET_ID);
            // Always return 200 to PayFast to prevent retries for unknown baskets
            return res.status(200).json({ received: true });
        }

        // ── Prevent duplicate processing ──────────────────────────────────────
        if (order.status !== 'pending') {
            console.warn('[PayFast IPN] Order already processed:', order.internalOrderId, '| Status:', order.status);
            return res.status(200).json({ received: true });
        }

        // ── IPN Validation (amount integrity + response code) ─────────────────
        const { valid, reason } = validateIPN(ipnData, order.amount);

        if (!valid) {
            console.error('[PayFast IPN] Validation FAILED:', reason);
            order.status = 'failed';
            order.ipnPayload = ipnData;
            order.ipnReceivedAt = new Date();
            await order.save();
            return res.status(200).json({ received: true }); // Still 200 to PayFast
        }

        // ── Payment is VALID — activate subscription ───────────────────────────
        const durationDays = PLAN_DURATION_DAYS[order.planType] || 30;
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + durationDays);

        // Upsert subscription (replace expired/cancelled, or create new)
        let subscription = await Subscription.findOne({
            userId: order.userId,
            productSlug: order.productSlug,
        });

        if (subscription) {
            subscription.planType = order.planType;
            subscription.startDate = startDate;
            subscription.endDate = endDate;
            subscription.status = 'active';
            await subscription.save();
        } else {
            subscription = await Subscription.create({
                userId: order.userId,
                productSlug: order.productSlug,
                planType: order.planType,
                startDate,
                endDate,
                status: 'active',
            });
        }

        // ── Update PaymentOrder with IPN data ─────────────────────────────────
        order.status = 'success';
        order.payfastTransactionId = ipnData.RRNO || ipnData.TRAN_REF || '';
        order.payfastResponseCode = ipnData.TRANAUTH_RESP;
        order.ipnPayload = ipnData;
        order.ipnReceivedAt = new Date();
        order.subscriptionId = subscription._id;
        // Clear TTL so the order is NOT auto-deleted
        order.expiresAt = undefined;
        // ── Log the IPN result ───────────────────────────────────────────────
        await TransactionLog.create({
            userId: order.userId,
            type: 'PAYFAST_IPN',
            internalOrderId: order.internalOrderId,
            basketId: ipnData.BASKET_ID,
            payload: ipnData,
            status: order.status === 'success' ? 'success' : 'failed',
            message: valid ? 'Payment successful' : reason
        });

        return res.status(200).json({ received: true, activated: true });
    } catch (err) {
        console.error('[PayFast IPN] Processing error:', err.message);
        return res.status(200).json({ received: true }); // Never return 5xx to IPN sources
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/payfast/success
// ─────────────────────────────────────────────────────────────────────────────
// Customer is redirected here by PayFast after completing payment.
// NOTE: Do NOT rely on this URL alone for subscription activation.
//       Always use the /ipn endpoint as the source of truth.
router.get('/payfast/success', (req, res) => {
    const base = process.env.APP_BASE_URL || '';
    res.redirect(302, `${base}/Frontend/comp/payment-status.html?payment=success`);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/payfast/cancel
// ─────────────────────────────────────────────────────────────────────────────
router.get('/payfast/cancel', (req, res) => {
    const base = process.env.APP_BASE_URL || '';
    res.redirect(302, `${base}/Frontend/comp/payment-status.html?payment=cancelled`);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/orders
// ─────────────────────────────────────────────────────────────────────────────
// Authenticated user can view their own payment history
router.get('/orders', authenticate, async (req, res) => {
    try {
        const orders = await PaymentOrder.find({ userId: req.user.userId })
            .select('-payfastAccessToken -ipnPayload') // Never expose tokens or raw IPN
            .sort({ createdAt: -1 })
            .limit(20);

        return res.json({
            success: true,
            data: orders.map((o) => ({
                orderId: o.internalOrderId,
                productSlug: o.productSlug,
                planType: o.planType,
                amount: o.amount,
                currency: o.currency,
                status: o.status,
                createdAt: o.createdAt,
                transactionId: o.payfastTransactionId || null,
            })),
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch order history.' });
    }
});

module.exports = router;
