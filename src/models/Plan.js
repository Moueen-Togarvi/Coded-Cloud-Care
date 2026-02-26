const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    planType: {
      type: String,
      enum: ['white-label', 'subscription', 'one-time', 'basic'],
      required: true,
    },
    productSlug: {
      type: String,
      enum: ['hospital-pms', 'pharmacy-pos', 'lab-reporting', 'quick-invoice', 'private-clinic-lite', 'general'],
      default: 'general',
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
planSchema.index({ productSlug: 1, planType: 1, billingCycle: 1, isActive: 1 });
planSchema.index({ planType: 1, isActive: 1 });

const Plan = mongoose.model('Plan', planSchema);

module.exports = Plan;
