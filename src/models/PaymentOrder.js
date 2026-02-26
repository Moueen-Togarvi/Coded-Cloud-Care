const mongoose = require('mongoose');

/**
 * PaymentOrder Model
 * Tracks every payment attempt via PayFast.
 * Each order is linked to a user and a subscription product.
 */
const paymentOrderSchema = new mongoose.Schema(
    {
        // ─── User & Product Context ─────────────────────────────────────────────
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        productSlug: {
            type: String,
            required: true,
            enum: ['hospital-pms', 'pharmacy-pos', 'lab-reporting', 'quick-invoice', 'private-clinic-lite'],
        },
        planType: {
            type: String,
            required: true,
            enum: ['monthly', 'yearly'],
        },

        // ─── Financial Details ──────────────────────────────────────────────────
        amount: {
            type: Number,
            required: true,
            min: 1,
        },
        currency: {
            type: String,
            default: 'PKR',
            uppercase: true,
        },

        // ─── Order Identifiers ──────────────────────────────────────────────────
        internalOrderId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        basketId: {
            // PayFast calls this BASKET_ID
            type: String,
            required: true,
            unique: true,
        },

        // ─── PayFast Response Data ──────────────────────────────────────────────
        payfastAccessToken: {
            type: String, // The encrypted token returned by PayFast GetAccessToken
        },
        payfastTransactionId: {
            type: String, // Transaction ID from PayFast IPN callback
            index: true,
        },
        payfastResponseCode: {
            type: String, // e.g. '00' for success
        },

        // ─── Lifecycle Status ───────────────────────────────────────────────────
        status: {
            type: String,
            enum: ['pending', 'success', 'failed', 'cancelled', 'expired'],
            default: 'pending',
            index: true,
        },

        // ─── IPN Audit Trail ────────────────────────────────────────────────────
        ipnPayload: {
            type: mongoose.Schema.Types.Mixed, // Raw IPN data stored for dispute resolution
        },
        ipnReceivedAt: {
            type: Date,
        },

        // ─── Subscription Link ──────────────────────────────────────────────────
        subscriptionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subscription',
            default: null,
        },

        // ─── Expiry Guard ───────────────────────────────────────────────────────
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 30 * 60 * 1000), // 30-minute window
            index: { expireAfterSeconds: 0 }, // MongoDB TTL: auto-delete abandoned pending orders
        },
    },
    {
        timestamps: true,
    }
);

// ─── Compound Indexes ─────────────────────────────────────────────────────────
paymentOrderSchema.index({ userId: 1, status: 1 });
paymentOrderSchema.index({ basketId: 1, status: 1 });

// ─── Instance Methods ─────────────────────────────────────────────────────────
paymentOrderSchema.methods.isSuccessful = function () {
    return this.status === 'success';
};

paymentOrderSchema.methods.isPending = function () {
    return this.status === 'pending' && new Date() < this.expiresAt;
};

// ─── Static Methods ───────────────────────────────────────────────────────────
paymentOrderSchema.statics.findByBasketId = async function (basketId) {
    return this.findOne({ basketId }).populate('userId', 'email name');
};

const PaymentOrder = mongoose.model('PaymentOrder', paymentOrderSchema);

module.exports = PaymentOrder;
