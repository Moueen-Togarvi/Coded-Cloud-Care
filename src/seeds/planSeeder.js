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

    // For this migration, we want to update the plans. 
    // We'll clear existing plans and re-seed to ensure consistency.
    console.log('⚠ Clearing existing plans...');
    await Plan.deleteMany({});

    const products = [
      'hospital-pms',
      'pharmacy-pos',
      'lab-reporting',
      'quick-invoice',
      'private-clinic-lite'
    ];

    const plans = [];

    // Add Monthly and Yearly plans for each product
    products.forEach(product => {
      const productName = product.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

      // Monthly Plan
      plans.push({
        productSlug: product,
        planType: 'subscription',
        planName: `${productName} Monthly`,
        price: 20000,
        billingCycle: 'monthly',
        features: [
          `Full ${productName} features`,
          'Standard support',
          'Regular updates',
          'Cloud storage'
        ],
        trialDays: 3,
        isActive: true,
      });

      // Yearly Plan
      plans.push({
        productSlug: product,
        planType: 'subscription',
        planName: `${productName} Yearly`,
        price: 210000,
        billingCycle: 'yearly',
        features: [
          `Full ${productName} features`,
          'Priority support',
          'Regular updates',
          'Cloud storage',
          'Discounted annual rate'
        ],
        trialDays: 3,
        isActive: true,
      });
    });

    // Add Global Plans (White Label and Basic)
    plans.push(
      {
        productSlug: 'general',
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
        productSlug: 'general',
        planType: 'basic',
        planName: 'Basic Free Plan',
        price: 0,
        billingCycle: 'monthly',
        features: [
          'Basic features access',
          'Single user access',
          'Community support',
        ],
        trialDays: 3,
        isActive: true,
      }
    );

    // Insert plans
    const createdPlans = await Plan.insertMany(plans);

    console.log(`\n✓ Successfully seeded ${createdPlans.length} plans.`);

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
