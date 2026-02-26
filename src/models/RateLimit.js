const mongoose = require('mongoose');

const rateLimitSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    count: {
        type: Number,
        default: 0
    },
    windowStart: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// TTL index to automatically remove old rate limit records (e.g., after 24 hours)
rateLimitSchema.index({ windowStart: 1 }, { expireAfterSeconds: 86400 });

/**
 * Check and update rate limit for a given key
 * @param {string} key 
 * @param {number} maxAttempts 
 * @param {number} windowMs 
 * @returns {Promise<{allowed: boolean, remaining: number, resetTime: Date}>}
 */
rateLimitSchema.statics.checkLimit = async function (key, maxAttempts, windowMs) {
    const now = new Date();
    let limit = await this.findOne({ key });

    if (!limit || (now - limit.windowStart) > windowMs) {
        // Reset or create new window
        limit = await this.findOneAndUpdate(
            { key },
            { count: 1, windowStart: now },
            { upsert: true, new: true }
        );
    } else {
        // Increment within existing window
        limit.count += 1;
        await limit.save();
    }

    const resetTime = new Date(limit.windowStart.getTime() + windowMs);
    const allowed = limit.count <= maxAttempts;

    return {
        allowed,
        remaining: Math.max(0, maxAttempts - limit.count),
        resetTime
    };
};

const RateLimit = mongoose.model('RateLimit', rateLimitSchema);

module.exports = RateLimit;
