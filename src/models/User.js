const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
        },
        message: 'Please enter a valid email address',
      },
    },
    passwordHash: {
      type: String,
      required: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    contactInfo: {
      phone: {
        type: String,
        trim: true,
      },
      address: {
        type: String,
        trim: true,
      },
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },
    tenantDbName: {
      type: String,
      required: true,
      unique: true,
    },
    tenantDbUrl: {
      type: String,
      required: true,
    },
    subscriptionStatus: {
      type: String,
      enum: ['trial', 'active', 'expired', 'cancelled'],
      default: 'trial',
    },
    trialStartDate: {
      type: Date,
      default: Date.now,
    },
    trialEndDate: {
      type: Date,
      required: true,
    },
    productId: {
      type: String,
      required: true,
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

// Indexes for faster queries (critical for performance)
// Note: email and tenantDbName already have indexes via "unique: true" in schema
// Only add additional indexes here
userSchema.index({ subscriptionStatus: 1, isActive: 1 }); // Subscription filtering

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Method to check if trial has expired
userSchema.methods.isTrialExpired = function () {
  if (this.subscriptionStatus !== 'trial') {
    return false;
  }
  return new Date() > this.trialEndDate;
};

// Method to check if user has access (trial not expired or active subscription)
userSchema.methods.hasAccess = function () {
  if (!this.isActive) {
    return false;
  }

  if (this.subscriptionStatus === 'trial') {
    return !this.isTrialExpired();
  }

  return this.subscriptionStatus === 'active';
};

const User = mongoose.model('User', userSchema);

module.exports = User;
