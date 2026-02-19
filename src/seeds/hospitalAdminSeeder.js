const { connectMasterDB } = require('../config/database');
const HospitalUser = require('../models/HospitalUser');

/**
 * Seed initial admin users for Hospital PMS
 * Run this script once to create default admin accounts
 */

const seedAdminUsers = async () => {
    try {
        console.log('Connecting to Hospital PMS database...');
        await connectMasterDB();

        // Check if any users exist
        const userCount = await HospitalUser.countDocuments({});

        if (userCount > 0) {
            console.log(`✓ Hospital PMS already has ${userCount} user(s). Skipping seed.`);
            process.exit(0);
        }

        console.log('Creating initial admin users...');

        // Create Admin 1 - Mudasir
        const admin1 = new HospitalUser({
            username: process.env.ADMIN1_USERNAME || 'mudasir',
            password: process.env.ADMIN1_PASSWORD || 'password123',
            role: 'Admin',
            name: process.env.ADMIN1_NAME || 'Mudasir',
            email: `${process.env.ADMIN1_USERNAME || 'mudasir'}@example.com`,
        });
        await admin1.save();
        console.log(`✓ Created admin user: ${admin1.username}`);

        // Create Admin 2 - Tayyab
        const admin2 = new HospitalUser({
            username: process.env.ADMIN2_USERNAME || 'tayyab',
            password: process.env.ADMIN2_PASSWORD || 'password123',
            role: 'Admin',
            name: process.env.ADMIN2_NAME || 'Tayyab',
            email: `${process.env.ADMIN2_USERNAME || 'tayyab'}@example.com`,
        });
        await admin2.save();
        console.log(`✓ Created admin user: ${admin2.username}`);

        console.log('\n✓ Hospital PMS admin users created successfully!');
        console.log('\nDefault credentials:');
        console.log('  Username: mudasir | Password: password123');
        console.log('  Username: tayyab  | Password: password123');
        console.log('\n⚠️  Please change these passwords in production!\n');

        process.exit(0);
    } catch (error) {
        console.error('Error seeding admin users:', error);
        process.exit(1);
    }
};

seedAdminUsers();
