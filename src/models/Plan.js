const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    planType: {
      type: String,
      enum: ['white-label', 'subscription', 'one-time', 'basic'],
      required: true,
      unique: true,
    },
    planName: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly', 'once'],
      required: true,
    },
    features: {
      type: [String],
      default: [],
    },
    trialDays: {
      type: Number,
      default: 3,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
planSchema.index({ planType: 1, isActive: 1 });

const Plan = mongoose.model('Plan', planSchema);

module.exports = Plan;
