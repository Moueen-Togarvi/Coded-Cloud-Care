const mongoose = require('mongoose');

/**
 * Subscription Model — Har product ke liye alag subscription track karta hai
 * Ek user ke paas multiple subscriptions ho sakti hain (alag alag products ke liye)
 */
const subscriptionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        productSlug: {
            type: String,
            required: true,
            enum: ['hospital-pms', 'pharmacy-pos', 'lab-reporting', 'quick-invoice', 'private-clinic-lite'],
        },
        planType: {
            type: String,
            enum: ['trial', 'monthly', 'yearly'],
            default: 'trial',
        },
        startDate: {
            type: Date,
            default: Date.now,
        },
        endDate: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: ['active', 'expired', 'cancelled'],
            default: 'active',
        },
    },
    {
        timestamps: true,
    }
);

// Index for fast lookup: userId + productSlug
subscriptionSchema.index({ userId: 1, productSlug: 1 });
subscriptionSchema.index({ status: 1, endDate: 1 });

// Method: check karo subscription abhi bhi active hai ya nahi
subscriptionSchema.methods.isAccessible = function () {
    if (this.status !== 'active') return false;
    return new Date() < this.endDate;
};

// Static method: user ka kisi product ka active subscription find karo
subscriptionSchema.statics.findActive = async function (userId, productSlug) {
    const sub = await this.findOne({ userId, productSlug, status: 'active' });
    if (!sub) return null;
    // Agar endDate guzar gayi ho to status update karo
    if (new Date() > sub.endDate) {
        sub.status = 'expired';
        await sub.save();
        return null;
    }
    return sub;
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;
