const mongoose = require('mongoose');
require('dotenv').config();
const Plan = require('../models/Plan');

/**
 * Seed the database with default payment plans
 */
const seedPlans = async () => {
  try {
    // Connect to master database
    await mongoose.connect(process.env.MONGO_MASTER_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✓ Connected to Master Database');

    // Check if plans already exist
    const existingPlans = await Plan.find();
    if (existingPlans.length > 0) {
      console.log('⚠ Plans already exist. Skipping seed...');
      console.log(`Found ${existingPlans.length} existing plans:`);
      existingPlans.forEach((plan) => {
        console.log(`  - ${plan.planName} (${plan.planType}): $${plan.price}/${plan.billingCycle}`);
      });
      await mongoose.connection.close();
      return;
    }

    // Define default plans
    const plans = [
      {
        planType: 'white-label',
        planName: 'White Label Partnership',
        price: 90000,
        billingCycle: 'monthly',
        features: [
          'Complete source code access',
          'Custom branding and domain',
          'Priority support',
          'Unlimited clients',
          'API access',
          'Custom feature development',
        ],
        trialDays: 3,
        isActive: true,
      },
      {
        planType: 'subscription',
        planName: 'Monthly Subscription',
        price: 55000,
        billingCycle: 'monthly',
        features: [
          'Full patient management system',
          'Appointment scheduling',
          'Staff management',
          'Reports and analytics',
          'Email support',
          'Regular updates',
        ],
        trialDays: 3,
        isActive: true,
      },
      {
        planType: 'one-time',
        planName: 'Lifetime License',
        price: 100000,
        billingCycle: 'once',
        features: [
          'One-time payment',
          'Lifetime access',
          'All core features',
          'Self-hosted option',
          'Basic support for 1 year',
          'Free updates for 1 year',
        ],
        trialDays: 3,
        isActive: true,
      },
      {
        planType: 'basic',
        planName: 'Basic Plan',
        price: 0,
        billingCycle: 'monthly',
        features: [
          'Basic patient records',
          'Single user access',
          'Community support',
        ],
        trialDays: 3,
        isActive: true,
      },
    ];

    // Insert plans
    const createdPlans = await Plan.insertMany(plans);

    console.log('\n✓ Successfully seeded plans:');
    createdPlans.forEach((plan) => {
      console.log(`  ✓ ${plan.planName} (${plan.planType})`);
      console.log(`    Price: $${plan.price}/${plan.billingCycle}`);
      console.log(`    Trial Days: ${plan.trialDays}`);
      console.log(`    Features: ${plan.features.length} features`);
      console.log('');
    });

    // Close connection
    await mongoose.connection.close();
    console.log('✓ Database connection closed');
  } catch (error) {
    console.error('✗ Error seeding plans:', error.message);
    process.exit(1);
  }
};

// Run seeder
seedPlans();
